import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { getLocalStorageItem, setLocalStorageItem } from '@/utils/playerUtils';

export enum SleepTimerType {
  NONE = 'none',
  TIME = 'time',
  SONGS = 'songs',
  PLAYLIST_END = 'end'
}

export interface SleepTimerInfo {
  type: SleepTimerType;
  value: number;
  endTime?: number;
  startSongIndex?: number;
  remainingSongs?: number;
}

export const useSleepTimerStore = defineStore('sleepTimer', () => {
  const sleepTimer = ref<SleepTimerInfo>(
    getLocalStorageItem('sleepTimer', {
      type: SleepTimerType.NONE,
      value: 0
    })
  );
  const showSleepTimer = ref(false);
  const timerInterval = ref<number | null>(null);

  const currentSleepTimer = computed(() => sleepTimer.value);
  const hasSleepTimerActive = computed(() => sleepTimer.value.type !== SleepTimerType.NONE);

  const sleepTimerRemainingTime = computed(() => {
    if (sleepTimer.value.type === SleepTimerType.TIME && sleepTimer.value.endTime) {
      const remaining = Math.max(0, sleepTimer.value.endTime - Date.now());
      return Math.ceil(remaining / 60000);
    }
    return 0;
  });

  const sleepTimerRemainingSongs = computed(() => {
    if (sleepTimer.value.type === SleepTimerType.SONGS) {
      return sleepTimer.value.remainingSongs || 0;
    }
    return 0;
  });

  const setSleepTimerByTime = (minutes: number) => {
    clearSleepTimer();

    if (minutes <= 0) {
      return false;
    }

    const endTime = Date.now() + minutes * 60 * 1000;

    sleepTimer.value = {
      type: SleepTimerType.TIME,
      value: minutes,
      endTime
    };

    setLocalStorageItem('sleepTimer', sleepTimer.value);

    timerInterval.value = window.setInterval(() => {
      checkSleepTimer();
    }, 1000) as unknown as number;

    console.log(`Set a timer to shut down: ${minutes}minutes later`);
    return true;
  };

  const setSleepTimerBySongs = async (songs: number) => {
    clearSleepTimer();

    if (songs <= 0) {
      return false;
    }

    const { usePlaylistStore } = await import('./playlist');
    const playlistStore = usePlaylistStore();

    sleepTimer.value = {
      type: SleepTimerType.SONGS,
      value: songs,
      startSongIndex: playlistStore.playListIndex,
      remainingSongs: songs
    };

    setLocalStorageItem('sleepTimer', sleepTimer.value);

    console.log(`Set a timer to shut down: Play again${songs}after song`);
    return true;
  };

  const setSleepTimerAtPlaylistEnd = () => {
    clearSleepTimer();

    sleepTimer.value = {
      type: SleepTimerType.PLAYLIST_END,
      value: 0
    };

    setLocalStorageItem('sleepTimer', sleepTimer.value);

    console.log('Set a timer to shut down: when playlist ends');
    return true;
  };

  const clearSleepTimer = () => {
    if (timerInterval.value) {
      window.clearInterval(timerInterval.value);
      timerInterval.value = null;
    }

    sleepTimer.value = {
      type: SleepTimerType.NONE,
      value: 0
    };

    setLocalStorageItem('sleepTimer', sleepTimer.value);

    console.log('Cancel scheduled shutdown');
    return true;
  };

  const checkSleepTimer = () => {
    if (sleepTimer.value.type === SleepTimerType.NONE) {
      return;
    }

    if (sleepTimer.value.type === SleepTimerType.TIME && sleepTimer.value.endTime) {
      if (Date.now() >= sleepTimer.value.endTime) {
        stopPlayback();
      }
    }
  };

  const stopPlayback = async () => {
    console.log('Timer triggers: Stop playing');

    const { usePlayerCoreStore } = await import('./playerCore');
    const playerCore = usePlayerCoreStore();
    const { audioService } = await import('@/services/audioService');

    if (playerCore.isPlaying) {
      playerCore.setIsPlay(false);
      audioService.pause();
    }

    // Use Tauri api bridge for notification instead of electron
    if (window.api) {
      window.api.send('show-notification', {
        title: 'Sleep timer ended',
        body: 'Music playback stopped'
      });
    }

    clearSleepTimer();
  };

  const handleSongChange = async () => {
    console.log('Song has been switched, check timer status:', sleepTimer.value);

    if (
      sleepTimer.value.type === SleepTimerType.SONGS &&
      sleepTimer.value.remainingSongs !== undefined
    ) {
      sleepTimer.value.remainingSongs--;
      console.log(`Number of songs remaining: ${sleepTimer.value.remainingSongs}`);

      setLocalStorageItem('sleepTimer', sleepTimer.value);

      if (sleepTimer.value.remainingSongs <= 0) {
        console.log('The set number of songs has been played, stop playing.');
        stopPlayback();
        setTimeout(() => {
          stopPlayback();
        }, 1000);
      }
    }

    if (sleepTimer.value.type === SleepTimerType.PLAYLIST_END) {
      const { usePlaylistStore } = await import('./playlist');
      const playlistStore = usePlaylistStore();

      const isLastSong = playlistStore.playListIndex === playlistStore.playList.length - 1;

      if (isLastSong && playlistStore.playMode !== 1) {
        console.log('End of playlist reached, will stop after current song ends');
        sleepTimer.value = {
          type: SleepTimerType.SONGS,
          value: 1,
          remainingSongs: 1
        };
        setLocalStorageItem('sleepTimer', sleepTimer.value);
      }
    }
  };

  const setShowSleepTimer = (value: boolean) => {
    showSleepTimer.value = value;
  };

  const restoreTimerInterval = () => {
    if (sleepTimer.value.type !== SleepTimerType.TIME || !sleepTimer.value.endTime) {
      return;
    }
    if (Date.now() >= sleepTimer.value.endTime) {
      stopPlayback();
      return;
    }
    if (!timerInterval.value) {
      timerInterval.value = window.setInterval(() => {
        checkSleepTimer();
      }, 1000) as unknown as number;
    }
  };

  restoreTimerInterval();

  return {
    sleepTimer,
    showSleepTimer,

    currentSleepTimer,
    hasSleepTimerActive,
    sleepTimerRemainingTime,
    sleepTimerRemainingSongs,

    setSleepTimerByTime,
    setSleepTimerBySongs,
    setSleepTimerAtPlaylistEnd,
    clearSleepTimer,
    checkSleepTimer,
    stopPlayback,
    handleSongChange,
    setShowSleepTimer
  };
});
