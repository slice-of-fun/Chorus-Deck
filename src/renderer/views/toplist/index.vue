<template>
  <div class="charts-page h-full w-full ">
    <n-scrollbar class="h-full">
      <div class="charts-content w-full pb-32 pt-6">
        <div class="mb-10 flex items-end justify-between">
          <div>
            <h1
              class="text-3xl md:text-4xl font-bold tracking-tight text-neutral-900 dark:text-white mb-2"
            >
              Charts
            </h1>
            <p class="text-neutral-500 dark:text-neutral-400">
              What the world is listening to right now
            </p>
          </div>
          <button
            class="flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all"
            @click="refresh"
            :disabled="loading"
          >
            <i
              :class="['ri-refresh-line text-base transition-transform', loading && 'animate-spin']"
            />
            Refresh
          </button>
        </div>

        <div v-if="loading && sections.length === 0" class="space-y-12">
          <div v-for="s in 2" :key="s" class="space-y-6">
            <!-- Section header: bar + title + pill -->
            <div class="flex items-center gap-3">
              <div class="h-5 w-1 rounded-full skeleton-shimmer" />
              <div class="h-6 w-40 skeleton-shimmer rounded-lg" />
              <div class="h-5 w-16 skeleton-shimmer rounded-full" />
            </div>
            <!-- 2-col grid matching lg:grid-cols-2 chart-row items -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-2">
              <div
                v-for="i in 12"
                :key="i"
                class="flex items-center gap-4 px-4 py-3 rounded-xl"
                :class="{ 'bg-neutral-50/50 dark:bg-neutral-900/30': i % 2 !== 0 }"
              >
                <!-- rank number -->
                <div class="w-7 h-5 skeleton-shimmer rounded flex-shrink-0" />
                <!-- thumbnail w-12 h-12 -->
                <div class="w-12 h-12 skeleton-shimmer rounded-lg flex-shrink-0" />
                <!-- title + artist lines -->
                <div class="flex-1 space-y-2 min-w-0">
                  <div class="h-4 w-2/3 skeleton-shimmer rounded" />
                  <div class="h-3 w-1/3 skeleton-shimmer rounded" />
                </div>
                <!-- duration -->
                <div class="w-10 h-3 skeleton-shimmer rounded flex-shrink-0" />
              </div>
            </div>
          </div>
        </div>

        <!-- ── Error state ───────────────────────────────────────── -->
        <div v-else-if="error" class="flex flex-col items-center justify-center py-24 text-center">
          <i class="ri-bar-chart-2-line text-5xl text-neutral-300 dark:text-neutral-700 mb-4" />
          <p class="text-neutral-500 dark:text-neutral-400 mb-4">{{ error }}</p>
          <button
            class="px-6 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
            @click="loadCharts"
          >
            Try again
          </button>
        </div>

        <!-- ── Sections ──────────────────────────────────────────── -->
        <div v-else class="space-y-14">
          <section v-for="(section, si) in sections" :key="si" class="charts-section">
            <!-- Section header -->
            <div class="flex items-center gap-3 mb-6">
              <div class="h-5 w-1 rounded-full bg-primary" />
              <h2 class="text-xl font-bold text-neutral-900 dark:text-white">
                {{ section.title }}
              </h2>
              <span
                class="text-xs font-medium px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400"
              >
                {{ section.items.length }} tracks
              </span>
            </div>

            <!-- Ranked list — 2 column desktop grid (like Android's LazyHorizontalGrid 4-row) -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-2">
              <div
                v-for="(item, idx) in section.items.slice(0, 20)"
                :key="item.id || idx"
                class="chart-row group flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-900/60 transition-all duration-200 cursor-pointer"
                :class="{ 'bg-neutral-50/50 dark:bg-neutral-900/30': idx % 2 === 0 }"
                :style="{ animationDelay: `${idx * 0.025}s` }"
                @click="playSong(item)"
              >
                <!-- Rank -->
                <span
                  class="w-7 text-center text-lg font-black italic flex-shrink-0 transition-colors duration-300"
                  :class="
                    idx === 0
                      ? 'text-yellow-500'
                      : idx === 1
                        ? 'text-slate-400'
                        : idx === 2
                          ? 'text-amber-600'
                          : 'text-neutral-300 dark:text-neutral-700'
                  "
                >
                  {{ idx + 1 }}
                </span>

                <!-- Thumbnail -->
                <div
                  class="relative flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-neutral-200 dark:bg-neutral-800"
                >
                  <img
                    :src="item.thumbnail || getPlaceholder(item.title)"
                    :alt="item.title"
                    class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    loading="lazy"
                    @error="onImgError($event, item.title)"
                  />
                  <!-- Play overlay -->
                  <div
                    class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  >
                    <i class="ri-play-fill text-white text-base" />
                  </div>
                </div>

                <!-- Info -->
                <div class="flex-1 min-w-0">
                  <p
                    class="text-sm font-semibold text-neutral-900 dark:text-white line-clamp-1 group-hover:text-primary transition-colors"
                  >
                    {{ item.title }}
                  </p>
                  <p class="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1 mt-0.5">
                    {{ getSubtitle(item) }}
                  </p>
                </div>

                <!-- Duration -->
                <span
                  v-if="isYTMSong(item) && item.duration"
                  class="text-xs text-neutral-400 dark:text-neutral-600 flex-shrink-0 tabular-nums"
                >
                  {{ item.duration }}
                </span>

                <!-- More button -->
                <button
                  class="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 flex items-center justify-center rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700"
                  @click.stop
                >
                  <i class="ri-more-2-fill text-neutral-500 text-sm" />
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </n-scrollbar>
  </div>
</template>

<script lang="ts" setup>
import { NScrollbar } from 'naive-ui';
import { onMounted, ref } from 'vue';

import {
  getYTMCharts,
  isYTMSong,
  type YTMPlaylist,
  type YTMSection,
  type YTMSong
} from '@/api/ytmusic';
import logoImg from '@/assets/logo.png';
import { useQueueStore } from '@/store/modules/queue';
import type { SongResult } from '@/types/music';

defineOptions({ name: 'Charts' });


const sections = ref<YTMSection[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const playlistStore = useQueueStore();


function getSubtitle(item: YTMSong | YTMPlaylist): string {
  if (isYTMSong(item)) {
    return item.artists.map((a) => a.name).join(', ') || item.album || '';
  }
  return item.subtitle || '';
}

function getPlaceholder(title: string): string {
  return logoImg;
}

function onImgError(event: Event, title: string) {
  (event.target as HTMLImageElement).src = getPlaceholder(title);
}

function playSong(item: YTMSong | YTMPlaylist) {
  if (!isYTMSong(item)) return;
  const track: SongResult = {
    id: item.id,
    name: item.title,
    picUrl: item.thumbnail,
    source: 'ytmusic',
    artists: item.artists.map((a) => ({ name: a.name }))
  };
  playlistStore.setQueue([track], false, false);
  window.dispatchEvent(new CustomEvent('ytm:play', { detail: track }));
}

async function loadCharts() {
  loading.value = true;
  error.value = null;
  try {
    const page = await getYTMCharts();
    sections.value = page.sections.filter((s) => s.items.length > 0);
  } catch (e: any) {
    error.value = e.message || 'Could not load charts';
  } finally {
    loading.value = false;
  }
}

function refresh() {
  sections.value = [];
  loadCharts();
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(() => {
  loadCharts();
});
</script>

<style lang="scss" scoped>
.charts-page {
  position: relative;
}

.chart-row {
  animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) backwards;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
