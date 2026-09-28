import { computed } from 'vue';

import { usePlayerStore } from '@/store/modules/player';

export function usePlayMode() {
  const playerStore = usePlayerStore();

  const playMode = computed(() => playerStore.playMode);

  const playModeIcon = computed(() => {
    switch (playMode.value) {
      case 0:
        return 'ri-repeat-2-line';
      case 1:
        return 'ri-repeat-one-line';
      case 2:
        return 'ri-shuffle-line';
      default:
        return 'ri-repeat-2-line';
    }
  });

  const playModeText = computed(() => {
    switch (playMode.value) {
      case 0:
        return 'Sequence';
      case 1:
        return 'Loop';
      case 2:
        return 'Random';
      default:
        return 'Sequence';
    }
  });

  const togglePlayMode = () => {
    playerStore.togglePlayMode();
  };

  return {
    playMode,
    playModeIcon,
    playModeText,
    togglePlayMode
  };
}
