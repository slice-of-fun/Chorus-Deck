import { computed } from 'vue';

import { playMusic } from '@/hooks/MusicHook';
import { usePlayerStore } from '@/store/modules/player';

export function usePlaybackControl() {
  const playerStore = usePlayerStore();

  const isPlaying = computed(() => playerStore.isPlay);

  const playMusicEvent = async () => {
    try {
      await playerStore.setPlay({ ...playMusic.value });
    } catch (error) {
      console.error('Playback error:', error);
      playerStore.nextPlay();
    }
  };

  const handleNext = () => {
    playerStore.nextPlay();
  };

  const handlePrev = () => {
    playerStore.prevPlay();
  };

  return {
    isPlaying,
    playMusicEvent,
    handleNext,
    handlePrev
  };
}
