<template>
  <div class="artist-page h-full w-full overflow-hidden">
    <!-- Loading overlay -->
    <div
      v-if="loading"
      class="absolute inset-0 z-50 bg-white dark:bg-[#0a0a0a] overflow-hidden p-4"
    >
      <div class="flex flex-col items-center pt-24">
        <n-skeleton height="112px" width="112px" style="border-radius: 16px" class="mb-4" />
        <n-skeleton text width="15%" class="mb-2" />
        <n-skeleton text width="40%" height="32px" class="mb-3" />
        <n-skeleton text width="35%" class="mb-5" />
        <div class="flex gap-3 mb-10">
          <n-skeleton height="40px" width="100px" style="border-radius: 20px" />
          <n-skeleton height="40px" width="100px" style="border-radius: 20px" />
        </div>
      </div>
      <div class="flex flex-col gap-4 w-full max-w-4xl mx-auto px-2">
        <div v-for="i in 5" :key="i" class="flex items-center gap-4">
          <n-skeleton height="48px" width="48px" style="border-radius: 8px" />
          <div class="flex-1 flex flex-col gap-2">
            <n-skeleton text width="40%" />
            <n-skeleton text width="20%" />
          </div>
        </div>
      </div>
    </div>
    <div v-show="!loading" class="h-full w-full">
      <n-scrollbar class="h-full">
        <div
          class="artist-banner relative w-full overflow-hidden"
          style="height: 220px"
          :style="bannerStyle"
        >
          <img
            v-if="artist?.thumbnail"
            :src="getImgUrl(artist.thumbnail, '400y400')"
            class="absolute inset-0 w-full h-full object-cover blur-3xl opacity-50 scale-125 mix-blend-overlay"
          />
          <div class="absolute inset-0 banner-glass" />
          <div class="absolute bottom-0 left-0 right-0 h-24 gradient-fade" />
        </div>

        <div class="flex justify-center -mt-14 relative z-20 mb-3">
          <div
            class="w-28 h-28 rounded-2xl overflow-hidden bg-neutral-200 dark:bg-neutral-800 shadow-xl ring-4 ring-white/20 dark:ring-black/30"
          >
            <img
              v-if="artist?.avatar || artist?.thumbnail"
              :src="getImgUrl(artist?.avatar || artist?.thumbnail, '300y300')"
              :alt="artist?.title"
              class="w-full h-full object-cover"
            />
            <div v-else class="w-full h-full flex items-center justify-center">
              <i class="ri-user-3-line text-4xl text-neutral-400" />
            </div>
          </div>
        </div>

        <div class="flex flex-col items-center px-6 relative z-10 pb-4">
          <p
            class="text-xs font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1"
          >
            Artist
          </p>
          <h1 class="text-3xl font-bold text-center leading-tight mb-4">
            {{ artist?.title || 'Artist' }}
          </h1>

          <div class="flex flex-wrap justify-center gap-2 mb-5">
            <div
              v-if="artist?.subscriberCount"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-primary/10 text-primary"
            >
              <i class="ri-user-follow-line text-sm" />
              {{ artist.subscriberCount }} subscribers
            </div>
            <div
              v-if="artist?.viewCount"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
            >
              <i class="ri-equalizer-line text-sm" />
              {{ artist.viewCount }}
            </div>
          </div>

          <p
            v-if="artist?.description"
            class="text-xs text-neutral-500 dark:text-neutral-400 text-center mb-5 px-2"
            :class="descExpanded ? '' : 'line-clamp-3'"
          >
            {{ artist.description }}
          </p>
          <button
            v-if="artist?.description && artist.description.length > 120"
            class="text-xs text-primary font-medium -mt-3 mb-4"
            @click="descExpanded = !descExpanded"
          >
            {{ descExpanded ? 'Show less' : 'Show more' }}
          </button>

          <div class="flex items-center justify-center gap-3">
            <button
              class="flex items-center gap-2 px-6 h-10 rounded-2xl font-semibold text-sm bg-primary text-white shadow transition-all hover:scale-[1.03] disabled:opacity-40"
              :disabled="!songs.length"
              @click="playAll"
            >
              <i class="ri-play-fill text-base" />
              Play
            </button>
            <button
              class="flex items-center gap-2 px-5 h-10 rounded-2xl font-semibold text-sm bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 transition-all hover:scale-[1.03] disabled:opacity-40"
              :disabled="!songs.length"
              @click="shufflePlay"
            >
              <i class="ri-shuffle-line text-base" />
              Shuffle
            </button>
          </div>
        </div>

        <div class="px-4 pb-8">
          <template v-if="songs.length > 0">
            <div
              class="section-header flex items-center justify-between px-2 mb-1 mt-2 group cursor-pointer"
              @click="handleMore('songs')"
            >
              <span class="text-sm font-semibold group-hover:underline">Songs</span>
              <button class="text-neutral-400 group-hover:text-primary transition-colors">
                <i class="ri-arrow-right-s-line text-xl" />
              </button>
            </div>
            <song-item
              v-for="(song, index) in songs"
              :key="song.id"
              :item="song"
              :is-next="index === 0"
              @play="playTrack"
            />
          </template>

          <template v-if="albumItems.length > 0">
            <div
              class="section-header flex items-center justify-between px-2 mb-3 mt-6 group cursor-pointer"
              @click="handleMore('albums')"
            >
              <span class="text-sm font-semibold group-hover:underline">Albums</span>
              <button class="text-neutral-400 group-hover:text-primary transition-colors">
                <i class="ri-arrow-right-s-line text-xl" />
              </button>
            </div>
            <div class="flex gap-3 overflow-x-auto pb-2 hide-scrollbar">
              <div
                v-for="album in albumItems"
                :key="album.id"
                class="flex-shrink-0 w-36 cursor-pointer group"
                @click="openPlaylistItem(album.id, album.name, 'album')"
              >
                <div
                  class="w-36 h-36 rounded-2xl overflow-hidden mb-2 bg-neutral-200 dark:bg-neutral-800 shadow-sm group-hover:shadow-md transition-shadow"
                >
                  <img
                    v-if="album.coverImgUrl"
                    :src="getImgUrl(album.coverImgUrl, '300y300')"
                    :alt="album.name"
                    class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div v-else class="w-full h-full flex items-center justify-center">
                    <i class="ri-album-line text-3xl text-neutral-400" />
                  </div>
                </div>
                <p class="text-xs font-medium truncate leading-tight">{{ album.name }}</p>
                <p
                  v-if="album.subtitle"
                  class="text-[10px] text-neutral-500 truncate leading-tight mt-0.5"
                >
                  {{ album.subtitle }}
                </p>
              </div>
            </div>
          </template>

          <template v-if="playlistItems.length > 0">
            <div
              class="section-header flex items-center justify-between px-2 mb-3 mt-6 group cursor-pointer"
              @click="handleMore('playlists')"
            >
              <span class="text-sm font-semibold group-hover:underline">Playlists</span>
              <button class="text-neutral-400 group-hover:text-primary transition-colors">
                <i class="ri-arrow-right-s-line text-xl" />
              </button>
            </div>
            <div class="flex gap-3 overflow-x-auto pb-2 hide-scrollbar">
              <div
                v-for="playlist in playlistItems"
                :key="playlist.id"
                class="flex-shrink-0 w-36 cursor-pointer group"
                @click="openPlaylistItem(playlist.id, playlist.name, 'playlist')"
              >
                <div
                  class="w-36 h-36 rounded-2xl overflow-hidden mb-2 bg-neutral-200 dark:bg-neutral-800 shadow-sm group-hover:shadow-md transition-shadow"
                >
                  <img
                    v-if="playlist.coverImgUrl"
                    :src="getImgUrl(playlist.coverImgUrl, '300y300')"
                    :alt="playlist.name"
                    class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div v-else class="w-full h-full flex items-center justify-center">
                    <i class="ri-play-list-line text-3xl text-neutral-400" />
                  </div>
                </div>
                <p class="text-xs font-medium truncate leading-tight">{{ playlist.name }}</p>
                <p
                  v-if="playlist.subtitle"
                  class="text-[10px] text-neutral-500 truncate leading-tight mt-0.5"
                >
                  {{ playlist.subtitle }}
                </p>
              </div>
            </div>
          </template>

          <template v-if="similarArtistItems.length > 0">
            <div
              class="section-header flex items-center justify-between px-2 mb-3 mt-6 group cursor-pointer"
              @click="handleMore('similar_artists')"
            >
              <span class="text-sm font-semibold group-hover:underline">Similar Artists</span>
              <button class="text-neutral-400 group-hover:text-primary transition-colors">
                <i class="ri-arrow-right-s-line text-xl" />
              </button>
            </div>
            <div class="flex gap-3 overflow-x-auto pb-2 hide-scrollbar">
              <div
                v-for="similar in similarArtistItems"
                :key="similar.id"
                class="flex-shrink-0 w-36 cursor-pointer group"
                @click="openArtist(similar.id)"
              >
                <div
                  class="w-36 h-36 rounded-full overflow-hidden mb-2 bg-neutral-200 dark:bg-neutral-800 shadow-sm group-hover:shadow-md transition-shadow ring-2 ring-white/10 dark:ring-black/20"
                >
                  <img
                    v-if="similar.coverImgUrl"
                    :src="getImgUrl(similar.coverImgUrl, '300y300')"
                    :alt="similar.name"
                    class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div v-else class="w-full h-full flex items-center justify-center">
                    <i class="ri-user-3-line text-3xl text-neutral-400" />
                  </div>
                </div>
                <p class="text-xs font-medium truncate leading-tight text-center">
                  {{ similar.name }}
                </p>
              </div>
            </div>
          </template>

          <div
            v-if="
              !loading &&
              songs.length === 0 &&
              albumItems.length === 0 &&
              playlistItems.length === 0 &&
              similarArtistItems.length === 0
            "
            class="py-20 text-center text-sm text-neutral-400"
          >
            <i class="ri-music-2-line text-4xl block mb-3 opacity-30" />
            Nothing found for this artist yet.
          </div>
        </div>

        <canvas ref="colorCanvas" class="hidden" width="8" height="8"></canvas>
      </n-scrollbar>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { argbFromRgb } from '@material/material-color-utilities';
import { useMessage } from 'naive-ui';
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { getYTMArtist, type YTMArtistDetail, type YTMPlaylist, type YTMSong } from '@/api/ytmusic';
import { navigateToMusicList } from '@/components/common/MusicListNavigator';
import SongItem from '@/components/common/SongItem.vue';
import { playTrack } from '@/services/playbackController';
import { usePlayerStore } from '@/store/modules/player';
import type { SongResult } from '@/types/music';
import { getImgUrl } from '@/utils';

defineOptions({ name: 'ArtistDetail' });

const route = useRoute();
const router = useRouter();
const playerStore = usePlayerStore();
const message = useMessage();

const artist = ref<YTMArtistDetail | null>(null);
const songs = ref<SongResult[]>([]);
const albums = ref<YTMPlaylist[]>([]);
const playlists = ref<YTMPlaylist[]>([]);
const similarArtists = ref<YTMPlaylist[]>([]);
const loading = ref(false);
const descExpanded = ref(false);
const colorCanvas = ref<HTMLCanvasElement | null>(null);
const extractedColors = ref<string[]>(['#1e293b', '#0f172a']);

const artistId = computed(() => String(route.params.id || ''));

const bannerStyle = computed(() => {
  const [c1, c2, c3] = extractedColors.value;
  const gradient = c3
    ? `linear-gradient(135deg, ${c1} 0%, ${c2} 50%, ${c3} 100%)`
    : `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`;
  return { background: gradient };
});

const extractColors = async (url: string) => {
  return new Promise<void>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = colorCanvas.value;
        if (!canvas) return resolve();
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve();

        ctx.drawImage(img, 0, 0, 8, 8);
        const data = ctx.getImageData(0, 0, 8, 8).data;

        const regions = [
          { x: 1, y: 1 },
          { x: 4, y: 4 },
          { x: 6, y: 6 }
        ];

        const colors = regions.map(({ x, y }) => {
          const idx = (y * 8 + x) * 4;
          let r = data[idx],
            g = data[idx + 1],
            b = data[idx + 2];
          const avg = (r + g + b) / 3;
          const satBoost = 1.4;
          r = Math.min(255, Math.round(avg + (r - avg) * satBoost));
          g = Math.min(255, Math.round(avg + (g - avg) * satBoost));
          b = Math.min(255, Math.round(avg + (b - avg) * satBoost));
          r = Math.round(r * 0.65);
          g = Math.round(g * 0.65);
          b = Math.round(b * 0.65);
          return { r, g, b };
        });

        extractedColors.value = colors.map((c) => `rgb(${c.r},${c.g},${c.b})`);

        if (window._applyThemeFromColor && colors.length > 0) {
          const c = colors[0];
          window._applyThemeFromColor(argbFromRgb(c.r, c.g, c.b));
        }
      } catch {}
      resolve();
    };
    img.onerror = () => resolve();
    img.src = url;
  });
};

const toSongResult = (song: YTMSong): SongResult => ({
  id: song.id,
  name: song.title,
  picUrl: song.thumbnail,
  source: 'ytmusic',
  artists: song.artists.map((a) => ({ name: a.name })),
  album: song.album
});

const loadArtist = async () => {
  const id = artistId.value;
  if (!id) return;

  loading.value = true;
  artist.value = null;
  songs.value = [];
  albums.value = [];
  playlists.value = [];
  descExpanded.value = false;
  extractedColors.value = ['#1e293b', '#0f172a'];

  try {
    const result = await getYTMArtist(id);
    artist.value = result;
    songs.value = result.songs.map(toSongResult);
    albums.value = result.albums;
    playlists.value = result.playlists;
    similarArtists.value = result.similarArtists;

    if (result.thumbnail) {
      const thumbUrl = getImgUrl(result.thumbnail, '100y100');
      await nextTick();
      await extractColors(thumbUrl);
    }
  } catch (error) {
    console.error('Failed to load artist:', error);
    message.error('Failed to load artist');
  } finally {
    loading.value = false;
  }
};

const playAll = () => {
  if (!songs.value.length) return;
  playerStore.setQueue(songs.value, false, true);
};

const shufflePlay = () => {
  if (!songs.value.length) return;
  const shuffled = [...songs.value].sort(() => Math.random() - 0.5);
  playerStore.setQueue(shuffled, false, true);
};

const albumItems = computed(() =>
  albums.value.map((album) => ({
    id: album.id,
    name: album.title,
    subtitle: album.subtitle,
    coverImgUrl: album.thumbnail
  }))
);

const playlistItems = computed(() =>
  playlists.value.map((playlist) => ({
    id: playlist.id,
    name: playlist.title,
    subtitle: playlist.subtitle,
    coverImgUrl: playlist.thumbnail
  }))
);

const similarArtistItems = computed(() =>
  similarArtists.value.map((artist) => ({
    id: artist.id,
    name: artist.title,
    coverImgUrl: artist.thumbnail
  }))
);

const openPlaylistItem = (id: string, name: string, type: 'album' | 'playlist') => {
  navigateToMusicList(router, {
    id,
    type,
    name,
    listInfo: { id, name }
  });
};

const openArtist = (id: string) => {
  router.push({ name: 'ArtistDetail', params: { id } });
};

const handleMore = (section: string) => {
  message.info(`${section} list coming soon!`);
};

onMounted(loadArtist);
watch(artistId, loadArtist);

import { onUnmounted } from 'vue';
onUnmounted(() => {
  if (window._restoreTheme) window._restoreTheme();
});
</script>

<style lang="scss" scoped>
.artist-page {
  @apply h-full w-full;
}

.artist-banner {
  transition: background 0.6s ease;
}

/* Frosted / hazy glass overlay — no image, just texture */
.banner-glass {
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(0px);

  /* Subtle noise pattern for a "material" feel */
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.08'/%3E%3C/svg%3E");
    background-size: 200px;
    opacity: 0.4;
    mix-blend-mode: overlay;
    pointer-events: none;
  }
}

.gradient-fade {
  background: linear-gradient(to bottom, transparent, white);

  :global(.dark) & {
    background: linear-gradient(to bottom, transparent, #0a0a0a);
  }
}

/* Hide scrollbar for horizontal carousels */
.hide-scrollbar {
  scrollbar-width: none;
  -ms-overflow-style: none;
  &::-webkit-scrollbar {
    display: none;
  }
}

.section-header {
  span:first-child {
    @apply font-semibold;
  }
}
</style>
