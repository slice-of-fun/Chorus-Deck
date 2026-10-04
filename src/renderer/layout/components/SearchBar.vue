<template>
  <div class="flex items-center gap-2 pb-4 pr-4 pl-1">
    <transition name="tab-slide">
      <div
        v-if="!isSearchExpanded && !showBackButton"
        class="tabs-track flex-shrink-0"
        ref="tabsTrackRef"
      >
        <div class="tab-slider-bg" :style="sliderStyle" />
        <button
          v-for="(tab, i) in tabs"
          :key="tab.key"
          :ref="(el) => setTabRef(el as HTMLElement, i)"
          class="tab-btn"
          :class="isTabActive(tab.path) ? 'tab-btn--on' : 'tab-btn--off'"
          @click="router.push(tab.path)"
        >
          <i :class="tab.icon" />
          <span>{{ tab.label }}</span>
        </button>
      </div>

      <div v-else-if="showBackButton" class="flex items-center gap-2 flex-shrink-0">
        <button class="back-btn" @click="goBack">
          <i class="ri-arrow-left-line" />
        </button>
        <transition name="nav-title">
          <span v-if="navTitleStore.isVisible && !isSearchExpanded" class="nav-page-title">
            {{ navTitleStore.title }}
          </span>
        </transition>
      </div>
    </transition>

    <div v-if="!isSearchExpanded" class="flex-1" />

    <div class="search-wrap" :class="isSearchExpanded ? 'search-wrap--open' : 'search-wrap--idle'">
      <n-popover
        trigger="manual"
        placement="bottom-end"
        :show="showSuggestions"
        :show-arrow="false"
        style="margin-top: 6px"
        content-style="padding:0;border-radius:12px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,0.12);"
        raw
      >
        <template #trigger>
          <div class="search-inner" :class="{ 'search-inner--focus': inputFocused }">
            <i class="ri-search-line search-icon-glyph" />
            <input
              ref="inputRef"
              v-model="searchValue"
              class="search-input"
              :placeholder="hotSearchKeyword"
              @input="handleInput(searchValue)"
              @keydown="handleKeydown"
              @focus="handleFocus"
              @blur="handleBlur"
            />
            <n-dropdown
              v-if="searchTypeOptions.length && isSearchExpanded"
              trigger="hover"
              :options="searchTypeOptions"
              @select="selectSearchType"
              @mousedown.prevent
            >
              <div class="type-chip" @mousedown.prevent>
                <span>{{
                  searchTypeOptions.find((i) => i.key === searchStore.searchType)?.label
                }}</span>
                <i class="ri-arrow-down-s-fill text-[10px]" />
              </div>
            </n-dropdown>
          </div>
        </template>
        <div class="suggestions-box">
          <n-scrollbar style="max-height: 260px">
            <div v-if="suggestionsLoading" class="suggest-loading">
              <n-spin size="small" />
            </div>
            <div
              v-for="(s, i) in suggestions"
              :key="i"
              class="suggest-row"
              :class="{ 'suggest-row--hi': i === highlightedIndex }"
              @mousedown.prevent="selectSuggestion(s)"
              @mouseenter="highlightedIndex = i"
            >
              <i class="ri-search-line suggest-icon" />
              <span>{{ s }}</span>
            </div>
          </n-scrollbar>
        </div>
      </n-popover>
    </div>

    <button v-if="showDownloadButton" class="action-btn" @click="navigateToDownloads">
      <n-badge :value="downloadingCount" :max="99" :show="downloadingCount > 0" :offset="[-2, 2]">
        <i class="ri-download-cloud-2-line" />
      </n-badge>
    </button>

    <n-popover trigger="hover" placement="bottom-end" :show-arrow="false" raw>
      <template #trigger>
        <div class="user-btn">
          <i class="ri-settings-3-fill settings-icon" />
        </div>
      </template>
      <div class="user-menu">
        <div class="menu-list">
          <div class="menu-row" @click="selectItem('set')">
            <i class="ri-settings-3-line" /><span>Settings</span>
          </div>
          <div v-if="isDesktop()" class="menu-row">
            <i class="ri-zoom-in-line" /><span>Zoom</span>
            <div class="zoom-ctrl ml-auto">
              <button class="zoom-btn" @click.stop="decreaseZoom">
                <i class="ri-subtract-line" />
              </button>
              <n-tooltip trigger="hover">
                <template #trigger>
                  <span
                    class="zoom-val"
                    :class="{ 'zoom-val--100': isZoom100() }"
                    @click.stop="resetZoom"
                  >
                    {{ Math.round(zoomFactor * 100) }}%
                  </span>
                </template>
                {{ isZoom100() ? 'Zoom 100%' : 'Reset Zoom' }}
              </n-tooltip>
              <button class="zoom-btn" @click.stop="increaseZoom"><i class="ri-add-line" /></button>
            </div>
          </div>
          <div class="menu-row">
            <i :class="isDark ? 'ri-moon-line' : 'ri-sun-line'" />
            <span>Theme</span>
            <n-switch v-model:value="isDark" class="ml-auto" size="small">
              <template #checked><i class="ri-moon-line text-[10px]" /></template>
              <template #unchecked><i class="ri-sun-line text-[10px]" /></template>
            </n-switch>
          </div>
          <div class="menu-row" @click="restartApp">
            <i class="ri-restart-line" /><span>Restart</span>
          </div>
          <div class="menu-row" @click="selectItem('refresh')">
            <i class="ri-refresh-line" /><span>Refresh</span>
          </div>
          <div class="menu-sep" />
          <div class="menu-row">
            <i class="ri-github-fill" /><span>Current Version</span>
            <span class="ver-chip ml-auto">{{ updateInfo.currentVersion }}</span>
            <n-tag v-if="updateInfo.hasUpdate" type="success" size="small" class="ml-1">New</n-tag>
          </div>
        </div>
      </div>
    </n-popover>
  </div>
</template>

<script lang="ts" setup>
import { useDebounceFn } from '@vueuse/core';
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import type { SearchFilter } from '@/api/provider';
import { getProvider } from '@/api/providers';
import { SEARCH_TYPES } from '@/const/bar-const';
import { useZoom } from '@/hooks/useZoom';
import { useDownloadStore } from '@/store/modules/download';
import { useNavTitleStore } from '@/store/modules/navTitle';
import { useSearchStore } from '@/store/modules/search';
import { useSettingsStore } from '@/store/modules/settings';
import { getImgUrl, isDesktop } from '@/utils';
import { locale, t } from '@/utils/i18n';
import { checkUpdate, UpdateResult } from '@/utils/update';

import config from '../../../../package.json';

const router = useRouter();
const route = useRoute();
const navTitleStore = useNavTitleStore();
const searchStore = useSearchStore();
const settingsStore = useSettingsStore();
const downloadStore = useDownloadStore();
const downloadingCount = computed(() => downloadStore.downloadingCount);
const navigateToDownloads = () => {
  router.push('/downloads');
};
const showDownloadButton = computed(
  () =>
    isDesktop() && (settingsStore.setData?.alwaysShowDownloadButton || downloadingCount.value > 0)
);
const { zoomFactor, initZoomFactor, increaseZoom, decreaseZoom, resetZoom, isZoom100 } = useZoom();

const showBackButton = computed(() => {
  const meta = router.currentRoute.value.meta;
  if (!settingsStore.isCompact && meta.isCompact === false) return false;
  return meta.back === true;
});
const goBack = () => router.back();

const tabs = computed(() => {
  const items = [
    { key: 'home', label: 'Home', path: '/', icon: 'ri-home-4-fill' },
    { key: 'playlist', label: 'Playlist', path: '/list', icon: 'ri-play-list-2-fill' },
    { key: 'album', label: 'Albums', path: '/album', icon: 'ri-album-fill' },
    {
      key: 'charts',
      label: 'Charts',
      path: '/toplist',
      icon: 'ri-bar-chart-grouped-fill'
    },

    {
      key: 'localMusic',
      label: 'Local Music',
      path: '/local-music',
      icon: 'ri-folder-music-fill',
      desktopOnly: true
    }
  ];
  return items.filter((tab) => !tab.desktopOnly || isDesktop());
});
const isTabActive = (path: string) => route.path === path;

const tabsTrackRef = ref<HTMLElement | null>(null);
const tabElsRef = ref<HTMLElement[]>([]);
const setTabRef = (el: HTMLElement, i: number) => {
  if (el) tabElsRef.value[i] = el;
};
const activeTabIndex = computed(() => tabs.value.findIndex((t) => isTabActive(t.path)));
const sliderStyle = computed(() => {
  const el = tabElsRef.value[activeTabIndex.value];
  if (!el) return { opacity: '0' };
  return {
    transform: `translateX(${el.offsetLeft}px)`,
    width: `${el.offsetWidth}px`,
    opacity: '1'
  };
});

const isSearchExpanded = ref(false);
const inputFocused = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);

const handleFocus = () => {
  inputFocused.value = true;
  isSearchExpanded.value = true;
  if (searchValue.value && suggestions.value.length) showSuggestions.value = true;
};
const handleBlur = () => {
  inputFocused.value = false;
  setTimeout(() => {
    showSuggestions.value = false;
    isSearchExpanded.value = false;
  }, 150);
};

const hotSearchKeyword = ref('Search for something...');

const searchValue = ref('');

watch(
  () => searchStore.searchValue,
  (v) => {
    if (v) searchValue.value = v;
  },
  { immediate: true }
);

const search = () => {
  const val = searchValue.value;
  if (!val) {
    return;
  }
  const q = { keyword: val, type: searchStore.searchType };
  if (router.currentRoute.value.path === '/search-result') {
    searchStore.searchValue = val;
    router.replace({ path: '/search-result', query: q });
  } else {
    router.push({ path: '/search-result', query: q });
  }
  showSuggestions.value = false;
};

const selectSearchType = (key: SearchFilter) => {
  searchStore.searchType = key;
  if (searchValue.value)
    router.push({ path: '/search-result', query: { keyword: searchValue.value, type: key } });
  nextTick(() => inputRef.value?.focus());
};

const rawSearchTypes = ref(SEARCH_TYPES);
const searchTypeOptions = computed(() => {
  locale.value;
  return rawSearchTypes.value
    .filter(() => isDesktop())

    .map((type) => ({ label: t(type.label), key: type.key }));
});

const suggestions = ref<string[]>([]);
const showSuggestions = ref(false);
const suggestionsLoading = ref(false);
const highlightedIndex = ref(-1);

let lastSuggestKeyword = '';
const debouncedSuggest = useDebounceFn(async (kw: string) => {
  if (!kw.trim()) {
    suggestions.value = [];
    showSuggestions.value = false;
    return;
  }
  lastSuggestKeyword = kw;
  suggestionsLoading.value = true;
  const provider = getProvider();
  const result = await provider.getSuggestions(kw);

  if (kw !== lastSuggestKeyword) {
    return;
  }
  suggestions.value = result;
  suggestionsLoading.value = false;
  showSuggestions.value = suggestions.value.length > 0;
  highlightedIndex.value = -1;
}, 300);

const handleInput = (v: string) => debouncedSuggest(v);

const selectSuggestion = (s: string) => {
  searchValue.value = s;
  showSuggestions.value = false;
  search();
};

const handleKeydown = (e: KeyboardEvent) => {
  const len = suggestions.value.length;
  if (!showSuggestions.value || !len) {
    if (e.key === 'Enter') search();
    return;
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    highlightedIndex.value = (highlightedIndex.value + 1) % len;
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    highlightedIndex.value = (highlightedIndex.value - 1 + len) % len;
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    highlightedIndex.value >= 0
      ? selectSuggestion(suggestions.value[highlightedIndex.value])
      : search();
  }
  if (e.key === 'Escape') {
    showSuggestions.value = false;
  }
};

const restartApp = () => window.api.send('restart');

const isDark = computed({
  get: () => settingsStore.theme === 'dark',
  set: () => settingsStore.toggleTheme()
});

const selectItem = (key: string) => {
  switch (key) {
    case 'set':
      router.push('/set');
      break;
    case 'refresh':
      window.location.reload();
      break;
  }
};

const updateInfo = ref<UpdateResult>({
  hasUpdate: false,
  latestVersion: '',
  currentVersion: config.version,
  releaseInfo: null
});
const checkForUpdates = async () => {
  try {
    const r = await checkUpdate(config.version);
    if (r) updateInfo.value = r;
  } catch (e) {
    void e;
  }
};

onMounted(() => {
  checkForUpdates();
  isDesktop() && initZoomFactor();
});
</script>

<style scoped>
.tabs-track {
  position: relative;
  display: inline-flex;
  align-items: center;
  height: 34px;
  background: #f3f4f6;
  border-radius: 9999px;
  padding: 3px;
  gap: 0;
  box-sizing: border-box;
}
.dark .tabs-track {
  background: #1f2937;
}

.tab-slider-bg {
  position: absolute;
  top: 3px;
  left: 0;
  height: calc(100% - 6px);
  border-radius: 9999px;
  background: rgb(var(--color-primary));
  box-shadow: 0 1px 6px rgba(34, 197, 94, 0.35);
  transition:
    transform 0.28s cubic-bezier(0.34, 1.4, 0.64, 1),
    width 0.28s cubic-bezier(0.34, 1.4, 0.64, 1);
  pointer-events: none;
  z-index: 0;
}

.tab-btn {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 13px;
  border-radius: 9999px;
  font-size: 12.5px;
  font-weight: 600;
  border: none;
  background: transparent;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.2s;
}
.tab-btn--on {
  color: #fff;
}
.tab-btn--off {
  color: #6b7280;
}
.dark .tab-btn--off {
  color: #9ca3af;
}
.tab-btn--off:hover {
  color: #111827;
}
.dark .tab-btn--off:hover {
  color: #f9fafb;
}

.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 9999px;
  border: 1px solid #e5e7eb;
  background: transparent;
  color: #6b7280;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.15s;
}
.dark .back-btn {
  border-color: #374151;
  color: #9ca3af;
}
.back-btn:hover {
  color: rgb(var(--color-primary));
  border-color: rgb(var(--color-primary));
}

.search-wrap {
  transition:
    flex 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    max-width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.search-wrap--idle {
  flex: 0 0 240px;
  max-width: 240px;
}
.search-wrap--open {
  flex: 1 1 0%;
  max-width: 9999px;
}

.search-inner {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 10px;
  border-radius: 9999px;
  border: 1.5px solid #e5e7eb;
  background: #f9fafb;
  transition:
    border-color 0.2s,
    background 0.2s,
    box-shadow 0.2s;
}
.dark .search-inner {
  border-color: #374151;
  background: #111827;
}
.search-inner--focus {
  border-color: rgb(var(--color-primary));
  background: #fff;
}
.dark .search-inner--focus {
  background: #0a0a0a;
}

.search-icon-glyph {
  font-size: 14px;
  color: #9ca3af;
  flex-shrink: 0;
  transition: color 0.2s;
}
.search-inner--focus .search-icon-glyph {
  color: rgb(var(--color-primary));
}

.search-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 13px;
  color: #111827;
}
.dark .search-input {
  color: #f3f4f6;
}
.search-input::placeholder {
  color: #9ca3af;
}

.type-chip {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 2px 7px;
  border-radius: 6px;
  background: #f3f4f6;
  font-size: 11px;
  font-weight: 500;
  color: #6b7280;
  cursor: pointer;
  white-space: nowrap;
  transition:
    background 0.15s,
    color 0.15s;
  flex-shrink: 0;
}
.dark .type-chip {
  background: #1f2937;
  color: #9ca3af;
}
.type-chip:hover {
  background: #dcfce7;
  color: #16a34a;
}
.dark .type-chip:hover {
  background: rgba(34, 197, 94, 0.1);
  color: rgb(var(--color-primary));
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 9999px;
  border: 1px solid #e5e7eb;
  background: transparent;
  color: #6b7280;
  font-size: 15px;
  cursor: pointer;
  transition: all 0.15s;
}
.dark .action-btn {
  border-color: #374151;
  color: #9ca3af;
}
.action-btn:hover {
  color: rgb(var(--color-primary));
  border-color: #bbf7d0;
  background: #f0fdf4;
}
.dark .action-btn:hover {
  border-color: #166534;
  background: rgba(34, 197, 94, 0.08);
  color: rgb(var(--color-primary));
}

.user-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  padding: 2px;
  border-radius: 9999px;
  border: 1px solid #e5e7eb;
  background: transparent;
  cursor: pointer;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}
.dark .user-btn {
  border-color: #374151;
}
.user-btn:hover {
  border-color: rgb(var(--color-primary));
  box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.12);
}

.login-label {
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  padding: 0 8px;
}
.dark .login-label {
  color: #9ca3af;
}

.user-menu {
  min-width: 220px;
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
  border: 1px solid #f3f4f6;
  box-shadow:
    0 4px 20px rgba(0, 0, 0, 0.1),
    0 1px 4px rgba(0, 0, 0, 0.05);
}
.dark .user-menu {
  background: #111827;
  border-color: #1f2937;
}

.user-menu-top {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 12px 14px 10px;
  cursor: pointer;
  transition: background 0.15s;
}
.user-menu-top:hover {
  background: #f9fafb;
}
.dark .user-menu-top:hover {
  background: #1f2937;
}

.user-name {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dark .user-name {
  color: #f3f4f6;
}

.menu-sep {
  height: 1px;
  background: #f3f4f6;
  margin: 2px 0;
}
.dark .menu-sep {
  background: #1f2937;
}

.menu-list {
  padding: 3px 0 5px;
}

.menu-row {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 14px;
  font-size: 13px;
  color: #374151;
  cursor: pointer;
  transition: background 0.12s;
}
.dark .menu-row {
  color: #d1d5db;
}
.menu-row:hover {
  background: #f9fafb;
}
.dark .menu-row:hover {
  background: #1f2937;
}

.menu-row i {
  font-size: 15px;
  color: #9ca3af;
  flex-shrink: 0;
  width: 16px;
  text-align: center;
}

.zoom-ctrl {
  display: flex;
  align-items: center;
  gap: 3px;
}
.zoom-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: none;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 10px;
  cursor: pointer;
  transition: all 0.12s;
}
.zoom-btn:hover {
  background: #dcfce7;
  color: #16a34a;
}
.zoom-val {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  background: #f3f4f6;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.12s;
}
.zoom-val--100 {
  background: #dcfce7;
  color: #16a34a;
}
.ver-chip {
  font-size: 11px;
  font-weight: 500;
  padding: 1px 6px;
  border-radius: 5px;
  background: #f3f4f6;
  color: #6b7280;
}
.dark .ver-chip {
  background: #1f2937;
  color: #9ca3af;
}

.suggestions-box {
  background: #fff;
}
.dark .suggestions-box {
  background: #111827;
}

.suggest-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  font-size: 13px;
  color: #374151;
  cursor: pointer;
  transition: background 0.1s;
}
.dark .suggest-row {
  color: #d1d5db;
}
.suggest-row:hover,
.suggest-row--hi {
  background: #f0fdf4;
  color: #16a34a;
}
.dark .suggest-row:hover,
.dark .suggest-row--hi {
  background: rgba(34, 197, 94, 0.06);
  color: rgb(var(--color-primary));
}
.suggest-icon {
  font-size: 13px;
  color: #9ca3af;
  flex-shrink: 0;
}
.suggest-loading {
  display: flex;
  justify-content: center;
  padding: 12px;
}

.nav-page-title {
  font-size: 15px;
  font-weight: 700;
  color: #111827;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 280px;
  letter-spacing: -0.01em;
}
.dark .nav-page-title {
  color: #f9fafb;
}

.tab-slide-enter-active,
.tab-slide-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.tab-slide-enter-from,
.tab-slide-leave-to {
  opacity: 0;
  transform: translateX(-8px);
}

.nav-title-enter-active {
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}
.nav-title-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}
.nav-title-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.nav-title-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
