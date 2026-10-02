import { useThrottleFn } from '@vueuse/core';
import { createDiscreteApi } from 'naive-ui';
import { defineStore, storeToRefs } from 'pinia';
import { computed, ref, shallowRef, triggerRef } from 'vue';

import { useSongDetail } from '@/hooks/usePlayerHooks';
import { audioService } from '@/services/audioService';
import { preloadService } from '@/services/preloadService';
import type { SongResult } from '@/types/music';
import { thumbTiny } from '@/utils/thumbnail';
import { debouncedLocalStorage } from '@/utils/debouncedStorage';
import { minifySongList } from '@/utils/persistedSong';
import { performShuffle, preloadCoverImage } from '@/utils/playerUtils';

import { usePlayerCoreStore } from './playerCore';
import { useSleepTimerStore } from './sleepTimer';

let _message: ReturnType<typeof createDiscreteApi>['message'] | null = null;
const getMessage = () => {
  if (!_message) _message = createDiscreteApi(['message']).message;
  return _message;
};

const parseDuration = (duration: string): number => {
  const parts = duration.split(':').map(Number);
  if (parts.some(Number.isNaN)) return 0;

  if (parts.length === 3) {
    return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  }
  if (parts.length === 2) {
    return (parts[0] * 60 + parts[1]) * 1000;
  }
  return (parts[0] || 0) * 1000;
};

export const useQueueStore = defineStore(
  'queue',
  () => {
    const queueItems = shallowRef<SongResult[]>([]);
    const queueIndex = ref(0);
    const repeatMode = ref(0);
    const shuffleEnabled = ref(false);
    const originalQueueItems = shallowRef<SongResult[]>([]);
    const queueVisible = ref(false);
    const playMode = computed(() => {
      if (shuffleEnabled.value) return 2;
      return repeatMode.value === 2 ? 1 : 0;
    });

    const consecutiveFailCount = ref(0);
    const MAX_CONSECUTIVE_FAILS = 5;
    let radioRequestId = 0;

    const currentQueueItems = computed(() => queueItems.value);
    const currentQueueIndex = computed(() => queueIndex.value);

    const fetchSongs = async (startIndex: number, endIndex: number) => {
      try {
        const songs = queueItems.value.slice(
          Math.max(0, startIndex),
          Math.min(endIndex, queueItems.value.length)
        );
        const { getSongDetail } = useSongDetail();

        const detailedSongs = await Promise.all(
          songs.map(async (song: SongResult) => {
            try {
              if (!song.playMusicUrl || (song.source === 'ytmusic' && !song.backgroundColor)) {
                return await getSongDetail(song);
              }
              return song;
            } catch (error) {
              console.error('Failed to get song details:', error);
              return song;
            }
          })
        );

        const nextSong = detailedSongs[0];
        if (nextSong && !(nextSong.lyric && nextSong.lyric.lrcTimeArray.length > 0)) {
          try {
            const { useLyrics } = await import('@/hooks/usePlayerHooks');
            const { loadLrc } = useLyrics();
            nextSong.lyric = await loadLrc(nextSong.id);
          } catch (error) {
            console.error('Failed to load lyrics:', error);
          }
        }

        if (nextSong?.picUrl && !(nextSong.backgroundColor && nextSong.primaryColor)) {
          try {
            const { getImageLinearBackground } = await import('@/utils/linearColor');
            const { backgroundColor, primaryColor } = await getImageLinearBackground(
              thumbTiny(nextSong.picUrl)
            );
            nextSong.backgroundColor = backgroundColor;
            nextSong.primaryColor = primaryColor;
          } catch (error) {
            console.warn('Failed to warm up background color:', error);
          }
        }

        detailedSongs.forEach((song, index) => {
          if (song && startIndex + index < queueItems.value.length) {
            queueItems.value[startIndex + index] = song;
          }
        });

        triggerRef(queueItems);

        if (nextSong) {
          if (nextSong.playMusicUrl) {
            preloadService.load(nextSong).catch((err) => {
              console.warn('Preloading next song failed:', err);
            });
          }
          if (nextSong.picUrl) {
            preloadCoverImage(nextSong.picUrl);
          }
        }
      } catch (error) {
        console.error('Failed to get song list:', error);
      }
    };

    let preloadDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    const preloadNextSongs = (currentIndex: number) => {
      if (preloadDebounceTimer) clearTimeout(preloadDebounceTimer);
      preloadDebounceTimer = setTimeout(() => {
        preloadDebounceTimer = null;
        doPreloadNextSongs(currentIndex);
      }, 800);
    };

    const doPreloadNextSongs = (currentIndex: number) => {
      if (queueItems.value.length <= 1) return;

      let nextIndex: number;

      if (repeatMode.value === 0 && !shuffleEnabled.value) {
        if (currentIndex >= queueItems.value.length - 1) {
          return;
        }
        nextIndex = currentIndex + 1;
      } else {
        nextIndex = (currentIndex + 1) % queueItems.value.length;
      }

      const endIndex = Math.min(nextIndex + 2, queueItems.value.length);

      if (nextIndex < queueItems.value.length) {
        fetchSongs(nextIndex, endIndex);

        if (
          (repeatMode.value === 1 || shuffleEnabled.value) &&
          nextIndex + 1 >= queueItems.value.length &&
          queueItems.value.length > 2
        ) {
          fetchSongs(0, 1);
        }
      }
    };

    const shuffleQueue = () => {
      console.log('[QueueStore] shuffleQueue called');
      if (queueItems.value.length === 0) return;

      if (originalQueueItems.value.length === 0) {
        console.log('[QueueStore] Saving original queue, length:', queueItems.value.length);
        originalQueueItems.value = [...queueItems.value];
      }

      const currentSong = queueItems.value[queueIndex.value];
      console.log('[QueueStore] Current song before shuffle:', currentSong?.name);

      const shuffled = performShuffle([...queueItems.value], currentSong);

      queueItems.value = [...shuffled];
      queueIndex.value = 0;
      shuffleEnabled.value = true;

      console.log('[QueueStore] Queue shuffled, new length:', queueItems.value.length);
      console.log('[QueueStore] New first song:', queueItems.value[0]?.name);
    };

    const restoreOriginalOrder = () => {
      console.log('[QueueStore] restoreOriginalOrder called');
      if (originalQueueItems.value.length === 0) return;

      const currentSong = queueItems.value[queueIndex.value];
      console.log('[QueueStore] Current song before restore:', currentSong?.name);

      queueItems.value = [...originalQueueItems.value];
      originalQueueItems.value = [];

      if (currentSong) {
        const index = queueItems.value.findIndex((s) => s.id === currentSong.id);
        if (index !== -1) {
          queueIndex.value = index;
        }
      }
      console.log('[QueueStore] Queue order restored, new index:', queueIndex.value);
      shuffleEnabled.value = false;
    };

    const setQueue = (
      list: SongResult[],
      keepIndex: boolean = false,

      preserveOrder: boolean = false
    ) => {
      if (list.length > 1) {
        const playerCore = usePlayerCoreStore();
        playerCore.isFmPlaying = false;
      }

      if (list.length === 0) {
        queueItems.value = [];
        queueIndex.value = 0;
        originalQueueItems.value = [];
        return;
      }

      const playerCore = usePlayerCoreStore();
      const { playMusic } = storeToRefs(playerCore);

      if (preserveOrder) {
        console.log('Edit queue in place, keeping given order');

        if (shuffleEnabled.value) {
          const idSet = new Set(list.map((song) => song.id));
          const reconciled = originalQueueItems.value.filter((song) => idSet.has(song.id));
          const existingIds = new Set(reconciled.map((song) => song.id));
          for (const song of list) {
            if (!existingIds.has(song.id)) {
              reconciled.push(song);
            }
          }
          originalQueueItems.value = reconciled;
        } else if (originalQueueItems.value.length > 0) {
          originalQueueItems.value = [];
        }

        const currentSong = playMusic.value;
        const currentIndex =
          currentSong && currentSong.id ? list.findIndex((song) => song.id === currentSong.id) : -1;
        queueIndex.value =
          currentIndex !== -1
            ? currentIndex
            : Math.min(Math.max(0, queueIndex.value), list.length - 1);

        queueItems.value = list;
      } else if (shuffleEnabled.value) {
        console.log('Set new queue in random mode, save original order and shuffle');

        originalQueueItems.value = [...list];

        const currentSong = playMusic.value;
        const shuffledList = performShuffle(list, currentSong);

        if (currentSong && currentSong.id) {
          const currentSongIndex = shuffledList.findIndex((song) => song.id === currentSong.id);
          queueIndex.value =
            currentSongIndex !== -1 ? 0 : keepIndex ? Math.max(0, queueIndex.value) : 0;
        } else {
          queueIndex.value = keepIndex ? Math.max(0, queueIndex.value) : 0;
        }

        queueItems.value = shuffledList;
      } else {
        console.log('Set up a new queue in loop mode');
        if (originalQueueItems.value.length > 0) {
          originalQueueItems.value = [];
        }

        if (!keepIndex) {
          const foundIndex = list.findIndex((item) => item.id === playMusic.value.id);
          queueIndex.value = foundIndex !== -1 ? foundIndex : 0;
        }

        queueItems.value = list;
      }

      if (!preserveOrder && list.length === 1) {
        void appendRadioQueue(list[0]);
      }
    };

    const appendRadioQueue = async (song: SongResult) => {
      if (song.source && song.source !== 'ytmusic') return;
      if (song.playMusicUrl?.startsWith('local://') || !song.id) return;

      const requestId = ++radioRequestId;
      try {
        const { getYTMRadio } = await import('@/api/ytmusic');
        const radioSongs = await getYTMRadio(String(song.id));

        if (
          requestId !== radioRequestId ||
          queueItems.value.length !== 1 ||
          queueItems.value[0]?.id !== song.id
        ) {
          return;
        }

        const existingIds = new Set(queueItems.value.map((item) => String(item.id)));
        const additions: SongResult[] = radioSongs
          .filter((item) => !existingIds.has(String(item.id)))
          .map((item) => ({
            id: item.id,
            name: item.title,
            artists: item.artists,
            album: item.album,
            picUrl: item.thumbnail,
            dt: item.duration ? parseDuration(item.duration) : undefined,
            source: 'ytmusic'
          }));

        if (additions.length > 0) {
          setQueue([...queueItems.value, ...additions], true, true);
        }
      } catch (error) {
        console.warn('[QueueStore] Failed to load radio queue:', error);
      }
    };

    const addToNextPlay = (song: SongResult) => {
      const list = [...queueItems.value];
      const currentIndex = queueIndex.value;

      const existingIndex = list.findIndex((item) => item.id === song.id);
      if (existingIndex !== -1) {
        list.splice(existingIndex, 1);
        if (existingIndex <= currentIndex) {
          queueIndex.value = Math.max(0, queueIndex.value - 1);
        }
      }

      const insertIndex = queueIndex.value + 1;
      list.splice(insertIndex, 0, song);

      setQueue(list, true, true);
    };

    const addToQueue = (song: SongResult) => {
      setQueue([...queueItems.value, song], true, true);
    };

    const moveInQueue = (fromIndex: number, toIndex: number) => {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= queueItems.value.length ||
        toIndex >= queueItems.value.length
      ) {
        return;
      }

      const list = [...queueItems.value];
      const [song] = list.splice(fromIndex, 1);
      list.splice(toIndex, 0, song);

      if (queueIndex.value === fromIndex) {
        queueIndex.value = toIndex;
      } else if (fromIndex < queueIndex.value && toIndex >= queueIndex.value) {
        queueIndex.value -= 1;
      } else if (fromIndex > queueIndex.value && toIndex <= queueIndex.value) {
        queueIndex.value += 1;
      }

      if (shuffleEnabled.value) {
        const originalIds = new Set(originalQueueItems.value.map((item) => item.id));
        originalQueueItems.value = originalQueueItems.value.filter((item) =>
          list.some((queuedItem) => queuedItem.id === item.id)
        );
        for (const item of list) {
          if (!originalIds.has(item.id)) originalQueueItems.value.push(item);
        }
      }

      queueItems.value = list;
    };

    const removeFromQueue = (id: number | string) => {
      const index = queueItems.value.findIndex((item) => item.id === id);
      if (index === -1) return;

      const playerCore = usePlayerCoreStore();
      const { playMusic } = storeToRefs(playerCore);

      if (id === playMusic.value.id) {
        nextPlay();
      }

      const newQueueItems = [...queueItems.value];
      newQueueItems.splice(index, 1);

      setQueue(newQueueItems, false, true);
    };

    const clearPlayAll = async () => {
      const { audioService } = await import('@/services/audioService');
      const playerCore = usePlayerCoreStore();

      audioService.pause();
      setTimeout(() => {
        playerCore.playMusic = {} as SongResult;
        playerCore.playMusicUrl = '';
        queueItems.value = [];
        queueIndex.value = 0;
        originalQueueItems.value = [];

        localStorage.removeItem('currentPlayMusic');
        localStorage.removeItem('currentPlayMusicUrl');
      }, 500);
    };

    const toggleShuffle = () => {
      if (shuffleEnabled.value) {
        restoreOriginalOrder();
      } else if (queueItems.value.length > 0) {
        shuffleQueue();
      } else {
        shuffleEnabled.value = true;
      }
    };

    const toggleRepeat = () => {
      repeatMode.value = (repeatMode.value + 1) % 3;
    };

    const togglePlayMode = () => {
      toggleRepeat();
    };

    let nextPlayRetryTimer: ReturnType<typeof setTimeout> | null = null;

    const cancelRetryTimer = () => {
      if (nextPlayRetryTimer) {
        clearTimeout(nextPlayRetryTimer);
        nextPlayRetryTimer = null;
      }
    };

    const _nextPlay = async (autoEnd: boolean = false, fromFailover: boolean = false) => {
      try {
        const playerCore = usePlayerCoreStore();

        if (queueItems.value.length === 0) return;

        if (!fromFailover) {
          cancelRetryTimer();
          consecutiveFailCount.value = 0;
        }

        const sleepTimerStore = useSleepTimerStore();

        if (consecutiveFailCount.value >= MAX_CONSECUTIVE_FAILS) {
          console.error(
            `[nextPlay] continuous${MAX_CONSECUTIVE_FAILS}The first playback failed and stopped.`
          );
          getMessage().warning(
            'Playback error, possibly due to network issues or invalid source. Please switch queue or try again later'
          );
          consecutiveFailCount.value = 0;
          playerCore.setIsPlay(false);
          return;
        }

        if (
          repeatMode.value === 0 &&
          !shuffleEnabled.value &&
          queueIndex.value >= queueItems.value.length - 1
        ) {
          if (autoEnd) {
            console.log('[nextPlay] Sequential playback: After the last song is played, stop');
            if (sleepTimerStore.sleepTimer.type === 'end') {
              sleepTimerStore.stopPlayback();
            }
            getMessage().info('Reached the end of the queue');
            playerCore.setIsPlay(false);
            const { audioService } = await import('@/services/audioService');
            audioService.pause();
          } else {
            console.log(
              '[nextPlay] Sequential playback: Already the last song, keep playing currently'
            );
            getMessage().info('Reached the end of the queue');
          }
          return;
        }

        const nowQueueIndex = (queueIndex.value + 1) % queueItems.value.length;
        const nextSong = { ...queueItems.value[nowQueueIndex] };

        console.log(
          `[nextPlay] ${nextSong.name}, index: ${queueIndex.value} -> ${nowQueueIndex}`
        );

        const { playTrack } = await import('@/services/playbackController');
        const success = await playTrack(nextSong, true);

        if (playerCore.playMusic.id !== nextSong.id) {
          console.log('[nextPlay] Replaced by new operation, exit silently');
          return;
        }

        if (success) {
          consecutiveFailCount.value = 0;
          queueIndex.value = nowQueueIndex;
          console.log(`[nextPlay] Play successfully, index: ${nowQueueIndex}`);
          sleepTimerStore.handleSongChange();
        } else {
          consecutiveFailCount.value++;
          console.log(
            `[nextPlay] Playback fails, skips directly, fails continuously: ${consecutiveFailCount.value}/${MAX_CONSECUTIVE_FAILS}`
          );
          if (queueItems.value.length > 1) {
            queueIndex.value = nowQueueIndex;
            nextPlayRetryTimer = setTimeout(() => {
              nextPlayRetryTimer = null;
              _nextPlay(false, true);
            }, 500);
          } else {
            getMessage().error('Play Failed, Play Next Song');
            playerCore.setIsPlay(false);
          }
        }
      } catch (error) {
        console.error('Error switching to next song:', error);
      }
    };

    const nextPlay = useThrottleFn(_nextPlay, 500);

    const nextPlayOnEnd = () => {
      _nextPlay(true);
    };

    const _prevPlay = async () => {
      try {
        const playerCore = usePlayerCoreStore();

        if (queueItems.value.length === 0) return;

        cancelRetryTimer();

        try {
          const currentTime = await window.api.audioGetTime();
          if (currentTime > 3) {
            audioService.seek(0);
            return;
          }
        } catch (error) {
          console.warn('Unable to read current playback position:', error);
        }

        if (queueIndex.value === 0 && !shuffleEnabled.value) {
          audioService.seek(0);
          return;
        }

        const nowQueueIndex =
          (queueIndex.value - 1 + queueItems.value.length) % queueItems.value.length;
        const prevSong = { ...queueItems.value[nowQueueIndex] };

        console.log(
          `[prevPlay] ${prevSong.name}, index: ${queueIndex.value} -> ${nowQueueIndex}`
        );

        const { playTrack } = await import('@/services/playbackController');
        const success = await playTrack(prevSong);

        if (success) {
          queueIndex.value = nowQueueIndex;
          console.log(`[prevPlay] Play successfully, index: ${nowQueueIndex}`);
        } else if (playerCore.playMusic.id === prevSong.id) {
          playerCore.setIsPlay(false);
          getMessage().error('Play Failed, Play Next Song');
        }
      } catch (error) {
        console.error('Error switching to previous song:', error);
      }
    };

    const prevPlay = useThrottleFn(_prevPlay, 500);

    const setQueueVisible = (value: boolean) => {
      queueVisible.value = value;
    };

    const setPlay = async (song: SongResult) => {
      try {
        const playerCore = usePlayerCoreStore();

        if (song.expiredAt && song.expiredAt < Date.now()) {
          if (!song.playMusicUrl?.startsWith('local://')) {
            console.info(`songURLExpired, get it again: ${song.name}`);
            song.playMusicUrl = undefined;
            song.expiredAt = undefined;
          }
        }

        if (
          playerCore.playMusic.id === song.id &&
          playerCore.playMusic.playMusicUrl === song.playMusicUrl
        ) {
          if (playerCore.play) {
            playerCore.setPlayMusic(false);
            audioService.pause();
            playerCore.userPlayIntent = false;
          } else {
            playerCore.setPlayMusic(true);
            playerCore.userPlayIntent = true;
            try {
              const duration = await window.api.audioGetDuration();
              if (duration === null) throw new Error("Native player is not running");
              await window.api.audioResume();
            } catch {
              // Native player is not running; restart the track from scratch.
              const { playTrack } = await import('@/services/playbackController');
              const recoverSong = {
                ...playerCore.playMusic,
                isFirstPlay: true,
                playMusicUrl: playerCore.playMusic.playMusicUrl?.startsWith('local://')
                  ? playerCore.playMusic.playMusicUrl
                  : undefined
              };
              const recovered = await playTrack(recoverSong, true);
              if (!recovered) {
                playerCore.setIsPlay(false);
                getMessage().error('Play Failed, Play Next Song');
              }
            }
          }
          return;
        }

        if (song.isFirstPlay) song.isFirstPlay = false;

        const songIndex = queueItems.value.findIndex(
          (item: SongResult) => item.id === song.id && item.source === song.source
        );
        if (songIndex !== -1 && songIndex !== queueIndex.value) {
          console.log('Song index does not match, update to:', songIndex);
          queueIndex.value = songIndex;
        }

        const { playTrack } = await import('@/services/playbackController');
        const success = await playTrack(song);

        if (success) {
          playerCore.isPlay = true;
          if (songIndex !== -1) {
            preloadNextSongs(queueIndex.value);
          }
        }
        return success;
      } catch (error) {
        console.error('Setting playback failed:', error);
        return false;
      }
    };

    const initializeQueue = async () => {
      if (queueItems.value.length === 1) {
        void appendRadioQueue(queueItems.value[0]);
      }

      if (shuffleEnabled.value && queueItems.value.length > 0) {
        if (originalQueueItems.value.length === 0) {
          console.log('After restarting, restore random queue mode and reshuffle the queue.');
          shuffleQueue();
        } else {
          console.log(
            'After restarting, the random queue mode is restored, and the queue is already shuffled.'
          );
        }
      }
    };

    return {
      queueItems,
      queueIndex,
      playMode,
      repeatMode,
      shuffleEnabled,
      originalQueueItems,
      queueVisible,

      currentQueueItems,
      currentQueueIndex,

      setQueue,
      addToNextPlay,
      addToQueue,
      moveInQueue,
      removeFromQueue,
      clearPlayAll,
      togglePlayMode,
      toggleShuffle,
      toggleRepeat,
      shuffleQueue,
      restoreOriginalOrder,
      preloadNextSongs,
      nextPlay: nextPlay as unknown as typeof _nextPlay,
      nextPlayOnEnd,
      prevPlay: prevPlay as unknown as typeof _prevPlay,
      setQueueVisible,
      setPlay,
      initializeQueue,
      fetchSongs,
      updateSong: (song: SongResult) => {
        const index = queueItems.value.findIndex(
          (item) => item.id === song.id && item.source === song.source
        );
        if (index !== -1) {
          queueItems.value[index] = song;

          queueItems.value = [...queueItems.value];
        }
      }
    };
  },
  {
    persist: {
      key: 'queue-store',
      storage: debouncedLocalStorage,
      pick: ['queueItems', 'queueIndex', 'repeatMode', 'shuffleEnabled', 'originalQueueItems'],
      serializer: {
        serialize: (state: any) => {
          return JSON.stringify({
            ...state,
            queueItems: minifySongList(state.queueItems),
            originalQueueItems: minifySongList(state.originalQueueItems)
          });
        },
        deserialize: JSON.parse
      }
    }
  }
);
