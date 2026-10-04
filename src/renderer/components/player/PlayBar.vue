<template>
  <div
    class="music-play-bar rounded-t-3xl overflow-hidden"
    :class="[
      setAnimationClass('animate__bounceInUp'),
      musicFullVisible ? 'play-bar-opcity' : '',
      musicFullVisible && MusicFullRef?.musicFullRef?.config?.hidePlayBar
        ? 'animate__animated animate__slideOutDown'
        : ''
    ]"
    :style="{
      backgroundColor: musicFullVisible ? 'transparent' : 'var(--shell-surface)',
      color: 'var(--text-color, inherit)',
      boxShadow: '0 -4px 20px rgba(0,0,0,0.05)',
      '--fill-color': playMusic?.primaryColor || 'var(--primary-color)',
      '--fill-color-light': playMusic?.primaryColor
        ? playMusic.primaryColor + '99'
        : 'var(--primary-color)'
    }"
    @click="handleBarClick"
  >
    <div class="play-bar-left">
      <div class="play-bar-img-wrapper" @click.stop="setMusicFull">
        <img
          v-if="playMusic?.picUrl"
          :src="getImgUrl(playMusic?.picUrl, '100y100')"
          class="play-bar-img"
          referrerpolicy="no-referrer"
          style="object-fit: cover"
        />
        <img v-else :src="logoImg" class="play-bar-img" style="object-fit: cover" />
        <div v-if="playMusic?.playLoading" class="loading-overlay">
          <i class="ri-loader-4-line loading-icon"></i>
        </div>
        <div class="hover-arrow">
          <div class="hover-content">
            <i
              class="text-3xl"
              :class="musicFullVisible ? 'ri-arrow-down-s-line' : 'ri-arrow-up-s-line'"
            ></i>
            <span class="hover-text">{{ musicFullVisible ? 'Collapse' : 'Expand' }}</span>
          </div>
        </div>
      </div>
      <div class="music-content">
        <div class="music-content-title flex items-center">
          <n-ellipsis class="text-ellipsis" line-clamp="1">
            <p v-html="playMusic?.name || ''"></p>
          </n-ellipsis>
          <span v-if="playbackRate !== 1.0" class="playback-rate-badge"> {{ playbackRate }}x </span>
        </div>
        <div class="music-content-name">
          <n-ellipsis
            class="text-ellipsis"
            line-clamp="1"
            :tooltip="{
              contentStyle: { maxWidth: '600px' },
              zIndex: 99999
            }"
          >
            <span
              v-for="(artists, artistsindex) in artistList"
              :key="artistsindex"
              class="cursor-pointer hover:text-primary"
              @click.stop="handleArtistClick(artists.id)"
            >
              {{ artists.name }}{{ artistsindex < artistList.length - 1 ? ' / ' : '' }}
            </span>
          </n-ellipsis>
        </div>
      </div>
      <div class="favorite-btn" @click.stop="toggleFavorite">
        <i :class="isFavorite ? 'ri-heart-fill like-active' : 'ri-heart-line'"></i>
      </div>
    </div>

    <div class="play-bar-center">
      <div class="music-buttons">
        <div class="icon-btn tooltip-btn" @click.stop="playerStore.toggleShuffle()">
          <n-tooltip trigger="hover" :z-index="9999999">
            <template #trigger>
              <i
                :class="shuffleEnabled ? 'ri-shuffle-fill text-primary' : 'ri-shuffle-line'"
                class="text-lg"
              ></i>
            </template>
            Shuffle
          </n-tooltip>
        </div>
        <div
          class="music-buttons-prev"
          :style="{ color: playMusic?.primaryColor }"
          @click.stop="handlePrev"
        >
          <i class="ri-skip-back-line"></i>
        </div>
        <div class="music-buttons-play play-animated" @click.stop>
          <animated-play-pause
            :is-playing="play"
            @click="playMusicEvent"
            :bg-color="playMusic?.primaryColor"
          />
        </div>
        <div
          class="music-buttons-next"
          :style="{ color: playMusic?.primaryColor }"
          @click.stop="handleNext"
        >
          <i class="ri-skip-forward-line"></i>
        </div>
        <div class="icon-btn tooltip-btn" @click.stop="playerStore.toggleRepeat()">
          <n-tooltip trigger="hover" :z-index="9999999">
            <template #trigger>
              <i
                :class="[
                  repeatMode === 1
                    ? 'ri-repeat-2-line text-primary'
                    : repeatMode === 2
                      ? 'ri-repeat-one-line text-primary'
                      : 'ri-repeat-2-line'
                ]"
                class="text-lg"
              ></i>
            </template>
            Repeat
          </n-tooltip>
        </div>
      </div>

      <div class="playback-timeline custom-slider">
        <span class="time-text">{{ secondToMinute(nowTime) }}</span>
        <div class="timeline-slider" @click.stop>
          <n-slider
            v-model:value="timeSlider"
            :step="1"
            :max="allTime"
            :min="0"
            :tooltip="false"
            @dragstart="handleSliderDragStart"
            @dragend="handleSliderDragEnd"
          ></n-slider>
        </div>
        <span class="time-text">{{ secondToMinute(allTime) }}</span>
      </div>
    </div>

    <!-- Right Side: Volume & Extra -->
    <div class="play-bar-right audio-button">
      <div class="icon-btn tooltip-btn" @click.stop="handleDownload">
        <n-tooltip trigger="hover" :z-index="9999999">
          <template #trigger>
            <i
              :class="isDownloading ? 'ri-loader-4-line loading-icon' : 'ri-download-2-line'"
              class="text-xl transition-colors cursor-pointer"
            ></i>
          </template>
          Download
        </n-tooltip>
      </div>

      <advanced-controls-popover @click.stop />

      <n-tooltip trigger="hover" :z-index="9999999">
        <template #trigger>
          <div class="icon-btn" @click.stop="openQueue">
            <i class="ri-play-list-fill text-xl transition-colors cursor-pointer"></i>
          </div>
        </template>
        Queue
      </n-tooltip>

      <div class="audio-volume custom-slider" @click.stop @wheel.prevent="handleVolumeWheel">
        <div class="volume-icon" @click.stop="mute">
          <i class="text-xl" :class="getVolumeIcon"></i>
        </div>
        <div class="volume-slider-horizontal">
          <n-slider
            v-model:value="volumeSlider"
            :step="0.01"
            :tooltip="false"
            :disabled="isMuted"
          ></n-slider>
        </div>
      </div>

      <n-tooltip trigger="hover" :z-index="9999999">
        <template #trigger>
          <div class="icon-btn close-btn" @click.stop="handleCloseBar">
            <i class="ri-close-line text-xl transition-colors cursor-pointer"></i>
          </div>
        </template>
        Close
      </n-tooltip>
    </div>

    <music-full-wrapper ref="MusicFullRef" v-model="musicFullVisible" :background="background" />
  </div>
</template>

<script lang="ts" setup>
import { useThrottleFn } from '@vueuse/core';
import { storeToRefs } from 'pinia';
import { computed, ref, watch } from 'vue';

import MusicFullWrapper from '@/components/lyric/MusicFullWrapper.vue';
import AdvancedControlsPopover from '@/components/player/AdvancedControlsPopover.vue';
import AnimatedPlayPause from '@/components/player/AnimatedPlayPause.vue';
import {
  allTime,
  artistList,
  isLyricWindowOpen,
  nowTime,
  openLyric,
  playMusic,
  textColors
} from '@/hooks/MusicHook';
import { useArtist } from '@/hooks/useArtist';
import { useDownload } from '@/hooks/useDownload';
import { useFavorite } from '@/hooks/useFavorite';
import { usePlaybackControl } from '@/hooks/usePlaybackControl';
import { usePlayMode } from '@/hooks/usePlayMode';
import { useVolumeControl } from '@/hooks/useVolumeControl';
import { audioService } from '@/services/audioService';
import { usePlayerStore } from '@/store/modules/player';
import { useSettingsStore } from '@/store/modules/settings';
import { getImgUrl, isCompact, isDesktop, secondToMinute, setAnimationClass } from '@/utils';

const playerStore = usePlayerStore();
const settingsStore = useSettingsStore();

const { isPlaying: play, playMusicEvent, handleNext, handlePrev } = usePlaybackControl();

const {
  isMuted,
  volumeSlider,
  volumeIcon: getVolumeIcon,
  mute,
  handleVolumeWheel
} = useVolumeControl();

const { isFavorite, toggleFavorite } = useFavorite();

const { isDownloading, downloadMusic } = useDownload();
const handleDownload = () => {
  if (!playMusic.value || isDownloading.value) return;
  downloadMusic(playMusic.value);
};

const handleCloseBar = async () => {
  try {
    const { stopAll } = await import('@/services/playbackController');
    await stopAll();
  } catch (error) {
    console.error('Failed to stop playback:', error);
  }
};

const { playMode, playModeIcon, playModeText, togglePlayMode } = usePlayMode();

const { playbackRate, shuffleEnabled, repeatMode } = storeToRefs(playerStore);

const background = ref('#000');

watch(
  () => playerStore.playMusic,
  async () => {
    if (playMusic && playMusic.value && playMusic.value.backgroundColor) {
      background.value = playMusic.value.backgroundColor as string;
    }
  },
  { immediate: true, deep: true }
);

const throttledSeek = useThrottleFn((value: number) => {
  audioService.seek(value);
  nowTime.value = value;
}, 50);

const dragValue = ref(0);
const isDragging = ref(false);

const timeSlider = computed({
  get: () => (isDragging.value ? dragValue.value : nowTime.value),
  set: (value) => {
    if (isDragging.value) {
      dragValue.value = value;
      return;
    }
    throttledSeek(value);
  }
});

const handleSliderDragStart = () => {
  isDragging.value = true;
  dragValue.value = nowTime.value;
};

const handleSliderDragEnd = () => {
  isDragging.value = false;
  audioService.seek(dragValue.value);
  nowTime.value = dragValue.value;
};

const formatTooltip = (value: number) => {
  return `${secondToMinute(value)} / ${secondToMinute(allTime.value)}`;
};

const MusicFullRef = ref<any>(null);
const showSliderTooltip = ref(false);

const musicFullVisible = computed({
  get: () => playerStore.musicFull,
  set: (value) => {
    playerStore.setMusicFull(value);
  }
});

const setMusicFull = () => {
  musicFullVisible.value = !musicFullVisible.value;
  playerStore.setMusicFull(musicFullVisible.value);
  if (musicFullVisible.value) {
    settingsStore.showArtistDrawer = false;
  }
};

const IGNORE_FULL_TRIGGER_SELECTOR = [
  '.music-time',
  '.music-buttons-prev',
  '.music-buttons-play',
  '.music-buttons-next',
  '.audio-button'
].join(', ');

const handleBarClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement | null;
  if (!target || target.closest(IGNORE_FULL_TRIGGER_SELECTOR)) return;
  setMusicFull();
};

const { navigateToArtist } = useArtist();

const handleArtistClick = (id: string | undefined) => {
  musicFullVisible.value = false;
  navigateToArtist(id);
};

const openQueue = () => {
  playerStore.setQueueVisible(true);
};
</script>

<style lang="scss" scoped>
.text-ellipsis {
  width: 100%;
}

.music-play-bar {
  @apply h-24 relative flex-shrink-0 flex items-center justify-between box-border px-4 py-2;
  margin-left: var(--shell-gap, 12px);
  margin-right: var(--shell-gap, 12px);
  margin-bottom: var(--shell-gap, 12px);
  border-radius: var(--shell-radius, 16px);
  width: calc(100% - calc(var(--shell-gap, 12px) * 2));
  z-index: var(--shell-z-player, 20);
  animation-duration: 0.5s !important;
  cursor: pointer;

  &.play-bar-opcity {
    background-color: transparent !important;
    box-shadow: none !important;
  }

  &.animate__slideOutDown {
    animation-duration: 0.3s !important;
    pointer-events: none;
  }
}

.play-bar-left {
  @apply flex items-center gap-3 w-1/3 min-w-[200px];

  .music-content {
    @apply flex flex-col justify-center overflow-hidden;

    &-title {
      @apply text-sm font-semibold;
    }
    &-name {
      @apply text-xs opacity-70;
    }
  }

  .favorite-btn {
    @apply flex items-center justify-center rounded-full transition-all w-8 h-8 ml-2 cursor-pointer;
    i {
      @apply text-lg;
    }
    &:hover {
      @apply bg-gray-100 dark:bg-dark-300;
    }
  }
}

.play-bar-center {
  @apply flex flex-col items-center justify-center w-1/3 min-w-[300px];

  .music-buttons {
    @apply flex items-center justify-center gap-3 mb-1;

    .tooltip-btn {
      @apply text-gray-500 hover:text-primary transition-colors cursor-pointer flex items-center justify-center w-8 h-8 rounded-full;
      &:hover {
        @apply bg-gray-100 dark:bg-dark-300;
      }
    }

    &-prev,
    &-next {
      @apply flex items-center justify-center rounded-full bg-gray-100 dark:bg-dark-300 transition-all cursor-pointer;
      width: 40px;
      height: 40px;

      i {
        font-size: 24px !important;
      }

      &:hover {
        @apply bg-gray-200 dark:bg-dark-200;
        transform: scale(1.05);
      }
    }

    &-play {
      @apply flex justify-center items-center rounded-full transition-all cursor-pointer;
      width: 48px;
      height: 48px;

      &.play-animated {
        background: transparent !important;
        &:hover {
          background: transparent !important;
          transform: scale(1.05);
        }
        :deep(.animated-play-pause) {
          width: 100%;
          height: 100%;
          border-radius: 50%;
        }
      }
    }
  }

  .playback-timeline {
    @apply flex items-center w-full gap-3;

    .time-text {
      @apply text-xs opacity-60 w-10 text-center;
      font-variant-numeric: tabular-nums;
    }

    .timeline-slider {
      @apply flex-1;
      padding: 6px 0;
    }
  }
}

.play-bar-right {
  @apply flex items-center justify-end w-1/3 min-w-[200px] gap-1;

  .audio-volume {
    @apply flex items-center gap-2 ml-1 w-28;

    .volume-icon {
      @apply cursor-pointer flex items-center;
      i {
        @apply text-lg hover:text-primary transition-colors;
      }
    }

    .volume-slider-horizontal {
      @apply flex-1 flex items-center;
    }
  }
}

.play-bar-img {
  @apply w-14 h-14 rounded-2xl;
}

.icon-btn {
  @apply flex items-center justify-center rounded-full transition-all w-9 h-9 mx-0.5;
  &:hover {
    @apply bg-gray-100 dark:bg-dark-300 text-primary;
  }
  &.close-btn:hover {
    @apply text-red-500;
  }
}

.custom-slider {
  :deep(.n-slider) {
    --n-rail-height: 5px !important;
    --n-rail-color: rgba(128, 128, 128, 0.25);
    --n-rail-color-dark: rgba(255, 255, 255, 0.12);
    --n-fill-color: var(--fill-color, var(--primary-color));
    --n-fill-color-hover: var(--fill-color, var(--primary-color));
    --n-handle-size: 14px !important;
    --n-handle-color: var(--fill-color, #fff);

    .n-slider-rail {
      @apply transition-all duration-200 rounded-full;
      overflow: visible;
    }

    .n-slider-handle {
      @apply transition-all duration-200;
      opacity: 0;
      transform: scale(0.5);
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
    }

    &:hover {
      .n-slider-handle {
        opacity: 1;
        transform: scale(1);
      }
    }
  }
}

.play-bar-img-wrapper {
  @apply relative cursor-pointer w-14 h-14;

  .hover-arrow {
    @apply absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 rounded-2xl;
    background: rgba(0, 0, 0, 0.5);

    .hover-content {
      @apply flex flex-col items-center justify-center;

      i {
        @apply text-white mb-0.5;
      }

      .hover-text {
        @apply text-white text-xs scale-90;
      }
    }
  }

  &:hover {
    .hover-arrow {
      @apply opacity-100;
    }
  }
}

.tooltip-content {
  @apply text-sm py-1 px-2;
}

.like-active {
  @apply text-red-500 hover:text-red-600 !important;
}

.disabled-icon {
  @apply opacity-50 cursor-not-allowed !important;
  &:hover {
    @apply text-inherit !important;
  }
}

.loading-overlay {
  @apply absolute inset-0 flex items-center justify-center rounded-2xl;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 2;
}

.loading-icon {
  font-size: 24px;
  color: white;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.playback-rate-badge {
  @apply ml-2 px-1.5 h-4 flex items-center text-xs rounded text-primary bg-opacity-15 text-primary dark:text-primary;
  font-weight: 500;
  vertical-align: 1px;
}

.compact {
  .music-play-bar {
    @apply px-4 bottom-[56px] transition-all duration-300;
  }
  .play-bar-center {
    display: none;
  }
  .play-bar-right {
    display: none;
  }
}
</style>
