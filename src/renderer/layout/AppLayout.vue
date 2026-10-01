<template>
  <compact-layout v-if="isPhone && !settingsStore.setData?.tabletMode" :is-phone="isPhone" />

  <div v-else class="layout-page" :class="{ compact: settingsStore.isCompact }">
    <div id="layout-main" class="layout-main">
      <title-bar />
      <div class="layout-main-page">
        <app-menu v-if="!settingsStore.isCompact" class="menu" :menus="menuStore.menus" />
        <div class="main">
          <div
            class="main-content"
            :native-scrollbar="false"
            :class="{ 'compact-content': !shouldShowCompactMenu }"
          >
            <router-view
              v-slot="{ Component }"
              class="main-page"
              :class="route.meta.noScroll && !settingsStore.isCompact ? 'pr-3' : ''"
            >
              <keep-alive :include="keepAliveInclude">
                <component :is="Component" />
              </keep-alive>
            </router-view>
          </div>
          <play-bottom />

          <app-menu v-if="shouldShowCompactMenu" class="menu compact-menu" :menus="menuStore.menus" />
        </div>
      </div>

      <template v-if="!settingsStore.isMiniMode">
        <play-bar
          v-if="!settingsStore.isCompact"
          v-show="isPlay"
          :style="playerStore.musicFull ? 'bottom: 0;' : ''"
        />
        <compact-play-bar
          v-else
          v-show="isPlay"
          :style="settingsStore.isCompact && playerStore.musicFull ? 'bottom: 0;' : ''"
        />
      </template>
    </div>
    <update-modal v-if="isDesktop()" />
    <sleep-timer-top v-if="!settingsStore.isCompact" />

    <queue />
  </div>
</template>

<script lang="ts" setup>
import { computed, defineAsyncComponent, onMounted, provide, ref } from 'vue';
import { useRoute } from 'vue-router';

import PlayBottom from '@/components/common/PlayBottom.vue';
import UpdateModal from '@/components/common/UpdateModal.vue';
import SleepTimerTop from '@/components/player/SleepTimerTop.vue';
import homeRouter from '@/router/home';
import otherRouter from '@/router/other';
import { useMenuStore } from '@/store/modules/menu';
import { usePlayerStore } from '@/store/modules/player';
import { useSettingsStore } from '@/store/modules/settings';
import { isDesktop } from '@/utils';

import AppMenu from './components/AppMenu.vue';
import TitleBar from './components/TitleBar.vue';
import CompactLayout from './CompactLayout.vue';

const keepAliveInclude = computed(() => {
  const allRoutes = [...homeRouter, ...otherRouter];

  return allRoutes
    .filter((item) => {
      return item.meta?.keepAlive;
    })
    .map((item) => {
      return typeof item.name === 'string'
        ? item.name.charAt(0).toUpperCase() + item.name.slice(1)
        : '';
    })
    .filter(Boolean);
});

const PlayBar = defineAsyncComponent(() => import('@/components/player/PlayBar.vue'));
const CompactPlayBar = defineAsyncComponent(() => import('@/components/player/CompactPlayBar.vue'));
const Queue = defineAsyncComponent(
  () => import('@/components/player/Queue.vue')
);

const playerStore = usePlayerStore();
const settingsStore = useSettingsStore();
const menuStore = useMenuStore();

const isPlay = computed(() => playerStore.playMusic && playerStore.playMusic.id);
const route = useRoute();

const shouldShowCompactMenu = computed(() => {
  const menuPaths = menuStore.menus.map((item: any) => item.path);

  return menuPaths.includes(route.path) && settingsStore.isCompact && !playerStore.musicFull;
});

provide('shouldShowCompactMenu', shouldShowCompactMenu);

const isPhone = computed(() => settingsStore.isCompact);

onMounted(() => {
  settingsStore.initializeSettings();
  settingsStore.initializeTheme();
});
</script>

<style lang="scss" scoped>
.layout-page {
  @apply w-screen h-screen overflow-hidden bg-light dark:bg-black;
}

.layout-main {
  @apply w-full h-full relative text-gray-900 dark:text-white;
}

.layout-main-page {
  @apply flex h-full;
}

.menu {
  @apply h-full bg-light dark:bg-black;
}

.main {
  @apply overflow-hidden flex-1 flex flex-col;
}

.main-content {
  @apply flex-1 overflow-hidden;
}

.main-page {
  @apply h-full;
}

.compact {
  .main-content {
    height: calc(100vh - 130px);
    overflow: auto;
    display: block;
    flex: none;
    position: relative;
  }

  .compact-content {
    height: calc(100vh - 75px);
    position: relative;
  }
}
</style>
