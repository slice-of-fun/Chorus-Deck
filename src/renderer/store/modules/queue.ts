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

export const useQueueStore = defineStore(
  'queue',
  () => {
    const playList = shallowRef<SongResult[]>([]);
    const playListIndex = ref(0);
    const playMode = ref(0);
    const originalPlayList = shallowRef<SongResult[]>([]);
    const queueVisible = ref(false);

    const consecutiveFailCount = ref(0);
    const MAX_CONSECUTIVE_FAILS = 5;

    const currentPlayList = computed(() => playList.value);
    const currentPlayListIndex = computed(() => playListIndex.value);

    const fetchSongs = async (startIndex: number, endIndex: number) => {
      try {
        const songs = playList.value.slice(
          Math.max(0, startIndex),
          Math.min(endIndex, playList.value.length)
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
          if (song && startIndex + index < playList.value.length) {
            playList.value[startIndex + index] = song;
          }
        });

        triggerRef(playList);

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
      if (playList.value.length <= 1) return;

      let nextIndex: number;

      if (playMode.value === 0) {
        if (currentIndex >= playList.value.length - 1) {
          return;
        }
        nextIndex = currentIndex + 1;
      } else {
        nextIndex = (currentIndex + 1) % playList.value.length;
      }

      const endIndex = Math.min(nextIndex + 2, playList.value.length);

      if (nextIndex < playList.value.length) {
        fetchSongs(nextIndex, endIndex);

        if (
          (playMode.value === 1 || playMode.value === 2) &&
          nextIndex + 1 >= playList.value.length &&
          playList.value.length > 2
        ) {
          fetchSongs(0, 1);
        }
      }
    };

    const shufflePlayList = () => {
      console.log('[PlaylistStore] shufflePlayList called');
      if (playList.value.length === 0) return;

      if (originalPlayList.value.length === 0) {
        console.log('[PlaylistStore] Saving original list, length:', playList.value.length);
        originalPlayList.value = [...playList.value];
      }

      const currentSong = playList.value[playListIndex.value];
      console.log('[PlaylistStore] Current song before shuffle:', currentSong?.name);

      const shuffled = performShuffle([...playList.value], currentSong);

      playList.value = [...shuffled];
      playListIndex.value = 0;

      console.log('[PlaylistStore] List shuffled, new length:', playList.value.length);
      console.log('[PlaylistStore] New first song:', playList.value[0]?.name);
    };

    const restoreOriginalOrder = () => {
      console.log('[PlaylistStore] restoreOriginalOrder called');
      if (originalPlayList.value.length === 0) return;

      const currentSong = playList.value[playListIndex.value];
      console.log('[PlaylistStore] Current song before restore:', currentSong?.name);

      playList.value = [...originalPlayList.value];
      originalPlayList.value = [];

      if (currentSong) {
        const index = playList.value.findIndex((s) => s.id === currentSong.id);
        if (index !== -1) {
          playListIndex.value = index;
        }
      }
      console.log('[PlaylistStore] Original order restored, new index:', playListIndex.value);
    };

    const setPlayList = (
      list: SongResult[],
      keepIndex: boolean = false,

      preserveOrder: boolean = false
    ) => {
      if (list.length > 1) {
        const playerCore = usePlayerCoreStore();
        playerCore.isFmPlaying = false;
      }

      if (list.length === 0) {
        playList.value = [];
        playListIndex.value = 0;
        originalPlayList.value = [];
        return;
      }

      const playerCore = usePlayerCoreStore();
      const { playMusic } = storeToRefs(playerCore);

      if (preserveOrder) {
        console.log('Edit playlist in place, keeping given order');

        if (playMode.value === 2) {
          const idSet = new Set(list.map((song) => song.id));
          const reconciled = originalPlayList.value.filter((song) => idSet.has(song.id));
          const existingIds = new Set(reconciled.map((song) => song.id));
          for (const song of list) {
            if (!existingIds.has(song.id)) {
              reconciled.push(song);
            }
          }
          originalPlayList.value = reconciled;
        } else if (originalPlayList.value.length > 0) {
          originalPlayList.value = [];
        }

        const currentSong = playMusic.value;
        const currentIndex =
          currentSong && currentSong.id ? list.findIndex((song) => song.id === currentSong.id) : -1;
        playListIndex.value =
          currentIndex !== -1
            ? currentIndex
            : Math.min(Math.max(0, playListIndex.value), list.length - 1);

        playList.value = list;
      } else if (playMode.value === 2) {
        console.log('Set new playlist in random mode, save original order and shuffle');

        originalPlayList.value = [...list];

        const currentSong = playMusic.value;
        const shuffledList = performShuffle(list, currentSong);

        if (currentSong && currentSong.id) {
          const currentSongIndex = shuffledList.findIndex((song) => song.id === currentSong.id);
          playListIndex.value =
            currentSongIndex !== -1 ? 0 : keepIndex ? Math.max(0, playListIndex.value) : 0;
        } else {
          playListIndex.value = keepIndex ? Math.max(0, playListIndex.value) : 0;
        }

        playList.value = shuffledList;
      } else {
        console.log('order/Set up a new playlist in loop mode');
        if (originalPlayList.value.length > 0) {
          originalPlayList.value = [];
        }

        if (!keepIndex) {
          const foundIndex = list.findIndex((item) => item.id === playMusic.value.id);
          playListIndex.value = foundIndex !== -1 ? foundIndex : 0;
        }

        playList.value = list;
      }
    };

    const addToNextPlay = (song: SongResult) => {
      const list = [...playList.value];
      const currentIndex = playListIndex.value;

      const existingIndex = list.findIndex((item) => item.id === song.id);
      if (existingIndex !== -1) {
        list.splice(existingIndex, 1);
        if (existingIndex <= currentIndex) {
          playListIndex.value = Math.max(0, playListIndex.value - 1);
        }
      }

      const insertIndex = playListIndex.value + 1;
      list.splice(insertIndex, 0, song);

      setPlayList(list, true, true);
    };

    const removeFromPlayList = (id: number | string) => {
      const index = playList.value.findIndex((item) => item.id === id);
      if (index === -1) return;

      const playerCore = usePlayerCoreStore();
      const { playMusic } = storeToRefs(playerCore);

      if (id === playMusic.value.id) {
        nextPlay();
      }

      const newPlayList = [...playList.value];
      newPlayList.splice(index, 1);

      setPlayList(newPlayList, false, true);
    };

    const clearPlayAll = async () => {
      const { audioService } = await import('@/services/audioService');
      const playerCore = usePlayerCoreStore();

      audioService.pause();
      setTimeout(() => {
        playerCore.playMusic = {} as SongResult;
        playerCore.playMusicUrl = '';
        playList.value = [];
        playListIndex.value = 0;
        originalPlayList.value = [];

        localStorage.removeItem('currentPlayMusic');
        localStorage.removeItem('currentPlayMusicUrl');
      }, 500);
    };

    const togglePlayMode = async () => {
      const wasRandom = playMode.value === 2;

      const newMode = (playMode.value + 1) % 3;

      const isRandom = newMode === 2;

      console.log(`[PlaylistStore] togglePlayMode: ${playMode.value} -> ${newMode}`);
      playMode.value = newMode;

      if (isRandom && !wasRandom && playList.value.length > 0) {
        shufflePlayList();
        console.log('Switch to random mode and shuffle the playlist');
      }

      if (!isRandom && wasRandom) {
        restoreOriginalOrder();
        console.log('Switch out of random mode and restore original order');
      }
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

        if (playList.value.length === 0) return;

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
            'Playback error, possibly due to network issues or invalid source. Please switch playlist or try again later'
          );
          consecutiveFailCount.value = 0;
          playerCore.setIsPlay(false);
          return;
        }

        if (playMode.value === 0 && playListIndex.value >= playList.value.length - 1) {
          if (autoEnd) {
            console.log('[nextPlay] Sequential playback: After the last song is played, stop');
            if (sleepTimerStore.sleepTimer.type === 'end') {
              sleepTimerStore.stopPlayback();
            }
            getMessage().info('Reached the end of the playlist');
            playerCore.setIsPlay(false);
            const { audioService } = await import('@/services/audioService');
            audioService.pause();
          } else {
            console.log(
              '[nextPlay] Sequential playback: Already the last song, keep playing currently'
            );
            getMessage().info('Reached the end of the playlist');
          }
          return;
        }

        const nowPlayListIndex = (playListIndex.value + 1) % playList.value.length;
        const nextSong = { ...playList.value[nowPlayListIndex] };

        console.log(
          `[nextPlay] ${nextSong.name}, index: ${playListIndex.value} -> ${nowPlayListIndex}`
        );

        const { playTrack } = await import('@/services/playbackController');
        const success = await playTrack(nextSong, true);

        if (playerCore.playMusic.id !== nextSong.id) {
          console.log('[nextPlay] Replaced by new operation, exit silently');
          return;
        }

        if (success) {
          consecutiveFailCount.value = 0;
          playListIndex.value = nowPlayListIndex;
          console.log(`[nextPlay] Play successfully, index: ${nowPlayListIndex}`);
          sleepTimerStore.handleSongChange();
        } else {
          consecutiveFailCount.value++;
          console.log(
            `[nextPlay] Playback fails, skips directly, fails continuously: ${consecutiveFailCount.value}/${MAX_CONSECUTIVE_FAILS}`
          );
          if (playList.value.length > 1) {
            playListIndex.value = nowPlayListIndex;
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

        if (playList.value.length === 0) return;

        cancelRetryTimer();
        const nowPlayListIndex =
          (playListIndex.value - 1 + playList.value.length) % playList.value.length;
        const prevSong = { ...playList.value[nowPlayListIndex] };

        console.log(
          `[prevPlay] ${prevSong.name}, index: ${playListIndex.value} -> ${nowPlayListIndex}`
        );

        const { playTrack } = await import('@/services/playbackController');
        const success = await playTrack(prevSong);

        if (success) {
          playListIndex.value = nowPlayListIndex;
          console.log(`[prevPlay] Play successfully, index: ${nowPlayListIndex}`);
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

        const songIndex = playList.value.findIndex(
          (item: SongResult) => item.id === song.id && item.source === song.source
        );
        if (songIndex !== -1 && songIndex !== playListIndex.value) {
          console.log('Song index does not match, update to:', songIndex);
          playListIndex.value = songIndex;
        }

        const { playTrack } = await import('@/services/playbackController');
        const success = await playTrack(song);

        if (success) {
          playerCore.isPlay = true;
          if (songIndex !== -1) {
            preloadNextSongs(playListIndex.value);
          }
        }
        return success;
      } catch (error) {
        console.error('Setting playback failed:', error);
        return false;
      }
    };

    const initializePlaylist = async () => {
      if (playMode.value === 2 && playList.value.length > 0) {
        if (originalPlayList.value.length === 0) {
          console.log('After restarting, restore random play mode and reshuffle the playlist.');
          shufflePlayList();
        } else {
          console.log(
            'After restarting, the random play mode is restored, and the playlist is already in a shuffled state.'
          );
        }
      }
    };

    return {
      playList,
      playListIndex,
      playMode,
      originalPlayList,
      queueVisible,

      currentPlayList,
      currentPlayListIndex,

      setPlayList,
      addToNextPlay,
      removeFromPlayList,
      clearPlayAll,
      togglePlayMode,
      shufflePlayList,
      restoreOriginalOrder,
      preloadNextSongs,
      nextPlay: nextPlay as unknown as typeof _nextPlay,
      nextPlayOnEnd,
      prevPlay: prevPlay as unknown as typeof _prevPlay,
      setQueueVisible,
      setPlay,
      initializePlaylist,
      fetchSongs,
      updateSong: (song: SongResult) => {
        const index = playList.value.findIndex(
          (item) => item.id === song.id && item.source === song.source
        );
        if (index !== -1) {
          playList.value[index] = song;

          playList.value = [...playList.value];
        }
      }
    };
  },
  {
    persist: {
      key: 'queue-store',
      storage: debouncedLocalStorage,
      pick: ['playList', 'playListIndex', 'playMode', 'originalPlayList'],
      serializer: {
        serialize: (state: any) => {
          return JSON.stringify({
            ...state,
            playList: minifySongList(state.playList),
            originalPlayList: minifySongList(state.originalPlayList)
          });
        },
        deserialize: JSON.parse
      }
    }
  }
);
