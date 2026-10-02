<template>
  <compact-layout v-if="isPhone && !settingsStore.setData?.tabletMode" :is-phone="isPhone" />

  <div v-else-if="settingsStore.isCompact" class="layout-page compact">
    <div id="layout-main" class="layout-main">
      <title-bar />
      <div class="layout-main-page">
        <div class="main">
          <div class="main-content compact-content">
            <router-view
              v-slot="{ Component }"
              class="main-page"
              :class="route.meta.noScroll ? 'pr-3' : ''"
            >
              <keep-alive :include="keepAliveInclude">
                <component :is="Component" />
              </keep-alive>
            </router-view>
          </div>
          <app-sidebar :menus="menuStore.menus" />
        </div>
      </div>

      <compact-play-bar v-show="isPlay" />
    </div>
    <update-modal v-if="isDesktop()" />
    <queue />
  </div>

  <div v-else class="layout-page">
    <div id="layout-main" class="layout-main">
      <title-bar />

      <div class="shell">
        <div class="shell-row">
          <div class="shell-surface shell-sidebar">
            <app-sidebar :menus="menuStore.menus" />
          </div>
          <div class="shell-surface shell-main">
            <div class="main-viewport">
              <router-view
                v-slot="{ Component }"
                class="main-page"
                :class="{ 'no-scroll': route.meta.noScroll }"
              >
                <keep-alive :include="keepAliveInclude">
                  <component :is="Component" />
                </keep-alive>
              </router-view>
            </div>
          </div>

          <queue />
        </div>
      </div>
      <play-bar v-if="!settingsStore.isMiniMode" v-show="isPlay" />
    </div>
    <update-modal v-if="isDesktop()" />
    <sleep-timer-top />
  </div>
</template>

<script lang="ts" setup>
import { computed, defineAsyncComponent, onMounted, provide, ref } from 'vue';
import { useRoute } from 'vue-router';

import UpdateModal from '@/components/common/UpdateModal.vue';
import SleepTimerTop from '@/components/player/SleepTimerTop.vue';
import homeRouter from '@/router/home';
import otherRouter from '@/router/other';
import { useMenuStore } from '@/store/modules/menu';
import { usePlayerStore } from '@/store/modules/player';
import { useSettingsStore } from '@/store/modules/settings';
import { isDesktop } from '@/utils';

import CompactLayout from './CompactLayout.vue';
import AppSidebar from './components/AppSidebar.vue';
import TitleBar from './components/TitleBar.vue';

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
const Queue = defineAsyncComponent(() => import('@/components/player/Queue.vue'));

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
/*
 * Outer application canvas. Its colour is what shows through every
 * shell gap, so it must stay distinct from the shell surfaces.
 */
.layout-page {
  @apply w-screen h-screen overflow-hidden;
  background-color: var(--shell-canvas, #fff);
}

.layout-main {
  @apply w-full h-full relative flex flex-col text-gray-900 dark:text-white;
}

.layout-main-page {
  @apply flex h-full;
}

/*
 * Shell canvas: owns the top/bottom/right outer insets via padding and
 * the vertical Main/Queue -> Player gap. `gap` collapses to 0 whenever a
 * surface is display:none, so gaps appear and disappear with their surface.
 */
.shell {
  @apply flex flex-col flex-1 min-h-0;
  gap: var(--shell-gap);
  padding: var(--shell-gap);
}

/* Sidebar / Main / Queue share one row and one horizontal gap. */
.shell-row {
  @apply flex flex-1 min-h-0;
  gap: var(--shell-gap);
}

/* Major shell surfaces: independent, rounded, never touching. */
.shell-surface {
  background-color: var(--shell-surface, #fff);
  border-radius: var(--shell-radius);
}

.shell-sidebar {
  @apply flex-shrink-0 self-stretch min-h-0;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.shell-main {
  @apply flex-1 min-w-0 flex flex-col overflow-hidden;
}

.main {
  @apply overflow-hidden flex-1 flex flex-col;
}

.main-viewport {
  @apply flex-1 min-h-0 overflow-auto;
}

.main-page {
  @apply h-full;
}

.main-page.no-scroll {
  @apply overflow-hidden;
}

/* Apply internal content padding to the page content inside MainSurface. */
.main-page > * {
  padding: var(--content-padding-y) var(--content-padding-x);
  box-sizing: border-box;
  height: 100%;
  min-height: 100%;
  overflow: auto;
}

.main-page.no-scroll > * {
  overflow: hidden;
}

.menu {
  @apply h-full bg-light dark:bg-black;
}

/* Legacy desktop-compact branch: preserved geometry. */
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
