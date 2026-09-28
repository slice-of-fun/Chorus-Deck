<template>
  <div
    class="lyric-window"
    :class="[
      lyricSetting.theme,
      { lyric_lock: lyricSetting.isLock, 'bar-bottom': controlBarAtBottom }
    ]"
    @mousedown="handleMouseDown"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <div class="drag-overlay"></div>

    <div class="control-bar" :class="{ 'control-bar-show': showControls }">
      <div class="font-size-controls">
        <n-button-group>
          <div class="control-button" @click="decreaseFontSize">
            <i class="ri-subtract-line"></i>
          </div>
          <div class="control-button" @click="increaseFontSize">
            <i class="ri-add-line"></i>
          </div>
        </n-button-group>
        <div v-html="staticData.playMusic.name"></div>
      </div>

      <div class="play-controls">
        <div class="control-button" @click="handlePrev">
          <i class="ri-skip-back-fill"></i>
        </div>
        <div class="control-button play-button" @click="handlePlayPause">
          <i :class="dynamicData.isPlay ? 'ri-pause-fill' : 'ri-play-fill'"></i>
        </div>
        <div class="control-button" @click="handleNext">
          <i class="ri-skip-forward-fill"></i>
        </div>
      </div>
      <div class="control-buttons">
        <div class="control-button" @click="checkTheme">
          <i v-if="lyricSetting.theme === 'light'" class="ri-sun-line"></i>
          <i v-else class="ri-moon-line"></i>
        </div>
        <div
          class="control-button theme-color-button"
          :class="{ active: showThemeColorPanel }"
          @click="toggleThemeColorPanel"
        >
          <i class="ri-palette-line"></i>
        </div>

        <div
          v-if="hasTranslation"
          class="control-button"
          :title="showTranslation ? 'Hide translation' : 'Show translation'"
          @click="lyricSetting.showTranslation = !lyricSetting.showTranslation"
        >
          <i class="ri-translate-2" :class="{ active: showTranslation }"></i>
        </div>

        <div
          class="control-button"
          :title="
            displayMode === 'scroll'
              ? 'scroll mode'
              : displayMode === 'single'
                ? 'single line mode'
                : 'Dual line mode'
          "
          @click="cycleDisplayMode"
        >
          <i
            :class="{
              'ri-align-justify': displayMode === 'scroll',
              'ri-subtract-line': displayMode === 'single',
              'ri-layout-row-line': displayMode === 'double'
            }"
          ></i>
        </div>

        <div id="lyric-lock" class="control-button" @click="handleLock">
          <i v-if="lyricSetting.isLock" class="ri-lock-line"></i>
          <i v-else class="ri-lock-unlock-line"></i>
        </div>
        <div class="control-button" @click="handleClose">
          <i class="ri-close-line"></i>
        </div>
      </div>
    </div>

    <theme-color-panel
      :visible="showThemeColorPanel"
      :current-color="currentHighlightColor"
      :theme="lyricSetting.theme"
      @color-change="handleColorChange"
      @close="handleThemeColorPanelClose"
      @reset="handleThemeColorReset"
    />

    <div ref="containerRef" class="lyric-container">
      <div v-if="displayMode === 'scroll'" class="lyric-scroll">
        <div class="lyric-wrapper" :style="wrapperStyle">
          <template v-if="staticData.lrcArray?.length > 0">
            <div
              v-for="(line, index) in staticData.lrcArray"
              :key="index"
              class="lyric-line"
              :style="getDynamicLineStyle(line, showTranslation)"
              :class="{
                'lyric-line-current': index === currentIndex,
                'lyric-line-passed': index < currentIndex,
                'lyric-line-next': index === currentIndex + 1
              }"
            >
              <div class="lyric-text" :style="{ fontSize: `${fontSize}px` }">
                <div
                  v-if="line.hasWordByWord && line.words && line.words.length > 0"
                  class="word-by-word-lyric"
                >
                  <template v-for="(word, wordIndex) in line.words" :key="wordIndex">
                    <span class="lyric-word" :style="getWordStyle(index, wordIndex, word)">
                      {{ word.text }} </span
                    ><span v-if="word.space" class="lyric-word">&nbsp;</span>
                  </template>
                </div>
                <span v-else class="lyric-text-inner" :style="getLyricStyle(index)">
                  {{ line.text || '' }}
                </span>
              </div>

              <div
                v-if="showTranslation && line.trText"
                class="lyric-translation"
                :style="{ fontSize: `${fontSize * 0.6}px` }"
              >
                {{ line.trText }}
              </div>
            </div>
          </template>
          <div v-else class="lyric-empty">no lyrics</div>
        </div>
      </div>

      <div v-else-if="displayMode === 'single'" class="lyric-single-mode">
        <template v-if="staticData.lrcArray?.length > 0">
          <div class="lyric-line lyric-line-current">
            <div class="lyric-text" :style="{ fontSize: `${fontSize}px` }">
              <div
                v-if="
                  staticData.lrcArray[currentIndex] != null &&
                  staticData.lrcArray[currentIndex].hasWordByWord &&
                  (staticData.lrcArray[currentIndex].words?.length ?? 0) > 0
                "
                class="word-by-word-lyric"
              >
                <template
                  v-for="(word, wordIndex) in staticData.lrcArray[currentIndex]!.words"
                  :key="wordIndex"
                >
                  <span class="lyric-word" :style="getWordStyle(currentIndex, wordIndex, word)">
                    {{ word.text }} </span
                  ><span v-if="word.space" class="lyric-word">&nbsp;</span>
                </template>
              </div>
              <span v-else class="lyric-text-inner" :style="getLyricStyle(currentIndex)">
                {{ staticData.lrcArray[currentIndex]?.text || '' }}
              </span>
            </div>
            <div
              v-if="showTranslation && staticData.lrcArray[currentIndex]?.trText"
              class="lyric-translation"
              :style="{ fontSize: `${fontSize * 0.6}px` }"
            >
              {{ staticData.lrcArray[currentIndex]?.trText }}
            </div>
          </div>
        </template>
        <div v-else class="lyric-empty">no lyrics</div>
      </div>

      <div v-else class="lyric-double-mode" :class="{ 'group-fade': isGroupTransitioning }">
        <template v-if="staticData.lrcArray?.length > 0">
          <div
            v-for="line in currentGroupLines"
            :key="line.index"
            class="lyric-line"
            :class="{ 'lyric-line-current': line.index === currentIndex }"
          >
            <div class="lyric-text" :style="{ fontSize: `${fontSize}px` }">
              <div
                v-if="line.hasWordByWord && line.words && line.words.length > 0"
                class="word-by-word-lyric"
              >
                <template v-for="(word, wordIndex) in line.words" :key="wordIndex">
                  <span class="lyric-word" :style="getWordStyle(line.index, wordIndex, word)">
                    {{ word.text }} </span
                  ><span v-if="word.space" class="lyric-word">&nbsp;</span>
                </template>
              </div>
              <span v-else class="lyric-text-inner" :style="getLyricStyle(line.index)">
                {{ line.text || '' }}
              </span>
            </div>
            <div
              v-if="showTranslation && line.trText"
              class="lyric-translation"
              :style="{ fontSize: `${fontSize * 0.6}px` }"
            >
              {{ line.trText }}
            </div>
          </div>
        </template>
        <div v-else class="lyric-empty">no lyrics</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

import ThemeColorPanel from '@/components/lyric/ThemeColorPanel.vue';
import { SongResult } from '@/types/music';
import {
  getCurrentLyricThemeColor,
  loadLyricThemeColor,
  saveLyricThemeColor,
  validateColor
} from '@/utils/linearColor';

defineOptions({
  name: 'Lyric'
});
const windowData = window as any;
const containerRef = ref<HTMLElement | null>(null);
const containerHeight = ref(0);
const lineHeight = ref(60);
const currentIndex = ref(0);

const fontSize = ref(24);
const fontSizeStep = 2;
const animationFrameId = ref<number | null>(null);
const lastUpdateTime = ref(performance.now());

const staticData = ref<{
  lrcArray: Array<{
    text: string;
    trText: string;
    words?: Array<{ text: string; startTime: number; duration: number; space?: boolean }>;
    hasWordByWord?: boolean;
    startTime?: number;
    duration?: number;
  }>;
  lrcTimeArray: number[];
  allTime: number;
  playMusic: SongResult;
}>({
  lrcArray: [],
  lrcTimeArray: [],
  allTime: 0,
  playMusic: {} as SongResult
});

const dynamicData = ref({
  nowTime: 0,
  startCurrentTime: 0,
  nextTime: 0,
  isPlay: true
});

const loadLyricSettings = () => {
  try {
    const stored = localStorage.getItem('lyricData');
    if (stored) {
      const parsed = JSON.parse(stored);

      let validatedHighlightColor = parsed.highlightColor;
      if (validatedHighlightColor && !validateColor(validatedHighlightColor)) {
        console.warn('Invalid stored highlight color, removing it');
        validatedHighlightColor = undefined;
      }

      return {
        isTop: parsed.isTop ?? false,
        theme: parsed.theme === 'light' || parsed.theme === 'dark' ? parsed.theme : 'dark',
        isLock: parsed.isLock ?? false,
        highlightColor: validatedHighlightColor,
        showTranslation: parsed.showTranslation ?? true,
        displayMode: (['scroll', 'single', 'double'].includes(parsed.displayMode)
          ? parsed.displayMode
          : 'scroll') as 'scroll' | 'single' | 'double'
      };
    }
  } catch (error) {
    console.error('Failed to load lyric settings:', error);
  }

  return {
    isTop: false,
    theme: 'dark' as 'light' | 'dark',
    isLock: false,
    highlightColor: undefined as string | undefined,
    showTranslation: true,
    displayMode: 'scroll' as 'scroll' | 'single' | 'double'
  };
};

const lyricSetting = ref(loadLyricSettings());

const hasTranslation = computed(() => staticData.value.lrcArray.some((line) => line.trText));

const currentGroupIndex = computed(() => Math.floor(currentIndex.value / 2));

const currentGroupLines = computed(() => {
  const start = currentGroupIndex.value * 2;
  return staticData.value.lrcArray
    .slice(start, start + 2)
    .map((line, i) => ({ ...line, index: start + i }));
});

const isGroupTransitioning = ref(false);

const displayMode = computed(() => lyricSetting.value.displayMode);
const showTranslation = computed(() => lyricSetting.value.showTranslation);

let hideControlsTimer: number | null = null;
let removeMousePresenceListener: (() => void) | null = null;
let removeReceiveLyricListener: (() => void) | null = null;

const isHovering = ref(false);

const showThemeColorPanel = ref(false);
const currentHighlightColor = ref('#1db954');

const showControls = computed(() => {
  if (lyricSetting.value.isLock) {
    return isHovering.value;
  }
  return true;
});

const clearHideTimer = () => {
  if (hideControlsTimer) {
    clearTimeout(hideControlsTimer);
    hideControlsTimer = null;
  }
};

const LOCKED_CONTROLS_HIDE_DELAY = 2500;

const scheduleLockedControlsHide = () => {
  clearHideTimer();
  hideControlsTimer = window.setTimeout(() => {
    hideControlsTimer = null;
    if (lyricSetting.value.isLock) {
      isHovering.value = false;
      windowData.electron.ipcRenderer.send('set-ignore-mouse', true);
    }
  }, LOCKED_CONTROLS_HIDE_DELAY);
};

const showLockedControls = () => {
  if (!lyricSetting.value.isLock) return;
  if (!isHovering.value) {
    isHovering.value = true;
    windowData.electron.ipcRenderer.send('set-ignore-mouse', false);
  }
  scheduleLockedControlsHide();
};

const handleLockedMouseMove = () => {
  if (!lyricSetting.value.isLock) return;
  showLockedControls();
};

const controlBarAtBottom = ref(false);

const CONTROL_BAR_FLIP_THRESHOLD = 90;

const updateControlBarPosition = () => {
  try {
    const availTop = (window.screen as any).availTop ?? 0;
    controlBarAtBottom.value = window.screenY - availTop < CONTROL_BAR_FLIP_THRESHOLD;
  } catch (error) {
    console.error('Failed to calculate control bar position:', error);
  }
};

const handleMouseEnter = () => {
  updateControlBarPosition();
  if (lyricSetting.value.isLock) {
    isHovering.value = true;
    windowData.electron.ipcRenderer.send('set-ignore-mouse', true);
  } else {
    windowData.electron.ipcRenderer.send('set-ignore-mouse', false);
  }
};

const handleMouseLeave = () => {
  if (!lyricSetting.value.isLock) return;
  isHovering.value = false;
  windowData.electron.ipcRenderer.send('set-ignore-mouse', false);

  const lyricWindow = document.querySelector('.lyric-window') as HTMLElement;
  if (lyricWindow) {
    lyricWindow.style.background = 'transparent';

    requestAnimationFrame(() => {
      lyricWindow.style.background = 'transparent';
    });
  }
};

watch(
  () => lyricSetting.value.isLock,
  (newLock: boolean) => {
    clearHideTimer();
    if (newLock) {
      isHovering.value = false;

      showThemeColorPanel.value = false;
    }
    windowData.electron.ipcRenderer.send('set-lyric-lock-state', newLock);
  }
);

onMounted(() => {
  if (lyricSetting.value.isLock) {
    isHovering.value = false;
  }
  updateControlBarPosition();
  document.addEventListener('mousemove', handleLockedMouseMove);
  window.addEventListener('resize', updateControlBarPosition);
});

onUnmounted(() => {
  clearHideTimer();
  document.removeEventListener('mousemove', handleLockedMouseMove);
  window.removeEventListener('resize', updateControlBarPosition);
});

const wrapperStyle = computed(() => {
  if (displayMode.value !== 'scroll') {
    return {};
  }

  if (!containerHeight.value) {
    return {
      transform: 'translateY(0)',
      transition: 'none'
    };
  }

  const containerCenter = containerHeight.value / 2;

  const getLineHeight = (line: { text: string; trText: string }) => {
    const baseHeight = lineHeight.value;
    if (showTranslation.value && line.trText) {
      const extraHeight = Math.round(fontSize.value * 0.6 * 1.4);
      return baseHeight + extraHeight;
    }
    return baseHeight;
  };

  let accumulatedHeight = containerHeight.value * 0.2;
  for (let i = 0; i < currentIndex.value; i++) {
    if (i < staticData.value.lrcArray.length) {
      accumulatedHeight += getLineHeight(staticData.value.lrcArray[i]);
    } else {
      accumulatedHeight += lineHeight.value;
    }
  }

  const currentLineHeight =
    currentIndex.value < staticData.value.lrcArray.length
      ? getLineHeight(staticData.value.lrcArray[currentIndex.value])
      : lineHeight.value;
  accumulatedHeight += currentLineHeight;

  const targetOffset = containerCenter - accumulatedHeight;

  let contentHeight = containerHeight.value * 0.4;
  for (const line of staticData.value.lrcArray) {
    contentHeight += getLineHeight(line);
  }

  const minOffset = -(contentHeight - containerHeight.value);
  const maxOffset = 0;

  const finalOffset = Math.min(maxOffset, Math.max(minOffset, targetOffset));

  return {
    transform: `translateY(${finalOffset}px)`,
    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
  };
});

const getDynamicLineStyle = (line: { text: string; trText: string }, withTranslation = true) => {
  const defaultHeight = lineHeight.value;
  if (withTranslation && line.trText) {
    const extraHeight = Math.round(fontSize.value * 0.6 * 1.4);
    return { height: `${defaultHeight + extraHeight}px` };
  }
  return { height: `${defaultHeight}px` };
};

const updateContainerHeight = () => {
  if (!containerRef.value) return;

  containerHeight.value = containerRef.value.clientHeight;

  const baseLineHeight = fontSize.value * 2.5;

  const maxAllowedHeight = containerHeight.value / 3;

  lineHeight.value = Math.min(maxAllowedHeight, Math.max(40, baseLineHeight));
};

const handleFontSizeChange = async () => {
  saveFontSize();

  updateContainerHeight();
};

const increaseFontSize = async () => {
  if (fontSize.value < 48) {
    fontSize.value += fontSizeStep;
    await handleFontSizeChange();
  }
};

const decreaseFontSize = async () => {
  if (fontSize.value > 12) {
    fontSize.value -= fontSizeStep;
    await handleFontSizeChange();
  }
};

const saveFontSize = () => {
  localStorage.setItem('lyricFontSize', fontSize.value.toString());
};

onMounted(() => {
  const resizeObserver = new ResizeObserver(() => {
    updateContainerHeight();
  });

  if (containerRef.value) {
    resizeObserver.observe(containerRef.value);
  }

  onUnmounted(() => {
    resizeObserver.disconnect();
  });
});

const actualTime = ref(0);

const currentProgress = computed(() => {
  const times = staticData.value.lrcTimeArray;
  const idx = currentIndex.value;
  const startTimeMs = times[idx];
  const endTimeMs = times[idx + 1];

  if (startTimeMs === undefined || endTimeMs === undefined || endTimeMs <= startTimeMs) return 0;

  const currentTimeMs = actualTime.value * 1000;
  const elapsed = currentTimeMs - startTimeMs;
  const duration = endTimeMs - startTimeMs;
  return Math.min(Math.max(elapsed / duration, 0), 1);
});

const getLyricStyle = (index: number) => {
  if (index !== currentIndex.value) return {};

  const progress = currentProgress.value * 100;

  return {
    background: `linear-gradient(to right, var(--highlight-color) ${progress}%, var(--text-color) ${progress}%)`,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',

    textRendering: 'optimizeLegibility' as const,
    WebkitFontSmoothing: 'antialiased' as const,
    MozOsxFontSmoothing: 'grayscale' as const,

    transform: 'translateZ(0)',
    backfaceVisibility: 'hidden' as const,
    transition: 'background 0.1s linear'
  };
};

const getWordStyle = (
  lineIndex: number,
  _wordIndex: number,
  word: { text: string; startTime: number; duration: number }
) => {
  if (lineIndex !== currentIndex.value) {
    return {
      color: 'var(--text-color)',
      transition: 'color 0.3s ease',
      backgroundImage: 'none',
      WebkitTextFillColor: 'initial'
    };
  }

  const currentTime = actualTime.value * 1000;

  const wordStartTime = word.startTime;
  const wordEndTime = word.startTime + word.duration;

  if (currentTime >= wordStartTime && currentTime < wordEndTime) {
    const progress = Math.min((currentTime - wordStartTime) / word.duration, 1);
    const progressPercent = Math.round(progress * 100);

    return {
      backgroundImage: `linear-gradient(to right, var(--highlight-color) 0%, var(--highlight-color) ${progressPercent}%, var(--text-color) ${progressPercent}%, var(--text-color) 100%)`,
      backgroundClip: 'text',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      transition: 'all 0.1s ease'
    };
  } else if (currentTime >= wordEndTime) {
    return {
      color: 'var(--highlight-color)',
      WebkitTextFillColor: 'initial',
      transition: 'none'
    };
  } else {
    return {
      color: 'var(--text-color)',
      WebkitTextFillColor: 'initial',
      transition: 'none'
    };
  }
};

const TIME_OFFSET = 400;

const updateProgress = () => {
  if (!dynamicData.value.isPlay) {
    if (animationFrameId.value) {
      cancelAnimationFrame(animationFrameId.value);
      animationFrameId.value = null;
    }
    return;
  }

  const timeDiff = (performance.now() - lastUpdateTime.value) / 1000;
  actualTime.value = dynamicData.value.nowTime + timeDiff + TIME_OFFSET / 1000;

  animationFrameId.value = requestAnimationFrame(updateProgress);
};

watch(
  () => dynamicData.value,
  (newData: any) => {
    lastUpdateTime.value = performance.now();

    actualTime.value = newData.nowTime + TIME_OFFSET / 1000;

    if (newData.isPlay && !animationFrameId.value) {
      updateProgress();
    }
  },
  { deep: true }
);

watch(
  () => dynamicData.value.isPlay,
  (isPlaying: boolean) => {
    if (isPlaying) {
      lastUpdateTime.value = performance.now();
      updateProgress();
    } else if (animationFrameId.value) {
      cancelAnimationFrame(animationFrameId.value);
      animationFrameId.value = null;
    }
  }
);

const handleDataUpdate = (parsedData: {
  type?: string;
  nowTime: number;
  startCurrentTime: number;
  nextTime: number;
  isPlay: boolean;
  nowIndex: number;
  lrcArray?: Array<{ text: string; trText: string }>;
  lrcTimeArray?: number[];
  allTime?: number;
  playMusic?: SongResult;
}) => {
  if (!parsedData) {
    console.error('Invalid update data received:', parsedData);
    return;
  }

  if (parsedData.type === 'update') {
    dynamicData.value = {
      ...dynamicData.value,
      nowTime: parsedData.nowTime || dynamicData.value.nowTime,
      isPlay: typeof parsedData.isPlay === 'boolean' ? parsedData.isPlay : dynamicData.value.isPlay
    };

    if (typeof parsedData.nowIndex === 'number') {
      currentIndex.value = parsedData.nowIndex;
    }
    return;
  }

  staticData.value = {
    lrcArray: parsedData.lrcArray || [],
    lrcTimeArray: parsedData.lrcTimeArray || [],
    allTime: parsedData.allTime || 0,
    playMusic: parsedData.playMusic || ({} as SongResult)
  };

  dynamicData.value = {
    nowTime: parsedData.nowTime || 0,
    startCurrentTime: parsedData.startCurrentTime || 0,
    nextTime: parsedData.nextTime || 0,
    isPlay: parsedData.isPlay
  };

  if (typeof parsedData.nowIndex === 'number') {
    currentIndex.value = parsedData.nowIndex;
  }
};

onMounted(() => {
  const savedFontSize = localStorage.getItem('lyricFontSize');
  if (savedFontSize) {
    fontSize.value = Number(savedFontSize);
    lineHeight.value = fontSize.value * 2.5;
  }

  updateContainerHeight();
  window.addEventListener('resize', updateContainerHeight);

  const disposeReceiveLyric = windowData.electron.ipcRenderer.on('receive-lyric', (_, data) => {
    try {
      const parsedData = JSON.parse(data);
      handleDataUpdate(parsedData);
    } catch (error) {
      console.error('Error parsing lyric data:', error);
    }
  });
  if (typeof disposeReceiveLyric === 'function') {
    removeReceiveLyricListener = disposeReceiveLyric;
  }

  windowData.electron.ipcRenderer.send('lyric-ready');

  removeMousePresenceListener = window.ipcRenderer.on(
    'lyric-mouse-presence',
    (isInside: boolean) => {
      if (lyricSetting.value.isLock) {
        if (isInside) {
          showLockedControls();
        } else {
          clearHideTimer();
          isHovering.value = false;
          windowData.electron.ipcRenderer.send('set-ignore-mouse', true);
        }
      } else {
        isHovering.value = isInside;
      }
    }
  );

  windowData.electron.ipcRenderer.send('set-lyric-lock-state', lyricSetting.value.isLock);
});

onUnmounted(() => {
  window.removeEventListener('resize', updateContainerHeight);
  if (removeMousePresenceListener) {
    removeMousePresenceListener();
    removeMousePresenceListener = null;
  }
  if (removeReceiveLyricListener) {
    removeReceiveLyricListener();
    removeReceiveLyricListener = null;
  }
});

const checkTheme = () => {
  if (lyricSetting.value.theme === 'light') {
    lyricSetting.value.theme = 'dark';
  } else {
    lyricSetting.value.theme = 'light';
  }
};

const toggleThemeColorPanel = () => {
  showThemeColorPanel.value = !showThemeColorPanel.value;
};

const handleColorChange = (color: string) => {
  if (!validateColor(color)) {
    console.error('Invalid color received:', color);
    return;
  }

  try {
    currentHighlightColor.value = color;
    updateThemeColorWithTransition(color);

    lyricSetting.value.highlightColor = color;

    saveLyricThemeColor(color);
  } catch (error) {
    console.error('Failed to handle color change:', error);

    const defaultColor = getCurrentLyricThemeColor(lyricSetting.value.theme);
    currentHighlightColor.value = defaultColor;
    updateThemeColorWithTransition(defaultColor);
  }
};

const handleThemeColorPanelClose = () => {
  showThemeColorPanel.value = false;
};

const handleThemeColorReset = () => {
  resetThemeColor();
  showThemeColorPanel.value = false;
};

const resetThemeColor = () => {
  const defaultColor = getCurrentLyricThemeColor(lyricSetting.value.theme);

  currentHighlightColor.value = defaultColor;
  lyricSetting.value.highlightColor = undefined;
  updateThemeColorWithTransition(defaultColor);

  try {
    const settings = loadLyricSettings();
    delete settings.highlightColor;
    saveLyricSettings(settings);
  } catch (error) {
    console.error('Failed to reset theme color:', error);
  }
};

const validateAndFixColorSettings = () => {
  try {
    if (currentHighlightColor.value && !validateColor(currentHighlightColor.value)) {
      console.warn('Current highlight color is invalid, resetting to default');
      const defaultColor = getCurrentLyricThemeColor(lyricSetting.value.theme);
      currentHighlightColor.value = defaultColor;
      lyricSetting.value.highlightColor = undefined;
      updateCSSVariable('--lyric-highlight-color', defaultColor);
    }

    if (lyricSetting.value.highlightColor && !validateColor(lyricSetting.value.highlightColor)) {
      console.warn('Stored highlight color is invalid, removing it');
      lyricSetting.value.highlightColor = undefined;
    }
  } catch (error) {
    console.error('Failed to validate color settings:', error);

    const defaultColor = getCurrentLyricThemeColor(lyricSetting.value.theme);
    currentHighlightColor.value = defaultColor;
    lyricSetting.value.highlightColor = undefined;
    updateCSSVariable('--lyric-highlight-color', defaultColor);
  }
};

defineExpose({
  resetThemeColor,
  validateAndFixColorSettings
});

const updateCSSVariable = (name: string, value: string) => {
  document.documentElement.style.setProperty(name, value);
};

const updateThemeColorWithTransition = (newColor: string) => {
  const lyricWindow = document.querySelector('.lyric-window');
  if (lyricWindow) {
    lyricWindow.classList.add('color-transitioning');
  }

  updateCSSVariable('--lyric-highlight-color', newColor);

  setTimeout(() => {
    if (lyricWindow) {
      lyricWindow.classList.remove('color-transitioning');
    }
  }, 300);
};

const initializeThemeColor = () => {
  let savedColor = lyricSetting.value.highlightColor;

  if (!savedColor) {
    savedColor = loadLyricThemeColor();

    if (savedColor) {
      lyricSetting.value.highlightColor = savedColor;
    }
  }

  if (savedColor) {
    const optimizedColor = getCurrentLyricThemeColor(lyricSetting.value.theme);
    currentHighlightColor.value = optimizedColor;
    updateCSSVariable('--lyric-highlight-color', optimizedColor);
  } else {
    const defaultColor = getCurrentLyricThemeColor(lyricSetting.value.theme);
    currentHighlightColor.value = defaultColor;
    updateCSSVariable('--lyric-highlight-color', defaultColor);
  }
};

const handleLock = () => {
  lyricSetting.value.isLock = !lyricSetting.value.isLock;
  windowData.electron.ipcRenderer.send('set-ignore-mouse', lyricSetting.value.isLock);
};

const handleClose = () => {
  windowData.electron.ipcRenderer.send('close-lyric');
};

const cycleDisplayMode = () => {
  const modes: Array<'scroll' | 'single' | 'double'> = ['scroll', 'single', 'double'];
  const current = modes.indexOf(lyricSetting.value.displayMode);
  lyricSetting.value.displayMode = modes[(current + 1) % modes.length];
};

const saveLyricSettings = (settings: typeof lyricSetting.value) => {
  try {
    localStorage.setItem('lyricData', JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save lyric settings:', error);
  }
};

watch(
  () => lyricSetting.value,
  (newValue) => {
    saveLyricSettings(newValue);
  },
  { deep: true }
);

watch(
  () => lyricSetting.value.theme,
  (newTheme) => {
    if (currentHighlightColor.value) {
      const optimizedColor = getCurrentLyricThemeColor(newTheme);
      currentHighlightColor.value = optimizedColor;
      updateThemeColorWithTransition(optimizedColor);
    }
  }
);

let groupFadeTimer: ReturnType<typeof setTimeout> | null = null;

watch(currentGroupIndex, () => {
  if (displayMode.value !== 'double') return;
  if (groupFadeTimer !== null) clearTimeout(groupFadeTimer);
  isGroupTransitioning.value = true;
  groupFadeTimer = setTimeout(() => {
    isGroupTransitioning.value = false;
    groupFadeTimer = null;
  }, 300);
});

const isDragging = ref(false);
const startPosition = ref({ x: 0, y: 0 });
const lastMoveTime = ref(0);
const moveThrottleMs = 10;

const handleMouseDown = (e: MouseEvent) => {
  if (
    lyricSetting.value.isLock ||
    (e.target as HTMLElement).closest('.control-buttons') ||
    (e.target as HTMLElement).closest('.font-size-controls') ||
    (e.target as HTMLElement).closest('.play-controls')
  ) {
    return;
  }

  if (e.button !== 0) return;

  isDragging.value = true;
  startPosition.value = { x: e.screenX, y: e.screenY };
  lastMoveTime.value = performance.now();

  windowData.electron.ipcRenderer.send('lyric-drag-start');

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.value) return;

    const now = performance.now();
    if (now - lastMoveTime.value < moveThrottleMs) return;
    lastMoveTime.value = now;

    const deltaX = e.screenX - startPosition.value.x;
    const deltaY = e.screenY - startPosition.value.y;

    if (Math.abs(deltaX) > 0 || Math.abs(deltaY) > 0) {
      windowData.electron.ipcRenderer.send('lyric-drag-move', { deltaX, deltaY });
      startPosition.value = { x: e.screenX, y: e.screenY };

      updateControlBarPosition();
    }
  };

  const handleMouseUp = () => {
    if (!isDragging.value) return;
    isDragging.value = false;

    windowData.electron.ipcRenderer.send('lyric-drag-end');
    updateControlBarPosition();

    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
};

onUnmounted(() => {
  isDragging.value = false;
  if (groupFadeTimer !== null) {
    clearTimeout(groupFadeTimer);
    groupFadeTimer = null;
  }
});

onMounted(() => {
  const lyricLock = document.getElementById('lyric-lock');
  if (lyricLock) {
    lyricLock.onmouseenter = () => {
      if (lyricSetting.value.isLock) {
        windowData.electron.ipcRenderer.send('set-ignore-mouse', false);
      }
    };
    lyricLock.onmouseleave = () => {
      if (lyricSetting.value.isLock) {
        windowData.electron.ipcRenderer.send('set-ignore-mouse', true);
      }
    };
  }

  initializeThemeColor();

  validateAndFixColorSettings();
});

const handlePlayPause = () => {
  windowData.electron.ipcRenderer.send('control-back', 'playpause');
};

const handlePrev = () => {
  windowData.electron.ipcRenderer.send('control-back', 'prev');
};

const handleNext = () => {
  windowData.electron.ipcRenderer.send('control-back', 'next');
};
</script>

<style scoped>
html,
body,
#app {
  background-color: transparent !important;
  box-shadow: none !important;
  border: none !important;
}
</style>

<style lang="scss" scoped>
.lyric-window {
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
  background: transparent !important;
  user-select: none;
  transition: background-color 0.3s ease;
  cursor: default;
  border-radius: 14px;

  &.color-transitioning {
    .lyric-text-inner {
      transition: background 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
    }

    .control-button {
      i {
        transition: color 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
      }
    }
  }

  &:hover {
    .control-bar {
      &-show {
        opacity: 1;
        visibility: visible;
      }
    }
  }

  &:active {
    cursor: grabbing;
  }

  &.dark {
    --text-color: #e6e6e6;
    --text-secondary: #ffffffea;
    --highlight-color: var(--lyric-highlight-color, #1ed760);
    --control-bg: rgba(124, 124, 124, 0.3);
    &:hover:not(.lyric_lock) {
      background: rgba(44, 44, 44, 0.466) !important;
    }
  }

  &.light {
    --text-color: #383838;
    --text-secondary: #282828ae;
    --highlight-color: var(--lyric-highlight-color, #1db954);
    --control-bg: rgba(38, 38, 38, 0.532);
    &:hover:not(.lyric_lock) {
      background: rgba(0, 0, 0, 0.434) !important;
    }
  }
}

.control-bar {
  position: absolute;
  top: 10px;
  left: 0;
  right: 0;
  height: 80px;
  display: flex;
  justify-content: space-between;
  align-items: start;
  padding: 0 20px;
  opacity: 0;
  visibility: hidden;
  transition:
    opacity 0.2s ease,
    visibility 0.2s ease;
  z-index: 100;

  .font-size-controls {
    -webkit-app-region: no-drag;
    color: var(--text-color);
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .play-controls {
    position: absolute;
    top: 0px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 16px;
    -webkit-app-region: no-drag;

    .play-button {
      width: 36px;
      height: 36px;
      i {
        font-size: 24px;
      }
    }
  }

  .control-buttons {
    -webkit-app-region: no-drag;
  }
}

.lyric-window.bar-bottom {
  .control-bar {
    top: auto;
    bottom: 10px;
    align-items: end;

    .play-controls {
      top: auto;
      bottom: 0;
    }
  }

  :deep(.theme-color-panel) {
    top: auto;
    bottom: 50px;
  }
}

.control-buttons {
  display: flex;
  gap: 16px;
  -webkit-app-region: no-drag;
}

.control-button {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 8px;
  color: var(--text-color);
  transition: all 0.2s ease;
  &:hover {
    background: var(--control-bg);
  }

  i {
    font-size: 20px;
    text-shadow: 0 0 10px rgba(0, 0, 0, 0.3);

    &.active {
      color: var(--highlight-color);
    }
  }

  &.theme-color-button {
    &.active {
      background: var(--control-bg);

      i {
        color: var(--highlight-color);
      }
    }
  }
}

.lyric-container {
  position: absolute;
  top: 80px;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  z-index: 100;
}

.lyric-single-mode {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 20px;

  .lyric-line {
    width: 100%;
    text-align: center;
  }
}

.lyric-double-mode {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 20px;

  transition: opacity 0.15s ease;

  &.group-fade {
    opacity: 0;
  }

  .lyric-line {
    width: 100%;
    text-align: center;

    opacity: 0.55;
    transition: opacity 0.25s ease;

    &.lyric-line-current {
      opacity: 1;
      transform: scale(1.03);
    }
  }
}

.lyric-scroll {
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
  mask-image: linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%);
}

.lyric-wrapper {
  will-change: transform;
  padding: 20vh 0;
  transform-origin: center center;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.lyric-line {
  padding: 4px 20px;
  text-align: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;

  &.lyric-line-current {
    transform: scale(1.05);
    opacity: 1;

    .lyric-text {
      text-shadow: none;

      .lyric-text-inner {
        filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.5));

        -webkit-font-smoothing: antialiased;
      }
    }
  }

  &.lyric-line-passed {
    opacity: 0.6;
  }
}

.lyric-text {
  font-weight: 600;
  margin-bottom: 2px;
  color: var(--text-color);
  white-space: pre-wrap;
  word-break: break-all;
  transition: transform 0.2s ease;
  line-height: 1.4;

  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;

  text-shadow:
    0 0 2px rgba(0, 0, 0, 0.8),
    0 1px 1px rgba(0, 0, 0, 0.6),
    0 0 4px rgba(255, 255, 255, 0.2);

  .lyric-text-inner {
    transition: background 0.3s ease;
  }

  .word-by-word-lyric {
    display: inline-block;
    text-align: center;

    .lyric-word {
      display: inline-block;
      font-weight: inherit;
      font-size: inherit;
      letter-spacing: inherit;
      line-height: inherit;
      position: relative;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
  }
}

.lyric-translation {
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-all;
  transition: font-size 0.2s ease;
  line-height: 1.4;

  text-shadow:
    0 0 2px rgba(0, 0, 0, 0.7),
    0 1px 1px rgba(0, 0, 0, 0.5),
    0 0 4px rgba(255, 255, 255, 0.2),
    1px 1px 1px rgba(0, 0, 0, 0.4),
    -1px -1px 1px rgba(0, 0, 0, 0.4);
}

.lyric-empty {
  text-align: center;
  color: var(--text-secondary);
  font-size: 16px;
  padding: 20px;

  text-shadow:
    0 0 2px rgba(0, 0, 0, 0.7),
    0 1px 1px rgba(0, 0, 0, 0.5),
    0 0 4px rgba(255, 255, 255, 0.2);
}

body {
  background-color: transparent !important;
  margin: 0;
}

.lyric-content {
  transition: font-size 0.2s ease;
}

.lyric-line-current {
  opacity: 1;
}

.control-bar {
  .control-buttons {
    .control-button {
      &:not(:has(.ri-lock-line)):not(:has(.ri-lock-unlock-line)) {
        .lyric_lock & {
          display: none;
        }
      }
    }
  }

  .lyric_lock & .font-size-controls {
    display: none;
  }

  .lyric_lock & .play-controls {
    display: none;
  }
}

.lyric_lock {
  background: transparent;
  &:hover {
    background: transparent;
  }

  #lyric-lock {
    position: absolute;
    top: 0;
    right: 72px;
    background: var(--control-bg);
  }

  &.bar-bottom #lyric-lock {
    top: auto;
    bottom: 0;
  }
}
</style>
