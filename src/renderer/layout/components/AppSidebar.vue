<template>
  <div
    class="app-sidebar-wrapper"
    :class="{ 'app-sidebar-expanded': settingsStore.setData.isMenuExpanded }"
  >
    <div class="app-sidebar-content">
      <div class="app-sidebar-header">
        <div class="app-sidebar-logo" @click="toggleMenu">
          <img :src="icon" class="w-9 h-9" alt="logo" />
        </div>
      </div>
      <div class="app-sidebar-list">
        <div v-for="(item, index) in menus" :key="item.path" class="app-sidebar-item">
          <n-tooltip
            :delay="200"
            :disabled="settingsStore.setData.isMenuExpanded || isCompact"
            placement="right"
          >
            <template #trigger>
              <div class="inline-block w-full">
                <router-link class="app-sidebar-item-link" :to="item.path">
                  <i
                    class="app-sidebar-item-icon"
                    :style="iconStyle(index)"
                    :class="item.meta.icon"
                  ></i>
                  <span
                    v-if="settingsStore.setData.isMenuExpanded"
                    class="app-sidebar-item-text ml-3"
                    :class="isChecked(index) ? 'text-primary' : ''"
                  >{{ t(item.meta.title) }}</span>
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
import { isCompact } from '@/utils';
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
  (newVal) => {
    path.value = newVal;
  }
);

const isChecked = (index: number) => {
  if (path.value === props.menus[index]?.path) {
    return true;
  }

  if (
    props.menus[index]?.meta?.isMulti &&
    props.menus[index]?.children?.find((item: any) => item.path === path.value)
  ) {
    return true;
  }

  return false;
};

const iconStyle = (index: number) => {
  if (isChecked(index)) {
    return {
      color: props.selectColor,
      fontSize: props.size
    };
  }

  return {
    color: props.color,
    fontSize: props.size
  };
};

const toggleMenu = () => {
  settingsStore.setSetData({
    ...settingsStore.setData,
    isMenuExpanded: !settingsStore.setData.isMenuExpanded
  });
};
</script>
<style lang="scss" scoped>
.app-sidebar-wrapper {
  @apply flex flex-col h-full w-[100px] px-2 py-3 transition-all duration-300;
}

.app-sidebar-expanded {
  width: 260px;
}

.app-sidebar-content {
  @apply flex flex-col h-full;
}

.app-sidebar-header {
  @apply flex justify-center mb-3;
}

.app-sidebar-logo {
  @apply flex items-center justify-center w-10 h-10 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors;
}

.app-sidebar-list {
  @apply flex-1 min-h-0 overflow-y-auto overflow-x-hidden;
  padding-bottom: 20px;
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;

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

.app-sidebar-item {
  @apply mb-1;
}

.app-sidebar-item-link {
  @apply flex items-center px-2 py-2 rounded-lg transition-colors duration-200;
  @apply hover:bg-gray-100 dark:hover:bg-gray-800;
}

.app-sidebar-item-icon {
  @apply flex-shrink-0 flex items-center justify-center;
  transition: all 0.3s;
}

.app-sidebar-item-text {
  @apply text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap overflow-hidden;
}
</style>
