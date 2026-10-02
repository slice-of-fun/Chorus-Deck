<template>
  <div
    class="mini-play-bar"
    :class="{ 'pure-mode': pureModeEnabled, 'mini-mode': settingsStore.isMiniMode }"
  >

    <div class="mini-bar-container">
      <div class="section-left">
        <div class="album-cover-wrapper">
          <svg class="circular-progress" viewBox="0 0 100 100">
            <circle class="progress-bg" cx="50" cy="50" r="46" />
            <circle class="progress-value" cx="50" cy="50" r="46" :stroke-dasharray="289.02" :stroke-dashoffset="289.02 - (289.02 * (nowTime / allTime))" :stroke="playMusic?.primaryColor || 'var(--primary-color)'" />
          </svg>
          <div class="album-cover">
            <n-image
              :src="getImgUrl(playMusic?.picUrl, '100y100')"
              :fallback-src="logoImg"
              class="cover-img"
              preview-disabled
            />
          </div>
        </div>

        <div class="song-info">
          <div class="song-title" v-html="playMusic?.name || 'Not played'"></div>
          <div class="song-artist">
            <span
              v-for="(artists, artistsindex) in artistList"
              :key="artistsindex"
              class="cursor-pointer hover:text-primary"
              @click.stop="handleArtistClick(artists.id)"
            >
              {{ artists.name }}{{ artistsindex < artistList.length - 1 ? ' / ' : '' }}
            </span>
          </div>
        </div>
      </div>

      <div class="section-center">
        <div class="control-buttons">
          <div class="control-button" :class="{ 'active': playerStore.queueVisible && activeTab === 'lyrics' }" @click="toggleLyrics">
            <i class="ri-mic-line"></i>
          </div>
          <div class="control-button previous" :style="{ color: playMusic?.primaryColor }" @click="handlePrev">
            <i class="ri-skip-back-fill"></i>
          </div>
          
          <div class="control-button play-pause" @click="playMusicEvent">
            <AnimatedPlayPause 
              :is-playing="play" 
              :bg-color="playMusic?.primaryColor || 'var(--primary-color)'"
              :icon-color="playMusic?.primaryColor || 'var(--primary-color)'"
            />
          </div>

          <div class="control-button next" :style="{ color: playMusic?.primaryColor }" @click="handleNext">
            <i class="ri-skip-forward-fill"></i>
          </div>
          <div class="control-button" :class="{ 'active': playerStore.queueVisible && activeTab === 'queue' }" @click="togglePlaylist">
            <i class="ri-play-list-line"></i>
          </div>
        </div>
      </div>

      <div class="section-right">
        <div class="control-button circular-restore" @click="restoreMainWindow">
          <i class="ri-external-link-line"></i>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue';
import { useRouter } from 'vue-router';

import logoImg from '@/assets/logo.png';
import SongItem from '@/components/common/SongItem.vue';
import AnimatedPlayPause from '@/components/player/AnimatedPlayPause.vue';
import { allTime, artistList, nowTime, playMusic } from '@/hooks/MusicHook';
import { useArtist } from '@/hooks/useArtist';
import { useFavorite } from '@/hooks/useFavorite';
import { usePlaybackControl } from '@/hooks/usePlaybackControl';
import { useVolumeControl } from '@/hooks/useVolumeControl';
import { audioService } from '@/services/audioService';
import { usePlayerStore, useSettingsStore } from '@/store';
import { getImgUrl } from '@/utils';

const playerStore = usePlayerStore();
const settingsStore = useSettingsStore();
const router = useRouter();
const { navigateToArtist } = useArtist();

const { isPlaying: play, playMusicEvent, handleNext, handlePrev } = usePlaybackControl();
const activeTab = ref('queue');

window.addEventListener('queue-tab-changed', (e: any) => {
  activeTab.value = e.detail;
});

const {
  isMuted,
  volumeSlider,
  volumeIcon: getVolumeIcon,
  mute,
  handleVolumeWheel
} = useVolumeControl();

const { isFavorite, toggleFavorite } = useFavorite();

withDefaults(
  defineProps<{
    pureModeEnabled?: boolean;
    component?: boolean;
  }>(),
  {
    component: false
  }
);

const restoreMainWindow = () => {
  if (settingsStore.isMiniMode) {
    settingsStore.setMiniMode(false);
    try {
      router.push('/');
    } catch(e) {}
    if (window.api && typeof window.api.resizeWindow === 'function') {
      window.api.resizeWindow(1200, 800);
    }
    if (window.api && typeof window.api.restore === 'function') {
      window.api.restore();
    }
  }
};

const togglePlaylist = () => {
  if (playerStore.queueVisible && activeTab.value === 'queue') {
    playerStore.setQueueVisible(false);
  } else {
    activeTab.value = 'queue';
    playerStore.setQueueVisible(true);
    window.dispatchEvent(new CustomEvent('open-queue-tab', { detail: 'queue' }));
  }
};

const toggleLyrics = () => {
  if (playerStore.queueVisible && activeTab.value === 'lyrics') {
    playerStore.setQueueVisible(false);
  } else {
    activeTab.value = 'lyrics';
    playerStore.setQueueVisible(true);
    window.dispatchEvent(new CustomEvent('open-queue-tab', { detail: 'lyrics' }));
  }
};

const updateWindowSize = () => {
};

const handleArtistClick = (id: string | undefined) => {
};

const handleProgressClick = (e: MouseEvent) => {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const percent = (e.clientX - rect.left) / rect.width;
  audioService.seek(allTime.value * percent);
  nowTime.value = allTime.value * percent;
};

const hoverTime = ref(0);
const isHovering = ref(false);

const handleProgressHover = (e: MouseEvent) => {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const percent = (e.clientX - rect.left) / rect.width;
  hoverTime.value = allTime.value * percent;
  isHovering.value = true;
};

const handleProgressLeave = () => {
  isHovering.value = false;
};

const setMusicFull = () => {
  if (settingsStore.isMiniMode) {
    restoreMainWindow();
  } else {
    playerStore.setMusicFull(true);
  }
};
</script>

<style lang="scss" scoped>
.mini-play-bar {
  @apply w-full flex flex-col bg-black;
  height: 72px;
  border-radius: 9999px;
  position: relative;
  overflow: visible;

  &.mini-mode {
    @apply shadow-lg;
    -webkit-app-region: drag;

    .album-cover-wrapper, .song-info, .control-button {
      -webkit-app-region: no-drag;
    }
    
    .mini-bar-container {
      @apply px-4;
    }

    .song-info {
      flex: 1;
      margin-right: 8px;

      .song-title {
        @apply text-base font-bold;
        color: #ffffff;
      }

      .song-artist {
        @apply text-sm font-medium opacity-70;
        color: #ffffff;
      }
    }

    .control-buttons {
      @apply space-x-2;
      .control-button {
        width: 36px;
        height: 36px;
        color: #ffffff;
        background: transparent;

        &.active {
          background-color: rgba(255, 255, 255, 0.2);
        }

        .iconfont, i {
          @apply text-xl;
        }

        &.play-pause {
          width: 52px;
          height: 52px;
          i { font-size: 28px; }
        }
      }
    }
  }
}

.mini-bar-container {
  @apply flex items-center px-2 h-full relative justify-between;
  flex: 1;
}

.section-left {
  @apply flex items-center flex-1 min-w-0;
}

.section-center {
  @apply flex items-center justify-end pr-2;
}

.section-right {
  @apply flex items-center justify-center pl-2 ml-2 border-l border-white/10;
}

.album-cover-wrapper {
  @apply relative flex items-center justify-center flex-shrink-0 mr-4 cursor-pointer;
  width: 56px;
  height: 56px;

  .circular-progress {
    @apply absolute inset-0;
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);

    .progress-bg {
      fill: none;
      stroke: rgba(255, 255, 255, 0.1);
      stroke-width: 8;
    }

    .progress-value {
      fill: none;
      stroke-width: 8;
      stroke-linecap: round;
      transition: stroke-dashoffset 0.1s linear;
    }
  }
}

.album-cover {
  @apply relative rounded-full overflow-hidden flex items-center justify-center;
  width: 44px;
  height: 44px;
  z-index: 1;

  .cover-img {
    @apply w-full h-full object-cover pointer-events-none;
  }
}

.song-info {
  @apply flex flex-col justify-center min-w-0 cursor-pointer;

  .song-title {
    @apply text-base font-bold truncate;
    color: #ffffff;
  }

  .song-artist {
    @apply text-sm truncate mt-0.5 font-medium opacity-70;
    color: #ffffff;
  }
}

.control-buttons {
  @apply flex items-center space-x-3;
}

.control-button {
  @apply flex items-center justify-center rounded-full transition-all duration-200 border-0 bg-transparent cursor-pointer;
  width: 36px;
  height: 36px;
  color: #ffffff;

  &:hover {
    transform: scale(1.1);
  }
  
  &.play-pause {
    width: 44px;
    height: 44px;
    background-color: transparent;
    padding: 0;
  }
  
  &.circular-restore {
    background-color: rgba(255, 255, 255, 0.1);
    &:hover {
      background-color: rgba(255, 255, 255, 0.2);
    }
  }

  i {
    font-size: 20px;
  }
}

.like-active {
  @apply text-red-500 hover:text-red-600 !important;
}

.volume-slider-wrapper {
  @apply p-2 py-4 rounded-xl bg-white dark:bg-dark-100 shadow-lg bg-opacity-90 backdrop-blur;
  height: 160px;

  :deep(.n-slider) {
    --n-rail-height: 4px;
    --n-rail-color: theme('colors.gray.200');
    --n-rail-color-dark: theme('colors.gray.700');
    --n-fill-color: theme('colors.green.500');
    --n-handle-size: 12px;
    --n-handle-color: theme('colors.green.500');

    &.n-slider--vertical {
      height: 100%;

      .n-slider-rail {
        width: 4px;
      }

      &:hover {
        .n-slider-rail {
          width: 6px;
        }

        .n-slider-handle {
          width: 14px;
          height: 14px;
        }
      }
    }

    .n-slider-rail {
      @apply overflow-hidden transition-all duration-200;
      @apply bg-gray-500 dark:bg-dark-300 bg-opacity-10 !important;
    }

    .n-slider-handle {
      @apply transition-all duration-200;
      opacity: 0;
    }

    &:hover {
      .n-slider-handle {
        opacity: 1;
      }
    }
  }
}



.dark {
  .song-info {
    .song-title {
      color: var(--text-color-1, #fff);
    }

    .song-artist {
      color: var(--text-color-2, #fff);
    }
  }
}

:deep(.n-popover) {
  background-color: transparent !important;
}
</style>
