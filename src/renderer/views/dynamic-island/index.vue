<template>
  <div class="dynamic-island-container">
    <div class="trigger-zone" @mouseenter="handleZoneEnter" @mouseleave="handleZoneLeave">
      <div
        class="dynamic-island"
        :class="[currentState, { 'is-active': isPlaying }]"
        @mouseenter="handleIslandEnter"
      >
        <Transition name="island-content" mode="out-in">
          <div v-if="currentState === 'hidden'" key="hidden" class="hidden-trigger-zone"></div>

          <div v-else-if="currentState === 'playing'" key="playing" class="notch-container w-full h-full">
            <Transition name="notch-swap" mode="out-in">
              <playing-state v-if="isPlaying" key="ps" :currentTrack="currentTrack" :progressPercent="progressPercent" :isDark="isDark" :accentColor="accentColor" />
              <idle-state v-else key="is" :isDark="isDark" />
            </Transition>
          </div>

          <div v-else-if="currentState === 'expanded'" key="expanded" class="island expanded-island">
            <div class="expanded-top">
              <div class="artwork-ring-wrap" v-if="currentTrack.cover && !coverFailed">
                <svg class="artwork-ring" viewBox="0 0 76 76">
                  <path class="ring-bg" :d="bigRing" :stroke="accentColor" />
                </svg>
                <div class="artwork-medium" :style="{ clipPath: bigArtClip }">
                  <img :src="currentTrack.cover" crossorigin="anonymous" referrerpolicy="no-referrer" @error="coverFailed = true" />
                </div>
              </div>
              <div class="artwork-ring-wrap" v-else>
                <svg class="artwork-ring" viewBox="0 0 76 76">
                  <path class="ring-bg" :d="bigRing" :stroke="accentColor" />
                </svg>
                <div class="artwork-medium" :style="{ clipPath: bigArtClip, background: 'transparent' }">
                  <img src="@/assets/logo.png" style="width: 100%; height: 100%; object-fit: contain" />
                </div>
              </div>

              <div class="track-info">
                <div class="title">
                  {{ currentTrack.title || 'Chorus Deck' }}
                </div>
                <div class="artist">{{ currentTrack.artist || 'Ready to play' }}</div>
              </div>

              <div class="controls ml-auto">
                <button class="scalloped-btn scalloped" @click.stop="previous">
                  <i class="ri-skip-back-fill"></i>
                </button>
                <div class="scalloped-btn play-pause-btn" style="background: transparent; padding: 0; transform: scale(1.15);" @click.stop>
                  <animated-play-pause
                    :is-playing="isPlaying"
                    @click="togglePlay"
                    :bg-color="btnBg"
                    :icon-color="btnFg"
                  />
                </div>
                <button class="scalloped-btn scalloped" @click.stop="next">
                  <i class="ri-skip-forward-fill"></i>
                </button>
              </div>
            </div>

            <div class="expanded-middle">
              <span class="time">{{ formatTime(currentTime) }}</span>
              <div class="progress-container" @click.stop="seek">
                <svg class="wavy-progress" viewBox="0 0 300 16" preserveAspectRatio="none">
                  <line class="wave-rest" :x1="progressX" y1="8" x2="300" y2="8" />
                  <path class="wave-path" :d="dynamicWavePath" :stroke="accentColor" />
                </svg>
              </div>
              <span class="time">{{ formatTime(duration) }}</span>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { emit, listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { computed, onMounted, ref, watch, onUnmounted } from 'vue';

import { useSettingsStore } from '@/store/modules/settings';

import IdleState from './components/IdleState.vue';
import PlayingState from './components/PlayingState.vue';
import AnimatedPlayPause from '@/components/player/AnimatedPlayPause.vue';

type IslandState = 'hidden' | 'playing' | 'expanded';
const currentState = ref<IslandState>('hidden');

const settingsStore = useSettingsStore();
const dynamicIslandVisibility = computed(
  () => settingsStore.setData.dynamicIslandVisibility || 'auto-hide'
);
const dynamicIslandEnabled = computed(() => settingsStore.setData.dynamicIslandEnabled ?? true);

const isPlaying = ref(false);
const currentTrack = ref({
  title: '',
  artist: '',
  cover: '',
  backgroundColor: ''
});
const currentTime = ref(0);
const duration = ref(0);

const progressPercent = computed(() => {
  if (duration.value === 0) return 0;
  return (currentTime.value / duration.value) * 100;
});

const coverFailed = ref(false);

// Wavy progress geometry (viewBox 300 x 16)
const progressX = computed(() => Math.min(Math.max(progressPercent.value, 0), 100) * 3);

const wavePhase = ref(0);
let waveRaf: number;
const updateWave = (time: number) => {
  if (isPlaying.value) {
    wavePhase.value = time * 0.005;
  }
  waveRaf = requestAnimationFrame(updateWave);
};

const dynamicWavePath = computed(() => {
  const px = progressX.value;
  if (px <= 0) return 'M 0 8';
  let d = `M 0 8 `;
  for (let x = 0; x <= px; x += 3) {
    const distFromEnd = px - x;
    const dampingStart = Math.min(x / 15, 1);
    const dampingEnd = Math.min(distFromEnd / 25, 1);
    const damping = dampingStart * dampingEnd;
    
    const y = 8 + 4 * damping * Math.sin(x * 0.15 - wavePhase.value);
    d += `L ${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  d += `L ${px.toFixed(1)} 8`;
  return d;
});

// Expanded artwork wavy ring (76x76 viewBox)
const LOBES = 10;
const AMP = 2.5; 
const wavyPoints = (cx: number, cy: number, R: number, steps = 180) => {
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const r = R + AMP * Math.cos(LOBES * t);
    pts.push([cx + r * Math.sin(t), cy - r * Math.cos(t)]);
  }
  return pts;
};

const BIG_ART_R = 34 - AMP;
const bigArtClip = `polygon(${wavyPoints(34, 34, BIG_ART_R)
  .map(([x, y]) => `${((x / 68) * 100).toFixed(2)}% ${((y / 68) * 100).toFixed(2)}%`)
  .join(', ')})`;
const bigRing = wavyPoints(38, 38, BIG_ART_R + 3)
  .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`)
  .join(' ');

// ---------- Theme (light / dark) ----------
const isDark = ref(localStorage.getItem('theme') === 'dark');
const syncThemeClass = () => {
  document.documentElement.classList.toggle('dark', isDark.value);
};

// ---------- Color helpers ----------
type RGB = [number, number, number];
const rgbToHsl = ([r, g, b]: RGB): RGB => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
};
const rgbStringToTuple = (c: string): RGB | null => {
  const m = c.match(/\d+(\.\d+)?/g);
  if (!m || m.length < 3) return null;
  return [Number(m[0]), Number(m[1]), Number(m[2])];
};

const extractCoverColor = (url: string): Promise<string> =>
  new Promise((resolve) => {
    if (!url) return resolve('');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const size = 24;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve('');
        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;
        // Weighted by saturation so vivid colors win over greys
        let r = 0, g = 0, b = 0, w = 0;
        for (let i = 0; i < data.length; i += 4) {
          const [, s, l] = rgbToHsl([data[i], data[i + 1], data[i + 2]]);
          const weight = 0.1 + (s / 100) * (1 - Math.abs(l - 50) / 50);
          r += data[i] * weight; g += data[i + 1] * weight; b += data[i + 2] * weight; w += weight;
        }
        resolve(`rgb(${Math.round(r / w)}, ${Math.round(g / w)}, ${Math.round(b / w)})`);
      } catch {
        resolve('');
      }
    };
    img.onerror = () => resolve('');
    img.src = url;
  });

// Album accent, clamped so it's always visible on the current theme
const accentColor = computed(() => {
  const rgb = rgbStringToTuple(currentTrack.value.backgroundColor || '');
  if (!rgb) return isDark.value ? '#f1ebd9' : '#2a2a2a';
  const [h, s, l] = rgbToHsl(rgb);
  const sat = Math.max(s, 35);
  const light = isDark.value ? Math.min(Math.max(l, 62), 78) : Math.min(Math.max(l, 28), 42);
  return `hsl(${h.toFixed(0)}, ${sat.toFixed(0)}%, ${light.toFixed(0)}%)`;
});

const albumHsl = computed(() => {
  const rgb = rgbStringToTuple(currentTrack.value.backgroundColor || '');
  return rgb ? rgbToHsl(rgb) : null;
});
const btnBg = computed(() => {
  const hsl = albumHsl.value;
  if (!hsl) return isDark.value ? '#f5f5f5' : '#161616';
  const h = hsl[0].toFixed(0);
  const s = Math.min(Math.max(hsl[1], 40), 85).toFixed(0);
  return isDark.value ? `hsl(${h}, ${s}%, 80%)` : `hsl(${h}, ${s}%, 26%)`;
});
const btnFg = computed(() => {
  if (!isDark.value) return '#ffffff';
  const hsl = albumHsl.value;
  if (!hsl) return '#161616';
  const s = Math.min(Math.max(hsl[1], 40), 85).toFixed(0);
  return `hsl(${hsl[0].toFixed(0)}, ${s}%, 14%)`;
});
const baseBg = computed(() => (isDark.value ? '#121212' : '#fafafa'));
const textColor = computed(() => (isDark.value ? '#ffffff' : '#111111'));

const islandBackground = computed(() => {
  const rgb = rgbStringToTuple(currentTrack.value.backgroundColor || '');
  if (!rgb) return baseBg.value;
  const [h, s] = rgbToHsl(rgb);
  const tint = isDark.value ? `hsla(${h.toFixed(0)}, ${Math.max(s, 40).toFixed(0)}%, 30%, 0.95)` : `hsla(${h.toFixed(0)}, ${Math.max(s, 40).toFixed(0)}%, 82%, 0.95)`;
  return `linear-gradient(110deg, ${tint} 0%, ${baseBg.value} 85%)`;
});

watch(
  () => currentTrack.value.cover,
  async (cover) => {
    coverFailed.value = false;
    const color = await extractCoverColor(cover);
    if (cover === currentTrack.value.cover) currentTrack.value.backgroundColor = color;
  },
  { immediate: true }
);

let hideTimeout: ReturnType<typeof setTimeout> | null = null;
let wasHiddenOnEnter = false;

const showConfirmation = () => {
  if (hideTimeout) clearTimeout(hideTimeout);
  
  if (currentState.value !== 'expanded' && dynamicIslandEnabled.value) {
    currentState.value = 'playing';
    
    if (!isPlaying.value && dynamicIslandVisibility.value !== 'always-show') {
      hideTimeout = setTimeout(() => {
        if (currentState.value === 'playing') {
          currentState.value = 'hidden';
        }
      }, 3000);
    }
  }
};

const handleZoneEnter = () => {
  if (hideTimeout) clearTimeout(hideTimeout);
  if (dynamicIslandEnabled.value) {
    if (currentState.value === 'hidden') {
      wasHiddenOnEnter = true;
      currentState.value = 'playing';
    } else {
      wasHiddenOnEnter = false;
    }
  }
};

const handleIslandEnter = () => {
  if (hideTimeout) clearTimeout(hideTimeout);
  if (dynamicIslandEnabled.value && !wasHiddenOnEnter) {
    currentState.value = 'expanded';
  }
};

const handleZoneLeave = () => {
  wasHiddenOnEnter = false;
  if (dynamicIslandEnabled.value) {
    currentState.value = 'playing';
    showConfirmation();
  } else {
    currentState.value = 'hidden';
  }
};

watch([dynamicIslandVisibility, dynamicIslandEnabled], () => {
  if (dynamicIslandEnabled.value) {
    showConfirmation();
  } else {
    currentState.value = 'hidden';
  }
});

const togglePlay = async () => {
  if (isPlaying.value) {
    await emit('mpris-pause');
  } else {
    await emit('mpris-play');
  }
};
const previous = async () => {
  await emit('mpris-previous');
};
const next = async () => {
  await emit('mpris-next');
};
const seek = async (e: MouseEvent) => {
  const target = e.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const percent = clickX / rect.width;
  const newTime = percent * duration.value;
  await emit('mpris-seek', newTime);
};

const formatTime = (seconds: number) => {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

onMounted(() => {
  waveRaf = requestAnimationFrame(updateWave);
  syncThemeClass();
  // localStorage is shared between windows; the 'storage' event fires in other windows on change
  window.addEventListener('storage', (e) => {
    if (e.key === 'theme') {
      isDark.value = e.newValue === 'dark';
      syncThemeClass();
    }
  });

  try {
    const stored = localStorage.getItem('player-core-store');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.isPlay) {
        isPlaying.value = true;
      }
      if (parsed.playMusic) {
        const dt = parsed.playMusic.dt || parsed.playMusic.duration;
        if (dt) duration.value = dt > 10000 ? dt / 1000 : dt;
        currentTrack.value = {
          title: parsed.playMusic.name || parsed.playMusic.title || '',
          artist: parsed.playMusic.ar?.[0]?.name || parsed.playMusic.artists?.[0]?.name || parsed.playMusic.artist || '',
          cover: parsed.playMusic.al?.picUrl || parsed.playMusic.picUrl || parsed.playMusic.coverImgUrl || parsed.playMusic.cover || '',
          backgroundColor: currentTrack.value.backgroundColor
        };
      }
    }
  } catch (e) {}

  if (dynamicIslandEnabled.value) {
    showConfirmation();
  }

  listen('update-play-state', (event: any) => {
    if (isPlaying.value !== event.payload) {
      isPlaying.value = event.payload;
      showConfirmation();
    }
  });

  listen('update-current-song', (event: any) => {
    const payload = event.payload;
    currentTrack.value = {
      title: payload.title || currentTrack.value.title || '',
      artist: payload.artist || currentTrack.value.artist || '',
      cover: payload.cover_url || currentTrack.value.cover || '',
      backgroundColor: currentTrack.value.backgroundColor
    };
    if (payload.duration) {
      duration.value = payload.duration > 10000 ? payload.duration / 1000 : payload.duration;
    }
    if (payload.is_playing !== undefined && isPlaying.value !== payload.is_playing) {
      isPlaying.value = payload.is_playing;
    }
    showConfirmation();
  });

  listen('playback-progress', (event: any) => {
    if (typeof event.payload === 'number') {
      currentTime.value = event.payload;
      if (!isPlaying.value && event.payload > 0) {
        isPlaying.value = true;
        showConfirmation();
      }
    }
  });
});

onUnmounted(() => {
  if (waveRaf) cancelAnimationFrame(waveRaf);
});
</script>

<style scoped>
.dynamic-island-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 0px;
  overflow: hidden;
  background: transparent;
  pointer-events: none;
}

.trigger-zone {
  pointer-events: auto;
  padding-top: 10px;
  padding-bottom: 50px;
  padding-left: 50px;
  padding-right: 50px;
  background: rgba(0, 0, 0, 0.01);
  display: flex;
  justify-content: center;
}

.dynamic-island {
  position: relative;
  background: v-bind('islandBackground') !important;
  border-radius: 40px;
  color: v-bind('textColor');
  --island-accent: v-bind('accentColor');
  --island-btn-bg: v-bind('btnBg');
  --island-btn-fg: v-bind('btnFg');
  --island-text: v-bind('textColor');
  transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  display: flex;
}

.dynamic-island.hidden {
  width: 150px;
  height: 20px;
  opacity: 0;
  cursor: pointer;
  background: transparent !important;
  box-shadow: none;
}

.dynamic-island.playing {
  height: 40px;
  opacity: 1;
  flex-direction: row;
  align-items: center;
  padding: 0 8px;
  justify-content: space-between;
}

.dynamic-island.playing.is-active {
  width: 120px;
}

.dynamic-island.playing:not(.is-active) {
  width: 100px;
}

.notch-container {
  width: 100%;
  height: 100%;
}

.scalloped {
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M 195.00 100.00 L 194.67 103.31 L 193.69 106.55 L 192.14 109.68 L 190.11 112.66 L 187.76 115.47 L 185.23 118.12 L 182.67 120.61 L 180.25 123.01 L 178.09 125.37 L 176.28 127.77 L 174.89 130.26 L 173.91 132.91 L 173.33 135.76 L 173.06 138.85 L 173.02 142.16 L 173.06 145.65 L 173.06 149.28 L 172.87 152.95 L 172.39 156.55 L 171.50 159.99 L 170.14 163.16 L 168.29 165.94 L 165.94 168.29 L 163.16 170.14 L 159.99 171.50 L 156.55 172.39 L 152.95 172.87 L 149.28 173.06 L 145.65 173.06 L 142.16 173.02 L 138.85 173.06 L 135.76 173.33 L 132.91 173.91 L 130.26 174.89 L 127.77 176.28 L 125.37 178.09 L 123.01 180.25 L 120.61 182.67 L 118.12 185.23 L 115.47 187.76 L 112.66 190.11 L 109.68 192.14 L 106.55 193.69 L 103.31 194.67 L 100.00 195.00 L 96.69 194.67 L 93.45 193.69 L 90.32 192.14 L 87.34 190.11 L 84.53 187.76 L 81.88 185.23 L 79.39 182.67 L 76.99 180.25 L 74.63 178.09 L 72.23 176.28 L 69.74 174.89 L 67.09 173.91 L 64.24 173.33 L 61.15 173.06 L 57.84 173.02 L 54.35 173.06 L 50.72 173.06 L 47.05 172.87 L 43.45 172.39 L 40.01 171.50 L 36.84 170.14 L 34.06 168.29 L 31.71 165.94 L 29.86 163.16 L 28.50 159.99 L 27.61 156.55 L 27.13 152.95 L 26.94 149.28 L 26.94 145.65 L 26.98 142.16 L 26.94 138.85 L 26.67 135.76 L 26.09 132.91 L 25.11 130.26 L 23.72 127.77 L 21.91 125.37 L 19.75 123.01 L 17.33 120.61 L 14.77 118.12 L 12.24 115.47 L 9.89 112.66 L 7.86 109.68 L 6.31 106.55 L 5.33 103.31 L 5.00 100.00 L 5.33 96.69 L 6.31 93.45 L 7.86 90.32 L 9.89 87.34 L 12.24 84.53 L 14.77 81.88 L 17.33 79.39 L 19.75 76.99 L 21.91 74.63 L 23.72 72.23 L 25.11 69.74 L 26.09 67.09 L 26.67 64.24 L 26.94 61.15 L 26.98 57.84 L 26.94 54.35 L 26.94 50.72 L 27.13 47.05 L 27.61 43.45 L 28.50 40.01 L 29.86 36.84 L 31.71 34.06 L 34.06 31.71 L 36.84 29.86 L 40.01 28.50 L 43.45 27.61 L 47.05 27.13 L 50.72 26.94 L 54.35 26.94 L 57.84 26.98 L 61.15 26.94 L 64.24 26.67 L 67.09 26.09 L 69.74 25.11 L 72.23 23.72 L 74.63 21.91 L 76.99 19.75 L 79.39 17.33 L 81.88 14.77 L 84.53 12.24 L 87.34 9.89 L 90.32 7.86 L 93.45 6.31 L 96.69 5.33 L 100.00 5.00 L 103.31 5.33 L 106.55 6.31 L 109.68 7.86 L 112.66 9.89 L 115.47 12.24 L 118.12 14.77 L 120.61 17.33 L 123.01 19.75 L 125.37 21.91 L 127.77 23.72 L 130.26 25.11 L 132.91 26.09 L 135.76 26.67 L 138.85 26.94 L 142.16 26.98 L 145.65 26.94 L 149.28 26.94 L 152.95 27.13 L 156.55 27.61 L 159.99 28.50 L 163.16 29.86 L 165.94 31.71 L 168.29 34.06 L 170.14 36.84 L 171.50 40.01 L 172.39 43.45 L 172.87 47.05 L 173.06 50.72 L 173.06 54.35 L 173.02 57.84 L 173.06 61.15 L 173.33 64.24 L 173.91 67.09 L 174.89 69.74 L 176.28 72.23 L 178.09 74.63 L 180.25 76.99 L 182.67 79.39 L 185.23 81.88 L 187.76 84.53 L 190.11 87.34 L 192.14 90.32 L 193.69 93.45 L 194.67 96.69 L 195.00 100.00 Z'/%3E%3C/svg%3E");
  mask-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M 195.00 100.00 L 194.67 103.31 L 193.69 106.55 L 192.14 109.68 L 190.11 112.66 L 187.76 115.47 L 185.23 118.12 L 182.67 120.61 L 180.25 123.01 L 178.09 125.37 L 176.28 127.77 L 174.89 130.26 L 173.91 132.91 L 173.33 135.76 L 173.06 138.85 L 173.02 142.16 L 173.06 145.65 L 173.06 149.28 L 172.87 152.95 L 172.39 156.55 L 171.50 159.99 L 170.14 163.16 L 168.29 165.94 L 165.94 168.29 L 163.16 170.14 L 159.99 171.50 L 156.55 172.39 L 152.95 172.87 L 149.28 173.06 L 145.65 173.06 L 142.16 173.02 L 138.85 173.06 L 135.76 173.33 L 132.91 173.91 L 130.26 174.89 L 127.77 176.28 L 125.37 178.09 L 123.01 180.25 L 120.61 182.67 L 118.12 185.23 L 115.47 187.76 L 112.66 190.11 L 109.68 192.14 L 106.55 193.69 L 103.31 194.67 L 100.00 195.00 L 96.69 194.67 L 93.45 193.69 L 90.32 192.14 L 87.34 190.11 L 84.53 187.76 L 81.88 185.23 L 79.39 182.67 L 76.99 180.25 L 74.63 178.09 L 72.23 176.28 L 69.74 174.89 L 67.09 173.91 L 64.24 173.33 L 61.15 173.06 L 57.84 173.02 L 54.35 173.06 L 50.72 173.06 L 47.05 172.87 L 43.45 172.39 L 40.01 171.50 L 36.84 170.14 L 34.06 168.29 L 31.71 165.94 L 29.86 163.16 L 28.50 159.99 L 27.61 156.55 L 27.13 152.95 L 26.94 149.28 L 26.94 145.65 L 26.98 142.16 L 26.94 138.85 L 26.67 135.76 L 26.09 132.91 L 25.11 130.26 L 23.72 127.77 L 21.91 125.37 L 19.75 123.01 L 17.33 120.61 L 14.77 118.12 L 12.24 115.47 L 9.89 112.66 L 7.86 109.68 L 6.31 106.55 L 5.33 103.31 L 5.00 100.00 L 5.33 96.69 L 6.31 93.45 L 7.86 90.32 L 9.89 87.34 L 12.24 84.53 L 14.77 81.88 L 17.33 79.39 L 19.75 76.99 L 21.91 74.63 L 23.72 72.23 L 25.11 69.74 L 26.09 67.09 L 26.67 64.24 L 26.94 61.15 L 26.98 57.84 L 26.94 54.35 L 26.94 50.72 L 27.13 47.05 L 27.61 43.45 L 28.50 40.01 L 29.86 36.84 L 31.71 34.06 L 34.06 31.71 L 36.84 29.86 L 40.01 28.50 L 43.45 27.61 L 47.05 27.13 L 50.72 26.94 L 54.35 26.94 L 57.84 26.98 L 61.15 26.94 L 64.24 26.67 L 67.09 26.09 L 69.74 25.11 L 72.23 23.72 L 74.63 21.91 L 76.99 19.75 L 79.39 17.33 L 81.88 14.77 L 84.53 12.24 L 87.34 9.89 L 90.32 7.86 L 93.45 6.31 L 96.69 5.33 L 100.00 5.00 L 103.31 5.33 L 106.55 6.31 L 109.68 7.86 L 112.66 9.89 L 115.47 12.24 L 118.12 14.77 L 120.61 17.33 L 123.01 19.75 L 125.37 21.91 L 127.77 23.72 L 130.26 25.11 L 132.91 26.09 L 135.76 26.67 L 138.85 26.94 L 142.16 26.98 L 145.65 26.94 L 149.28 26.94 L 152.95 27.13 L 156.55 27.61 L 159.99 28.50 L 163.16 29.86 L 165.94 31.71 L 168.29 34.06 L 170.14 36.84 L 171.50 40.01 L 172.39 43.45 L 172.87 47.05 L 173.06 50.72 L 173.06 54.35 L 173.02 57.84 L 173.06 61.15 L 173.33 64.24 L 173.91 67.09 L 174.89 69.74 L 176.28 72.23 L 178.09 74.63 L 180.25 76.99 L 182.67 79.39 L 185.23 81.88 L 187.76 84.53 L 190.11 87.34 L 192.14 90.32 L 193.69 93.45 L 194.67 96.69 L 195.00 100.00 Z'/%3E%3C/svg%3E");
  -webkit-mask-size: contain;
  mask-size: contain;
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
}

.artwork-small {
  width: 28px;
  height: 28px;
  overflow: hidden;
  background: #222;
}
.artwork-small img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.notch-icon {
  width: 28px;
  height: 28px;
  background-color: #f1ebd9;
  color: #000;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 16px;
}

.dynamic-island.expanded {
  width: 330px;
  height: 120px;
  opacity: 1;
  padding: 15px 18px;
  flex-direction: column;
  justify-content: center;
}

.expanded-top {
  display: flex;
  flex-direction: row;
  align-items: center;
  width: 100%;
}

.expanded-middle {
  display: flex;
  flex-direction: row;
  align-items: center;
  width: 100%;
  gap: 12px;
  margin-top: 15px;
  padding: 0 14px;
  box-sizing: border-box;
}

.time {
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  opacity: 0.8;
  font-weight: 500;
}

.progress-container {
  flex: 1;
  height: 16px;
  position: relative;
  cursor: pointer;
  display: flex;
  align-items: center;
}

.wavy-progress {
  width: 100%;
  height: 16px;
  overflow: visible;
}

.wave-path {
  fill: none;
  stroke-width: 3;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
}

.wave-rest {
  stroke: var(--island-text);
  stroke-opacity: 0.2;
  stroke-width: 3;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
}


.progress-track {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: var(--island-text);
  opacity: 0.15;
  border-radius: 4px;
}

.progress-bar {
  height: 100%;
  border-radius: 4px;
  transition: width 0.1s linear;
  position: relative;
  z-index: 1;
}

.progress-thumb {
  position: absolute;
  top: 50%;
  width: 4px;
  height: 16px;
  border-radius: 2px;
  transform: translate(-50%, -50%);
  transition: left 0.1s linear;
  z-index: 2;
}

.artwork-ring-wrap {
  position: relative;
  width: 68px;
  height: 68px;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-right: 15px;
  flex-shrink: 0;
}
.artwork-ring {
  position: absolute;
  top: -4px;
  left: -4px;
  width: 76px;
  height: 76px;
  z-index: 1;
  pointer-events: none;
}
.ring-bg {
  fill: none;
  stroke-width: 2.5;
}
.expanded-island .artwork-medium {
  width: 68px;
  height: 68px;
  overflow: hidden;
  background: var(--bg-color-200, #222);
  position: relative;
  z-index: 2;
}
.expanded-island .artwork-medium img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.track-info {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding-right: 15px;
}
.title {
  font-weight: 700;
  font-size: 16px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 2px;
}
.artist {
  font-size: 13px;
  opacity: 0.8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.controls {
  display: flex;
  gap: 12px;
  flex-shrink: 0;
  align-items: center;
}
.scalloped-btn {
  width: 36px;
  height: 36px;
  background-color: var(--island-btn-bg);
  color: var(--island-btn-fg);
  border: none;
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 18px;
  transition: transform 0.2s;
  padding: 0;
}
.scalloped-btn:hover {
  transform: scale(1.1);
}

.play-pause-btn i {
  animation: popIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes popIn {
  0% { transform: scale(0.5); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

.visualizer {
  display: flex;
  align-items: center;
  gap: 3px;
  height: 20px;
}
.visualizer .bar {
  width: 3px;
  border-radius: 2px;
  animation: equalize 1s infinite alternate ease-in-out;
}
.visualizer .bar:nth-child(1) {
  height: 10px;
  animation-delay: 0.1s;
}
.visualizer .bar:nth-child(2) {
  height: 16px;
  animation-delay: 0.3s;
}
.visualizer .bar:nth-child(3) {
  height: 12px;
  animation-delay: 0.2s;
}
.visualizer .bar:nth-child(4) {
  height: 18px;
  animation-delay: 0.4s;
}
.visualizer .bar:nth-child(5) {
  height: 14px;
  animation-delay: 0.15s;
}
.visualizer .bar:nth-child(6) {
  height: 11px;
  animation-delay: 0.35s;
}
.visualizer .bar:nth-child(7) {
  height: 15px;
  animation-delay: 0.25s;
}

@keyframes equalize {
  0% {
    transform: scaleY(0.3);
  }
  100% {
    transform: scaleY(1);
  }
}

.ml-auto {
  margin-left: auto;
}
.ml-3 {
  margin-left: 12px;
}
.mr-2 {
  margin-right: 8px;
}
.mt-2 {
  margin-top: 8px;
}
.font-semibold {
  font-weight: 600;
}
.text-sm {
  font-size: 14px;
}
.text-white {
  color: white;
}
.opacity-90 {
  opacity: 0.9;
}
.whitespace-nowrap {
  white-space: nowrap;
}

/* ---- Island content transitions ---- */
.island-content-enter-active,
.island-content-leave-active {
  transition: opacity 0.22s ease, transform 0.22s cubic-bezier(0.25, 0.46, 0.45, 0.94), filter 0.22s ease;
  will-change: opacity, transform, filter;
}
.island-content-enter-from {
  opacity: 0.3;
  transform: scale(0.93);
  filter: blur(5px);
}
.island-content-leave-to {
  opacity: 0.3;
  transform: scale(0.93);
  filter: blur(5px);
}
.island-content-enter-to,
.island-content-leave-from {
  opacity: 1;
  transform: scale(1);
  filter: blur(0px);
}

/* ---- Playing <-> Idle swap inside notch ---- */
.notch-swap-enter-active,
.notch-swap-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease, filter 0.16s ease;
  will-change: opacity, transform, filter;
}
.notch-swap-enter-from {
  opacity: 0.35;
  transform: scale(0.8) translateY(4px);
  filter: blur(3px);
}
.notch-swap-leave-to {
  opacity: 0.35;
  transform: scale(0.8) translateY(-4px);
  filter: blur(3px);
}
.notch-swap-enter-to,
.notch-swap-leave-from {
  opacity: 1;
  transform: scale(1) translateY(0);
  filter: blur(0px);
}
</style>
