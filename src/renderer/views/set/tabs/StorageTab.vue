<template>
  <setting-section v-if="isDesktop()" title="System Management">
    <setting-item
      icon="ri-hard-drive-2-line"
      title="Disk Cache"
      description="Cache played music and lyrics on local disk to speed up repeated playback"
    >
      <n-switch v-model:value="setData.enableDiskCache">
        <template #checked>On</template>
        <template #unchecked>Off</template>
      </n-switch>
    </setting-item>

    <setting-item
      icon="ri-folder-2-line"
      title="Cache Directory"
      :description="
        setData.diskCacheDir ||
        diskCacheStats.path ||
        'Custom directory for music and lyric cache files'
      "
    >
      <template #action>
        <div class="flex items-center gap-2 max-md:flex-wrap">
          <s-btn @click="selectCacheDirectory"> Select Directory </s-btn>
          <s-btn @click="openCacheDirectory"> Open Directory </s-btn>
        </div>
      </template>
    </setting-item>

    <setting-item
      icon="ri-database-2-line"
      title="Cache Size Limit"
      description="Older cache items are cleaned automatically when limit is reached"
    >
      <template #action>
        <s-input
          v-model="setData.diskCacheMaxSizeMB"
          type="number"
          :min="256"
          :max="102400"
          :step="256"
          suffix="MB"
          width="w-[160px] max-md:w-32"
        />
      </template>
    </setting-item>

    <setting-item
      icon="ri-delete-bin-6-line"
      title="Cleanup Policy"
      description="Auto cleanup rule when cache reaches the size limit"
    >
      <s-select
        v-model="setData.diskCacheCleanupPolicy"
        :options="cleanupPolicyOptions"
        width="w-40"
      />
    </setting-item>

    <setting-item
      icon="ri-pie-chart-line"
      title="Cache Status"
      :description="
        t('settings.system.cacheStatusDesc', {
          used: formatBytes(diskCacheStats.totalSizeBytes),
          limit: `${setData.diskCacheMaxSizeMB || (diskCacheStats.maxSize ? diskCacheStats.maxSize / 1024 / 1024 : 0)} MB`
        })
      "
    >
      <template #action>
        <div class="flex items-center gap-3 max-md:flex-wrap">
          <div class="w-40 max-md:w-32">
            <n-progress type="line" :percentage="diskCacheUsagePercent" />
          </div>
          <span class="text-xs text-neutral-500">
            {{
              t('settings.system.cacheStatusDetail', {
                musicCount: diskCacheStats.musicFiles,
                lyricCount: diskCacheStats.lyricFiles
              })
            }}
          </span>
          <s-btn @click="refreshDiskCacheStats()">Refresh</s-btn>
        </div>
      </template>
    </setting-item>

    <setting-item
      icon="ri-broom-line"
      title="Manual Disk Cache Cleanup"
      description="Clean cache by category"
    >
      <template #action>
        <div class="flex items-center gap-2 max-md:flex-wrap">
          <s-btn @click="clearDiskCacheByScope('music')"> Clear Music Cache </s-btn>
          <s-btn @click="clearDiskCacheByScope('lyrics')"> Clear Lyric Cache </s-btn>
          <s-btn variant="danger" @click="clearDiskCacheByScope('all')"> Clear All Cache </s-btn>
        </div>
      </template>
    </setting-item>

    <setting-item icon="ri-restart-line" title="Restart" description="Restart application">
      <s-btn @click="restartApp">Restart</s-btn>
    </setting-item>
  </setting-section>
</template>

<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core';
import { computed, inject, onMounted, ref, watch } from 'vue';

import localData from '@/../shared/set.json';
import { usePlayHistoryStore } from '@/store/modules/playHistory';
import { isDesktop } from '@/utils';
import { openDirectory, selectDirectory } from '@/utils/fileOperation';
import { t } from '@/utils/i18n';

import { SETTINGS_DATA_KEY, SETTINGS_DIALOG_KEY, SETTINGS_MESSAGE_KEY } from '../keys';
import SBtn from '../SBtn.vue';
import SettingItem from '../SettingItem.vue';
import SettingSection from '../SettingSection.vue';
import SInput from '../SInput.vue';
import SSelect from '../SSelect.vue';

type DiskCacheScope = 'all' | 'music' | 'lyrics';
type DiskCacheCleanupPolicy = 'lru' | 'fifo';
type CacheSwitchAction = 'migrate' | 'destroy' | 'keep';

type DiskCacheConfig = {
  enabled: boolean;
  path: string;
  maxSize: number;
};

type DiskCacheStats = DiskCacheConfig & {
  totalSizeBytes: number;
  musicSizeBytes: number;
  lyricSizeBytes: number;
  totalFiles: number;
  musicFiles: number;
  lyricFiles: number;
  usage: number;
};

type SwitchCacheDirectoryResult = {
  success: boolean;
  config: DiskCacheConfig;
  migratedFiles: number;
  destroyedFiles: number;
};

const setData = inject(SETTINGS_DATA_KEY)!;
const message = inject(SETTINGS_MESSAGE_KEY)!;
const dialog = inject(SETTINGS_DIALOG_KEY)!;

const diskCacheStats = ref<DiskCacheStats>({
  enabled: true,
  path: '',
  maxSize: 4096,
  totalSizeBytes: 0,
  musicSizeBytes: 0,
  lyricSizeBytes: 0,
  totalFiles: 0,
  musicFiles: 0,
  lyricFiles: 0,
  usage: 0
});
const applyingDiskCacheConfig = ref(false);
const switchingCacheDirectory = ref(false);

const cleanupPolicyOptions = computed(() => [
  { label: 'Least Recently Used', value: 'lru' },
  { label: 'First In, First Out', value: 'fifo' }
]);

const diskCacheUsagePercent = computed(() =>
  Math.min(100, Math.max(0, Math.round((diskCacheStats.value.usage || 0) * 100)))
);

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
};

const readDiskCacheConfigFromUI = (): DiskCacheConfig => {
  const maxSize = Math.max(256, Math.floor(Number(setData.value.diskCacheMaxSizeMB || 4096)));

  return {
    enabled: setData.value.enableDiskCache !== false,
    path: String(setData.value.diskCacheDir || ''),
    maxSize
  };
};

const refreshDiskCacheStats = async (silent: boolean = true) => {
  try {
    const stats = (await window.api.invoke('get-disk-cache-stats')) as DiskCacheStats;
    if (stats) {
      diskCacheStats.value = stats;
    }
  } catch (error) {
    console.error('Failed to read disk cache statistics:', error);
    if (!silent) {
      message.error('Failed to load cache status');
    }
  }
};

const loadDiskCacheConfig = async () => {
  try {
    const config = (await window.api.invoke('get-disk-cache-config')) as DiskCacheConfig;
    if (config) {
      setData.value = {
        ...setData.value,
        enableDiskCache: config.enabled,
        diskCacheDir: config.path,
        diskCacheMaxSizeMB: config.maxSize
      };
    }
  } catch (error) {
    console.error('Failed to read disk cache configuration:', error);
  }
};

const applyDiskCacheConfig = async () => {
  applyingDiskCacheConfig.value = true;
  try {
    const config = readDiskCacheConfigFromUI();
    await window.api.setDiskCacheConfig(config);
    const updated = config;

    if (updated) {
      setData.value = {
        ...setData.value,
        enableDiskCache: updated.enabled,
        diskCacheDir: updated.path,
        diskCacheMaxSizeMB: updated.maxSize
      };
    }
    await refreshDiskCacheStats();
  } catch (error) {
    console.error('Failed to update disk cache configuration:', error);
  } finally {
    applyingDiskCacheConfig.value = false;
  }
};

const applyDiskCacheConfigDebounced = useDebounceFn(() => {
  void applyDiskCacheConfig();
}, 500);

watch(
  () => [
    setData.value.enableDiskCache,
    setData.value.diskCacheDir,
    setData.value.diskCacheMaxSizeMB,
    setData.value.diskCacheCleanupPolicy
  ],
  () => {
    if (applyingDiskCacheConfig.value || switchingCacheDirectory.value) return;
    applyDiskCacheConfigDebounced();
  }
);

const askCacheSwitchMigrate = (): Promise<boolean> => {
  return new Promise((resolve) => {
    let resolved = false;
    const finish = (value: boolean) => {
      if (resolved) return;
      resolved = true;
      resolve(value);
    };

    dialog.warning({
      title: 'Existing Cache Detected',
      content: 'Do you want to migrate old cache files to the new directory?',
      positiveText: 'Migrate',
      negativeText: 'Keep Old Cache',
      onPositiveClick: () => finish(true),
      onNegativeClick: () => finish(false),
      onClose: () => finish(false)
    });
  });
};

const askCacheSwitchDestroy = (): Promise<boolean> => {
  return new Promise((resolve) => {
    let resolved = false;
    const finish = (value: boolean) => {
      if (resolved) return;
      resolved = true;
      resolve(value);
    };

    dialog.warning({
      title: 'Destroy Old Cache',
      content:
        'If you do not migrate, do you want to destroy old cache files in the previous directory?',
      positiveText: 'Destroy',
      negativeText: 'Keep Old Cache',
      onPositiveClick: () => finish(true),
      onNegativeClick: () => finish(false),
      onClose: () => finish(false)
    });
  });
};

const selectCacheDirectory = async () => {
  const selectedPath = await selectDirectory(message);
  if (!selectedPath) return;

  const currentDirectory = setData.value.diskCacheDir || diskCacheStats.value.path;
  if (currentDirectory && selectedPath === currentDirectory) {
    return;
  }

  let action: CacheSwitchAction = 'keep';
  if (currentDirectory && diskCacheStats.value.totalFiles > 0) {
    const shouldMigrate = await askCacheSwitchMigrate();
    if (shouldMigrate) {
      action = 'migrate';
    } else {
      const shouldDestroy = await askCacheSwitchDestroy();
      action = shouldDestroy ? 'destroy' : 'keep';
    }
  }

  switchingCacheDirectory.value = true;
  try {
    const result = await window.api.invoke('switch-disk-cache-directory', { path: selectedPath }) as any;
    message.success('Cache directory switched');
    
    setData.value = {
      ...setData.value,
      diskCacheDir: selectedPath
    };
    await refreshDiskCacheStats();

    if (action === 'migrate') {
      message.success(
        t('settings.system.messages.switchDirectoryMigrated', { count: result.migratedFiles })
      );
      return;
    }
    if (action === 'destroy') {
      message.success(
        t('settings.system.messages.switchDirectoryDestroyed', { count: result.destroyedFiles })
      );
      return;
    }
    message.success('Cache directory switched, old cache is kept');
  } catch (error) {
    console.error('Failed to switch cache directory:', error);
    message.error('Failed to switch cache directory');
  } finally {
    switchingCacheDirectory.value = false;
  }
};

const openCacheDirectory = () => {
  const targetPath = setData.value.diskCacheDir || diskCacheStats.value.path;
  openDirectory(targetPath, message);
};

const clearDiskCacheByScope = async (scope: DiskCacheScope) => {
  try {
    const success = await window.api.invoke('clear-disk-cache', scope);
    if (success) {
      await refreshDiskCacheStats();
      message.success('Disk cache cleaned');
      return;
    }
    message.error('Failed to clean disk cache');
  } catch (error) {
    console.error('Manually clearing disk cache failed:', error);
    message.error('Failed to clean disk cache');
  }
};

const restartApp = () => {
  window.api.send('restart');
};

onMounted(async () => {
  await loadDiskCacheConfig();
  await refreshDiskCacheStats();
});
</script>

<style scoped></style>
