<template>
  <div class="artist-page flex flex-col h-full">
    <div class="flex-shrink-0 px-6 pt-5 pb-4 flex gap-5 items-end">
      <div
        class="w-32 h-32 rounded-full flex-shrink-0 overflow-hidden bg-gray-100 dark:bg-neutral-800 flex items-center justify-center"
      >
        <img
          v-if="artist?.thumbnail"
          :src="getImgUrl(artist.thumbnail, '400y400')"
          :alt="artist.title"
          class="w-full h-full object-cover"
        />
        <i v-else class="ri-user-3-line text-4xl text-gray-300 dark:text-neutral-600" />
      </div>

      <div class="flex-1 min-w-0 pb-1">
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Artist</p>
        <h1 class="text-2xl font-bold mb-2 truncate">{{ artist?.title || 'Artist' }}</h1>
        <p v-if="artist?.subscriberCount" class="text-xs text-gray-500 dark:text-gray-400">
          {{ artist.subscriberCount }} subscribers
        </p>
        <p v-if="artist?.description" class="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
          {{ artist.description }}
        </p>
      </div>

      <div class="flex-shrink-0 flex gap-2">
        <n-button type="primary" circle size="large" :disabled="!songs.length" @click="playAll">
          <i class="ri-play-fill text-lg" />
        </n-button>
      </div>
    </div>

    <div class="flex-shrink-0 px-6 pb-3 flex gap-2">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="px-3 h-7 rounded-full text-xs font-medium transition-all"
        :class="
          activeTab === tab.key
            ? 'bg-primary text-white'
            : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-300'
        "
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="flex-1 min-h-0 px-2">
      <n-spin :show="loading">
        <n-scrollbar class="h-full pr-4" :size="100">
          <template v-if="activeTab === 'songs'">
            <p v-if="!loading && songs.length === 0" class="py-20 text-center text-sm text-gray-500">
              No tracks available for this artist.
            </p>
            <SongItem
              v-for="(song, index) in songs"
              :key="song.id"
              :item="song"
              :index="index"
              :is-next="index === 0"
              @play="playTrack"
            />
          </template>

          <template v-else-if="activeTab === 'albums'">
            <p v-if="!loading && albums.length === 0" class="py-20 text-center text-sm text-gray-500">
              No albums available for this artist.
            </p>
            <PlaylistItem
              v-for="album in albumItems"
              :key="album.id"
              :item="album"
              @click="openPlaylist(album.id, album.name)"
            />
          </template>

          <template v-else>
            <p
              v-if="!loading && playlists.length === 0"
              class="py-20 text-center text-sm text-gray-500"
            >
              No playlists available for this artist.
            </p>
            <PlaylistItem
              v-for="playlist in playlistItems"
              :key="playlist.id"
              :item="playlist"
              @click="openPlaylist(playlist.id, playlist.name)"
            />
          </template>
        </n-scrollbar>
      </n-spin>
    </div>

    <PlayBottom />
  </div>
</template>

<script lang="ts" setup>
import { useMessage } from 'naive-ui';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { getYTMArtist, type YTMArtistDetail, type YTMPlaylist } from '@/api/ytmusic';
import { navigateToMusicList } from '@/components/common/MusicListNavigator';
import PlayBottom from '@/components/common/PlayBottom.vue';
import PlaylistItem from '@/components/common/PlaylistItem.vue';
import SongItem from '@/components/common/SongItem.vue';
import { playTrack } from '@/services/playbackController';
import { usePlayerStore } from '@/store/modules/player';
import type { SongResult } from '@/types/music';
import { getImgUrl } from '@/utils';

import { toSongResult } from '../../api/search';

defineOptions({ name: 'ArtistDetail' });

const route = useRoute();
const router = useRouter();
const playerStore = usePlayerStore();
const message = useMessage();

const artist = ref<YTMArtistDetail | null>(null);
const songs = ref<SongResult[]>([]);
const albums = ref<YTMPlaylist[]>([]);
const playlists = ref<YTMPlaylist[]>([]);
const loading = ref(false);

const activeTab = ref<'songs' | 'albums' | 'playlists'>('songs');

const tabs = computed(() => [
  { key: 'songs' as const, label: `Songs${songs.value.length ? ` (${songs.value.length})` : ''}` },
  { key: 'albums' as const, label: 'Albums' },
  { key: 'playlists' as const, label: 'Playlists' }
]);

const artistId = computed(() => String(route.params.id || ''));

const loadArtist = async () => {
  const id = artistId.value;
  if (!id) return;

  loading.value = true;
  artist.value = null;
  songs.value = [];
  albums.value = [];
  playlists.value = [];

  try {
    const result = await getYTMArtist(id);
    artist.value = result;
    songs.value = result.songs.map(toSongResult);
    albums.value = result.albums;
    playlists.value = result.playlists;
  } catch (error) {
    console.error('Failed to load artist:', error);
    message.error('Failed to load artist');
  } finally {
    loading.value = false;
  }
};

const playAll = () => {
  if (!songs.value.length) return;
  playerStore.setPlayList(songs.value, false, true);
};

const albumItems = computed(() =>
  albums.value.map((album) => ({
    id: album.id,
    name: album.title,
    coverImgUrl: album.thumbnail,
    trackCount: 0
  }))
);

const playlistItems = computed(() =>
  playlists.value.map((playlist) => ({
    id: playlist.id,
    name: playlist.title,
    coverImgUrl: playlist.thumbnail,
    trackCount: 0
  }))
);

const openPlaylist = (id: string, name: string) => {
  navigateToMusicList(router, {
    id,
    type: 'playlist',
    name,
    listInfo: { id, name }
  });
};

onMounted(loadArtist);
watch(artistId, loadArtist);
</script>

<style lang="scss" scoped>
.artist-page {
  @apply h-full w-full;
}
</style>
