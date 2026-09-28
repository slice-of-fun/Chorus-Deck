import { computed } from 'vue';

import { playMusic } from '@/hooks/MusicHook';
import { usePlayerStore } from '@/store/modules/player';

export function useFavorite() {
  const playerStore = usePlayerStore();

  const isFavorite = computed(() => {
    if (!playMusic?.value?.id) return false;
    return playerStore.favoriteIds.includes(playMusic.value.id);
  });

  const toggleFavorite = (e?: Event) => {
    e?.stopPropagation();
    if (!playMusic?.value?.id) return;

    const favoriteId = playMusic.value.id;
    if (isFavorite.value) {
      playerStore.removeFromFavorite(favoriteId);
    } else {
      playerStore.addToFavorite(playMusic.value);
    }
  };

  return {
    isFavorite,
    toggleFavorite
  };
}
