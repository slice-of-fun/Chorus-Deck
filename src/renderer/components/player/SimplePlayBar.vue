<template>
  <div class="play-bar" :class="{ 'dark-theme': isDarkMode }" ref="playBarRef">
    <div class="container">
      <div class="top-section">
        <div
          class="progress-bar"
          :class="{ 'is-dragging': isDragging }"
          @mousedown="handleProgressMouseDown"
          @click.stop="handleProgressClick"
        >
          <div class="progress-track"></div>
          <div class="progress-fill" :style="{ width: `${progressPercentage}%` }">
            <div class="progress-handle"></div>
          </div>
        </div>

        <div class="time-display">
          <span class="current-time">{{ formatTime(displayTime) }}</span>
          <span class="total-time">{{ formatTime(allTime) }}</span>
        </div>
      </div>

      <div class="controls-section">
        <div class="left-controls">
          <button class="control-btn small-btn" @click="togglePlayMode">
            <i class="" :class="playModeIcon"></i>
          </button>
        </div>

        <div class="center-controls">
          <button
            class="control-btn"
            style="width: 48px; height: 48px"
            :style="{ color: playerStore.playMusic?.primaryColor }"
            @click="handlePrev"
          >
            <i class="ri-skip-back-line" style="font-size: 28px"></i>
          </button>

          <div
            class="control-btn play-btn play-animated"
            style="
              width: 64px;
              height: 64px;
              background: none;
              border: none;
              padding: 0;
              box-shadow: none;
            "
            @click="playMusicEvent"
          >
            <animated-play-pause
              :is-playing="play"
              :bg-color="playerStore.playMusic?.primaryColor"
            />
          </div>

          <button
            class="control-btn"
            style="width: 48px; height: 48px"
            :style="{ color: playerStore.playMusic?.primaryColor }"
            @click="handleNext"
          >
            <i class="ri-skip-forward-line" style="font-size: 28px"></i>
          </button>
        </div>

        <div class="right-controls">
          <button class="control-btn small-btn" @click="openQueue">
            <i class="ri-play-list-fill"></i>
          </button>
        </div>
      </div>

      <div class="bottom-section">
        <div class="spacer"></div>

        <div class="volume-control">
          <i class="" :class="getVolumeIcon" @click="mute"></i>
          <div class="volume-slider">
            <n-slider
              v-model:value="volumeSlider"
              :step="1"
              :tooltip="false"
              :disabled="isMuted"
              @wheel.prevent="handleVolumeWheel"
            ></n-slider>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

import AnimatedPlayPause from '@/components/player/AnimatedPlayPause.vue';
import { allTime, nowTime } from '@/hooks/MusicHook';
import { usePlaybackControl } from '@/hooks/usePlaybackControl';
import { usePlayMode } from '@/hooks/usePlayMode';
import { useVolumeControl } from '@/hooks/useVolumeControl';
import { audioService } from '@/services/audioService';
import { usePlayerStore } from '@/store/modules/player';
import { secondToMinute } from '@/utils';

const props = withDefaults(
  defineProps<{
    isDark: boolean;
  }>(),
  {
    isDark: false
  }
);

const playerStore = usePlayerStore();
const playBarRef = ref<HTMLElement | null>(null);

const { isPlaying: play, playMusicEvent, handleNext, handlePrev } = usePlaybackControl();

const { playMode, playModeIcon, togglePlayMode } = usePlayMode();

const {
  isMuted,
  volumeSlider,
  volumeIcon: getVolumeIcon,
  mute,
  handleVolumeWheel
} = useVolumeControl();

const isDragging = ref(false);
const dragProgress = ref(0);

const progressPercentage = computed(() => {
  if (isDragging.value) {
    return dragProgress.value;
  }
  if (allTime.value === 0) return 0;
  return (nowTime.value / allTime.value) * 100;
});

const displayTime = computed(() => {
  if (isDragging.value) {
    return (dragProgress.value / 100) * allTime.value;
  }
  return nowTime.value;
});

const calculateProgress = (clientX: number, element: HTMLElement): number => {
  const rect = element.getBoundingClientRect();
  const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  return percent * 100;
};

const seekToProgress = (percentage: number) => {
  const targetTime = (percentage / 100) * allTime.value;
  audioService.seek(targetTime);
};

const handleProgressMouseDown = (e: MouseEvent) => {
  if (e.button !== 0) return;

  const target = e.currentTarget as HTMLElement;
  isDragging.value = true;
  dragProgress.value = calculateProgress(e.clientX, target);

  const handleMouseMove = (moveEvent: MouseEvent) => {
    if (isDragging.value) {
      dragProgress.value = calculateProgress(moveEvent.clientX, target);
    }
  };

  const handleMouseUp = () => {
    if (isDragging.value) {
      seekToProgress(dragProgress.value);
      isDragging.value = false;
    }

    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);

  e.preventDefault();
};

const handleProgressClick = (e: MouseEvent) => {
  if (isDragging.value) return;

  const target = e.currentTarget as HTMLElement;
  const percentage = calculateProgress(e.clientX, target);
  seekToProgress(percentage);
};

const formatTime = (seconds: number) => {
  return secondToMinute(seconds);
};

const openQueue = () => {
  playerStore.setMusicFull(false);
  playerStore.setQueueVisible(true);
};

const isDarkMode = computed(() => props.isDark);

const applyThemeColor = (colorValue: string) => {
  if (!colorValue || !playBarRef.value) return;

  console.log('Apply theme color:', colorValue);
  const playBarElement = playBarRef.value;

  const rgbMatch = colorValue.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);

  if (rgbMatch) {
    const [_, r, g, b] = rgbMatch.map(Number);

    const brightness = Math.round(0.299 * r + 0.587 * g + 0.114 * b);

    console.log(`Theme color brightness: ${brightness}/255`);

    playBarElement.style.setProperty('--fill-color', colorValue);

    if (brightness > 200) {
      const darkenedColor = `rgb(${Math.max(0, r - 60)}, ${Math.max(0, g - 60)}, ${Math.max(0, b - 60)})`;
      playBarElement.style.setProperty('--fill-color-alt', darkenedColor);
      playBarElement.style.setProperty('--fill-color-transparent', `rgba(${r}, ${g}, ${b}, 0.5)`);
      playBarElement.style.setProperty('--text-on-fill', '#000000');
      playBarElement.style.setProperty('--high-contrast-color', '#000000');
      playBarElement.classList.add('light-theme-color');
      playBarElement.classList.remove('dark-theme-color');
    } else if (brightness < 50) {
      const lightenedColor = `rgb(${Math.min(255, r + 60)}, ${Math.min(255, g + 60)}, ${Math.min(255, b + 60)})`;
      playBarElement.style.setProperty('--fill-color-alt', lightenedColor);
      playBarElement.style.setProperty('--fill-color-transparent', `rgba(${r}, ${g}, ${b}, 0.7)`);
      playBarElement.style.setProperty('--text-on-fill', '#ffffff');
      playBarElement.style.setProperty('--high-contrast-color', '#ffffff');
      playBarElement.classList.add('dark-theme-color');
      playBarElement.classList.remove('light-theme-color');
    } else {
      playBarElement.style.setProperty('--fill-color-alt', colorValue);
      playBarElement.style.setProperty('--fill-color-transparent', `rgba(${r}, ${g}, ${b}, 0.25)`);

      const textColor = brightness > 125 ? '#000000' : '#ffffff';
      playBarElement.style.setProperty('--text-on-fill', textColor);
      playBarElement.style.setProperty('--high-contrast-color', textColor);
      playBarElement.classList.remove('light-theme-color');
      playBarElement.classList.remove('dark-theme-color');
    }

    const lightenedColor = `rgb(${Math.min(255, r + 40)}, ${Math.min(255, g + 40)}, ${Math.min(255, b + 40)})`;
    playBarElement.style.setProperty('--fill-color-light', lightenedColor);
  } else {
    playBarElement.style.setProperty('--fill-color', colorValue);
    playBarElement.style.setProperty('--fill-color-transparent', `${colorValue}40`);
    playBarElement.style.setProperty('--fill-color-light', `${colorValue}80`);
    playBarElement.style.setProperty('--fill-color-alt', colorValue);
    playBarElement.style.setProperty('--text-on-fill', '#ffffff');
    playBarElement.style.setProperty('--high-contrast-color', '#ffffff');
  }
};

watch(
  () => playerStore.playMusic.primaryColor,
  (newVal) => {
    if (newVal) {
      applyThemeColor(newVal);
    }
  }
);

onMounted(() => {
  if (playerStore.playMusic?.primaryColor) {
    setTimeout(() => {
      applyThemeColor(playerStore.playMusic.primaryColor as string);
    }, 50);
  }
});
</script>

<style lang="scss" scoped>
.play-bar {
  @apply w-full;
  border-radius: 12px;
  transition: all 0.3s ease;

  --text-on-fill: #ffffff;
  --high-contrast-color: #ffffff;

  &.dark-theme {
    --text-color: #333333;
    --muted-color: rgba(0, 0, 0, 0.6);
    --track-color: rgba(0, 0, 0, 0.2);
    --track-color-hover: rgba(0, 0, 0, 0.4);
    --fill-color: rgba(255, 255, 255, 0.75);
    --fill-color-alt: rgba(255, 255, 255, 0.75);
    --fill-color-transparent: rgba(255, 255, 255, 0.15);
    --fill-color-light: rgba(255, 255, 255, 0.5);
    --button-bg: rgba(0, 0, 0, 0.1);
    --button-hover: rgba(0, 0, 0, 0.2);
  }

  &:not(.dark-theme) {
    --text-color: #f1f1f1;
    --muted-color: rgba(255, 255, 255, 0.6);
    --track-color: rgba(255, 255, 255, 0.1);
    --track-color-hover: rgba(255, 255, 255, 0.2);
    --fill-color: rgba(255, 255, 255, 0.8);
    --fill-color-alt: rgba(255, 255, 255, 0.8);
    --fill-color-transparent: rgba(255, 255, 255, 0.2);
    --fill-color-light: rgba(255, 255, 255, 0.5);
    --button-bg: rgba(255, 255, 255, 0.05);
    --button-hover: rgba(255, 255, 255, 0.1);
  }

  &.light-theme-color {
    .progress-fill {
      box-shadow:
        0 0 8px var(--fill-color-transparent),
        inset 0 0 0 1px rgba(0, 0, 0, 0.1);
    }

    .control-btn.play-btn {
      box-shadow:
        0 3px 8px var(--fill-color-transparent),
        0 1px 2px rgba(0, 0, 0, 0.3);
      color: var(--text-on-fill);
    }

    .volume-control :hover {
      color: var(--fill-color-alt);
    }
  }

  &.dark-theme-color {
    .progress-fill {
      box-shadow:
        0 0 10px var(--fill-color-transparent),
        inset 0 0 0 1px rgba(255, 255, 255, 0.2);
    }

    .control-btn.play-btn {
      box-shadow:
        0 3px 12px var(--fill-color-transparent),
        0 0 0 1px rgba(255, 255, 255, 0.2);

      .iconfont {
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
      }
    }

    .volume-control :hover {
      color: var(--fill-color-light);
    }
  }
}

.container {
  @apply flex flex-col;
}

.top-section {
  @apply mb-3;

  .progress-bar {
    @apply relative cursor-pointer h-2 mb-2 w-full;
    user-select: none;

    .progress-track {
      @apply absolute inset-0 rounded-full transition-all duration-150;
      background-color: var(--track-color);
    }

    .progress-fill {
      @apply absolute top-0 left-0 h-full rounded-full transition-all duration-150;
      background: linear-gradient(90deg, var(--fill-color), var(--fill-color-light));
      box-shadow: 0 0 8px var(--fill-color-transparent);
    }

    .progress-handle {
      @apply absolute top-1/2 rounded-full transition-all duration-200;
      right: 0;
      transform: translate(50%, -50%) scale(0.5);
      width: 16px;
      height: 16px;
      background-color: var(--fill-color, rgba(255, 255, 255, 0.85));
      opacity: 0;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    }

    &:hover,
    &.is-dragging {
      .progress-track {
        background-color: var(--track-color-hover);
      }

      .progress-fill {
        box-shadow: 0 0 12px var(--fill-color-transparent);
      }

      .progress-handle {
        opacity: 1;
        transform: translate(50%, -50%) scale(1);
      }
    }
  }

  .time-display {
    @apply flex justify-between text-base;
    color: var(--muted-color);

    .time-separator {
      @apply mx-1;
    }

    .current-time {
      opacity: 0.8;
      transition: opacity 0.3s ease;

      &:hover {
        opacity: 1;
      }
    }
  }
}

.controls-section {
  @apply flex items-center justify-between mb-4;

  .left-controls,
  .right-controls {
    @apply flex items-center;
  }

  .center-controls {
    @apply flex items-center justify-center space-x-6;
  }
}

.bottom-section {
  @apply flex items-center justify-between mt-2;
}

.control-btn {
  @apply flex items-center justify-center rounded-full outline-none border-0 transition-all duration-200;
  color: var(--text-color);
  background: transparent;
  width: 32px;
  height: 32px;
  cursor: pointer;

  &:hover {
    background-color: var(--button-bg);
    transform: scale(1.05);
  }

  &:active {
    background-color: var(--button-hover);
    transform: scale(0.95);
  }

  &.play-btn {
    background: linear-gradient(145deg, var(--fill-color), var(--fill-color-alt));
    color: var(--text-on-fill);
    width: 46px;
    height: 46px;
    box-shadow: 0 3px 8px var(--fill-color-transparent);

    &:hover {
      box-shadow: 0 4px 12px var(--fill-color-transparent);
    }

    .iconfont {
      font-size: 1.25rem;
    }
  }

  &.small-btn {
    @apply text-2xl;
    width: 28px;
    height: 28px;
  }

  .iconfont {
    @apply text-2xl;
  }
}

.volume-control {
  @apply flex items-center space-x-2;
  color: var(--text-color);

  .iconfont {
    @apply cursor-pointer text-base;
    transition:
      transform 0.2s ease,
      color 0.2s ease;

    &:hover {
      transform: scale(1.1);
      color: var(--fill-color);
    }
  }

  .volume-slider {
    @apply w-24;

    :deep(.n-slider) {
      --n-rail-height: 8px !important;
      --n-fill-color: var(--fill-color);
      --n-rail-color: var(--track-color);
      --n-handle-size: 16px !important;
      --n-handle-color: var(--fill-color, rgba(255, 255, 255, 0.85));

      .n-slider-rail {
        @apply transition-all duration-200 rounded-full;
      }

      .n-slider-rail__fill {
        background: linear-gradient(90deg, var(--fill-color), var(--fill-color-light));
        box-shadow: 0 0 6px var(--fill-color-transparent);
      }

      .n-slider-handle {
        @apply transition-all duration-200;
        background-color: var(--fill-color, rgba(255, 255, 255, 0.85)) !important;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3) !important;
        border: none !important;
        opacity: 0;
        transform: scale(0.5);
      }

      &:hover .n-slider-handle {
        opacity: 1;
        transform: scale(1);
      }
    }
  }
}

.spacer {
  flex: 1;
}

.like-active {
  color: var(--fill-color);
  text-shadow: 0 0 8px var(--fill-color-transparent);
}

.intelligence-active {
  @apply text-primary;
}
</style>
