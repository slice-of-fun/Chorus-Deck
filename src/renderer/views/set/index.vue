<template>
  <div class="h-full w-full bg-white dark:bg-black transition-colors duration-500 flex flex-col">
    <div
      v-if="currentSection === 'main'"
      class="flex-shrink-0 bg-white dark:bg-black z-10 page-padding pt-6 pb-2"
    >
      <h1 class="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-white mb-6">Settings</h1>
      <n-input
        v-model:value="searchQuery"
        placeholder="Search settings..."
        round
        clearable
        class="w-full mb-4 bg-gray-50 dark:bg-neutral-900"
      >
        <template #prefix>
          <i class="ri-search-line text-gray-400"></i>
        </template>
      </n-input>
    </div>

    <div
      v-else
      class="flex-shrink-0 bg-white dark:bg-black z-10 page-padding pt-6 pb-2 flex items-center gap-4 border-b border-gray-100 dark:border-gray-800"
    >
      <div
        class="w-10 h-10 rounded-full hover:bg-gray-100 dark:hover:bg-neutral-800 flex items-center justify-center cursor-pointer transition-colors"
        @click="currentSection === 'discord' ? currentSection = 'account' : currentSection = 'main'"
      >
        <i class="ri-arrow-left-line text-xl text-neutral-900 dark:text-white"></i>
      </div>
      <h1 class="text-xl md:text-2xl font-bold text-neutral-900 dark:text-white">
        {{ currentSectionTitle }}
      </h1>
    </div>

    <n-scrollbar class="flex-1">
      <div class="w-full mx-auto pb-32 pt-2 page-padding">
        <!-- Main Settings Menu -->
        <div v-show="currentSection === 'main'" class="animate-fade-in flex flex-col gap-2">
          <div
            v-for="item in filteredSettings"
            :key="item.id"
            class="flex items-center gap-4 p-4 rounded-2xl hover:bg-gray-50 dark:hover:bg-neutral-900 cursor-pointer transition-colors"
            @click="currentSection = item.id"
          >
            <div
              class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary"
            >
              <i v-if="!item.customIcon" :class="item.icon + ' text-2xl'"></i>
              <span v-else class="text-xl font-bold font-sans">{{ item.customIcon }}</span>
            </div>
            <div class="flex-1">
              <div class="text-base font-semibold text-neutral-900 dark:text-white">
                {{ item.title }}
              </div>
              <div v-if="item.description" class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {{ item.description }}
              </div>
            </div>
          </div>
        </div>

        <!-- Sub Tabs -->
        <div v-show="currentSection === 'account'" class="animate-fade-in">
          <account-tab @navigate="(section) => currentSection = section" />
        </div>
        <div v-show="currentSection === 'discord'" class="animate-fade-in">
          <discord-tab />
        </div>
        <div v-show="currentSection === 'ai'" class="animate-fade-in">
          <ai-tab />
        </div>
        <div v-show="currentSection === 'appearance'" class="animate-fade-in">
          <appearance-tab />
        </div>
        <div v-show="currentSection === 'player'" class="animate-fade-in">
          <player-tab />
        </div>
        <div v-show="currentSection === 'content'" class="animate-fade-in">
          <content-tab />
        </div>
        <div v-show="currentSection === 'privacy'" class="animate-fade-in">
          <privacy-tab />
        </div>
        <div v-show="currentSection === 'storage'" class="animate-fade-in">
          <storage-tab />
        </div>
        <div v-show="currentSection === 'backup_restore'" class="animate-fade-in">
          <backup-restore-tab />
        </div>
        <div v-show="currentSection === 'system_update'" class="animate-fade-in">
          <system-update-tab />
        </div>
        <div v-show="currentSection === 'about'" class="animate-fade-in">
          <about-tab />
        </div>

        <div class="h-20"></div>
        <play-bottom />
      </div>
    </n-scrollbar>
  </div>
</template>

<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core';
import { useDialog, useMessage } from 'naive-ui';
import { computed, onMounted, onUnmounted, provide, ref, watch } from 'vue';

import PlayBottom from '@/components/common/PlayBottom.vue';
import { useSettingsStore } from '@/store/modules/settings';
import { isElectron } from '@/utils';

import config from '../../../../package.json';
import { createDefaultAppUpdateState } from '../../../shared/appUpdate';
import { SETTINGS_DATA_KEY, SETTINGS_DIALOG_KEY, SETTINGS_MESSAGE_KEY } from './keys';
import AboutTab from './tabs/AboutTab.vue';
import AccountTab from './tabs/AccountTab.vue';
import DiscordTab from './tabs/DiscordTab.vue';
import AiTab from './tabs/AiTab.vue';
import AppearanceTab from './tabs/AppearanceTab.vue';
import BackupRestoreTab from './tabs/BackupRestoreTab.vue';
import ContentTab from './tabs/ContentTab.vue';
import PlayerTab from './tabs/PlayerTab.vue';
import PrivacyTab from './tabs/PrivacyTab.vue';
import StorageTab from './tabs/StorageTab.vue';
import SystemUpdateTab from './tabs/SystemUpdateTab.vue';

const settingsStore = useSettingsStore();
const message = useMessage();
const dialog = useDialog();

const saveSettings = useDebounceFn((data) => {
  settingsStore.setSetData(data);
}, 500);

const localSetData = ref({ ...settingsStore.setData });

const setData = computed({
  get: () => localSetData.value,
  set: (newData) => {
    localSetData.value = newData;
  }
});

watch(
  () => localSetData.value,
  (newValue) => saveSettings(newValue),
  { deep: true }
);

watch(
  () => settingsStore.setData,
  (newValue) => {
    if (JSON.stringify(localSetData.value) !== JSON.stringify(newValue)) {
      localSetData.value = { ...newValue };
    }
  },
  { deep: true, immediate: true }
);

onUnmounted(() => {
  settingsStore.setSetData(localSetData.value);
});

provide(SETTINGS_DATA_KEY, setData);
provide(SETTINGS_MESSAGE_KEY, message);
provide(SETTINGS_DIALOG_KEY, dialog);

const searchQuery = ref('');
const currentSection = ref('main');

const allSettingsItems = computed(() => [
  {
    id: 'account',
    title: 'Account',
    icon: 'ri-account-circle-line',
    description: 'Manage cookies and account details'
  },
  {
    id: 'ai',
    title: 'Ai Lyrics Translation',
    customIcon: 'Ai',
    description: 'Manage AI-powered translation engines'
  },
  {
    id: 'appearance',
    title: 'Appearance',
    icon: 'ri-palette-line',
    description: 'Theme, animations, fonts, and layout'
  },
  {
    id: 'player',
    title: 'Player and Audio',
    icon: 'ri-play-circle-line',
    description: 'Playback settings, equalizer, and quality'
  },
  {
    id: 'content',
    title: 'Content',
    icon: 'ri-global-line',
    description: 'Language and regional preferences'
  },
  {
    id: 'privacy',
    title: 'Privacy',
    icon: 'ri-shield-check-line',
    description: 'Data sharing and privacy controls'
  },
  {
    id: 'storage',
    title: 'Storage',
    icon: 'ri-database-2-line',
    description: 'Cache management and storage limits'
  },
  {
    id: 'backup_restore',
    title: 'Backup & Restore',
    icon: 'ri-history-line',
    description: 'Backup your settings and data'
  },
  {
    id: 'system_update',
    title: 'System Update',
    icon: 'ri-refresh-line',
    description: 'Check for application updates'
  },
  {
    id: 'about',
    title: 'About',
    icon: 'ri-information-line',
    description: 'App version and information'
  }
]);

const filteredSettings = computed(() => {
  if (!searchQuery.value) return allSettingsItems.value;
  const q = searchQuery.value.toLowerCase();
  return allSettingsItems.value.filter(
    (item) =>
      item.title.toLowerCase().includes(q) ||
      (item.description && item.description.toLowerCase().includes(q))
  );
});

const currentSectionTitle = computed(() => {
  if (currentSection.value === 'main') return 'Settings';
  if (currentSection.value === 'discord') return 'Discord Integration';
  const found = allSettingsItems.value.find((s) => s.id === currentSection.value);
  return found ? found.title : 'Settings';
});

onMounted(() => {
  if (isElectron && settingsStore.appUpdateState.currentVersion === '') {
    settingsStore.setAppUpdateState(createDefaultAppUpdateState(config.version));
  }
  if (setData.value.enableRealIP === undefined) {
    setData.value = { ...setData.value, enableRealIP: false };
  }
  if (setData.value.enableDiskCache === undefined) {
    setData.value = { ...setData.value, enableDiskCache: true };
  }
  if (!setData.value.diskCacheMaxSizeMB) {
    setData.value = { ...setData.value, diskCacheMaxSizeMB: 4096 };
  }
  if (!['lru', 'fifo'].includes(setData.value.diskCacheCleanupPolicy)) {
    setData.value = { ...setData.value, diskCacheCleanupPolicy: 'lru' };
  }
});
</script>

<style scoped>
:deep(.n-select .n-base-selection) {
  border-radius: 10px;
}
:deep(.n-input) {
  border-radius: 999px;
  background-color: transparent !important;
}

.animate-fade-in {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
