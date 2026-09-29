<template>
  <div class="history-page h-full flex flex-col">
    <div
      class="flex flex-col gap-4 px-6 pt-4 pb-2 flex-shrink-0"
      :class="setAnimationClass('animate__fadeInRight')"
      v-if="!isMobile"
    >
      <div class="flex items-center justify-between">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Play History</h2>

        <button
          class="h-8 px-3 rounded-full bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 text-gray-600 dark:text-gray-300 text-xs font-medium transition-colors flex items-center gap-1.5"
          @click="handleNavigateToHeatmap"
        >
          <i class="ri-calendar-2-line"></i>
          Heatmap
        </button>
      </div>

      <div class="flex items-center justify-between gap-4">
        <div
          class="bg-gray-100 dark:bg-neutral-800 p-1 rounded-full inline-flex h-9 items-center overflow-x-auto no-scrollbar max-w-full"
        >
          <div
            v-for="tab in ['songs', 'playlists', 'albums']"
            :key="tab"
            class="px-4 h-7 rounded-full text-xs font-medium cursor-pointer transition-all duration-300 flex items-center justify-center whitespace-nowrap"
            :class="
              currentCategory === tab
                ? 'bg-white dark:bg-neutral-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            "
            @click="handleCategoryChange(tab as any)"
          >
            {{ t(`history.categoryTabs.${tab}`) }}
          </div>
        </div>

        <div
          class="flex items-center bg-gray-100 dark:bg-neutral-800 rounded-full p-1 h-9 flex-shrink-0"
        >
          <div
            class="px-3 h-7 flex items-center rounded-full text-xs font-medium bg-white dark:bg-neutral-700 text-gray-900 dark:text-white shadow-sm"
          >
            Play History
          </div>
        </div>
      </div>
    </div>

    <div class="flex-grow min-h-0 px-2 mt-2" :class="setAnimationClass('animate__bounceInLeft')">
      <n-scrollbar ref="scrollbarRef" class="h-full pr-4" :size="100" @scroll="handleScroll">
        <div class="pb-24 space-y-1">
          <template v-if="currentCategory === 'songs'">
            <div
              v-for="(item, index) in displayList"
              :key="item.id"
              class="group flex items-center justify-between rounded-xl hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors p-1"
              :class="setAnimationClass('animate__bounceInRight')"
              :style="setAnimationDelay(index, 30)"
            >
              <song-item
                class="flex-1 !bg-transparent hover:!bg-transparent"
                :item="item"
                @play="handlePlay"
              />
              <template v-if="!isMobile">
                <div
                  class="px-4 text-xs text-gray-400 dark:text-gray-600 font-medium min-w-[60px] text-right"
                  v-show="true"                >
                  {{ t('history.playCount', { count: item.count }) }}
                </div>
                <div
                  class="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer transition-all opacity-0 group-hover:opacity-100"
                  v-show="true"                  @click="handleDelMusic(item)"
                >
                  <i class="ri-close-line text-lg"></i>
                </div>
              </template>
            </div>
          </template>

          <template v-if="currentCategory === 'playlists'">
            <playlist-item
              v-for="(item, index) in displayList"
              :key="item.id"
              :item="item"
              :show-count="true"              :show-delete="true"              class="rounded-xl hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
              :class="setAnimationClass('animate__bounceInRight')"
              :style="setAnimationDelay(index, 30)"
              @click="handlePlaylistClick(item)"
              @delete="handleDelPlaylist(item)"
            />
          </template>

          <template v-if="currentCategory === 'albums'">
            <album-item
              v-for="(item, index) in displayList"
              :key="item.id"
              :item="item"
              :show-count="true"              :show-delete="true"              class="rounded-xl hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
              :class="setAnimationClass('animate__bounceInRight')"
              :style="setAnimationDelay(index, 30)"
              @click="handleAlbumClick(item)"
              @delete="handleDelAlbum(item)"
            />
          </template>


          <div v-if="displayList.length === 0 && !loading" class="text-center py-12 text-gray-400">
            <div
              class="w-20 h-20 mx-auto rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center mb-4"
            >
              <i class="ri-history-line text-3xl text-gray-300 dark:text-gray-600"></i>
            </div>
            <p>No records</p>
          </div>

          <div v-if="loading" class="space-y-2 pt-2">
            <div
              v-for="i in 8"
              :key="i"
              class="flex items-center gap-4 rounded-xl p-2 animate-pulse"
            >
              <div class="h-12 w-12 rounded-xl bg-gray-200 dark:bg-neutral-800"></div>
              <div class="flex-1 space-y-2">
                <div class="h-4 w-1/3 rounded bg-gray-200 dark:bg-neutral-800"></div>
                <div class="h-3 w-1/4 rounded bg-gray-200 dark:bg-neutral-800"></div>
              </div>
            </div>
          </div>

          <div
            v-if="noMore && displayList.length > 0"
            class="text-center py-8 text-sm text-gray-400 dark:text-gray-500"
          >
            No more
          </div>
        </div>
      </n-scrollbar>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useMessage } from 'naive-ui';
import { onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import AlbumItem from '@/components/common/AlbumItem.vue';
import { navigateToMusicList } from '@/components/common/MusicListNavigator';
import PlaylistItem from '@/components/common/PlaylistItem.vue';
import SongItem from '@/components/common/SongItem.vue';
import { usePlayerStore } from '@/store/modules/player';
import { usePlayHistoryStore } from '@/store/modules/playHistory';
import type { SongResult } from '@/types/music';
import { isMobile, setAnimationClass, setAnimationDelay } from '@/utils';
import { t } from '@/utils/i18n';


const message = useMessage();
const router = useRouter();
const playHistoryStore = usePlayHistoryStore();
const scrollbarRef = ref();
const loading = ref(false);
const noMore = ref(false);
const displayList = ref<any[]>([]);
const playerStore = usePlayerStore();
const hasLoaded = ref(false);
const currentCategory = ref<'songs' | 'playlists' | 'albums'>('songs');

const pageSize = 100;
const currentPage = ref(1);


const getCurrentList = (): any[] => {
  if (currentCategory.value === 'songs') return playHistoryStore.musicHistory;
  if (currentCategory.value === 'playlists') return playHistoryStore.playlistHistory;
  return playHistoryStore.albumHistory;
};

const handleCategoryChange = async (value: 'songs' | 'playlists' | 'albums') => {
  currentCategory.value = value;
  currentPage.value = 1;
  noMore.value = false;
  displayList.value = [];

  await loadHistoryData();
};

const handlePlaylistClick = async (item: any) => {
  try {
    navigateToMusicList(router, {
      id: item.id,
      type: 'playlist',
      name: item.name,
      listInfo: item,
      canRemove: false
    });
  } catch (error) {
    console.error('Failed to open playlist:', error);
    message.error('Failed to open playlist');
  }
};

const handleAlbumClick = async (item: any) => {
  try {
    navigateToMusicList(router, {
      id: item.id,
      type: 'album',
      name: item.name,
      listInfo: {
        ...item,
        coverImgUrl: item.picUrl || item.coverImgUrl
      },
      canRemove: false
    });
  } catch (error) {
    console.error('Failed to open album:', error);
    message.error('Failed to open album');
  }
};

const handleDelPlaylist = (item: any) => {
  playHistoryStore.delPlaylist(item);
  displayList.value = displayList.value.filter((playlist) => playlist.id !== item.id);
};

const handleDelAlbum = (item: any) => {
  playHistoryStore.delAlbum(item);
  displayList.value = displayList.value.filter((album) => album.id !== item.id);
};



const loadHistoryData = async () => {
  const currentList = getCurrentList();
  if (currentList.length === 0) {
    displayList.value = [];
    return;
  }

  loading.value = true;
  try {
    const startIndex = (currentPage.value - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const currentPageItems = currentList.slice(startIndex, endIndex);

    if (currentCategory.value === 'songs') {
      // History entries are stored fully resolved, so no detail lookup is needed.
      const newSongs = currentPageItems as SongResult[];

      if (currentPage.value === 1) {
        displayList.value = newSongs;
      } else {
        displayList.value = [...displayList.value, ...newSongs];
      }
    } else {
      if (currentPage.value === 1) {
        displayList.value = currentPageItems;
      } else {
        displayList.value = [...displayList.value, ...currentPageItems];
      }
    }

    const totalLength = getCurrentList().length;
    noMore.value = displayList.value.length >= totalLength;
  } catch (error) {
    console.error('Failed to get play history', error);
  } finally {
    loading.value = false;
  }
};

const handleScroll = (e: any) => {
  const { scrollTop, scrollHeight, offsetHeight } = e.target;
  const threshold = 100;

  if (!loading.value && !noMore.value && scrollHeight - (scrollTop + offsetHeight) < threshold) {
    currentPage.value++;
    loadHistoryData();
  }
};

const handlePlay = () => {
  playerStore.setPlayList(displayList.value);
};


onMounted(async () => {
  if (!hasLoaded.value) {
    await loadHistoryData();
    hasLoaded.value = true;
  }
});

watch(
  () => [
    playHistoryStore.musicHistory,
    playHistoryStore.playlistHistory,
    playHistoryStore.albumHistory
  ],
  async () => {
    if (hasLoaded.value) {
      currentPage.value = 1;
      noMore.value = false;
      await loadHistoryData();
    }
  },
  { deep: true }
);

const handleDelMusic = async (item: SongResult) => {
  playHistoryStore.delMusic(item);
  displayList.value = displayList.value.filter((music) => music.id !== item.id);
};

const handleNavigateToHeatmap = () => {
  router.push('/heatmap');
};
</script>

<style scoped lang="scss"></style>
