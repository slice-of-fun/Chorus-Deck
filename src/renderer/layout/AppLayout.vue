<template>
  <mobile-layout v-if="isPhone && !settingsStore.setData?.tabletMode" :is-phone="isPhone" />

  <div v-else class="layout-page" :class="{ mobile: settingsStore.isMobile }">
    <div id="layout-main" class="layout-main">
      <title-bar />
      <div class="layout-main-page">
        <app-menu v-if="!settingsStore.isMobile" class="menu" :menus="menuStore.menus" />
        <div class="main">
          <div
            class="main-content"
            :native-scrollbar="false"
            :class="{ 'mobile-content': !shouldShowMobileMenu }"
          >
            <router-view
              v-slot="{ Component }"
              class="main-page"
              :class="route.meta.noScroll && !settingsStore.isMobile ? 'pr-3' : ''"
            >
              <keep-alive :include="keepAliveInclude">
                <component :is="Component" />
              </keep-alive>
            </router-view>
          </div>
          <play-bottom />

          <app-menu v-if="shouldShowMobileMenu" class="menu mobile-menu" :menus="menuStore.menus" />
        </div>
      </div>

      <template v-if="!settingsStore.isMiniMode">
        <play-bar
          v-if="!settingsStore.isMobile"
          v-show="isPlay"
          :style="playerStore.musicFull ? 'bottom: 0;' : ''"
        />
        <mobile-play-bar
          v-else
          v-show="isPlay"
          :style="settingsStore.isMobile && playerStore.musicFull ? 'bottom: 0;' : ''"
        />
      </template>
    </div>
    <update-modal v-if="isElectron" />
    <sleep-timer-top v-if="!settingsStore.isMobile" />

    <playing-list-drawer />
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
import { isElectron } from '@/utils';

import AppMenu from './components/AppMenu.vue';
import TitleBar from './components/TitleBar.vue';
import MobileLayout from './MobileLayout.vue';

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
const MobilePlayBar = defineAsyncComponent(() => import('@/components/player/MobilePlayBar.vue'));
const PlayingListDrawer = defineAsyncComponent(
  () => import('@/components/player/PlayingListDrawer.vue')
);

const playerStore = usePlayerStore();
const settingsStore = useSettingsStore();
const menuStore = useMenuStore();

const isPlay = computed(() => playerStore.playMusic && playerStore.playMusic.id);
const route = useRoute();

const shouldShowMobileMenu = computed(() => {
  const menuPaths = menuStore.menus.map((item: any) => item.path);

  return menuPaths.includes(route.path) && settingsStore.isMobile && !playerStore.musicFull;
});

provide('shouldShowMobileMenu', shouldShowMobileMenu);

const isPhone = computed(() => settingsStore.isMobile);

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

.mobile {
  .main-content {
    height: calc(100vh - 130px);
    overflow: auto;
    display: block;
    flex: none;
    position: relative;
  }

  .mobile-content {
    height: calc(100vh - 75px);
    position: relative;
  }
}
</style>
