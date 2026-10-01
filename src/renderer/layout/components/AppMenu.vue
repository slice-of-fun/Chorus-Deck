<template>
  <div>
    <div class="app-menu" :class="{ 'app-menu-expanded': settingsStore.setData.isMenuExpanded }">
      <div class="app-menu-header">
        <div class="app-menu-logo" @click="toggleMenu">
          <img :src="icon" class="w-9 h-9" alt="logo" />
        </div>
      </div>
      <div class="app-menu-list">
        <div v-for="(item, index) in menus" :key="item.path" class="app-menu-item">
          <n-tooltip
            :delay="200"
            :disabled="settingsStore.setData.isMenuExpanded || isMobile"
            placement="right"
          >
            <template #trigger>
              <div class="inline-block w-full">
                <router-link class="app-menu-item-link" :to="item.path">
                  <i
                    class="app-menu-item-icon"
                    :style="iconStyle(index)"
                    :class="item.meta.icon"
                  ></i>
                  <span
                    v-if="settingsStore.setData.isMenuExpanded"
                    class="app-menu-item-text ml-3"
                    :class="isChecked(index) ? '-primary' : ''"
                    >{{ t(item.meta.title) }}</span
                  >
                </router-link>
              </div>
            </template>
            {{ t(item.meta.title) }}
          </n-tooltip>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import icon from '@/assets/logo.png';
import { useSettingsStore } from '@/store';
import { isMobile } from '@/utils';
import { t } from '@/utils/i18n';

const props = defineProps({
  size: {
    type: String,
    default: '26px'
  },
  color: {
    type: String,
    default: '#aaa'
  },
  selectColor: {
    type: String,
    default: 'rgb(var(--color-primary))'
  },
  menus: {
    type: Array as any,
    default: () => []
  }
});

const route = useRoute();
const path = ref(route.path);
const settingsStore = useSettingsStore();
watch(
  () => route.path,
  async (newParams) => {
    path.value = newParams;
  }
);

const isChecked = (index: number) => {
  return path.value === props.menus[index].path;
};

const iconStyle = (index: number) => {
  const style = {
    fontSize: props.size,
    color: isChecked(index) ? props.selectColor : props.color
  };
  return style;
};

const toggleMenu = () => {
  settingsStore.setSetData({
    isMenuExpanded: !settingsStore.setData.isMenuExpanded
  });
};
</script>

<style lang="scss" scoped>
.app-menu {
  @apply flex-col items-center justify-center transition-all duration-300 w-[100px] px-1;
}

.app-menu-list {
  max-height: calc(100vh - 120px);
  overflow-y: auto;
  overflow-x: hidden;

  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
  padding-bottom: 20px;
  transition: scrollbar-color 0.3s ease;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background-color: transparent;
    border-radius: 2px;
    transition: background-color 0.3s ease;
  }

  &:hover {
    scrollbar-color: rgba(156, 163, 175, 0.5) transparent;

    &::-webkit-scrollbar-thumb {
      background-color: rgba(156, 163, 175, 0.5);

      &:hover {
        background-color: rgba(156, 163, 175, 0.7);
      }
    }
  }
}

.app-menu-expanded {
  @apply w-[160px];

  .app-menu-item {
    @apply hover:bg-gray-100 dark:hover:bg-gray-800 rounded mr-4;
  }
}

.app-menu-item-link,
.app-menu-header {
  @apply flex items-center w-[200px] overflow-hidden ml-2 px-5;
}

.app-menu-header {
  @apply ml-1;
}

.app-menu-item-link {
  @apply mb-6 mt-6;
}

.app-menu-item-icon {
  @apply transition-all duration-200 text-gray-500 dark:text-gray-400;

  &:hover {
    @apply text-primary scale-105 !important;
  }
}

.mobile {
  .app-menu {
    max-width: 100%;
    width: 100vw;
    position: relative;
    bottom: 0;
    left: 0;
    z-index: 99999;
    @apply bg-light dark:bg-black border-none border-gray-200 dark:border-gray-700;

    &-header {
      display: none;
    }

    &-list {
      @apply flex justify-between px-4;
      max-height: none !important;
      overflow: visible !important;
    }

    &-item {
      &-link {
        @apply my-2 w-auto px-2;
        width: auto !important;
        margin-top: 8px;
        margin-bottom: 8px;
      }
    }

    &-expanded {
      @apply w-full;
    }
  }
}
</style>
