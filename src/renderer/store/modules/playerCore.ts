import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';

import { audioService } from '@/services/audioService';
import type { AudioOutputDevice } from '@/types/audio';
import type { SongResult } from '@/types/music';
import { debouncedLocalStorage } from '@/utils/debouncedStorage';
import { minifySong } from '@/utils/persistedSong';

export const usePlayerCoreStore = defineStore(
  'playerCore',
  () => {
    const play = ref(false);
    const isPlay = ref(false);
    const playMusic = ref<SongResult>({} as SongResult);
    const playMusicUrl = ref('');
    const musicFull = ref(false);
    const playbackRate = ref(1.0);
    const volume = ref(1);
    const isMuted = ref(false);
    const userPlayIntent = ref(false);
    const isFmPlaying = ref(false);

    const audioOutputDeviceId = ref<string>(
      localStorage.getItem('audioOutputDeviceId') || 'default'
    );
    const availableAudioDevices = ref<AudioOutputDevice[]>([]);

    const currentSong = computed(() => playMusic.value);
    const isPlaying = computed(() => isPlay.value);

    const setIsPlay = (value: boolean) => {
      isPlay.value = value;
      play.value = value;
      window.api.send('update-play-state', value);
    };

    const setMusicFull = (value: boolean) => {
      musicFull.value = value;
    };

    const setPlaybackRate = (rate: number) => {
      playbackRate.value = rate;
      audioService.setPlaybackRate(rate);
    };

    const setVolume = (newVolume: number) => {
      const normalizedVolume = Math.max(0, Math.min(1, newVolume));
      volume.value = normalizedVolume;

      if (isMuted.value && normalizedVolume > 0) {
        isMuted.value = false;
      }
      audioService.setVolume(isMuted.value ? 0 : normalizedVolume);
    };

    const setMuted = (value: boolean) => {
      if (isMuted.value === value) return;
      isMuted.value = value;
      audioService.setVolume(isMuted.value ? 0 : volume.value);
    };

    const toggleMute = () => {
      setMuted(!isMuted.value);
    };

    const getVolume = () => volume.value;

    const increaseVolume = (step: number = 0.1) => {
      const newVolume = Math.min(1, volume.value + step);
      setVolume(newVolume);
      return newVolume;
    };

    const decreaseVolume = (step: number = 0.1) => {
      const newVolume = Math.max(0, volume.value - step);
      setVolume(newVolume);
      return newVolume;
    };

    const handlePause = async () => {
      try {
        audioService.pause();
        setPlayMusic(false);
        userPlayIntent.value = false;
      } catch (error) {
        console.error('Failed to pause playback:', error);
      }
    };

    const setPlayMusic = async (value: boolean | SongResult) => {
      if (typeof value === 'boolean') {
        setIsPlay(value);
        userPlayIntent.value = value;
      } else {
        const { playTrack } = await import('@/services/playbackController');
        await playTrack(value);
        play.value = true;
        isPlay.value = true;
        userPlayIntent.value = true;
      }
    };

    const refreshAudioDevices = async () => {
      availableAudioDevices.value = await audioService.getAudioOutputDevices();
    };

    const setAudioOutputDevice = async (deviceId: string): Promise<boolean> => {
      const success = await audioService.setAudioOutputDevice(deviceId);
      if (success) {
        audioOutputDeviceId.value = deviceId;
      }
      return success;
    };

    const initAudioDeviceListener = () => {
      if (navigator.mediaDevices) {
        navigator.mediaDevices.addEventListener('devicechange', async () => {
          await refreshAudioDevices();
          const exists = availableAudioDevices.value.some(
            (d) => d.deviceId === audioOutputDeviceId.value
          );
          if (!exists && audioOutputDeviceId.value !== 'default') {
            await setAudioOutputDevice('default');
          }
        });
      }
    };

    // Discord Rich Presence Integration
    watch(
      [playMusic, isPlay],
      ([newSong, newIsPlay]) => {
        if (window.api) {
          if (newSong && newSong.name) {
            const artist = newSong.ar?.map((a: any) => a.name).join(' / ') || 'Unknown Artist';
            const album = newSong.al?.name || 'Unknown Album';
            const albumArt = newSong.al?.picUrl || 'chorus_logo';
            const songId = newSong.id || '';
            const artistId = newSong.ar?.[0]?.id || '';
            const albumId = newSong.al?.id || '';
            window.api
              .audioGetTime()
              .then((time) => {
                const currentTime = time * 1000;
                const currentDur = audioService.getDuration();
                const duration = currentDur > 0 ? currentDur * 1000 : newSong.dt || 0;

                let startTimestamp = undefined;
                if (newIsPlay) {
                  startTimestamp = Date.now() - currentTime;
                }

                window.api.send('update-discord-presence', {
                  title: newSong.name,
                  artist: artist,
                  album: album,
                  albumArt: albumArt,
                  songId,
                  artistId,
                  albumId,
                  duration: duration,
                  isPlaying: newIsPlay,
                  startTimestamp
                });
              })
              .catch(() => {
                window.api.send('clear-discord-presence');
              });
          } else {
            window.api.send('clear-discord-presence');
          }
        }
      },
      { deep: true }
    );

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
      audioOutputDeviceId,
      availableAudioDevices,

      currentSong,
      isPlaying,

      setIsPlay,
      setMusicFull,
      setPlayMusic,
      setPlaybackRate,
      setVolume,
      getVolume,
      increaseVolume,
      decreaseVolume,
      setMuted,
      toggleMute,
      handlePause,
      refreshAudioDevices,
      setAudioOutputDevice,
      initAudioDeviceListener
    };
  },
  {
    persist: {
      key: 'player-core-store',

      storage: debouncedLocalStorage,
      pick: [
        'playMusic',
        'playMusicUrl',
        'playbackRate',
        'volume',
        'isMuted',
        'isPlay',
        'audioOutputDeviceId'
      ],

      serializer: {
        serialize: (state: any) =>
          JSON.stringify({
            ...state,
            playMusic: state.playMusic?.id ? minifySong(state.playMusic as SongResult) : {}
          }),
        deserialize: JSON.parse
      }
    }
  }
);
