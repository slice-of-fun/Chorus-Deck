<template>
  <div class="search-page h-full w-full">
    <n-scrollbar class="h-full">
      <div class="search-content w-full pb-32 pt-6">
        <!-- ── Search bar ─────────────────────────────────────────── -->
        <div class="search-bar-wrapper relative mb-8">
          <div class="relative">
            <i
              class="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 text-lg pointer-events-none"
            />
            <input
              ref="searchInputRef"
              v-model="query"
              type="text"
              placeholder="Search songs, artists, albums, playlists…"
              class="w-full pl-12 pr-12 py-3.5 rounded-2xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary text-sm font-medium transition-all duration-200"
              @keyup.enter="() => doSearch(true)"
              @keyup.escape="clearQuery"
              @input="onQueryInput"
            />
            <button
              v-if="query"
              class="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
              @click="clearQuery"
            >
              <i class="ri-close-line text-lg" />
            </button>
          </div>

          <!-- Suggestions dropdown -->
          <div
            v-if="suggestions.length > 0 && query && !searchDone"
            class="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-xl z-50 overflow-hidden"
          >
            <button
              v-for="(s, i) in suggestions"
              :key="i"
              class="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors text-left"
              @click="selectSuggestion(s)"
            >
              <i class="text-base text-neutral-400 ri-search-line" />
              <span class="text-sm text-neutral-700 dark:text-neutral-300 flex-1">{{ s }}</span>
              <i
                class="ri-arrow-up-left-line text-neutral-300 dark:text-neutral-600 text-xs"
                title="Fill search bar"
              />
            </button>
          </div>
        </div>

        <!-- ── Search results ─────────────────────────────────────── -->
        <div v-if="searchDone">
          <!-- Result tabs -->
          <div class="flex items-center gap-1 mb-6 overflow-x-auto pb-1 no-scrollbar">
            <button
              v-for="tab in SEARCH_TABS"
              :key="tab.key"
              class="flex-shrink-0 px-4 py-1.5 rounded-xl text-sm font-semibold transition-all duration-200"
              :class="
                activeTab === tab.key
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800'
              "
              @click="switchTab(tab.key)"
            >
              {{ tab.label }}
            </button>
          </div>

          <!-- Loading results -->
          <div v-if="searchLoading" class="space-y-1">
            <div v-for="i in 8" :key="i" class="flex items-center gap-4 px-3 py-2.5 rounded-xl">
              <div
                :class="[
                  'w-12 h-12 skeleton-shimmer flex-shrink-0',
                  activeTab === 'artists' ? 'rounded-full' : 'rounded-lg'
                ]"
              />
              <div class="flex-1 space-y-2 min-w-0 py-1">
                <div class="h-4 w-2/3 skeleton-shimmer rounded" />
                <div class="h-3 w-1/3 skeleton-shimmer rounded" />
              </div>
            </div>
          </div>
          <div v-else-if="activeTab === 'all'" class="space-y-8">
            <div
              v-if="
                results.songs.length === 0 &&
                !results.playlists?.length &&
                !results.albums?.length &&
                !results.artists?.length &&
                !results.videos?.length
              "
              class="text-center py-12 text-neutral-400"
            >
              <i class="ri-search-line text-4xl opacity-30 mb-2" />
              <p class="text-sm">No results found for "{{ lastQuery }}"</p>
            </div>

            <section v-if="results.songs.length > 0" class="mb-8">
              <h2 class="text-xl font-bold text-neutral-900 dark:text-white mb-3 px-1">Songs</h2>
              <div
                class="flex flex-col gap-1 bg-neutral-100/80 dark:bg-neutral-900/50 rounded-3xl p-2"
              >
                <div
                  v-for="(song, idx) in results.songs"
                  :key="song.id"
                  class="search-result-row group flex items-center gap-4 px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10 transition-all cursor-pointer rounded-2xl"
                  :style="{ animationDelay: `${idx * 0.02}s` }"
                  @click="playSong(song)"
                >
                  <div
                    class="relative w-11 h-11 flex-shrink-0 rounded-lg overflow-hidden bg-neutral-200 dark:bg-neutral-800"
                  >
                    <img
                      :src="song.picUrl || getPlaceholder(song.name)"
                      :alt="song.name"
                      class="w-full h-full object-cover"
                      loading="lazy"
                      @error="onImgError($event, song.name)"
                    />
                    <div
                      class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    >
                      <i class="ri-play-fill text-white text-sm" />
                    </div>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p
                      class="text-sm font-semibold text-neutral-900 dark:text-white line-clamp-1 group-hover:text-primary transition-colors"
                    >
                      {{ song.name }}
                    </p>
                    <p class="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1 mt-0.5">
                      {{ (song.artists || []).map((a) => a.name).join(', ') }}
                      <span v-if="song.album"> · {{ song.album }}</span>
                    </p>
                  </div>
                  <span
                    v-if="formatTime(song.dt)"
                    class="text-xs text-neutral-400 flex-shrink-0 tabular-nums"
                  >
                    {{ formatTime(song.dt) }}
                  </span>
                </div>
              </div>
            </section>

            <!-- Videos are only shown in the dedicated Videos tab, not in All -->

            <section v-if="results.artists && results.artists.length > 0" class="mb-8">
              <h2 class="text-xl font-bold text-neutral-900 dark:text-white mb-3 px-1">Artists</h2>
              <div
                class="flex flex-col gap-1 bg-neutral-100/80 dark:bg-neutral-900/50 rounded-3xl p-2"
              >
                <div
                  v-for="(ar, idx) in results.artists"
                  :key="ar.id"
                  class="search-result-row group flex items-center gap-4 px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10 transition-all cursor-pointer rounded-2xl"
                  :style="{ animationDelay: `${idx * 0.02}s` }"
                >
                  <div
                    class="relative w-12 h-12 flex-shrink-0 rounded-full overflow-hidden bg-neutral-200 dark:bg-neutral-800"
                  >
                    <img
                      :src="ar.picUrl || getPlaceholder(ar.name)"
                      :alt="ar.name"
                      class="w-full h-full object-cover"
                      loading="lazy"
                      @error="onImgError($event, ar.name)"
                    />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p
                      class="text-sm font-semibold text-neutral-900 dark:text-white line-clamp-1 group-hover:text-primary transition-colors"
                    >
                      {{ ar.name }}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section v-if="results.albums && results.albums.length > 0" class="mb-8">
              <h2 class="text-xl font-bold text-neutral-900 dark:text-white mb-3 px-1">Albums</h2>
              <div
                class="flex flex-col gap-1 bg-neutral-100/80 dark:bg-neutral-900/50 rounded-3xl p-2"
              >
                <div
                  v-for="(al, idx) in results.albums"
                  :key="al.id"
                  class="search-result-row group flex items-center gap-4 px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10 transition-all cursor-pointer rounded-2xl"
                  :style="{ animationDelay: `${idx * 0.02}s` }"
                >
                  <div
                    class="relative w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-neutral-200 dark:bg-neutral-800"
                  >
                    <img
                      :src="al.picUrl || getPlaceholder(al.name)"
                      :alt="al.name"
                      class="w-full h-full object-cover"
                      loading="lazy"
                      @error="onImgError($event, al.name)"
                    />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p
                      class="text-sm font-semibold text-neutral-900 dark:text-white line-clamp-1 group-hover:text-primary transition-colors"
                    >
                      {{ al.name }}
                    </p>
                    <p
                      v-if="al.desc"
                      class="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1 mt-0.5"
                    >
                      {{ al.desc }}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section v-if="results.playlists && results.playlists.length > 0" class="mb-8">
              <h2 class="text-xl font-bold text-neutral-900 dark:text-white mb-3 px-1">
                Playlists
              </h2>
              <div
                class="flex flex-col gap-1 bg-neutral-100/80 dark:bg-neutral-900/50 rounded-3xl p-2"
              >
                <div
                  v-for="(pl, idx) in results.playlists"
                  :key="pl.id"
                  class="search-result-row group flex items-center gap-4 px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10 transition-all cursor-pointer rounded-2xl"
                  :style="{ animationDelay: `${idx * 0.02}s` }"
                >
                  <div
                    class="relative w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-neutral-200 dark:bg-neutral-800"
                  >
                    <img
                      :src="pl.picUrl || getPlaceholder(pl.name)"
                      :alt="pl.name"
                      class="w-full h-full object-cover"
                      loading="lazy"
                      @error="onImgError($event, pl.name)"
                    />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p
                      class="text-sm font-semibold text-neutral-900 dark:text-white line-clamp-1 group-hover:text-primary transition-colors"
                    >
                      {{ pl.name }}
                    </p>
                    <p
                      v-if="pl.desc"
                      class="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2 mt-0.5"
                    >
                      {{ pl.desc }}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <!-- Songs -->
          <div v-else-if="activeTab === 'songs'">
            <div v-if="results.songs.length === 0" class="text-center py-12 text-neutral-400">
              <i class="ri-music-2-line text-4xl opacity-30 mb-2" />
              <p class="text-sm">No songs found for "{{ lastQuery }}"</p>
            </div>
            <div
              v-else
              class="flex flex-col gap-1 bg-neutral-100/80 dark:bg-neutral-900/50 rounded-3xl p-2"
            >
              <div
                v-for="(song, idx) in results.songs"
                :key="song.id"
                class="search-result-row group flex items-center gap-4 px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10 transition-all cursor-pointer rounded-2xl"
                :style="{ animationDelay: `${idx * 0.02}s` }"
                @click="playSong(song)"
              >
                <div
                  class="relative w-11 h-11 flex-shrink-0 rounded-lg overflow-hidden bg-neutral-200 dark:bg-neutral-800"
                >
                  <img
                    :src="song.picUrl || getPlaceholder(song.name)"
                    :alt="song.name"
                    class="w-full h-full object-cover"
                    loading="lazy"
                    @error="onImgError($event, song.name)"
                  />
                  <div
                    class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  >
                    <i class="ri-play-fill text-white text-sm" />
                  </div>
                </div>
                <div class="flex-1 min-w-0">
                  <p
                    class="text-sm font-semibold text-neutral-900 dark:text-white line-clamp-1 group-hover:text-primary transition-colors"
                  >
                    {{ song.name }}
                  </p>
                  <p class="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1 mt-0.5">
                    {{ (song.artists || []).map((a) => a.name).join(', ') }}
                    <span v-if="song.album"> · {{ song.album }}</span>
                  </p>
                </div>
                <span
                  v-if="formatTime(song.dt)"
                  class="text-xs text-neutral-400 flex-shrink-0 tabular-nums"
                >
                  {{ formatTime(song.dt) }}
                </span>
              </div>
            </div>
          </div>

          <!-- Playlists -->
          <div v-else-if="activeTab === 'playlists'">
            <div v-if="results.playlists?.length === 0" class="text-center py-12 text-neutral-400">
              <i class="ri-play-list-2-line text-4xl opacity-30 mb-2" />
              <p class="text-sm">No playlists found for "{{ lastQuery }}"</p>
            </div>
            <div
              v-else
              class="flex flex-col gap-1 bg-neutral-100/80 dark:bg-neutral-900/50 rounded-3xl p-2"
            >
              <div
                v-for="(pl, idx) in results.playlists"
                :key="pl.id"
                class="search-result-row group flex items-center gap-4 px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10 transition-all cursor-pointer rounded-2xl"
                :style="{ animationDelay: `${idx * 0.02}s` }"
              >
                <div
                  class="relative w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-neutral-200 dark:bg-neutral-800"
                >
                  <img
                    :src="pl.picUrl || getPlaceholder(pl.name)"
                    :alt="pl.name"
                    class="w-full h-full object-cover"
                    loading="lazy"
                    @error="onImgError($event, pl.name)"
                  />
                </div>
                <div class="flex-1 min-w-0">
                  <p
                    class="text-sm font-semibold text-neutral-900 dark:text-white line-clamp-1 group-hover:text-primary transition-colors"
                  >
                    {{ pl.name }}
                  </p>
                  <p
                    v-if="pl.desc"
                    class="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2 mt-0.5"
                  >
                    {{ pl.desc }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Albums -->
          <div v-else-if="activeTab === 'albums'">
            <div v-if="results.albums?.length === 0" class="text-center py-12 text-neutral-400">
              <i class="ri-album-line text-4xl opacity-30 mb-2" />
              <p class="text-sm">No albums found for "{{ lastQuery }}"</p>
            </div>
            <div
              v-else
              class="flex flex-col gap-1 bg-neutral-100/80 dark:bg-neutral-900/50 rounded-3xl p-2"
            >
              <div
                v-for="(al, idx) in results.albums"
                :key="al.id"
                class="search-result-row group flex items-center gap-4 px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10 transition-all cursor-pointer rounded-2xl"
                :style="{ animationDelay: `${idx * 0.02}s` }"
              >
                <div
                  class="relative w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-neutral-200 dark:bg-neutral-800"
                >
                  <img
                    :src="al.picUrl || getPlaceholder(al.name)"
                    :alt="al.name"
                    class="w-full h-full object-cover"
                    loading="lazy"
                    @error="onImgError($event, al.name)"
                  />
                </div>
                <div class="flex-1 min-w-0">
                  <p
                    class="text-sm font-semibold text-neutral-900 dark:text-white line-clamp-1 group-hover:text-primary transition-colors"
                  >
                    {{ al.name }}
                  </p>
                  <p
                    v-if="al.desc"
                    class="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1 mt-0.5"
                  >
                    {{ al.desc }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Artists -->
          <div v-else-if="activeTab === 'artists'">
            <div v-if="results.artists?.length === 0" class="text-center py-12 text-neutral-400">
              <i class="ri-mic-line text-4xl opacity-30 mb-2" />
              <p class="text-sm">No artists found for "{{ lastQuery }}"</p>
            </div>
            <div
              v-else
              class="flex flex-col gap-1 bg-neutral-100/80 dark:bg-neutral-900/50 rounded-3xl p-2"
            >
              <div
                v-for="(ar, idx) in results.artists"
                :key="ar.id"
                class="search-result-row group flex items-center gap-4 px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10 transition-all cursor-pointer rounded-2xl"
                :style="{ animationDelay: `${idx * 0.02}s` }"
              >
                <div
                  class="relative w-12 h-12 flex-shrink-0 rounded-full overflow-hidden bg-neutral-200 dark:bg-neutral-800"
                >
                  <img
                    :src="ar.picUrl || getPlaceholder(ar.name)"
                    :alt="ar.name"
                    class="w-full h-full object-cover"
                    loading="lazy"
                    @error="onImgError($event, ar.name)"
                  />
                </div>
                <div class="flex-1 min-w-0">
                  <p
                    class="text-sm font-semibold text-neutral-900 dark:text-white line-clamp-1 group-hover:text-primary transition-colors"
                  >
                    {{ ar.name }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Videos -->
          <div v-else-if="activeTab === 'videos'">
            <div v-if="results.videos?.length === 0" class="text-center py-12 text-neutral-400">
              <i class="ri-video-line text-4xl opacity-30 mb-2" />
              <p class="text-sm">No videos found for "{{ lastQuery }}"</p>
            </div>
            <div
              v-else
              class="flex flex-col gap-1 bg-neutral-100/80 dark:bg-neutral-900/50 rounded-3xl p-2"
            >
              <div
                v-for="(video, idx) in results.videos"
                :key="video.id"
                class="search-result-row group flex items-center gap-4 px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10 transition-all cursor-pointer rounded-2xl"
                :style="{ animationDelay: `${idx * 0.02}s` }"
                @click="playSong(video)"
              >
                <div
                  class="relative w-20 h-11 flex-shrink-0 rounded-lg overflow-hidden bg-neutral-200 dark:bg-neutral-800"
                >
                  <img
                    :src="video.picUrl || getPlaceholder(video.name)"
                    :alt="video.name"
                    class="w-full h-full object-cover"
                    loading="lazy"
                    @error="onImgError($event, video.name)"
                  />
                  <div
                    class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  >
                    <i class="ri-play-fill text-white text-sm" />
                  </div>
                </div>
                <div class="flex-1 min-w-0">
                  <p
                    class="text-sm font-semibold text-neutral-900 dark:text-white line-clamp-1 group-hover:text-primary transition-colors"
                  >
                    {{ video.name }}
                  </p>
                  <p class="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1 mt-0.5">
                    {{ (video.artists || []).map((a) => a.name).join(', ') }}
                  </p>
                </div>
                <span
                  v-if="formatTime(video.dt)"
                  class="text-xs text-neutral-400 flex-shrink-0 tabular-nums"
                >
                  {{ formatTime(video.dt) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- ── Idle: History + Moods ──────────────────────────────── -->
        <div v-else class="space-y-12">
          <!-- Search history -->
          <section v-if="searchHistory.length > 0">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-bold text-neutral-900 dark:text-white">Recent Searches</h2>
              <button
                class="text-xs text-neutral-400 hover:text-red-500 transition-colors font-medium"
                @click="clearHistory"
              >
                Clear all
              </button>
            </div>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="(item, i) in searchHistory"
                :key="i"
                class="group relative flex items-center gap-2 px-4 py-1.5 rounded-full bg-neutral-100 dark:bg-neutral-900 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all"
                @click="selectSuggestion(item)"
              >
                <i class="ri-time-line text-neutral-400 text-xs" />
                <span>{{ item }}</span>
                <i
                  class="ri-close-line text-neutral-400 hover:text-red-500 transition-colors text-xs"
                  @click.stop="removeHistory(item)"
                />
              </button>
            </div>
          </section>

          <!-- Moods & Genres -->
          <section>
            <h2 class="text-lg font-bold text-neutral-900 dark:text-white mb-5">
              Moods &amp; Genres
            </h2>
            <div v-if="moodsLoading" class="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <div v-for="i in 12" :key="i" class="h-20 skeleton-shimmer rounded-2xl" />
            </div>
            <div v-else class="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <button
                v-for="(mood, i) in moods"
                :key="mood.id"
                class="mood-pill group relative h-20 rounded-2xl overflow-hidden text-white font-bold text-sm cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-lg"
                :style="{ animationDelay: `${i * 0.03}s` }"
                @click="searchByMood(mood.title)"
              >
                <img
                  :src="mood.thumbnail || getPlaceholder(mood.title)"
                  :alt="mood.title"
                  class="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity"
                  loading="lazy"
                  @error="onImgError($event, mood.title)"
                />
                <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <span class="absolute bottom-0 left-0 right-0 p-3 text-left leading-tight">
                  {{ mood.title }}
                </span>
              </button>
            </div>
          </section>
        </div>
      </div>
    </n-scrollbar>
  </div>
</template>

<script lang="ts" setup>
import { NScrollbar, NSelect } from 'naive-ui';
import { onMounted, ref, watch } from 'vue';

import type { SearchFilter, SearchResults } from '@/api/provider';
import { getProvider } from '@/api/providers';
import { getYTMMoods, type YTMMood } from '@/api/ytmusic';
import logoImg from '@/assets/logo.png';
import { useQueueStore } from '@/store/modules/queue';
import type { SongResult } from '@/types/music';
import { secondToMinute } from '@/utils';

defineOptions({ name: 'Search' });

const SEARCH_TABS = [
  { key: 'all', label: 'All' },
  { key: 'songs', label: 'Songs' },
  { key: 'videos', label: 'Videos' },
  { key: 'albums', label: 'Albums' },
  { key: 'artists', label: 'Artists' },
  { key: 'playlists', label: 'Playlists' }
] as const;

const HISTORY_KEY = 'ytm_search_history';
const MAX_HISTORY = 20;
const SUGGESTION_DEBOUNCE = 350;

// ─── State ────────────────────────────────────────────────────────────────────

const query = ref('');
const lastQuery = ref('');
const suggestions = ref<string[]>([]);
const searchDone = ref(false);
const searchLoading = ref(false);
const activeTab = ref<'all' | 'songs' | 'videos' | 'albums' | 'artists' | 'playlists'>('all');
const results = ref<
  SearchResults & {
    topResult?: SongResult;
    total?: number;
  }
>({
  topResult: undefined,
  songs: [],
  playlists: [],
  albums: [],
  artists: [],
  videos: [],
  total: 0
});

const moods = ref<YTMMood[]>([]);
const moodsLoading = ref(false);
const searchHistory = ref<string[]>([]);

const searchInputRef = ref<HTMLInputElement | null>(null);
const suggestDebounceTimer = ref<ReturnType<typeof setTimeout> | null>(null);

const playlistStore = useQueueStore();

const formatTime = (time?: number | string) => {
  if (!time) return '';
  if (typeof time === 'string') {
    if (time.includes(':')) return time;
    return secondToMinute(Number(time));
  }
  return secondToMinute(time);
};

function getTabCount(key: string): number {
  if (key === 'songs') return results.value.songs?.length || 0;
  if (key === 'playlists') return results.value.playlists?.length || 0;
  if (key === 'albums') return results.value.albums?.length || 0;
  if (key === 'artists') return results.value.artists?.length || 0;
  if (key === 'videos') return results.value.videos?.length || 0;
  return 0;
}

function getPlaceholder(title: string): string {
  return logoImg;
}

function onImgError(event: Event, title: string) {
  (event.target as HTMLImageElement).src = getPlaceholder(title);
}

let suggestAbortController: AbortController | null = null;

function onQueryInput() {
  if (suggestAbortController) suggestAbortController.abort();
  suggestAbortController = new AbortController();
  if (!query.value.trim()) {
    suggestions.value = [];
    return;
  }
  suggestDebounceTimer.value = setTimeout(
    async () => {
      try {
        const provider = getProvider();
        suggestions.value = await provider.getSuggestions(query.value.trim());
      } catch {
        // request cancelled - ignore
      }
    },
    SUGGESTION_DEBOUNCE,
    { signal: suggestAbortController.signal }
  );
}

function clearQuery() {
  query.value = '';
  suggestions.value = [];
  searchDone.value = false;
  results.value = {
    topResult: undefined,
    songs: [],
    playlists: [],
    albums: [],
    artists: [],
    videos: [],
    total: 0
  };
}

function selectSuggestion(q: string) {
  query.value = q;
  suggestions.value = [];
  doSearch();
}

function switchTab(tab: 'all' | 'songs' | 'videos' | 'albums' | 'artists' | 'playlists') {
  if (activeTab.value === tab) return;
  activeTab.value = tab;
  if (query.value.trim()) {
    doSearch(false);
  }
}

async function doSearch(clearResults = true) {
  const q = query.value.trim();
  if (!q) return;
  suggestions.value = [];
  saveHistory(q);
  lastQuery.value = q;
  searchDone.value = true;
  searchLoading.value = true;

  if (clearResults) {
    results.value = {
      topResult: undefined,
      songs: [],
      playlists: [],
      albums: [],
      artists: [],
      videos: [],
      total: 0
    };
    activeTab.value = 'all';
  }

  try {
    const provider = getProvider();
    const res = await provider.search({
      keywords: q,
      type: activeTab.value === 'all' ? undefined : (activeTab.value as SearchFilter)
    });

    if (activeTab.value === 'all') {
      results.value = res;
    } else {
      results.value[activeTab.value] = res[activeTab.value] as never;
    }
  } catch (e) {
    console.error(e);
  } finally {
    searchLoading.value = false;
  }
}

function searchByMood(title: string) {
  query.value = title;
  doSearch();
}

function playSong(song: SongResult) {
  playlistStore.setQueue([song], false, false);
  window.dispatchEvent(new CustomEvent('ytm:play', { detail: song }));
}

// ─── History ─────────────────────────────────────────────────────────────────

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    searchHistory.value = raw ? JSON.parse(raw) : [];
  } catch {
    searchHistory.value = [];
  }
}

function saveHistory(q: string) {
  searchHistory.value = [q, ...searchHistory.value.filter((h) => h !== q)].slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(searchHistory.value));
}

function removeHistory(q: string) {
  searchHistory.value = searchHistory.value.filter((h) => h !== q);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(searchHistory.value));
}

function clearHistory() {
  searchHistory.value = [];
  localStorage.removeItem(HISTORY_KEY);
}

// ─── Moods ────────────────────────────────────────────────────────────────────

async function loadMoods() {
  moodsLoading.value = true;
  try {
    moods.value = await getYTMMoods();
  } catch {
    moods.value = [];
  } finally {
    moodsLoading.value = false;
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(() => {
  loadHistory();
  loadMoods();
  searchInputRef.value?.focus();
});
</script>

<style lang="scss" scoped>
.search-page {
  position: relative;
}

.search-result-row {
  animation: fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) backwards;
}

.mood-pill {
  animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) backwards;
}

.ytm-playlist-card {
  animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) backwards;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.no-scrollbar {
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
}
</style>
