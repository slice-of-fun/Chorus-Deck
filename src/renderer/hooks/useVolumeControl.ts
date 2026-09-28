import { computed } from 'vue';

import { usePlayerStore } from '@/store/modules/player';

export function useVolumeControl() {
  const playerStore = usePlayerStore();

  const isMuted = computed(() => playerStore.isMuted);

  const volumeSlider = computed({
    get: () => playerStore.volume * 100,
    set: (value: number) => {
      playerStore.setVolume(value / 100);
    }
  });

  const volumeIcon = computed(() => {
    if (playerStore.isMuted || playerStore.volume === 0) return 'ri-volume-mute-line';
    if (playerStore.volume <= 0.5) return 'ri-volume-down-line';
    return 'ri-volume-up-line';
  });

  const mute = () => {
    playerStore.toggleMute();
  };

  const handleVolumeWheel = (e: WheelEvent) => {
    const delta = e.deltaY < 0 ? 5 : -5;
    const newValue = Math.min(Math.max(volumeSlider.value + delta, 0), 100);
    volumeSlider.value = newValue;
  };

  return {
    isMuted,
    volumeSlider,
    volumeIcon,
    mute,
    handleVolumeWheel
  };
}
