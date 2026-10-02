<template>
  <div id="layout-main" class="compact-layout compact" :class="{ 'has-safe-area': isPhone }">
    <compact-header />

    <div
      class="compact-content"
      :class="{ 'has-bottom-menu': shouldShowBottomMenu, 'has-player': isPlay }"
    >
      <router-view v-slot="{ Component }" class="compact-page">
        <keep-alive :include="keepAliveInclude">
          <component :is="Component" />
        </keep-alive>
      </router-view>
    </div>

    <compact-play-bar v-if="isPlay" />

    <div v-if="shouldShowBottomMenu" class="compact-bottom-menu">
      <app-menu class="compact-menu" :menus="menuStore.menus" />
    </div>

    <queue />
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
import CompactHeader from './components/CompactHeader.vue';
const CompactPlayBar = defineAsyncComponent(() => import('@/components/player/CompactPlayBar.vue'));
const Queue = defineAsyncComponent(() => import('@/components/player/Queue.vue'));

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

provide('shouldShowCompactMenu', shouldShowBottomMenu);

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
.compact-layout {
  @apply w-screen h-screen flex flex-col;
  @apply bg-light dark:bg-black;
  @apply overflow-hidden;
  position: relative;
}

.compact-content {
  @apply flex-1 overflow-auto;
}

.compact-page {
  @apply h-full;
}

.compact-bottom-menu {
  @apply bg-light dark:bg-black;
  @apply border-t border-gray-200 dark:border-gray-800;
}

.compact-menu {
  @apply w-full;
}
</style>
