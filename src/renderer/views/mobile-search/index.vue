<template>
  <div class="mobile-search-page">
    <div class="search-header" :class="{ 'safe-area-top': hasSafeArea }">
      <div class="header-back" @click="goBack">
        <i class="ri-arrow-left-s-line"></i>
      </div>
      <div class="search-input-wrapper">
        <i class="ri-search-line search-icon"></i>
        <input
          ref="searchInputRef"
          v-model="searchValue"
          type="text"
          class="search-input"
          :placeholder="hotSearchKeyword"
          @input="handleInput"
          @keydown.enter="handleSearch"
        />
        <i v-if="searchValue" class="ri-close-circle-fill clear-icon" @click="clearSearch"></i>
      </div>
      <div class="search-button" @click="handleSearch">Search</div>
    </div>

    <div class="search-types">
      <div
        v-for="type in searchTypes"
        :key="type.key"
        class="type-tag"
        :class="{ active: searchType === type.key }"
        @click="selectType(type.key)"
      >
        {{ type.label }}
      </div>
    </div>

    <div class="search-content">
      <div v-if="suggestions.length > 0" class="search-section">
        <div class="section-title">Search Suggestions</div>
        <div class="suggestion-list">
          <div
            v-for="(item, index) in suggestions"
            :key="index"
            class="suggestion-item"
            @click="selectSuggestion(item)"
          >
            <i class="ri-search-line"></i>
            <span>{{ item }}</span>
          </div>
        </div>
      </div>

      <div v-else-if="searchHistory.length > 0" class="search-section">
        <div class="section-header">
          <span class="section-title">Search History</span>
          <span class="clear-history" @click="clearHistory">Clear</span>
        </div>
        <div class="history-tags">
          <div
            v-for="(item, index) in searchHistory"
            :key="index"
            class="history-tag"
            @click="selectSuggestion(item)"
          >
            {{ item }}
          </div>
        </div>
      </div>

      <div v-if="hotSearchList.length > 0 && !searchValue" class="search-section">
        <div class="section-title">Hot Searches</div>
        <div class="hot-list">
          <div
            v-for="(item, index) in hotSearchList"
            :key="index"
            class="hot-item"
            @click="selectSuggestion(item.searchWord)"
          >
            <span class="hot-rank" :class="{ top: index < 3 }">{{ index + 1 }}</span>
            <span class="hot-word">{{ item.searchWord }}</span>
            <span v-if="item.iconUrl" class="hot-icon">
              <img :src="item.iconUrl" alt="" />
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core';
import { computed, inject, nextTick, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { getHotSearch, getSearchKeyword } from '@/api/home';
import { getSearchSuggestions } from '@/api/search';
import { SEARCH_TYPES } from '@/const/bar-const';
import { useSearchStore } from '@/store/modules/search';

const router = useRouter();
const searchStore = useSearchStore();

const hasSafeArea = inject('hasSafeArea', false);

const searchValue = ref('');
const searchInputRef = ref<HTMLInputElement | null>(null);

const hotSearchKeyword = ref('Search music, singers, playlists');

const searchType = ref(searchStore.searchType || 1);
const searchTypes = computed(() => {
  // eslint-disable-next-line no-undef
  locale.value;
  return SEARCH_TYPES.map((type) => ({
    // eslint-disable-next-line no-undef
    label: t(type.label),
    key: type.key
  }));
});

const suggestions = ref<string[]>([]);

const HISTORY_KEY = 'mobile_search_history';
const searchHistory = ref<string[]>([]);

const hotSearchList = ref<any[]>([]);

const loadHotSearchKeyword = async () => {
  try {
    const { data } = await getSearchKeyword();
    hotSearchKeyword.value = data.data.showKeyword;
  } catch (e) {
    console.error('Failed to load popular search keywords:', e);
  }
};

const loadHotSearchList = async () => {
  try {
    const { data } = await getHotSearch();
    hotSearchList.value = data.data || [];
  } catch (e) {
    console.error('Failed to load popular searches:', e);
  }
};

const loadSearchHistory = () => {
  try {
    const history = localStorage.getItem(HISTORY_KEY);
    searchHistory.value = history ? JSON.parse(history) : [];
  } catch (e) {
    console.error('Failed to load search history:', e);
    searchHistory.value = [];
  }
};

const saveSearchHistory = (keyword: string) => {
  if (!keyword.trim()) return;

  const history = searchHistory.value.filter((item) => item !== keyword);
  history.unshift(keyword);

  searchHistory.value = history.slice(0, 20);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(searchHistory.value));
};

const clearHistory = () => {
  searchHistory.value = [];
  localStorage.removeItem(HISTORY_KEY);
};

const debouncedGetSuggestions = useDebounceFn(async (keyword: string) => {
  if (!keyword.trim()) {
    suggestions.value = [];
    return;
  }
  suggestions.value = await getSearchSuggestions(keyword);
}, 300);

const handleInput = () => {
  debouncedGetSuggestions(searchValue.value);
};

const clearSearch = () => {
  searchValue.value = '';
  suggestions.value = [];
};

const selectType = (type: number) => {
  searchType.value = type;
  searchStore.searchType = type;
};

const selectSuggestion = (keyword: string) => {
  searchValue.value = keyword;
  handleSearch();
};

const handleSearch = () => {
  const keyword = searchValue.value.trim();
  if (!keyword) return;

  saveSearchHistory(keyword);

  router.push({
    path: '/mobile-search-result',
    query: {
      keyword,
      type: searchType.value
    }
  });
};

const goBack = () => {
  router.back();
};

onMounted(() => {
  loadHotSearchKeyword();
  loadHotSearchList();
  loadSearchHistory();
  nextTick(() => {
    searchInputRef.value?.focus();
  });
});
</script>

<style lang="scss" scoped>
.mobile-search-page {
  @apply fixed inset-0 z-50;
  @apply bg-light dark:bg-black;
  @apply flex flex-col;
}

.search-header {
  @apply flex items-center gap-3 pl-1 pr-3 py-3;
  @apply border-b border-gray-100 dark:border-gray-800;

  &.safe-area-top {
    padding-top: calc(var(--safe-area-inset-top, 0px) + 12px);
  }
}

.header-back {
  @apply flex items-center justify-center;
  @apply w-8 h-8 rounded-full text-2xl;
  @apply text-gray-600 dark:text-gray-300;
  @apply active:bg-gray-100 dark:active:bg-gray-800;
}

.search-input-wrapper {
  @apply flex-1 flex items-center gap-2;
  @apply bg-gray-100 dark:bg-gray-800 rounded-full;
  @apply px-4 py-1;
}

.search-icon {
  @apply text-gray-400 text-lg;
}

.search-input {
  @apply flex-1 bg-transparent border-none outline-none;
  @apply text-gray-900 dark:text-white text-base;

  &::placeholder {
    @apply text-gray-400;
  }
}

.clear-icon {
  @apply text-gray-400 text-lg cursor-pointer;
}

.search-types {
  @apply flex gap-2 px-4 py-3 overflow-x-auto;
  @apply border-b border-gray-100 dark:border-gray-800;

  &::-webkit-scrollbar {
    display: none;
  }
}

.type-tag {
  @apply px-4 py-1.5 rounded-full text-sm whitespace-nowrap;
  @apply bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300;
  @apply transition-colors duration-200;

  &.active {
    @apply text-primary text-white;
  }
}

.search-content {
  @apply flex-1 overflow-y-auto px-4 py-3;
}

.search-section {
  @apply mb-6;
}

.section-header {
  @apply flex items-center justify-between mb-3;
}

.section-title {
  @apply text-sm font-medium text-gray-500 dark:text-gray-400 mb-3;
}

.clear-history {
  @apply text-sm text-gray-400 dark:text-gray-500;
}

.suggestion-list {
  @apply space-y-1;
}

.suggestion-item {
  @apply flex items-center gap-3 py-3;
  @apply text-gray-700 dark:text-gray-200;
  @apply active:bg-gray-50 dark:active:bg-gray-800;

  i {
    @apply text-gray-400;
  }
}

.history-tags {
  @apply flex flex-wrap gap-2;
}

.history-tag {
  @apply px-3 py-1.5 rounded-full text-sm;
  @apply bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300;
  @apply active:bg-gray-200 dark:active:bg-gray-700;
}

.hot-list {
  @apply space-y-1;
}

.hot-item {
  @apply flex items-center gap-3 py-2.5;
  @apply active:bg-gray-50 dark:active:bg-gray-800;
}

.hot-rank {
  @apply w-5 text-center text-sm font-medium text-gray-400;

  &.top {
    @apply text-red-500;
  }
}

.hot-word {
  @apply flex-1 text-gray-700 dark:text-gray-200;
}

.hot-icon {
  img {
    @apply h-4;
  }
}
</style>
