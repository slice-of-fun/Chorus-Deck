<template>
  <div class="local-music-page h-full w-full bg-white dark:bg-black transition-colors duration-500">
    <n-scrollbar class="h-full">
      <div class="local-music-content pb-32">
        <section class="hero-section relative overflow-hidden rounded-tl-2xl">
          <div class="hero-bg absolute inset-0 -top-20">
            <div
              class="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-primary/10 blur-3xl opacity-50 dark:opacity-30"
            ></div>
            <div
              class="absolute inset-0 bg-gradient-to-b from-transparent via-white/80 to-white dark:via-black/80 dark:to-black"
            ></div>
          </div>

          <div class="hero-content relative z-10 page-padding-x pt-6 pb-4">
            <div class="flex items-center gap-5">
              <div
                class="cover-container relative w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center shadow-lg ring-2 ring-white/50 dark:ring-neutral-800/50 shrink-0"
              >
                <i class="ri-folder-music-fill text-4xl text-primary opacity-80" />
              </div>

              <div class="info-content min-w-0">
                <h1
                  class="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-white tracking-tight"
                >
                  Local Music
                </h1>
                <p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                  {{ t('localMusic.songCount', { count: localMusicStore.musicList.length }) }}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          class="action-bar sticky top-0 z-20 page-padding-x py-3 md:py-4 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-neutral-100 dark:border-neutral-800/50"
        >
          <div class="flex items-center justify-between gap-4">
            <div class="flex-1 max-w-xs">
              <n-input
                v-model:value="searchKeyword"
                placeholder="Search local music"
                clearable
                size="small"
                round
              >
                <template #prefix>
                  <i class="ri-search-line text-neutral-400" />
                </template>
              </n-input>
            </div>

            <div class="flex items-center gap-3">
              <button
                v-if="filteredList.length > 0"
                class="action-btn-pill flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm transition-all bg-primary text-white hover:bg-primary/90"
                @click="handlePlayAll"
              >
                <i class="ri-play-fill text-lg" />
                <span class="hidden md:inline">Play All</span>
              </button>

              <button
                class="action-btn-icon w-10 h-10 rounded-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all"
                :disabled="localMusicStore.scanning"
                @click="handleScan"
              >
                <i
                  class="ri-refresh-line text-lg"
                  :class="{ 'animate-spin': localMusicStore.scanning }"
                />
              </button>

              <button
                class="action-btn-icon w-10 h-10 rounded-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all"
                @click="handleAddFolder"
              >
                <i class="ri-folder-add-line text-lg" />
              </button>

              <button
                v-if="localMusicStore.folderPaths.length > 0"
                class="action-btn-icon w-10 h-10 rounded-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all"
                @click="showFolderManager = true"
              >
                <i class="ri-folder-settings-line text-lg" />
              </button>
            </div>
          </div>
        </section>

        <section v-if="localMusicStore.scanning" class="page-padding-x mt-6">
          <div
            class="flex items-center gap-4 p-4 rounded-2xl bg-primary/5 dark:bg-primary/10 border border-primary/20"
          >
            <n-spin size="small" />
            <div>
              <p class="text-sm font-medium text-neutral-900 dark:text-white">Scanning...</p>
              <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                {{ t('localMusic.songCount', { count: localMusicStore.scanProgress }) }}
              </p>
            </div>
          </div>
        </section>

        <section class="list-section page-padding-x mt-6">
          <div
            v-if="!localMusicStore.scanning && filteredList.length === 0"
            class="empty-state py-20 text-center"
          >
            <i class="ri-folder-music-fill text-5xl mb-4 text-neutral-200 dark:text-neutral-800" />
            <p class="text-neutral-400">No local music found. Please select a folder to scan.</p>
            <button
              class="mt-6 px-6 py-2 rounded-full bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-all"
              @click="handleAddFolder"
            >
              <i class="ri-folder-add-line mr-2" />
              Scan Folder
            </button>
          </div>

          <div v-else-if="filteredList.length > 0" class="song-list-container">
            <song-item
              v-for="(item, index) in filteredSongResults"
              :key="item.id"
              :index="index"
              :item="item"
              :can-remove="true"
              @play="handlePlaySong"
              @remove-song="handleRemoveSong"
            />
          </div>
        </section>
      </div>
    </n-scrollbar>

    <n-drawer v-model:show="showFolderManager" :width="400" placement="right">
      <n-drawer-content title="Remove Folder" closable>
        <div class="space-y-3 py-4">
          <div
            v-for="folder in localMusicStore.folderPaths"
            :key="folder"
            class="flex items-center justify-between p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800"
          >
            <div class="flex items-center gap-3 min-w-0 flex-1">
              <i class="ri-folder-line text-lg text-primary flex-shrink-0" />
              <span class="text-sm text-neutral-700 dark:text-neutral-300 truncate">{{
                folder
              }}</span>
            </div>
            <button
              class="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-red-500 hover:bg-red-500/10 transition-all flex-shrink-0 ml-2"
              @click="handleRemoveFolder(folder)"
            >
              <i class="ri-delete-bin-line" />
            </button>
          </div>

          <div v-if="localMusicStore.folderPaths.length === 0" class="text-center py-8">
            <i class="ri-folder-line text-4xl text-neutral-200 dark:text-neutral-800" />
            <p class="text-sm text-neutral-400 mt-2">
              No local music found. Please select a folder to scan.
            </p>
          </div>
        </div>

        <template #footer>
          <n-button type="primary" block @click="handleAddFolder">
            <template #icon>
              <i class="ri-folder-add-line" />
            </template>
            Scan Folder
          </n-button>
        </template>
      </n-drawer-content>
    </n-drawer>
  </div>
</template>

<script setup lang="ts">
import { createDiscreteApi } from 'naive-ui';
import { computed, onMounted, ref } from 'vue';

import SongItem from '@/components/common/SongItem.vue';
import { useLocalMusicStore } from '@/store/modules/localMusic';
import { usePlayerStore } from '@/store/modules/player';
import type { SongResult } from '@/types/music';
import { t } from '@/utils/i18n';
import { selectDirectory } from '@/utils/fileOperation';
import { filterByKeyword, toSongResult } from '@/utils/localMusicUtils';

const { message } = createDiscreteApi(['message']);
const localMusicStore = useLocalMusicStore();
const playerStore = usePlayerStore();

const searchKeyword = ref('');

const showFolderManager = ref(false);

const filteredList = computed(() => {
  return filterByKeyword(localMusicStore.musicList, searchKeyword.value);
});

const filteredSongResults = computed(() => {
  return filteredList.value.map(toSongResult);
});

async function handleAddFolder(): Promise<void> {
  try {
    const folderPath = await selectDirectory(message);
    if (folderPath) {
      localMusicStore.addFolder(folderPath);

      await localMusicStore.scanFolders();
    }
  } catch (error) {
    console.error('Failed to select folder:', error);
    message.error(String(error));
  }
}

async function handleRemoveFolder(folder: string): Promise<void> {
  await localMusicStore.removeFolder(folder);
}

async function handleScan(): Promise<void> {
  if (localMusicStore.folderPaths.length === 0) {
    await localMusicStore.scanFolders();
    await handleAddFolder();
    return;
  }
  await localMusicStore.scanFolders();
}

async function handlePlaySong(_song: SongResult): Promise<void> {
  try {
    playerStore.setPlayList(filteredSongResults.value);
  } catch (error) {
    console.error('Failed to play local music:', error);
  }
}

async function handleRemoveSong(id: number | string): Promise<void> {
  try {
    await localMusicStore.removeEntry(String(id));
    message.success('Removed from library (file not deleted)');
  } catch (error) {
    console.error('Failed to remove local songs:', error);
    message.error(String(error));
  }
}

async function handlePlayAll(): Promise<void> {
  if (filteredSongResults.value.length === 0) return;

  try {
    const firstSong = filteredSongResults.value[0];
    const entry = filteredList.value[0];

    const exists = await window.api.invoke('check-file-exists', entry.filePath);
    if (!exists) {
      message.error('File not found or has been moved');
      return;
    }

    playerStore.setPlayList(filteredSongResults.value);
    await playerStore.setPlay(firstSong);
  } catch (error) {
    console.error('Failed to play all:', error);
  }
}

onMounted(async () => {
  if (localMusicStore.scanning) {
    return;
  }

  await localMusicStore.loadFromCache();
});
</script>

<style scoped>
.song-virtual-list {
  @apply w-full;
}

.song-virtual-list :deep(.n-virtual-list__scroll) {
  scrollbar-width: thin;
}

.song-virtual-list :deep(.n-virtual-list__scroll)::-webkit-scrollbar {
  width: 6px;
}

.song-virtual-list :deep(.n-virtual-list__scroll)::-webkit-scrollbar-thumb {
  @apply bg-neutral-300 dark:bg-neutral-700 rounded-full;
}

.song-virtual-list :deep(.n-virtual-list__scroll)::-webkit-scrollbar-track {
  @apply bg-transparent;
}
</style>
