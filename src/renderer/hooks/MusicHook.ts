import { cloneDeep } from 'lodash';
import { computed, type ComputedRef, nextTick, ref, watch } from 'vue';

import useIndexedDB from '@/hooks/IndexDBHook';
import { audioService } from '@/services/audioService';
import type { usePlayerStore } from '@/store';
import type { Artist, ILyricText, SongResult } from '@/types/music';
import { isDesktop } from '@/utils';
import { getTextColors } from '@/utils/linearColor';
import { parseLyrics } from '@/utils/yrcParser';

const windowData = window as any;

let playerStore: ReturnType<typeof usePlayerStore> | null = null;

export const initMusicHook = (store: ReturnType<typeof usePlayerStore>) => {
  playerStore = store;

  playMusic = computed(() => getPlayerStore().playMusic as SongResult);
  artistList = computed(
    () => (getPlayerStore().playMusic.ar || getPlayerStore().playMusic?.artists) as Artist[]
  );

  setupKeyboardListeners();
  setupMusicWatchers();
  setupCorrectionTimeWatcher();
  setupPlayStateWatcher();
  void initPlatform();
};

const getPlayerStore = () => {
  if (!playerStore) {
    throw new Error('MusicHook not initialized. Call initMusicHook first.');
  }
  return playerStore;
};
export const lrcArray = ref<ILyricText[]>([]);
export const lrcTimeArray = ref<number[]>([]);
export const nowTime = ref(0);
export const allTime = ref(0);
export const nowIndex = ref(0);
export const currentLrcProgress = ref(0);
export const sound = ref<any>(null);
export const isLyricWindowOpen = ref(false);
export const textColors = ref<any>(getTextColors());

export let playMusic: ComputedRef<SongResult>;
export let artistList: ComputedRef<Artist[]>;

let lastIndex = -1;

// Tauri has no synchronous IPC, so the platform is resolved once at startup.
let cachedPlatform = 'web';

/**
 * Resolve the host platform via the Tauri backend.
 * Linux-only features (tray lyrics) depend on this.
 */
export const initPlatform = async (): Promise<void> => {
  if (!isDesktop()) return;
  try {
    cachedPlatform = await window.api.getPlatform();
  } catch (error) {
    console.error('Failed to resolve host platform:', error);
  }
};

export const musicDB = await useIndexedDB(
  'musicDB',
  [
    { name: 'music', keyPath: 'id' },
    { name: 'music_lyric', keyPath: 'id' },
    { name: 'api_cache', keyPath: 'id' },
    { name: 'music_url_cache', keyPath: 'id' },
    { name: 'music_failed_cache', keyPath: 'id' }
  ],
  3
);

const handleKeyUp = (e: KeyboardEvent) => {
  const target = e.target as HTMLElement;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
    return;
  }

  const store = getPlayerStore();
  switch (e.code) {
    case 'Space':
      if (store.playMusic?.id) {
        void store.setPlay({ ...store.playMusic });
      }
      break;
    default:
  }
};

const setupKeyboardListeners = () => {
  document.removeEventListener('keyup', handleKeyUp);
  document.addEventListener('keyup', handleKeyUp);
};

let audioListenersInitialized = false;

const parseLyricsString = async (
  lyricsStr: string
): Promise<{ lrcArray: ILyricText[]; lrcTimeArray: number[]; hasWordByWord: boolean }> => {
  if (!lyricsStr || typeof lyricsStr !== 'string') {
    return { lrcArray: [], lrcTimeArray: [], hasWordByWord: false };
  }

  try {
    const parseResult = parseLyrics(lyricsStr);
    if (!parseResult.success) {
      console.error('Lyrics parsing failed:', parseResult.error.message);
      return { lrcArray: [], lrcTimeArray: [], hasWordByWord: false };
    }

    const { lyrics } = parseResult.data;
    const lrcArray: ILyricText[] = [];
    const lrcTimeArray: number[] = [];
    let hasWordByWord = false;

    for (const line of lyrics) {
      const hasWords = line.words && line.words.length > 0;
      if (hasWords) {
        hasWordByWord = true;
      }

      lrcArray.push({
        text: line.fullText,
        trText: '',
        words: hasWords
          ? line.words.map((word) => ({
              ...word
            }))
          : undefined,
        hasWordByWord: hasWords,
        startTime: line.startTime,
        duration: line.duration
      });

      lrcTimeArray.push(line.startTime / 1000);
    }
    return { lrcArray, lrcTimeArray, hasWordByWord };
  } catch (error) {
    console.error('An error occurred while parsing lyrics:', error);
    return { lrcArray: [], lrcTimeArray: [], hasWordByWord: false };
  }
};

const ensureLyricsLoaded = async (force = false) => {
  const songId = playMusic.value?.id;
  if (!songId) {
    lrcArray.value = [];
    lrcTimeArray.value = [];
    nowIndex.value = 0;
    return;
  }
  if (!force && lrcArray.value.length > 0) return;

  await nextTick();

  const lyricData = playMusic.value.lyric;
  if (lyricData && typeof lyricData === 'string') {
    const {
      lrcArray: parsedLrcArray,
      lrcTimeArray: parsedTimeArray,
      hasWordByWord
    } = await parseLyricsString(lyricData);
    lrcArray.value = parsedLrcArray;
    lrcTimeArray.value = parsedTimeArray;

    if (playMusic.value.lyric && typeof playMusic.value.lyric === 'object') {
      playMusic.value.lyric.hasWordByWord = hasWordByWord;
    }
  } else if (lyricData && typeof lyricData === 'object' && lyricData.lrcArray?.length > 0) {
    const rawLrc = lyricData.lrcArray || [];
    lrcTimeArray.value = lyricData.lrcTimeArray || [];

    try {
      const { translateLyrics } = await import('@/services/lyricTranslation');
      lrcArray.value = await translateLyrics(rawLrc as any);
    } catch (e) {
      console.error('Failed to translate lyrics, use original lyrics:', e);
      lrcArray.value = rawLrc as any;
    }
  } else if (playMusic.value.playMusicUrl?.startsWith('local://')) {
    try {
      let filePath = decodeURIComponent(playMusic.value.playMusicUrl.replace('local://', ''));

      if (/^\/[a-zA-Z]:\//.test(filePath)) {
        filePath = filePath.slice(1);
      }
      const embeddedLyrics = await window.api.getEmbeddedLyrics(filePath);
      if (embeddedLyrics) {
        const {
          lrcArray: parsedLrcArray,
          lrcTimeArray: parsedTimeArray,
          hasWordByWord
        } = await parseLyricsString(embeddedLyrics);
        lrcArray.value = parsedLrcArray;
        lrcTimeArray.value = parsedTimeArray;
        if (playMusic.value.lyric && typeof playMusic.value.lyric === 'object') {
          (playMusic.value.lyric as any).hasWordByWord = hasWordByWord;
        }
      }
    } catch (err) {
      console.error('Failed to extract embedded lyrics:', err);
    }
  } else {
    try {
        const title = playMusic.value.name || "";
        const artist =
          playMusic.value.ar?.[0]?.name || playMusic.value.artists?.[0]?.name || '';
        const videoId = playMusic.value.id;
        
        const fetchedLyrics = await window.api.fetchBestLyrics(title, artist, videoId);
        
        if (fetchedLyrics && fetchedLyrics.lines) {
            lrcArray.value = fetchedLyrics.lines.map((line: any) => ({
                text: line.text,
                trText: '',
                startTime: line.time,
                hasWordByWord: line.words !== null && line.words !== undefined,
                words: line.words?.map((w: any) => ({ word: w.word, startTime: w.start, duration: w.duration }))
            }));
            lrcTimeArray.value = fetchedLyrics.lines.map((line: any) => line.time / 1000);
            
            console.log(`Successfully loaded lyrics from provider: ${fetchedLyrics.provider}`);
        }
    } catch (err) {
        console.error("Failed to fetch lyrics from network providers:", err);
    }
  }

  if (isLyricWindowOpen.value) {
    sendLyricToWin();
    setTimeout(() => sendLyricToWin(), 500);
  }
};

const setupMusicWatchers = () => {
  const store = getPlayerStore();

  watch(
    () => store.playMusic.id,
    async (newId, oldId) => {
      if (newId !== oldId) {
        lrcArray.value = [];
        lrcTimeArray.value = [];
        nowTime.value = 0;
        nowIndex.value = 0;
        lastIndex = -1;
      }
      await ensureLyricsLoaded(true);
      sendDiscordPresence();
    },
    { immediate: true }
  );

  watch(
    () => playMusic.value?.lyric,
    (newLyric) => {
      if (!playMusic.value?.id) return;

      const isRichLyric =
        !!newLyric && typeof newLyric === 'object' && (newLyric.lrcArray?.length ?? 0) > 0;
      if (lrcArray.value.length === 0 || isRichLyric) {
        ensureLyricsLoaded(isRichLyric);
      }
    }
  );
};

const setupAudioListeners = () => {
  if (audioListenersInitialized) {
    return () => {};
  }
  audioListenersInitialized = true;

  let interval: number | null = null;
  let recoveryTimer: number | null = null;
  const lyricThrottleCounter = 0;
  let lastSavedProgress = 0;

  const clearInterval = () => {
    if (interval) {
      window.clearInterval(interval);
      interval = null;
    }
  };

  const stopRecovery = () => {
    if (recoveryTimer) {
      window.clearInterval(recoveryTimer);
      recoveryTimer = null;
    }
  };

  const startProgressInterval = () => {
    clearInterval();
    interval = window.setInterval(async () => {
      try {
        if (!audioService.isActuallyPlaying()) {
          return;
        }

        const currentTime = await window.api.audioGetTime();
        if (typeof currentTime !== 'number' || Number.isNaN(currentTime)) {
          return;
        }

        nowTime.value = currentTime;
        allTime.value = audioService.getDuration() || 0;

        const newIndex = getLrcIndex(nowTime.value);
        if (newIndex !== nowIndex.value) {
          nowIndex.value = newIndex;
          currentLrcProgress.value = 0;
          if (isLyricWindowOpen.value) {
            sendLyricToWin();
          }
        }
        if (lrcArray.value[nowIndex.value]) {
          if (lastIndex !== nowIndex.value) {
            sendTrayLyric(nowIndex.value);
            lastIndex = nowIndex.value;
          }
        }

        const { start, end } = currentLrcTiming.value;
        if (typeof start === 'number' && typeof end === 'number' && start !== end) {
          const elapsed = currentTime - start;
          const duration = end - start;
          const progress = (elapsed / duration) * 100;
          currentLrcProgress.value = Math.min(Math.max(progress, 0), 100);
        }

        let lyricLastSend = 0;
        const now = Date.now();
        if (now - lyricLastSend >= 50) {
          try {
            window.api.sendLyric(
              JSON.stringify({
                type: 'update',
                nowIndex: nowIndex.value,
                nowTime: nowTime.value,
                isPlay: getPlayerStore().play
              })
            );
            lyricLastSend = now;
          } catch {
            /* empty */
          }
        }

        if (
          Math.floor(currentTime) % 2 === 0 &&
          Math.floor(currentTime) !== Math.floor(lastSavedProgress)
        ) {
          lastSavedProgress = currentTime;
          if (getPlayerStore().playMusic?.id) {
            localStorage.setItem(
              'playProgress',
              JSON.stringify({
                songId: getPlayerStore().playMusic.id,
                progress: currentTime
              })
            );
          }
        }
      } catch (error) {
        console.error('progress update interval Error:', error);
      }
    }, 50);
  };

  const startRecoveryMonitor = () => {
    stopRecovery();
    recoveryTimer = window.setInterval(() => {
      try {
        const store = getPlayerStore();
        if (store.play && !interval) {
          if (audioService.isActuallyPlaying()) {
            console.warn('[MusicHook] Playing detected but interval Lost, automatically restored');
            startProgressInterval();
          }
        }
      } catch {
        /* empty */
      }
    }, 500);
  };

  startRecoveryMonitor();

  audioService.on('seek_start', (time: number) => {
    nowTime.value = time;
  });

  audioService.on('seek', async () => {
    try {
      const currentTime = await window.api.audioGetTime();
      if (typeof currentTime === 'number' && !Number.isNaN(currentTime)) {
        nowTime.value = currentTime;

        if (lrcArray.value[nowIndex.value]) {
          if (lastIndex !== nowIndex.value) {
            sendTrayLyric(nowIndex.value);
            lastIndex = nowIndex.value;
          }
        }

        const newIndex = getLrcIndex(nowTime.value);
        if (newIndex !== nowIndex.value) {
          nowIndex.value = newIndex;
          if (isLyricWindowOpen.value) {
            sendLyricToWin();
          }
        }
      }
    } catch (error) {
      console.error('deal withseekEvent error:', error);
    }
  });

  const updateCurrentTimeAndDuration = async () => {
    try {
      const currentTime = await window.api.audioGetTime();
      if (typeof currentTime === 'number' && !Number.isNaN(currentTime)) {
        nowTime.value = currentTime;
        allTime.value = audioService.getDuration() || 0;
      }
    } catch (error) {
      console.error('Initialization time and progress failed:', error);
    }
  };

  updateCurrentTimeAndDuration();

  audioService.on('play', () => {
    getPlayerStore().setPlayMusic(true);
    window.api.sendSong(cloneDeep(getPlayerStore().playMusic));

    if (lrcArray.value.length === 0 && playMusic.value?.id) {
      ensureLyricsLoaded();
    }
    startProgressInterval();
  });

  audioService.on('pause', () => {
    console.log('Audio pause event triggered');
    getPlayerStore().setPlayMusic(false);
    clearInterval();
    if (isLyricWindowOpen.value) {
      sendLyricToWin();
    }
  });

  audioService.on('stop', () => {
    clearInterval();
    nowTime.value = 0;
    nowIndex.value = 0;
    lrcArray.value = [];
    lrcTimeArray.value = [];
    if (isLyricWindowOpen.value) {
      sendLyricToWin();
    }
  });

  const replayMusic = async (retryCount = 0) => {
    const MAX_REPLAY_RETRIES = 3;
    try {
      if (getPlayerStore().playMusicUrl && playMusic.value) {
        await audioService.play(getPlayerStore().playMusicUrl, playMusic.value);
        setupAudioListeners();
      } else {
        console.error('Single loop: None available URL or song data');
        const { useQueueStore } = await import('@/store/modules/queue');
        useQueueStore().nextPlayOnEnd();
      }
    } catch (error) {
      console.error('Single loop replay failed:', error);
      if (retryCount < MAX_REPLAY_RETRIES) {
        setTimeout(() => replayMusic(retryCount + 1), 1000 * (retryCount + 1));
      } else {
        const { useQueueStore } = await import('@/store/modules/queue');
        useQueueStore().nextPlayOnEnd();
      }
    }
  };

  audioService.on('end', async () => {
    console.log('Audio playback end event triggered');
    clearInterval();

    if (getPlayerStore().repeatMode === 2) {
      replayMusic();
      return;
    }

    const { useQueueStore } = await import('@/store/modules/queue');
    useQueueStore().nextPlayOnEnd();
  });

  audioService.on('previoustrack', () => {
    getPlayerStore().prevPlay();
  });

  audioService.on('nexttrack', () => {
    getPlayerStore().nextPlay();
  });

  return () => {
    clearInterval();
    stopRecovery();
  };
};

export const play = () => {
  window.api.audioResume();
};

export const pause = async () => {
  try {
    const currentTime = await window.api.audioGetTime();
    if (getPlayerStore().playMusic && getPlayerStore().playMusic.id) {
      localStorage.setItem(
        'playProgress',
        JSON.stringify({
          songId: getPlayerStore().playMusic.id,
          progress: currentTime
        })
      );
    }

    audioService.pause();
  } catch (error) {
    console.error('Pause playback error:', error);
  }
};

const CORRECTION_KEY = 'lyric-correction-map';
const correctionTimeMap = ref<Record<string, number>>({});

const loadCorrectionMap = () => {
  try {
    const raw = localStorage.getItem(CORRECTION_KEY);
    correctionTimeMap.value = raw ? JSON.parse(raw) : {};
  } catch {
    correctionTimeMap.value = {};
  }
};
const saveCorrectionMap = () => {
  localStorage.setItem(CORRECTION_KEY, JSON.stringify(correctionTimeMap.value));
};

loadCorrectionMap();

export const correctionTime = ref(0);

const setupCorrectionTimeWatcher = () => {
  watch(
    () => playMusic.value?.id,
    (id) => {
      if (!id) return;
      correctionTime.value = correctionTimeMap.value[id] ?? 0;
    },
    { immediate: true }
  );
};

export const adjustCorrectionTime = (delta: number) => {
  const id = playMusic.value?.id;
  if (!id) return;
  const newVal = Math.max(-10, Math.min(10, (correctionTime.value ?? 0) + delta));
  correctionTime.value = newVal;
  correctionTimeMap.value[id] = newVal;
  saveCorrectionMap();
};

export const isCurrentLrc = (index: number, time: number): boolean => {
  const currentTime = lrcTimeArray.value[index];

  if (index === lrcTimeArray.value.length - 1) {
    const correctedTime = time + correctionTime.value;
    return correctedTime >= currentTime;
  }

  const nextTime = lrcTimeArray.value[index + 1];
  const correctedTime = time + correctionTime.value;
  return correctedTime >= currentTime && correctedTime < nextTime;
};

export const getLrcIndex = (time: number): number => {
  const correctedTime = time + correctionTime.value;

  if (lrcTimeArray.value.length === 0) {
    return nowIndex.value;
  }

  if (correctedTime < lrcTimeArray.value[0]) {
    nowIndex.value = 0;
    return 0;
  }

  const lastIndex = lrcTimeArray.value.length - 1;
  if (correctedTime >= lrcTimeArray.value[lastIndex]) {
    nowIndex.value = lastIndex;
    return lastIndex;
  }

  for (let i = 0; i < lrcTimeArray.value.length - 1; i++) {
    const currentTime = lrcTimeArray.value[i];
    const nextTime = lrcTimeArray.value[i + 1];

    if (correctedTime >= currentTime && correctedTime < nextTime) {
      nowIndex.value = i;
      return i;
    }
  }

  return nowIndex.value;
};

const currentLrcTiming = computed(() => {
  const start = lrcTimeArray.value[nowIndex.value] || 0;
  const end = lrcTimeArray.value[nowIndex.value + 1] || start + 1;
  return { start, end };
});

export const getLrcStyle = (index: number) => {
  const currentTime = nowTime.value + correctionTime.value;
  const start = lrcTimeArray.value[index];
  const end = lrcTimeArray.value[index + 1] ?? start + 1;

  if (currentTime >= start && currentTime < end) {
    const progress = ((currentTime - start) / (end - start)) * 100;
    return {
      backgroundImage: `linear-gradient(to right, #ffffff ${progress}%, #ffffff8a ${progress}%)`,
      backgroundClip: 'text',
      WebkitBackgroundClip: 'text',
      color: 'transparent',
      transition: 'background-image 0.1s linear'
    };
  }

  return {};
};

export const useLyricProgress = () => {
  return {
    getLrcStyle
  };
};

export const setAudioTime = (index: number) => {
  const time = lrcTimeArray.value[index] || 0;
  nowTime.value = time;
  nowIndex.value = index;
  audioService.seek(time);
  window.api.audioResume();
};

export const getCurrentLrc = () => {
  const index = getLrcIndex(nowTime.value);
  return {
    currentLrc: lrcArray.value[index],
    nextLrc: lrcArray.value[index + 1]
  };
};

export const getLrcTimeRange = (index: number) => ({
  currentTime: lrcTimeArray.value[index],
  nextTime: lrcTimeArray.value[index + 1]
});

watch(
  () => lrcArray.value,
  (newLrcArray) => {
    if (newLrcArray.length > 0 && isLyricWindowOpen.value) {
      sendLyricToWin();
    }
  }
);

export const sendLyricToWin = () => {
  if (!playMusic.value || !playMusic.value.id) {
    return;
  }

  try {
    if (lrcArray.value && lrcArray.value.length > 0) {
      const nowIndex = getLrcIndex(nowTime.value);

      const updateData = {
        type: 'full',
        nowIndex,
        nowTime: nowTime.value,
        startCurrentTime: lrcTimeArray.value[nowIndex] || 0,
        nextTime: lrcTimeArray.value[nowIndex + 1] || 0,
        isPlay: getPlayerStore().play,
        lrcArray: lrcArray.value,
        lrcTimeArray: lrcTimeArray.value,
        allTime: allTime.value,
        playMusic: playMusic.value
      };

      window.api.sendLyric(JSON.stringify(updateData));
    } else {
      console.log('No lyric data available, sending empty lyric message');

      const emptyLyricData = {
        type: 'empty',
        nowIndex: 0,
        nowTime: nowTime.value,
        startCurrentTime: 0,
        nextTime: 0,
        isPlay: getPlayerStore().play,
        lrcArray: [{ text: 'The current song has no lyrics yet', trText: '' }],
        lrcTimeArray: [0],
        allTime: allTime.value,
        playMusic: playMusic.value
      };
      window.api.sendLyric(JSON.stringify(emptyLyricData));
    }
  } catch (error) {
    console.error('Error sending lyric update:', error);
  }
};

const sendTrayLyric = (index: number) => {
  if (cachedPlatform !== 'linux') return;

  try {
    const lyric = lrcArray.value[index];
    if (!lyric) return;

    const currentTime = lrcTimeArray.value[index] || 0;
    const nextTime = lrcTimeArray.value[index + 1] || currentTime + 3;
    const duration = nextTime - currentTime;

    const lrcObj = JSON.stringify({
      content: lyric.text || '',
      time: duration.toFixed(1),
      sender: 'ChorusDeck'
    });

    window.api.send('tray-lyric-update', lrcObj);
  } catch (error) {
    console.error('[TrayLyric] Failed to send:', error);
  }
};

let lyricSyncInterval: any = null;

const startLyricSync = () => {
  if (lyricSyncInterval) {
    clearInterval(lyricSyncInterval);
  }

  lyricSyncInterval = setInterval(() => {
    if (getPlayerStore().play && playMusic.value?.id) {
      try {
        const updateData = {
          type: 'update',
          nowIndex: getLrcIndex(nowTime.value),
          nowTime: nowTime.value,
          isPlay: getPlayerStore().play
        };
        window.api.sendLyric(JSON.stringify(updateData));
      } catch (error) {
        console.error('Failed to send lyrics progress update:', error);
      }
    }
  }, 1000);
};

const stopLyricSync = () => {
  if (lyricSyncInterval) {
    clearInterval(lyricSyncInterval);
    lyricSyncInterval = null;
  }
};

export const openLyric = async () => {
  isLyricWindowOpen.value = !isLyricWindowOpen.value;
  if (isLyricWindowOpen.value) {
    window.api.openLyric();

    if (!lrcArray.value || lrcArray.value.length === 0) {
      const emptyLyricData = {
        type: 'empty',
        nowIndex: 0,
        nowTime: nowTime.value,
        startCurrentTime: 0,
        nextTime: 0,
        isPlay: getPlayerStore().play,
        lrcArray: [{ text: 'Loading lyrics...', trText: '' }],
        lrcTimeArray: [0],
        allTime: allTime.value,
        playMusic: playMusic.value
      };
      window.api.sendLyric(JSON.stringify(emptyLyricData));

      await ensureLyricsLoaded(true);
    } else {
      sendLyricToWin();
    }

    setTimeout(() => {
      if (isLyricWindowOpen.value) {
        sendLyricToWin();
      }
    }, 500);

    startLyricSync();
  } else {
    closeLyric();

    stopLyricSync();
  }
};

export const closeLyric = () => {
  isLyricWindowOpen.value = false;
  windowData.api.onLyricWindowClosed?.();
  stopLyricSync();
};

const sendDiscordPresence = () => {
  const store = getPlayerStore();
  const music = store.playMusic;
  if (!music || !music.id) return;

  const isPlaying = store.play;
  const artistName = music.ar?.map((a) => a.name).join(', ') || 'Unknown Artist';
  const title = music.name || 'Unknown Title';
  const albumName = music.al?.name || '';
  const albumArt = music.al?.picUrl || 'chorus_logo';
  const songId = music.id || '';
  const artistId = music.ar?.[0]?.id || '';
  const albumId = music.al?.id || '';

  try {
    const currentPlaybackTimeMillis = nowTime.value * 1000;
    const duration = (audioService.getDuration() || 0) * 1000;
    window.api.updateDiscordPresence({
      title: title,
      artist: artistName,
      album: albumName,
      albumArt: albumArt,
      songId: songId,
      artistId: artistId,
      albumId: albumId,
      duration: duration,
      isPlaying: isPlaying,
      startTimestamp: isPlaying ? Math.floor(Date.now() - currentPlaybackTimeMillis) : undefined
    });
  } catch (err) {
    // Discord not running is an expected state, not an error worth surfacing
    // on every playback tick.
    console.debug('Discord presence unavailable:', (err as Error)?.message || err);
  }
};

const setupPlayStateWatcher = () => {
  watch(
    () => getPlayerStore().play,
    (isPlaying) => {
      sendDiscordPresence();
      if (isLyricWindowOpen.value) {
        if (isPlaying) {
          startLyricSync();
        } else {
          const pauseData = {
            type: 'update',
            isPlay: false
          };
          window.api.sendLyric(JSON.stringify(pauseData));
        }
      }
    }
  );
};

export const destroyMusicHook = () => {
  stopLyricSync();
};

export { parseLyricsString };

export const initAudioListeners = async () => {
  try {
    if (!getPlayerStore().playMusic || !getPlayerStore().playMusic.id) {
      console.log('No music playing, skipping audio listener initialization');
      return;
    }

    setupAudioListeners();

    if (isDesktop()) {
      window.api.onLyricWindowClosed(() => {
        isLyricWindowOpen.value = false;
      });
      window.api.onLyricWindowReady(async () => {
        if (!isLyricWindowOpen.value) return;

        if (lrcArray.value.length === 0 && playMusic.value?.id) {
          await ensureLyricsLoaded(true);
        }
        sendLyricToWin();
      });
    }
  } catch (error) {
    console.error('Failed to initialize audio listener:', error);
  }
};

const handleAudioReady = ((event: CustomEvent) => {
  try {
    setupAudioListeners();
  } catch (error) {
    console.error('Error handling audio ready event:', error);
  }
}) as EventListener;

window.removeEventListener('audio-ready', handleAudioReady);
window.addEventListener('audio-ready', handleAudioReady);
