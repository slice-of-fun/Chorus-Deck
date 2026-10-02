<template>
  <div class="ytm-home h-full w-full ">
    <n-scrollbar class="h-full" ref="scrollRef">
      <div class="home-content w-full pb-32">
        <!-- ── Header ──────────────────────────────────────────────── -->
        <div class="home-header flex items-center justify-between mb-8 pt-2">
          <div>
            <h1 class="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
              Good {{ greeting }},
              <span class="text-primary">{{ userName }}</span>
            </h1>
            <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              {{ headerSubtitle }}
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

        <!-- ── Loading skeleton ───────────────────────────────────── -->
        <div v-if="loading && sections.length === 0" class="space-y-12">
          <div v-for="s in 3" :key="s" class="space-y-5">
            <!-- Section header skeleton: title + dot + 'More' link -->
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="h-6 w-40 skeleton-shimmer rounded-lg" />
                <div class="h-1.5 w-1.5 rounded-full skeleton-shimmer" />
              </div>
              <div class="h-4 w-10 skeleton-shimmer rounded-lg" />
            </div>
            <!-- Horizontal scroll row: w-44 cards matching real .ytm-card -->
            <div class="flex gap-5 overflow-hidden">
              <div v-for="i in 6" :key="i" class="flex-shrink-0 w-44 space-y-3">
                <div class="aspect-square skeleton-shimmer rounded-2xl" />
                <div class="h-4 w-3/4 skeleton-shimmer rounded-lg" />
                <div class="h-3 w-1/2 skeleton-shimmer rounded-lg" />
              </div>
            </div>
          </div>
        </div>

        <!-- ── Error state ───────────────────────────────────────── -->
        <div v-else-if="error" class="flex flex-col items-center justify-center py-24 text-center">
          <i class="ri-wifi-off-line text-5xl text-neutral-300 dark:text-neutral-700 mb-4" />
          <p class="text-neutral-500 dark:text-neutral-400 mb-4">{{ error }}</p>
          <button
            class="px-6 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
            @click="loadHome"
          >
            Try again
          </button>
        </div>

        <!-- ── Sections ──────────────────────────────────────────── -->
        <div v-else class="space-y-12">
          <section v-for="(section, si) in sections" :key="si" class="home-section">
            <!-- Section header -->
            <div class="flex items-center justify-between mb-5">
              <div class="flex items-center gap-3">
                <h2 class="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
                  {{ section.title }}
                </h2>
                <div class="h-1.5 w-1.5 rounded-full bg-primary" />
              </div>
              <button
                class="group flex items-center gap-1 text-sm font-semibold text-neutral-400 hover:text-primary dark:text-neutral-500 dark:hover:text-white transition-colors"
                @click="scrollSection(si, 1)"
              >
                <span>More</span>
                <i class="ri-arrow-right-s-line transition-transform group-hover:translate-x-1" />
              </button>
            </div>

            <!-- Items grid -->
            <div
              class="home-section-scroll overflow-x-auto pb-2"
              :ref="(el) => (sectionRefs[si] = el as HTMLElement | null)"
            >
              <div class="flex gap-5" :style="{ width: 'max-content' }">
                <div
                  v-for="(item, idx) in section.items.slice(0, 10)"
                  :key="item.id || idx"
                  class="ytm-card group flex-shrink-0 w-44 cursor-pointer"
                  :style="{ animationDelay: `${idx * 0.04}s` }"
                  @click="handleItemClick(item)"
                >
                  <!-- Cover -->
                  <div
                    class="relative aspect-square overflow-hidden rounded-2xl shadow-md group-hover:shadow-xl transition-all duration-500 mb-3"
                    :class="
                      isVideoThumb(item.thumbnail)
                        ? 'bg-black'
                        : 'bg-neutral-100 dark:bg-neutral-900'
                    "
                  >
                    <img
                      :src="item.thumbnail || getPlaceholder(item.title)"
                      :alt="item.title"
                      :class="[
                        'w-full h-full transition-transform duration-700 group-hover:scale-110',
                        isVideoThumb(item.thumbnail) ? 'object-contain' : 'object-cover'
                      ]"
                      loading="lazy"
                      @error="onImgError($event, item.title)"
                    />
                    <!-- Play button overlay -->
                    <div
                      class="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-all duration-300"
                    >
                      <button
                        class="play-btn w-11 h-11 rounded-full bg-white/95 flex items-center justify-center opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300 shadow-lg"
                        @click.stop="playSong(item)"
                      >
                        <i class="ri-play-fill text-xl text-neutral-900 ml-0.5" />
                      </button>
                    </div>
                  </div>

                  <!-- Info -->
                  <div class="space-y-0.5">
                    <p
                      class="text-sm font-semibold text-neutral-900 dark:text-white line-clamp-1 group-hover:text-primary transition-colors"
                    >
                      {{ item.title }}
                    </p>
                    <p class="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1">
                      {{ getSubtitle(item) }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </n-scrollbar>
  </div>
</template>

<script lang="ts" setup>
import { useMessage } from 'naive-ui';
import { NScrollbar } from 'naive-ui';
import { computed, onMounted, type Ref, ref } from 'vue';

import {
  getYTMHome,
  isYTMSong,
  type YTMPlaylist,
  type YTMSection,
  type YTMSong
} from '@/api/ytmusic';
import logoImg from '@/assets/logo.png';
import { useQueueStore } from '@/store/modules/queue';
import type { SongResult } from '@/types/music';

defineOptions({ name: 'Home' });

// ─── State ────────────────────────────────────────────────────────────────────

const sections = ref<YTMSection[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const sectionRefs = ref<Record<number, HTMLElement | null>>({});

const message = useMessage();
const playlistStore = useQueueStore();

const greeting = computed(() => {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
});

const userName = computed(() => {
  try {
    const stored = localStorage.getItem('userInfo');
    if (stored) return JSON.parse(stored)?.nickname || 'music lover';
  } catch {
    /* empty */
  }
  return 'music lover';
});

const headerSubtitle = computed(() => {
  const subs = [
    'Your personalized YouTube Music feed',
    'Fresh picks from YouTube Music',
    "What's trending on YouTube Music"
  ];
  return subs[new Date().getDay() % subs.length];
});

function getSubtitle(item: YTMSong | YTMPlaylist): string {
  if (isYTMSong(item)) {
    return item.artists.map((a) => a.name).join(', ') || item.album || '';
  }
  return item.subtitle || '';
}

function isVideoThumb(url?: string): boolean {
  return !!url && url.includes('i.ytimg.com');
}

function getPlaceholder(title: string): string {
  return logoImg;
}

function onImgError(event: Event, title: string) {
  (event.target as HTMLImageElement).src = getPlaceholder(title);
}

function handleItemClick(item: YTMSong | YTMPlaylist) {
  if (isYTMSong(item)) {
    playSong(item);
  }
}

function playSong(item: YTMSong | YTMPlaylist) {
  if (!isYTMSong(item)) return;
  // Queue single song for playback via ytm video id
  // The actual playback is handled by the existing Howler/yt service
  const track: SongResult = {
    id: item.id,
    name: item.title,
    picUrl: item.thumbnail,
    source: 'ytmusic',
    artists: item.artists.map((a) => ({ name: a.name }))
  };
  playlistStore.setQueue([track], false, false);
  // Emit play event — existing playback controller will handle it
  window.dispatchEvent(new CustomEvent('ytm:play', { detail: track }));
}

function scrollSection(idx: number, dir: 1 | -1) {
  const el = sectionRefs.value[idx];
  if (!el) return;
  el.scrollBy({ left: dir * 800, behavior: 'smooth' });
}

async function loadHome() {
  loading.value = true;
  error.value = null;
  sections.value = [];
  try {
    const page = await getYTMHome();
    const networkSections = page.sections.filter((s) => s.items.length > 0);
    sections.value = [...sections.value, ...networkSections];
  } catch (e: any) {
    if (sections.value.length === 0) {
      error.value = e.message || 'Could not load YouTube Music home';
    }
  } finally {
    loading.value = false;
  }
}

function refresh() {
  sections.value = [];
  loadHome();
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(() => {
  loadHome();
});
</script>

<style lang="scss" scoped>
.ytm-home {
  position: relative;
}

.ytm-card {
  animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) backwards;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.home-section-scroll {
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
}
</style>
