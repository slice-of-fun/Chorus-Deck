<template>
  <div id="layout-main" class="mobile-layout mobile" :class="{ 'has-safe-area': isPhone }">
    <mobile-header />

    <div
      class="mobile-content"
      :class="{ 'has-bottom-menu': shouldShowBottomMenu, 'has-player': isPlay }"
    >
      <router-view v-slot="{ Component }" class="mobile-page">
        <keep-alive :include="keepAliveInclude">
          <component :is="Component" />
        </keep-alive>
      </router-view>
    </div>

    <mobile-play-bar v-if="isPlay" />

    <div v-if="shouldShowBottomMenu" class="mobile-bottom-menu">
      <app-menu class="mobile-menu" :menus="menuStore.menus" />
    </div>

    <playing-list-drawer />
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, provide, ref } from 'vue';
import { useRoute } from 'vue-router';

import homeRouter from '@/router/home';
import otherRouter from '@/router/other';
import { useMenuStore } from '@/store/modules/menu';
import { usePlayerStore } from '@/store/modules/player';

import AppMenu from './components/AppMenu.vue';
import MobileHeader from './components/MobileHeader.vue';
const MobilePlayBar = defineAsyncComponent(() => import('@/components/player/MobilePlayBar.vue'));
const PlayingListDrawer = defineAsyncComponent(
  () => import('@/components/player/PlayingListDrawer.vue')
);

const props = defineProps<{
  isPhone: boolean;
}>();

const route = useRoute();
const playerStore = usePlayerStore();
const menuStore = useMenuStore();

provide('hasSafeArea', props.isPhone);

const isPlay = computed(() => playerStore.playMusic && playerStore.playMusic.id);

const shouldShowBottomMenu = computed(() => {
  const menuPaths = menuStore.menus.map((item: any) => item.path);
  return menuPaths.includes(route.path) && !playerStore.musicFull;
});

provide('shouldShowMobileMenu', shouldShowBottomMenu);

const keepAliveInclude = computed(() => {
  const allRoutes = [...homeRouter, ...otherRouter];
  return allRoutes
    .filter((item) => item.meta?.keepAlive)
    .map((item) =>
      typeof item.name === 'string' ? item.name.charAt(0).toUpperCase() + item.name.slice(1) : ''
    )
    .filter(Boolean);
});
</script>

<style lang="scss" scoped>
.mobile-layout {
  @apply w-screen h-screen flex flex-col;
  @apply bg-light dark:bg-black;
  @apply overflow-hidden;
  position: relative;
}

.mobile-content {
  @apply flex-1 overflow-auto;
}

.mobile-page {
  @apply h-full;
}

.mobile-bottom-menu {
  @apply bg-light dark:bg-black;
  @apply border-t border-gray-200 dark:border-gray-800;
}

.mobile-menu {
  @apply w-full;
}
</style>
