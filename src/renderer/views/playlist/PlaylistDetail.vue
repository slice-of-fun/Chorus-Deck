<template>
  <div class="playlist-page flex flex-col h-full">
    <div class="flex-shrink-0 px-6 pt-5 pb-4 flex gap-5 items-end">
      <div
        class="w-40 h-40 rounded-xl flex-shrink-0 overflow-hidden bg-gray-100 dark:bg-neutral-800 flex items-center justify-center"
      >
        <img
          v-if="detail?.thumbnail"
          :src="getImgUrl(detail.thumbnail, '400y400')"
          :alt="detail.title"
          class="w-full h-full object-cover"
        />
        <i v-else class="ri-album-line text-5xl text-gray-300 dark:text-neutral-600" />
      </div>

      <div class="flex-1 min-w-0 pb-1">
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Playlist</p>
        <h1 class="text-2xl font-bold mb-2 truncate">{{ detail?.title || 'Playlist' }}</h1>
        <p v-if="detail?.author" class="text-sm text-gray-600 dark:text-gray-300 mb-1">
          {{ detail.author }}
        </p>
        <p v-if="detail?.songCount" class="text-xs text-gray-500 dark:text-gray-400">
          {{ detail.songCount }} tracks
        </p>
      </div>

      <div class="flex-shrink-0 flex gap-2">
        <n-button type="primary" circle size="large" :disabled="!songs.length" @click="playAll">
          <i class="ri-play-fill text-lg" />
        </n-button>
        <n-button circle size="large" :disabled="!songs.length" @click="batchDownload">
          <i class="ri-download-2-line text-lg" />
        </n-button>
      </div>
    </div>

    <div v-if="description" class="px-6 pb-3 flex-shrink-0">
      <p class="text-xs text-gray-500 dark:text-gray-400 line-clamp-3">{{ description }}</p>
    </div>

    <div class="flex-1 min-h-0 px-2">
      <n-spin :show="loading">
        <n-scrollbar class="h-full pr-4" :size="100">
          <div v-if="!loading && songs.length === 0" class="py-20 text-center">
            <p class="text-sm text-gray-500 dark:text-gray-400">
              This playlist has no playable tracks.
            </p>
          </div>

          <SongItem
            v-for="(song, index) in songs"
            :key="song.id"
            :item="song"
            :index="index"
            :is-next="index === 0"
            @play="playTrack"
          />
        </n-scrollbar>
      </n-spin>
    </div>

    <PlayBottom />
  </div>
</template>

<script lang="ts" setup>
import { useMessage } from 'naive-ui';
import { onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { getYTMPlaylist } from '@/api/ytmusic';
import SongItem from '@/components/common/SongItem.vue';
import { useDownload } from '@/hooks/useDownload';
import { playTrack } from '@/services/playbackController';
import { usePlayerStore } from '@/store/modules/player';
import type { SongResult } from '@/types/music';
import { getImgUrl, setAnimationClass } from '@/utils';

import { toSongResult } from '../../api/search';

defineOptions({ name: 'PlaylistDetail' });

const route = useRoute();
const playerStore = usePlayerStore();
const message = useMessage();
const { batchDownloadMusic } = useDownload();

const detail = ref<YTMPlaylistDetail | null>(null);
const songs = ref<SongResult[]>([]);
const loading = ref(false);

const description = ref('');

const loadPlaylist = async () => {
  const id = String(route.params.id || '');
  if (!id) return;

  loading.value = true;
  songs.value = [];
  detail.value = null;
  description.value = '';

  try {
    const result = await getYTMPlaylistDetail(id);
    detail.value = result;
    description.value = result.description || '';
    songs.value = result.songs.map(toSongResult);
  } catch (error) {
    console.error('Failed to load playlist:', error);
    message.error('Failed to load playlist');
  } finally {
    loading.value = false;
  }
};

const playAll = () => {
  if (!songs.value.length) return;
  playerStore.setPlayList(songs.value, 0, true);
};

const batchDownload = async () => {
  if (!songs.value.length) return;
  await batchDownloadMusic(songs.value);
};

onMounted(loadPlaylist);
watch(() => route.params.id, loadPlaylist);
</script>

<style lang="scss" scoped>
.playlist-page {
  @apply h-full w-full;
}
</style>
