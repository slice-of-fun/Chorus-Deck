<template>
  <n-drawer
    v-model:show="isVisible"
    height="100%"
    placement="bottom"
    :style="{ background: playerStore.playMusic.primaryColor || background }"
    :to="`#layout-main`"
    :z-index="9998"
  >
    <div
      id="compact-drawer-target"
      :class="[
        config.theme,
        `cover-style-${config.compactCoverStyle}`,
        { 'is-landscape': isLandscape },
        { 'is-dark': isDark }
      ]"
    >
      <div v-if="playMusic?.playLoading" class="loading-overlay">
        <i class="ri-loader-4-line loading-icon"></i>
      </div>
      <div
        class="control-btn absolute left-5"
        :class="{ 'pure-mode': config.pureModeEnabled }"
        @click="closeMusicFull"
      >
        <i class="ri-arrow-down-s-line"></i>
      </div>

      <div
        class="control-btn absolute right-5 flex items-center gap-2"
        :class="[
          { 'pure-mode': config.pureModeEnabled },
          hasSleepTimerActive ? '!w-auto !px-2' : ''
        ]"
      >
        <div
          v-if="hasSleepTimerActive"
          class="flex items-center gap-1 px-2 py-1 rounded-full bg-black/30 backdrop-blur-sm text-xs text-white/90"
          @click="showPlayerSettings = true"
        >
          <i class="ri-timer-line text-primary"></i>
          <span class="font-medium tabular-nums">{{ sleepTimerDisplayText }}</span>
        </div>
        <div @click="showPlayerSettings = true">
          <i class="ri-more-2-fill"></i>
        </div>
      </div>

      <compact-player-settings v-model:visible="showPlayerSettings" />

      <transition name="fade">
        <div v-if="showFullLyrics && !isLandscape" class="fullscreen-lyrics" :class="config.theme">
          <div class="fullscreen-header">
            <div class="song-title" v-html="playMusic.name"></div>
            <div class="artist-name">
              <span v-for="(item, index) in artistList" :key="index">
                {{ item.name }}{{ index < artistList.length - 1 ? ' / ' : '' }}
              </span>
            </div>
          </div>

          <div
            ref="lyricsScrollerRef"
            class="lyrics-scroller"
            @touchstart="handleTouchStart"
            @touchmove="handleTouchMove"
            @touchend="handleTouchEnd"
            @wheel="handleManualScroll"
            @scroll="handleScroll"
          >
            <div class="lyrics-padding-top"></div>

            <div v-if="!supportAutoScroll" class="lyric-line no-scroll-tip">
              <span>This lyrics does not support auto-scroll</span>
            </div>
            <div
              v-for="(item, index) in lrcArray"
              :key="index"
              :id="`lyric-line-${index}`"
              class="lyric-line"
              :class="{
                'now-text': index === nowIndex,
                'hover-text': item.text && item.startTime !== -1
              }"
              @click="item.startTime !== -1 ? setAudioTime(index) : null"
            >
              <div
                v-if="item.hasWordByWord && item.words && item.words.length > 0"
                class="word-by-word-lyric"
              >
                <template v-for="(word, wordIndex) in item.words" :key="wordIndex">
                  <span class="lyric-word" :style="getWordStyle(index, wordIndex, word)">
                    {{ word.text }} </span
                  ><span class="lyric-word" v-if="word.space">&nbsp;</span></template
                >
              </div>

              <span
                v-else
                :style="getLrcStyle(index)"
                :class="{ 'bg-vocal': item.text.startsWith('{bg}') }"
                >{{ item.text.replace('{bg}', '') }}</span
              >
              <div v-if="config.showRoma && item.romaText" class="translation">
                {{ item.romaText }}
              </div>
              <div v-if="config.showTranslation && item.trText" class="translation">
                {{ item.trText }}
              </div>
            </div>
            <div class="lyrics-padding-bottom"></div>
          </div>
          <button
            v-if="showSyncButton && supportAutoScroll"
            class="lyrics-sync-button"
            type="button"
            @click="syncLyrics"
          >
            <i class="ri-focus-3-line"></i>
            Sync
          </button>
        </div>
      </transition>

      <transition name="fade">
        <div v-if="!showFullLyrics && !isLandscape" class="ios-layout-container">
          <div
            class="cover-container"
            :class="{
              'record-style': config.compactCoverStyle === 'record',
              'square-style': config.compactCoverStyle === 'square',
              'full-style': config.compactCoverStyle === 'full',
              paused: !play
            }"
            @click="cycleCoverStyle"
          >
            <div class="img-wrapper">
              <n-image
                ref="PicImgRef"
                :src="currentSrc"
                preview-disabled
                class="cover-image"
                :class="{
                  'full-blend': config.compactCoverStyle === 'full',
                  'has-black-bars': hasBlackBars
                }"
                :img-props="{ referrerpolicy: 'no-referrer' }"
                @load="onImageLoad"
                @error="onImageError"
              />
            </div>
          </div>

          <div class="px-2 flex-1 flex flex-col justify-around w-[85%]">
            <div class="song-info">
              <div class="song-title-container">
                <h1 class="song-title" v-html="playMusic.name"></h1>
              </div>
              <p class="song-artist">
                <span
                  v-for="(item, index) in artistList"
                  :key="index"
                  class="artist-name"
                  @click="handleArtistClick(item.id)"
                >
                  {{ item.name }}
                  {{ index < artistList.length - 1 ? ' / ' : '' }}
                </span>
              </p>
              <div class="favorite-icon" @click="toggleFavorite">
                <i class="ri-heart-3-fill" :class="{ favorite: isFavorite }"></i>
              </div>
            </div>

            <div class="lyrics-container" v-if="!config.hideLyrics" @click="showFullLyricScreen">
              <div v-if="lrcArray.length > 0" class="lyrics-wrapper">
                <div v-for="(line, idx) in visibleLyrics" :key="idx" class="lyric-line">
                  <div
                    v-if="line.hasWordByWord && line.words && line.words.length > 0"
                    class="word-by-word-lyric"
                  >
                    <template v-for="(word, wordIndex) in line.words" :key="wordIndex">
                      <span
                        class="lyric-word"
                        :style="getWordStyle(line.originalIndex, wordIndex, word)"
                      >
                        {{ word.text }}</span
                      ><span v-if="word.space">&nbsp;</span></template
                    >
                  </div>

                  <span v-else :class="{ 'bg-vocal': line.text.startsWith('{bg}') }">{{
                    line.text.replace('{bg}', '')
                  }}</span>
                </div>
              </div>
              <div v-else class="no-lyrics">No lyrics, please enjoy</div>
            </div>
          </div>
        </div>
      </transition>

      <div v-if="isLandscape" class="landscape-layout">
        <div class="landscape-left-section">
          <div
            class="landscape-cover-container cover-container"
            :class="{
              'record-style': config.compactCoverStyle === 'record',
              'square-style': config.compactCoverStyle === 'square',
              'full-style': config.compactCoverStyle === 'full',
              paused: !play
            }"
            @click="cycleCoverStyle"
          >
            <div class="img-wrapper">
              <n-image
                :src="currentSrc"
                preview-disabled
                class="cover-image"
                :class="{
                  'full-blend': config.compactCoverStyle === 'full',
                  'has-black-bars': hasBlackBars
                }"
                :img-props="{ referrerpolicy: 'no-referrer' }"
                @load="onImageLoad"
                @error="onImageError"
              />
            </div>
          </div>

          <div class="landscape-progress-container">
            <div class="time-info">
              <span class="current-time">{{ secondToMinute(nowTime) }}</span>
              <span class="total-time">{{ secondToMinute(allTime) }}</span>
            </div>
            <div
              class="apple-style-progress"
              @click="handleProgressBarClick"
              @mousedown="handleMouseDown"
            >
              <div class="progress-track">
                <div
                  class="progress-fill"
                  :style="{ width: `${(nowTime / Math.max(1, allTime)) * 100}%` }"
                ></div>
                <div
                  class="progress-thumb"
                  :class="{ active: isThumbDragging || isMouseDragging }"
                  :style="{ left: `${(nowTime / Math.max(1, allTime)) * 100}%` }"
                  @touchstart="handleThumbTouchStart"
                  @touchmove="handleThumbTouchMove"
                  @touchend="handleThumbTouchEnd"
                  @mousedown="handleMouseDown"
                ></div>
              </div>
            </div>
          </div>
        </div>

        <div class="landscape-lyrics-section">
          <div class="landscape-song-info">
            <div class="flex flex-col flex-1">
              <h1 class="song-title" v-html="playMusic.name"></h1>
              <p class="song-artist">
                <span
                  v-for="(item, index) in artistList"
                  :key="index"
                  class="artist-name"
                  @click="handleArtistClick(item.id)"
                >
                  {{ item.name }}{{ index < artistList.length - 1 ? ' / ' : '' }}
                </span>
              </p>
            </div>
            <div class="favorite-icon landscape" @click="toggleFavorite">
              <i class="ri-heart-3-fill" :class="{ favorite: isFavorite }"></i>
            </div>
          </div>

          <div
            ref="landscapeLyricsRef"
            class="landscape-lyrics-scroller"
            @touchstart="handleTouchStart"
            @touchmove="handleTouchMove"
            @touchend="handleTouchEnd"
            @wheel="handleManualScroll"
            @scroll="handleScroll"
          >
            <div class="lyrics-padding-top"></div>

            <div v-if="!supportAutoScroll" class="lyric-line no-scroll-tip">
              <span>This lyrics does not support auto-scroll</span>
            </div>
            <div
              v-for="(item, index) in lrcArray"
              :key="index"
              :id="`landscape-lyric-line-${index}`"
              class="lyric-line"
              :class="{
                'now-text': index === nowIndex,
                'hover-text': item.text && item.startTime !== -1
              }"
              @click="item.startTime !== -1 ? setAudioTime(index) : null"
            >
              <div
                v-if="item.hasWordByWord && item.words && item.words.length > 0"
                class="word-by-word-lyric"
              >
                <template v-for="(word, wordIndex) in item.words" :key="wordIndex">
                  <span class="lyric-word" :style="getWordStyle(index, wordIndex, word)">
                    {{ word.text }} </span
                  ><span class="lyric-word" v-if="word.space">&nbsp;</span></template
                >
              </div>

              <span
                v-else
                :style="getLrcStyle(index)"
                :class="{ 'bg-vocal': item.text.startsWith('{bg}') }"
                >{{ item.text.replace('{bg}', '') }}</span
              >
              <div v-if="config.showRoma && item.romaText" class="translation">
                {{ item.romaText }}
              </div>
              <div v-if="config.showTranslation && item.trText" class="translation">
                {{ item.trText }}
              </div>
            </div>
            <div class="lyrics-padding-bottom"></div>
          </div>

          <button
            v-if="showSyncButton && supportAutoScroll"
            class="lyrics-sync-button landscape-sync-button"
            type="button"
            @click="syncLyrics"
          >
            <i class="ri-focus-3-line"></i>
            Sync
          </button>

          <div class="landscape-main-controls">
            <div
              class="main-button prev"
              style="width: 48px; height: 48px"
              :style="{ color: playMusic?.primaryColor }"
              @click="prevSong"
            >
              <i class="ri-skip-back-fill" style="font-size: 36px"></i>
            </div>
            <div
              class="main-button play-pause play-animated"
              style="width: 64px; height: 64px; border: none; background: none; padding: 0"
              @click="togglePlay"
            >
              <animated-play-pause :is-playing="play" :bg-color="playMusic?.primaryColor" />
            </div>
            <div
              class="main-button next"
              style="width: 48px; height: 48px"
              :style="{ color: playMusic?.primaryColor }"
              @click="nextSong"
            >
              <i class="ri-skip-forward-fill" style="font-size: 36px"></i>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="!isLandscape"
        class="unified-controls"
        :class="{ 'fullscreen-mode': showFullLyrics }"
      >
        <div class="progress-container">
          <div class="time-info">
            <span class="current-time">{{ secondToMinute(nowTime) }}</span>
            <span class="total-time">{{ secondToMinute(allTime) }}</span>
          </div>
          <div
            class="apple-style-progress"
            @click="handleProgressBarClick"
            @mousedown="handleMouseDown"
          >
            <div class="progress-track">
              <div
                class="progress-fill"
                :style="{ width: `${(nowTime / Math.max(1, allTime)) * 100}%` }"
              ></div>
              <div
                class="progress-thumb"
                :class="{ active: isThumbDragging || isMouseDragging }"
                :style="{ left: `${(nowTime / Math.max(1, allTime)) * 100}%` }"
                @touchstart="handleThumbTouchStart"
                @touchmove="handleThumbTouchMove"
                @touchend="handleThumbTouchEnd"
                @mousedown="handleMouseDown"
              ></div>
            </div>
          </div>
        </div>

        <div class="control-buttons">
          <div v-if="showFullLyrics" class="back-button" @click.stop="closeFullLyrics">
            <i class="ri-arrow-down-s-line"></i>
          </div>
          <div class="side-button" @click="togglePlayMode">
            <i :class="playModeIcon"></i>
          </div>
          <div
            class="main-button prev"
            style="width: 48px; height: 48px"
            :style="{ color: playMusic?.primaryColor }"
            @click="prevSong"
          >
            <i class="ri-skip-back-fill" style="font-size: 36px"></i>
          </div>
          <div
            class="main-button play-pause play-animated"
            style="width: 64px; height: 64px; border: none; background: none; padding: 0"
            @click="togglePlay"
          >
            <animated-play-pause :is-playing="play" :bg-color="playMusic?.primaryColor" />
          </div>
          <div
            class="main-button next"
            style="width: 48px; height: 48px"
            :style="{ color: playMusic?.primaryColor }"
            @click="nextSong"
          >
            <i class="ri-skip-forward-fill" style="font-size: 36px"></i>
          </div>
          <div class="side-button" @click="showPlaylist">
            <i class="ri-play-list-fill"></i>
          </div>
        </div>
      </div>
    </div>
  </n-drawer>
</template>

<script setup lang="ts">
import { useWindowSize } from '@vueuse/core';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import AnimatedPlayPause from '@/components/player/AnimatedPlayPause.vue';
import CompactPlayerSettings from '@/components/player/CompactPlayerSettings.vue';
import {
  allTime,
  artistList,
  correctionTime,
  lrcArray,
  nowIndex,
  nowTime,
  playMusic,
  setAudioTime,
  sound,
  textColors,
  useLyricProgress
} from '@/hooks/MusicHook';
import { useArtist } from '@/hooks/useArtist';
import { useLyricBackground } from '@/hooks/useLyricBackground';
import { usePlayMode } from '@/hooks/usePlayMode';
import { audioService } from '@/services/audioService';
import { usePlayerStore } from '@/store/modules/player';
import { DEFAULT_LYRIC_CONFIG, LyricConfig } from '@/types/lyric';
import { secondToMinute } from '@/utils';
import { getTextColors } from '@/utils/linearColor';
import { LYRIC_CONFIG_CHANGE_EVENT, readLyricConfig } from '@/utils/lyricConfig';
import { showBottomToast } from '@/utils/shortcutToast';
import { thumbPlayer } from '@/utils/thumbnail';

const playerStore = usePlayerStore();

const play = computed(() => playerStore.isPlay);
const playIcon = computed(() => (play.value ? 'ri-pause-fill' : 'ri-play-fill'));

const showPlayerSettings = ref(false);

const currentSrc = ref(thumbPlayer(playMusic.value?.picUrl));
watch(
  () => playMusic.value?.picUrl,
  (newVal) => {
    currentSrc.value = thumbPlayer(newVal);
  }
);

const hasBlackBars = computed(() => {
  return currentSrc.value?.includes('sddefault') || currentSrc.value?.includes('hqdefault');
});

const onImageLoad = (e: Event) => {
  const img = e.target as HTMLImageElement;
  if (img && img.naturalWidth <= 120) {
    if (currentSrc.value?.includes('maxresdefault.jpg')) {
      currentSrc.value = currentSrc.value.replace('maxresdefault.jpg', 'sddefault.jpg');
    } else if (currentSrc.value?.includes('sddefault.jpg')) {
      currentSrc.value = currentSrc.value.replace('sddefault.jpg', 'hqdefault.jpg');
    }
  }
};

const onImageError = () => {
  if (currentSrc.value?.includes('maxresdefault.jpg')) {
    currentSrc.value = currentSrc.value.replace('maxresdefault.jpg', 'sddefault.jpg');
  } else if (currentSrc.value?.includes('sddefault.jpg')) {
    currentSrc.value = currentSrc.value.replace('sddefault.jpg', 'hqdefault.jpg');
  }
};

const sleepTimerRefresh = ref(0);
let sleepTimerInterval: ReturnType<typeof setInterval> | null = null;

const hasSleepTimerActive = computed(() => playerStore.hasSleepTimerActive);

const sleepTimerDisplayText = computed(() => {
  void sleepTimerRefresh.value;

  const timer = playerStore.sleepTimer;
  if (timer.type === 'time' && timer.endTime) {
    const remaining = Math.max(0, timer.endTime - Date.now());
    const totalSeconds = Math.floor(remaining / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  if (timer.type === 'songs' && timer.remainingSongs) {
    return `${timer.remainingSongs}head`;
  }
  if (timer.type === 'end') {
    return 'end of list';
  }
  return '';
});

watch(
  hasSleepTimerActive,
  (active) => {
    if (active && playerStore.sleepTimer.type === 'time') {
      if (!sleepTimerInterval) {
        sleepTimerInterval = setInterval(() => {
          sleepTimerRefresh.value = Date.now();
        }, 1000);
      }
    } else {
      if (sleepTimerInterval) {
        clearInterval(sleepTimerInterval);
        sleepTimerInterval = null;
      }
    }
  },
  { immediate: true }
);

const { playMode, playModeIcon, playModeText, togglePlayMode: togglePlayModeBase } = usePlayMode();

const showPlaylist = () => {
  playerStore.setQueueVisible(true);
};

const isFavorite = computed(() => {
  return playerStore.favoriteIds.includes(playMusic.value.id);
});

const toggleFavorite = () => {
  if (isFavorite.value) {
    playerStore.removeFromFavorite(playMusic.value.id);
  } else {
    playerStore.addToFavorite(playMusic.value);
  }
};

const showFullLyrics = ref(false);
const isAutoScrollEnabled = ref(true);
const lyricsScrollerRef = ref<HTMLElement | null>(null);
const isTouchScrolling = ref(false);
const touchStartY = ref(0);
const lastScrollTop = ref(0);
const autoScrollTimer = ref<number | null>(null);
const isSongChanging = ref(false);
const showSyncButton = ref(false);
const isProgrammaticScroll = ref(false);

const { width, height } = useWindowSize();
const isLandscape = computed(() => width.value > height.value);
const landscapeLyricsRef = ref<HTMLElement | null>(null);

watch(isLandscape, (newVal) => {
  if (newVal) {
    nextTick(() => {
      setTimeout(() => {
        scrollToCurrentLyric(true, landscapeLyricsRef.value);
      }, 300);
    });
  }
});

const showFullLyricScreen = () => {
  showFullLyrics.value = true;

  nextTick(() => {
    scrollToCurrentLyric(true);

    setTimeout(() => {
      scrollToCurrentLyric(true);
    }, 200);

    setTimeout(() => {
      scrollToCurrentLyric(true);
    }, 500);
  });
};

const supportAutoScroll = computed(() => {
  return lrcArray.value.length > 0 && lrcArray.value[0].startTime !== -1;
});

const closeFullLyrics = () => {
  showFullLyrics.value = false;
  if (autoScrollTimer.value) {
    clearTimeout(autoScrollTimer.value);
    autoScrollTimer.value = null;
  }
};

const scrollToCurrentLyric = (immediate = false, customScrollerRef?: HTMLElement | null) => {
  try {
    const scrollerRef = customScrollerRef || lyricsScrollerRef.value;
    if (!scrollerRef) {
      console.log('Lyrics container reference does not exist');
      return;
    }

    if (!supportAutoScroll.value) {
      console.log('Lyrics do not support auto-scrolling');
      return;
    }

    if (isTouchScrolling.value && !immediate) {
      return;
    }

    const prefix = customScrollerRef ? 'landscape-' : '';
    const activeEl = document.getElementById(`${prefix}lyric-line-${nowIndex.value}`);
    if (!activeEl) {
      console.log(`Current lyrics element not found: ${prefix}lyric-line-${nowIndex.value}`);
      return;
    }

    const containerRect = scrollerRef.getBoundingClientRect();
    const lineRect = activeEl.getBoundingClientRect();

    const scrollTop =
      scrollerRef.scrollTop +
      (lineRect.top - containerRect.top) -
      containerRect.height / 2 +
      lineRect.height / 2;

    console.log(`scroll to lyrics #${nowIndex.value}, Location: ${scrollTop}px`);

    scrollerRef.scrollTo({
      top: scrollTop,
      behavior: immediate ? 'auto' : 'smooth'
    });
    isProgrammaticScroll.value = true;
    window.setTimeout(
      () => {
        isProgrammaticScroll.value = false;
      },
      immediate ? 120 : 500
    );
  } catch (err) {
    console.error('Error scrolling lyrics:', err);
  }
};

watch(nowIndex, (newIndex, oldIndex) => {
  console.log(`Lyric index changes: ${oldIndex} -> ${newIndex}`);

  if (isSongChanging.value || showSyncButton.value) return;

  if (showFullLyrics.value) {
    nextTick(() => {
      scrollToCurrentLyric(false);
    });
  } else if (isLandscape.value) {
    nextTick(() => {
      scrollToCurrentLyric(false, landscapeLyricsRef.value);
    });
  }
});

watch(showFullLyrics, (newVal) => {
  if (newVal) {
    nextTick(() => {
      setTimeout(() => {
        scrollToCurrentLyric(true);
      }, 300);
    });
  }
});

watch(nowTime, () => {
  if (!isThumbDragging.value && !isTouchScrolling.value && !showSyncButton.value) {
    if (showFullLyrics.value) {
      scrollToCurrentLyric(false);
    } else if (isLandscape.value) {
      scrollToCurrentLyric(false, landscapeLyricsRef.value);
    }
  }
});

const handleScroll = () => {
  if (isProgrammaticScroll.value || isSongChanging.value) return;

  showSyncButton.value = true;
  if (!isTouchScrolling.value) return;

  isAutoScrollEnabled.value = false;

  if (autoScrollTimer.value) {
    clearTimeout(autoScrollTimer.value);
  }

  autoScrollTimer.value = window.setTimeout(() => {
    isAutoScrollEnabled.value = false;
    isTouchScrolling.value = false;
  }, 3000);
};

const handleManualScroll = () => {
  if (isProgrammaticScroll.value || isSongChanging.value) return;
  showSyncButton.value = true;
  isAutoScrollEnabled.value = false;
};

const handleTouchStart = (e: TouchEvent) => {
  touchStartY.value = e.touches[0].clientY;

  const scrollerRef = showFullLyrics.value
    ? lyricsScrollerRef.value
    : isLandscape.value
      ? landscapeLyricsRef.value
      : lyricsScrollerRef.value;

  lastScrollTop.value = scrollerRef?.scrollTop || 0;
  isTouchScrolling.value = true;

  isAutoScrollEnabled.value = false;

  if (autoScrollTimer.value) {
    clearTimeout(autoScrollTimer.value);
    autoScrollTimer.value = null;
  }
};

const handleTouchMove = () => {
  if (!isTouchScrolling.value) return;
};

const handleTouchEnd = () => {
  if (autoScrollTimer.value) {
    clearTimeout(autoScrollTimer.value);
  }

  autoScrollTimer.value = window.setTimeout(() => {
    isAutoScrollEnabled.value = false;
    isTouchScrolling.value = false;
  }, 3000);
};

const syncLyrics = () => {
  if (showFullLyrics.value) {
    scrollToCurrentLyric(true);
  } else if (isLandscape.value) {
    scrollToCurrentLyric(true, landscapeLyricsRef.value);
  }

  showSyncButton.value = false;
  isAutoScrollEnabled.value = true;
  isTouchScrolling.value = false;
};

const cycleCoverStyle = () => {
  const styles = ['record', 'square', 'full'];
  const currentIdx = styles.indexOf(config.value.compactCoverStyle);
  const nextIdx = (currentIdx + 1) % styles.length;
  config.value.compactCoverStyle = styles[nextIdx] as 'record' | 'square' | 'full';

  const container = document.querySelector('.cover-container');
  if (container) {
    container.classList.add('style-changing');
    setTimeout(() => {
      container.classList.remove('style-changing');
    }, 500);
  }
};

const isThumbDragging = ref(false);
const progressContainerWidth = ref(0);

const isMouseDragging = ref(false);

const handleProgressBarClick = (e: MouseEvent) => {
  if (!sound.value) return;

  e.stopPropagation();
  const progressBar = e.currentTarget as HTMLElement;
  const rect = progressBar.getBoundingClientRect();
  const offsetX = e.clientX - rect.left;
  progressContainerWidth.value = rect.width;

  const percentage = offsetX / rect.width;
  const newTime = Math.max(0, Math.min(percentage * allTime.value, allTime.value));

  console.log(`Progress bar click: ${percentage.toFixed(2)}, new time: ${newTime.toFixed(2)}`);

  audioService.seek(newTime);
  nowTime.value = newTime;
};

const handleMouseDown = (e: MouseEvent) => {
  if (e.button !== 0) return;

  e.preventDefault();
  e.stopPropagation();
  isMouseDragging.value = true;

  const progressBar = (e.currentTarget as HTMLElement).closest(
    '.apple-style-progress'
  ) as HTMLElement;
  if (progressBar) {
    const rect = progressBar.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, offsetX / rect.width));
    const newTime = percentage * allTime.value;

    nowTime.value = newTime;
    console.log(
      `Mouse pressed, position: ${percentage.toFixed(2)}, time: ${newTime.toFixed(2)}Second`
    );
  }

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
};

const handleMouseMove = (e: MouseEvent) => {
  if (!isMouseDragging.value || !sound.value) return;

  e.preventDefault();

  const progressBar = isLandscape.value
    ? document.querySelector('.landscape-left-section .apple-style-progress')
    : document.querySelector('.unified-controls .apple-style-progress');

  if (!progressBar) return;

  const rect = (progressBar as HTMLElement).getBoundingClientRect();
  const offsetX = e.clientX - rect.left;
  const percentage = Math.max(0, Math.min(1, offsetX / rect.width));
  const newTime = percentage * allTime.value;

  nowTime.value = newTime;
  console.log(
    `mouse movement, position: ${percentage.toFixed(2)}, time: ${newTime.toFixed(2)}Second`
  );
};

const handleMouseUp = (e: MouseEvent) => {
  if (!isMouseDragging.value || !sound.value) return;

  e.preventDefault();

  audioService.seek(nowTime.value);
  console.log(`Release the mouse to jump to: ${nowTime.value.toFixed(2)}Second`);

  isMouseDragging.value = false;

  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);
};

const handleThumbTouchStart = (e: TouchEvent) => {
  e.preventDefault();
  e.stopPropagation();
  isThumbDragging.value = true;

  const target = e.currentTarget as HTMLElement;
  const progressBar = target.parentElement?.parentElement as HTMLElement;
  if (progressBar) {
    progressContainerWidth.value = progressBar.getBoundingClientRect().width;
    console.log(`progress bar width: ${progressContainerWidth.value}px`);
  }
};

const handleThumbTouchMove = (e: TouchEvent) => {
  if (!isThumbDragging.value || !sound.value) return;

  e.preventDefault();

  const touch = e.touches[0];
  const target = e.currentTarget as HTMLElement;
  const progressBar = target.parentElement?.parentElement as HTMLElement;
  const rect = progressBar.getBoundingClientRect();
  const offsetX = touch.clientX - rect.left;

  const percentage = Math.max(0, Math.min(1, offsetX / rect.width));
  const newTime = percentage * allTime.value;

  nowTime.value = newTime;

  console.log(`thumbdrag: ${percentage.toFixed(2)}, time: ${newTime.toFixed(2)}`);
};

const handleThumbTouchEnd = (e: TouchEvent) => {
  if (!isThumbDragging.value || !sound.value) return;

  e.preventDefault();
  e.stopPropagation();

  console.log(`Drag ends and jumps to: ${nowTime.value.toFixed(2)}Second`);
  audioService.seek(nowTime.value);
  isThumbDragging.value = false;
};

const { isDark, applyBackground } = useLyricBackground({
  writeBgColor: () => playerStore.playMusic.primaryColor || undefined
});
const config = ref<LyricConfig>({ ...DEFAULT_LYRIC_CONFIG });

const handleLyricConfigChange = () => {
  config.value = readLyricConfig();
};

const visibleLyrics = computed(() => {
  const centerIndex = nowIndex.value;
  const numLines = 3;
  const halfLines = Math.floor(numLines / 2);

  let startIdx = centerIndex - halfLines;
  let endIdx = centerIndex + halfLines;

  if (numLines % 2 === 0) {
    endIdx -= 1;
  }

  if (startIdx < 0) {
    startIdx = 0;
    endIdx = Math.min(numLines - 1, lrcArray.value.length - 1);
  }

  if (endIdx >= lrcArray.value.length) {
    endIdx = lrcArray.value.length - 1;
    startIdx = Math.max(0, endIdx - numLines + 1);
  }

  return lrcArray.value.slice(startIdx, endIdx + 1).map((item, idx) => ({
    ...item,
    originalIndex: startIdx + idx
  }));
});

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  background: {
    type: String,
    default: ''
  }
});

const themeMusic = {
  light: 'linear-gradient(to bottom, #ffffff, #f5f5f5)',
  dark: 'linear-gradient(to bottom, #1a1a1a, #000000)'
};

const emit = defineEmits(['update:modelValue']);

const isVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

const targetBackground = computed(() => {
  if (config.value.theme !== 'default') {
    return themeMusic[config.value.theme] || props.background;
  }
  return props.background;
});

watch(
  targetBackground,
  (newBg) => {
    if (newBg) {
      applyBackground(newBg);
    }
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  window.removeEventListener(LYRIC_CONFIG_CHANGE_EVENT, handleLyricConfigChange);

  if (autoScrollTimer.value) {
    clearTimeout(autoScrollTimer.value);
  }

  if (sleepTimerInterval) {
    clearInterval(sleepTimerInterval);
    sleepTimerInterval = null;
  }

  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);
});

const { navigateToArtist } = useArtist();

const handleArtistClick = (id: string | undefined) => {
  isVisible.value = false;
  navigateToArtist(id);
};

const togglePlay = () => {
  try {
    playerStore.setPlay(playMusic.value);
  } catch (error) {
    console.error('Playback error:', error);
  }
};

const nextSong = () => {
  playerStore.nextPlay();
};

const prevSong = () => {
  playerStore.prevPlay();
};

const togglePlayMode = () => {
  togglePlayModeBase();
  showBottomToast(playModeText.value);
};

const closeMusicFull = () => {
  isVisible.value = false;
  playerStore.setMusicFull(false);
};

watch(
  () => playMusic.value.id,
  (newId, oldId) => {
    if (newId !== oldId && newId) {
      isSongChanging.value = true;

      setTimeout(() => {
        if (showFullLyrics.value && lyricsScrollerRef.value) {
          showSyncButton.value = false;
          isAutoScrollEnabled.value = true;
          isTouchScrolling.value = false;
          lyricsScrollerRef.value.scrollTo({
            top: 0,
            behavior: 'smooth'
          });
        } else if (isLandscape.value && landscapeLyricsRef.value) {
          showSyncButton.value = false;
          isAutoScrollEnabled.value = true;
          isTouchScrolling.value = false;
          landscapeLyricsRef.value.scrollTo({
            top: 0,
            behavior: 'smooth'
          });
        }

        setTimeout(() => {
          isSongChanging.value = false;
        }, 300);
      }, 100);
    }
  }
);

onMounted(() => {
  const savedConfig = localStorage.getItem('music-full-config');
  if (savedConfig) {
    config.value = { ...config.value, ...JSON.parse(savedConfig) };
  }
  window.addEventListener(LYRIC_CONFIG_CHANGE_EVENT, handleLyricConfigChange);

  isAutoScrollEnabled.value = true;
  isTouchScrolling.value = false;

  nextTick(() => {
    if (isVisible.value) {
      if (isLandscape.value) {
        setTimeout(() => {
          scrollToCurrentLyric(true, landscapeLyricsRef.value);
        }, 500);
      } else if (showFullLyrics.value) {
        setTimeout(() => {
          scrollToCurrentLyric(true);
        }, 500);
      }
    }
  });
});

watch(isVisible, (newVal) => {
  if (newVal) {
    if (targetBackground.value) {
      applyBackground(targetBackground.value);
    }
  } else {
    showFullLyrics.value = false;
    if (autoScrollTimer.value) {
      clearTimeout(autoScrollTimer.value);
      autoScrollTimer.value = null;
    }
  }
});

const { getLrcStyle: originalLrcStyle } = useLyricProgress();

const getLrcStyle = (index: number) => {
  const colors = textColors.value || getTextColors();
  const originalStyle = originalLrcStyle(index);

  if (index === nowIndex.value) {
    if (originalStyle.backgroundImage) {
      return {
        ...originalStyle,
        backgroundImage: originalStyle.backgroundImage
          .replace(/#ffffff/g, colors.active)
          .replace(/#ffffff8a/g, `${colors.primary}`),
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        color: 'transparent'
      };
    }

    return {
      color: colors.active
    };
  }

  return {
    color: colors.primary
  };
};

const getWordStyle = (lineIndex: number, _wordIndex: number, word: any) => {
  const colors = textColors.value || getTextColors();

  if (lineIndex !== nowIndex.value) {
    return {
      color: colors.primary,
      transition: 'color 0.3s ease',

      backgroundImage: 'none',
      WebkitTextFillColor: 'initial'
    };
  }

  const currentTime = (nowTime.value + correctionTime.value) * 1000;

  const wordStartTime = word.startTime;
  const wordEndTime = word.startTime + word.duration;

  if (currentTime >= wordStartTime && currentTime < wordEndTime) {
    const progress = Math.min((currentTime - wordStartTime) / word.duration, 1);
    const progressPercent = Math.round(progress * 100);

    return {
      backgroundImage: `linear-gradient(to right, ${colors.active} 0%, ${colors.active} ${progressPercent}%, ${colors.primary} ${progressPercent}%, ${colors.primary} 100%)`,
      backgroundClip: 'text',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      textShadow: `0 0 8px ${colors.active}40`,
      transition: 'all 0.1s ease'
    };
  } else if (currentTime >= wordEndTime) {
    return {
      color: colors.active,
      WebkitTextFillColor: 'initial',
      transition: 'none'
    };
  } else {
    return {
      color: colors.primary,
      WebkitTextFillColor: 'initial',
      transition: 'none'
    };
  }
};
</script>

<style scoped lang="scss">
.cover-image.has-black-bars :deep(img) {
  width: 135% !important;
  height: 135% !important;
  max-width: 135% !important;
  max-height: 135% !important;
  position: absolute;
  top: -17.5%;
  left: -17.5%;
}

#compact-drawer-target {
  @apply top-0 left-0 absolute overflow-hidden flex flex-col w-full h-full;
  animation-duration: 300ms;

  .main-button {
    @apply flex items-center justify-center cursor-pointer transition-all duration-200 rounded-full;

    i {
      @apply text-2xl;
      color: var(--text-color-active);
    }

    &.play-pause {
      i {
        @apply text-4xl;
      }
    }

    &:hover {
      transform: scale(1.05);
    }

    &:active {
      transform: scale(0.95);
    }
  }

  .apple-style-progress {
    @apply relative flex items-center cursor-pointer;
    touch-action: none;

    .progress-track {
      @apply relative w-full h-2 bg-white bg-opacity-20 rounded-full;

      .progress-fill {
        @apply absolute top-0 left-0 h-full bg-white rounded-full;
        box-shadow: 0 0 8px rgba(255, 255, 255, 0.5);
        z-index: 1;
        transition: width 0.1s linear;
      }

      .progress-thumb {
        @apply absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full bg-white;
        box-shadow: 0 0 8px rgba(255, 255, 255, 0.6);
        z-index: 2;
        transition: transform 0.15s ease-out;

        &.active {
          transform: translate(-50%, -50%) scale(1.3);
          box-shadow: 0 0 12px rgba(255, 255, 255, 0.9);
        }

        &:active {
          transform: translate(-50%, -50%) scale(1.3);
        }
      }
    }
  }

  .record-style-common {
    @apply rounded-full overflow-hidden relative;
    aspect-ratio: 1/1;

    &::before {
      content: '';
      @apply absolute top-0 left-0 w-full h-full rounded-full z-10;
      background: radial-gradient(
        circle at center,
        transparent 38%,
        rgba(0, 0, 0, 0.15) 38%,
        rgba(0, 0, 0, 0.15) 39%,
        rgba(255, 255, 255, 0.1) 39%,
        rgba(255, 255, 255, 0.1) 39.5%,
        rgba(0, 0, 0, 0.08) 39.5%,
        rgba(0, 0, 0, 0.08) 40.5%,
        rgba(0, 0, 0, 0.2) 40.5%,
        rgba(0, 0, 0, 0.2) 41.5%,
        rgba(0, 0, 0, 0.6) 41.5%,
        rgba(0, 0, 0, 0.6) 100%
      );
      pointer-events: none;
      animation: spin 20s linear infinite;
      animation-play-state: running;
    }

    &::after {
      content: '';
      @apply absolute w-6 h-6 rounded-full bg-gray-900 z-20;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.4);
    }

    &.paused {
      &::before,
      &::after {
        animation-play-state: paused;
      }
    }

    .img-wrapper {
      @apply rounded-full overflow-hidden border-solid border-black z-0;
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);

      &::after {
        content: '';
        @apply absolute top-0 left-0 w-full h-full rounded-full z-[2];
        background: linear-gradient(
          135deg,
          rgba(255, 255, 255, 0.05) 0%,
          rgba(255, 255, 255, 0) 50%,
          rgba(0, 0, 0, 0.05) 100%
        );
        pointer-events: none;
      }
    }

    .cover-image {
      @apply w-full h-full rounded-full border-[2px] border-gray-900;
      animation: spin 20s linear infinite;
      animation-play-state: running;
    }

    &.paused .cover-image {
      animation-play-state: paused;
    }
  }

  .time-info {
    @apply flex justify-between items-center mb-2;

    .current-time,
    .total-time {
      @apply text-sm;
      color: var(--text-color-primary);
      opacity: 0.8;
    }
  }

  .favorite-icon {
    @apply cursor-pointer transition-all duration-200;

    i {
      @apply text-xl;
      color: var(--text-color-primary);

      &.favorite {
        @apply text-red-500 !important;
      }
    }

    &:hover {
      transform: scale(1.1);
    }

    &:active {
      transform: scale(0.9);
    }

    &.landscape {
      i {
        @apply text-3xl;
      }
    }
  }

  .song-info-common {
    @apply z-[9995];

    .song-title {
      @apply font-bold line-clamp-1;
      color: var(--text-color-active);
    }

    .song-artist {
      @apply font-medium line-clamp-1;
      color: var(--text-color-primary);
      opacity: 0.9;

      .artist-name {
        @apply cursor-pointer;

        &:hover {
          @apply underline;
        }
      }
    }
  }

  &.is-landscape {
    .landscape-layout {
      @apply flex flex-row w-full h-full overflow-hidden px-8 gap-4;

      .landscape-left-section {
        @apply h-full flex flex-col items-center justify-center pt-6 pb-6 px-3 relative;
        width: 35%;
        min-width: 320px;
        max-width: 480px;

        .landscape-cover-container {
          @apply flex-shrink-0 mx-auto mb-4 z-[9995];
          width: 85%;
          max-width: 260px;
          min-width: 180px;

          &.record-style {
            @extend .record-style-common;

            .img-wrapper {
              @apply border-[20px];
              width: 90%;
              height: 90%;
            }
          }
        }

        .landscape-progress-container {
          @apply mt-0 mb-2 px-2 w-full max-w-md;

          .apple-style-progress {
            height: 48px;

            .progress-thumb {
              @apply w-5 h-5;
            }
          }
        }
      }

      .landscape-lyrics-section {
        @apply h-full flex-1 flex flex-col relative;

        .landscape-song-info {
          @apply flex justify-between items-center pt-5 z-[9995] px-4;
          @extend .song-info-common;

          .song-title {
            @apply text-2xl mb-1;
          }

          .song-artist {
            @apply text-base;
          }
        }

        .landscape-lyrics-scroller {
          @apply h-full w-full overflow-y-auto pt-24 pb-24;
          scroll-behavior: smooth;
          -webkit-overflow-scrolling: touch;
          mask-image: linear-gradient(
            to bottom,
            transparent 5%,
            black 15%,
            black 85%,
            transparent 95%
          );
          -webkit-mask-image: linear-gradient(
            to bottom,
            transparent 5%,
            black 15%,
            black 85%,
            transparent 95%
          );
        }

        .landscape-main-controls {
          @apply fixed bottom-6 right-6 flex items-center z-[10000];

          .main-button {
            @apply mx-2;
            width: 54px;
            height: 54px;
            background-color: rgba(255, 255, 255, 0.15);
            backdrop-filter: blur(8px);
            border-radius: 50%;

            &.play-pause {
              width: 70px;
              height: 70px;
              background-color: rgba(255, 255, 255, 0.25);
            }
          }
        }
      }
    }
  }

  &:not(.is-landscape) {
    .ios-layout-container {
      @apply flex flex-col items-center justify-between w-full h-full pt-10;
      padding-bottom: 180px;

      .cover-container {
        @apply relative mb-6 transition-all duration-500 border-gray-900 z-[9995];

        &.style-changing {
          animation: styleChange 0.5s ease;
        }

        &.record-style {
          @extend .record-style-common;
          @apply w-72 h-72;

          .img-wrapper {
            @apply border-[40px];
            width: 90%;
            height: 90%;
          }
        }
      }

      .song-info {
        @apply flex flex-col items-center mb-5 w-full z-[9995];
        @extend .song-info-common;

        .song-title-container {
          @apply w-full text-center;

          .song-title {
            @apply text-2xl inline-block;
          }
        }

        .song-artist {
          @apply text-base mb-2;
        }

        .ri-heart-3-fill {
          @apply text-2xl;
        }
      }
    }

    .unified-controls {
      @apply fixed bottom-0 left-0 right-0 px-6 pt-6 pb-6;
      background: linear-gradient(to top, rgba(0, 0, 0, 0.5) 0%, rgba(0, 0, 0, 0) 100%);
      height: 230px;
      pointer-events: auto;
      z-index: 10000 !important;

      .progress-container {
        @apply w-full mb-6;

        .apple-style-progress {
          height: 40px;

          .progress-thumb {
            @apply w-4 h-4;
          }
        }
      }

      .control-buttons {
        @apply flex items-center justify-between w-full px-4;

        .side-button {
          @apply w-10 h-10 flex items-center justify-center cursor-pointer transition-all duration-200;

          i {
            @apply text-2xl;
            color: var(--text-color-primary);

            &.intelligence-active {
              @apply text-primary;
            }
          }

          &:hover {
            i {
              color: var(--text-color-active);
            }
          }
        }

        .main-button {
          @apply w-14 h-14;

          i {
            @apply text-3xl;
          }

          &.play-pause {
            @apply w-16 h-16 bg-white/15 rounded-full backdrop-blur-sm;

            i {
              @apply text-4xl;
            }
          }

          &:hover:not(.play-pause) {
            i {
              color: var(--text-color-active);
            }
          }

          &.play-pause:hover {
            @apply bg-white/30;
          }
        }
      }
    }
  }
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.loading-overlay {
  @apply absolute top-0 left-0 w-full h-full flex items-center justify-center;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 9999999999;

  .loading-icon {
    font-size: 36px;
    color: white;
    animation: spin 1s linear infinite;
  }
}

#compact-drawer-target.cover-style-record {
  .ios-layout-container .cover-container {
    @apply mt-4;
  }
}

#compact-drawer-target.cover-style-full {
  .ios-layout-container {
    @apply pt-0;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@keyframes styleChange {
  0% {
    opacity: 0.7;
    transform: scale(0.95);
  }
  50% {
    opacity: 0.9;
    transform: scale(1.03);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes clickPulse {
  0% {
    opacity: 0.5;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes pulse {
  0% {
    opacity: 0.9;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.9;
  }
}

.favorite-icon {
  @apply cursor-pointer transition-all duration-200;

  i {
    @apply text-xl;
    color: var(--text-color-primary);

    &.favorite {
      @apply text-red-500 !important;
    }
  }

  &:hover {
    transform: scale(1.1);
  }

  &:active {
    transform: scale(0.9);
  }

  &.landscape {
    @apply mt-2;
    i {
      @apply text-2xl;
    }
  }
}

.song-title-container {
  @apply w-full flex items-center justify-center relative;

  .song-title {
    @apply text-center text-2xl font-bold max-w-[80%] truncate;
    color: var(--text-color-active);
  }
}

.lyric-line {
  @apply cursor-pointer transition-all duration-300 font-medium;
  font-weight: 500;
  letter-spacing: var(--lyric-letter-spacing, 0);
  line-height: var(--lyric-line-height, 1.6);
  color: var(--text-color-primary);
  opacity: 0.8;

  &.no-scroll-tip {
    @apply text-base opacity-60 cursor-default py-2;
    color: var(--text-color-primary);
    font-weight: normal;

    span {
      padding-right: 0;
    }
  }

  span {
    background-clip: text !important;
    -webkit-background-clip: text !important;
  }

  &.now-text {
    @apply font-medium py-4;
    color: var(--text-color-active);
    opacity: 1;
  }

  &.clicked {
    animation: clickPulse 0.3s ease-in-out;
  }

  .translation {
    @apply font-normal opacity-70 mt-1 text-base;
  }

  .word-by-word-lyric {
    @apply flex flex-wrap justify-center;

    .lyric-word {
      @apply inline-block;
      font-weight: inherit;
      font-size: inherit;
      letter-spacing: inherit;
      line-height: inherit;
      cursor: inherit;
      position: relative;
      padding-right: 0 !important;

      &:hover {
        background-color: rgba(255, 255, 255, 0.1);
      }
    }
  }
}

.fullscreen-lyrics {
  @apply flex flex-col w-full h-full relative;

  &.light {
    background: linear-gradient(to bottom, #ffffff, #f5f5f5);
  }

  &.dark {
    background: linear-gradient(to bottom, #1a1a1a, #000000);
  }

  .fullscreen-header {
    @apply pt-16 pb-4 px-6 flex flex-col items-center fixed top-0 left-0 w-full z-10;
    background: linear-gradient(to bottom, rgba(0, 0, 0, 0.2) 0%, rgba(0, 0, 0, 0) 100%);
    pointer-events: auto;

    .song-title {
      @apply text-xl font-semibold text-center mb-1 max-w-full line-clamp-1;
      color: var(--text-color-active);
    }

    .artist-name {
      @apply text-sm text-opacity-80 text-center;
      color: var(--text-color-primary);
    }
  }

  .lyrics-scroller {
    @apply flex-1 overflow-y-auto px-4;
    scroll-behavior: smooth;
    -webkit-overflow-scrolling: touch;
    mask-image: linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%);
    -webkit-mask-image: linear-gradient(
      to bottom,
      transparent 0%,
      black 10%,
      black 90%,
      transparent 100%
    );
    padding-top: 100px;
    padding-bottom: 200px;
    margin-bottom: 180px;
    margin-top: 90px;

    .lyrics-padding-top {
      height: 70px;
      min-height: 70px;
    }

    .lyrics-padding-bottom {
      height: 150px;
      min-height: 150px;
    }

    .lyric-line {
      @apply px-6 py-4 text-center;
      font-size: var(--lyric-font-size, 22px);

      span {
        padding-right: 10px;
      }
    }

    .now-text {
      @apply text-2xl;
    }
  }

  .lyrics-sync-button {
    @apply absolute right-5 bottom-24 z-20 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold;
    color: var(--text-color-active);
    background: color-mix(in srgb, var(--background-color, #222) 82%, transparent);
    border: 1px solid color-mix(in srgb, var(--text-color-active) 35%, transparent);
    box-shadow: 0 4px 16px rgb(0 0 0 / 25%);
    backdrop-filter: blur(10px);

    i {
      font-size: 15px;
    }
  }
}

.control-btn {
  @apply w-9 h-9 flex items-center justify-center rounded cursor-pointer transition-all duration-300 z-[9999];
  background: rgba(142, 142, 142, 0.192);
  backdrop-filter: blur(12px);
  top: calc(var(--safe-area-inset-top, 0) + 20px);

  i {
    @apply text-xl;
    color: var(--text-color-active);
  }

  &.pure-mode {
    background: transparent;
    backdrop-filter: none;

    &:not(:hover) {
      i {
        opacity: 0;
      }
    }
  }

  &:hover {
    background: rgba(126, 121, 121, 0.2);
    i {
      opacity: 1;
    }
  }
}

#compact-drawer-target {
  &.is-landscape {
    .landscape-lyrics-section {
      .landscape-lyrics-scroller {
        .lyrics-padding-top {
          height: 30px;
          min-height: 30px;
        }

        .lyrics-sync-button {
          @apply absolute right-5 bottom-20 z-20 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold;
          color: var(--text-color-active);
          background: color-mix(in srgb, var(--background-color, #222) 82%, transparent);
          border: 1px solid color-mix(in srgb, var(--text-color-active) 35%, transparent);
          box-shadow: 0 4px 16px rgb(0 0 0 / 25%);
          backdrop-filter: blur(10px);

          i {
            font-size: 15px;
          }
        }

        .lyrics-padding-bottom {
          height: 100px;
          min-height: 100px;
        }

        .lyric-line {
          @apply px-4 py-3 text-left;
          font-size: 26px;
        }

        .now-text {
          @apply text-3xl;
        }
      }
    }

    .word-by-word-lyric {
      @apply justify-start;
    }
  }

  .unified-controls {
    &.fullscreen-mode {
      background: linear-gradient(to top, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0) 100%);
    }

    .back-button {
      @apply absolute top-4 left-1/2 -translate-x-1/2 w-10 h-10 flex items-center justify-center bg-black bg-opacity-30 rounded-2xl;

      i {
        @apply text-4xl;
        color: var(--text-color-primary);
      }
    }
  }

  .ios-layout-container {
    .lyrics-container {
      @apply w-full flex-grow flex flex-col items-center justify-center mb-6 overflow-hidden cursor-pointer;

      .lyrics-wrapper {
        @apply w-full flex flex-col items-center justify-center;

        .lyric-line {
          @apply text-center py-1 transition-all duration-300 opacity-70;

          &:nth-child(2) {
            @apply text-lg font-medium opacity-100;
            color: var(--text-color-active);
          }

          .translation {
            @apply text-sm opacity-60 mt-1;
          }
        }
      }

      .lyric-word {
        @apply px-[2px];
      }

      .no-lyrics {
        @apply text-center text-base opacity-60;
        color: var(--text-color-primary);
      }
    }
  }
}

.cover-container {
  &.square-style {
    @apply w-[85%] shadow-2xl shadow-black/50 rounded-xl overflow-hidden mt-8 aspect-square;

    .cover-image {
      @apply w-full h-full;
      transition: transform 0.3s ease-out;

      &:active {
        transform: scale(0.95);
      }
    }

    :deep(.n-image) {
      display: block;
      width: 100%;
      height: 100%;
    }

    :deep(.n-image img) {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
      image-rendering: -webkit-optimize-contrast;
      filter: none !important;
      backdrop-filter: none !important;
    }
  }

  &.full-style {
    @apply w-full max-h-[50vh] relative overflow-hidden;

    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 40%;
      background: linear-gradient(
        transparent,
        var(--bg-color, rgba(25, 25, 25, 1)) 70%,
        var(--bg-color, rgba(25, 25, 25, 1))
      );
      z-index: 1;
      pointer-events: none;
    }

    .cover-image {
      @apply w-full h-auto shadow-lg;

      &.full-blend {
        mix-blend-mode: luminosity;
      }
    }
  }
}

.is-dark {
  .square-style {
    @apply shadow-2xl shadow-black/50;
  }
}
.bg-vocal {
  font-size: 0.85em !important;
  font-style: italic !important;
  opacity: 0.85 !important;
}
</style>
