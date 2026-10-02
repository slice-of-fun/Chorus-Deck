import { defineStore, storeToRefs } from 'pinia';
import { computed } from 'vue';

import { useFavoriteStore } from './favorite';
import { usePlayerCoreStore } from './playerCore';
import { cleanupLegacyPlayHistoryStorage } from './playHistory';
import { useQueueStore } from './queue';
import { type SleepTimerInfo, SleepTimerType, useSleepTimerStore } from './sleepTimer';

export { type SleepTimerInfo, SleepTimerType };
export { getSongUrl, loadLrc, useLyrics, useSongDetail, useSongUrl } from '@/hooks/usePlayerHooks';

export const usePlayerStore = defineStore('player', () => {
  const playerCore = usePlayerCoreStore();
  const playlist = useQueueStore();
  const favorite = useFavoriteStore();
  const sleepTimer = useSleepTimerStore();

  const {
    play,
    isPlay,
    playMusic,
    playMusicUrl,
    musicFull,
    playbackRate,
    volume,
    isMuted,
    userPlayIntent,
    isFmPlaying
  } = storeToRefs(playerCore);

  const {
    queueItems,
    queueIndex,
    playMode,
    repeatMode,
    shuffleEnabled,
    originalQueueItems,
    queueVisible
  } =
    storeToRefs(playlist);

  const { favoriteList, favoriteIds, dislikeList } = storeToRefs(favorite);

  const { sleepTimer: sleepTimerState, showSleepTimer } = storeToRefs(sleepTimer);

  const currentSong = computed(() => playerCore.currentSong);
  const isPlaying = computed(() => playerCore.isPlaying);
  const currentQueueItems = computed(() => playlist.currentQueueItems);
  const currentQueueIndex = computed(() => playlist.currentQueueIndex);

  const currentSleepTimer = computed(() => sleepTimer.currentSleepTimer);
  const hasSleepTimerActive = computed(() => sleepTimer.hasSleepTimerActive);
  const sleepTimerRemainingTime = computed(() => sleepTimer.sleepTimerRemainingTime);
  const sleepTimerRemainingSongs = computed(() => sleepTimer.sleepTimerRemainingSongs);

  const initializePlayState = async () => {
    cleanupLegacyPlayHistoryStorage();

    const { initializePlayState: initPlayState } = await import('@/services/playbackController');
    await initPlayState();
    await playlist.initializeQueue();
  };

  const initializeFavoriteList = () => {
    favorite.initializeFavoriteList();
  };

  return {
    play,
    isPlay,
    playMusic,
    playMusicUrl,
    musicFull,
    playbackRate,
    volume,
    isMuted,
    userPlayIntent,
    isFmPlaying,

    currentSong,
    isPlaying,

    setIsPlay: playerCore.setIsPlay,
    setMusicFull: playerCore.setMusicFull,
    setPlayMusic: playerCore.setPlayMusic,
    setPlaybackRate: playerCore.setPlaybackRate,
    setVolume: playerCore.setVolume,
    getVolume: playerCore.getVolume,
    increaseVolume: playerCore.increaseVolume,
    decreaseVolume: playerCore.decreaseVolume,
    setMuted: playerCore.setMuted,
    toggleMute: playerCore.toggleMute,
    handlePause: playerCore.handlePause,

    queueItems,
    queueIndex,
    playMode,
    repeatMode,
    shuffleEnabled,
    originalQueueItems,
    queueVisible,

    currentQueueItems,
    currentQueueIndex,

    setQueue: playlist.setQueue,
    addToNextPlay: playlist.addToNextPlay,
    addToQueue: playlist.addToQueue,
    moveInQueue: playlist.moveInQueue,
    removeFromQueue: playlist.removeFromQueue,
    clearPlayAll: playlist.clearPlayAll,
    togglePlayMode: playlist.togglePlayMode,
    toggleShuffle: playlist.toggleShuffle,
    toggleRepeat: playlist.toggleRepeat,
    shuffleQueue: playlist.shuffleQueue,
    restoreOriginalOrder: playlist.restoreOriginalOrder,
    preloadNextSongs: playlist.preloadNextSongs,
    nextPlay: playlist.nextPlay,
    prevPlay: playlist.prevPlay,
    setQueueVisible: playlist.setQueueVisible,
    setPlay: playlist.setPlay,

    favoriteList,
    favoriteIds,
    dislikeList,

    addToFavorite: favorite.addToFavorite,
    removeFromFavorite: favorite.removeFromFavorite,
    addToDislikeList: favorite.addToDislikeList,
    removeFromDislikeList: favorite.removeFromDislikeList,

    sleepTimer: sleepTimerState,
    showSleepTimer,

    currentSleepTimer,
    hasSleepTimerActive,
    sleepTimerRemainingTime,
    sleepTimerRemainingSongs,

    setSleepTimerByTime: sleepTimer.setSleepTimerByTime,
    setSleepTimerBySongs: sleepTimer.setSleepTimerBySongs,
    setSleepTimerAtPlaylistEnd: sleepTimer.setSleepTimerAtPlaylistEnd,
    clearSleepTimer: sleepTimer.clearSleepTimer,

    initializePlayState,
    initializeFavoriteList
  };
});
