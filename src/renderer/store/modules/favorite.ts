import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import type { SongResult } from '@/types/music';
import { getLocalStorageItem, setLocalStorageItem } from '@/utils/playerUtils';

export type FavoriteId = string;

const FAVORITES_KEY = 'favorite-list-store';
const DISLIKES_KEY = 'dislike-list-store';

/**
 * Favorites keep the full track rather than an id, because there is no
 * catalog service to re-resolve a bare id against.
 */
const readFavorites = (): SongResult[] => {
  const stored = getLocalStorageItem<SongResult[]>(FAVORITES_KEY, []);
  return Array.isArray(stored) ? stored.filter((song) => song && typeof song.id === 'string') : [];
};

const readDislikes = (): FavoriteId[] => {
  const stored = getLocalStorageItem<FavoriteId[]>(DISLIKES_KEY, []);
  return Array.isArray(stored) ? stored.filter((id) => typeof id === 'string') : [];
};

export const useFavoriteStore = defineStore('favorite', () => {
  const favoriteList = ref<SongResult[]>(readFavorites());
  const dislikeList = ref<FavoriteId[]>(readDislikes());

  const favoriteIds = computed(() => favoriteList.value.map((song) => song.id));

  const persistFavorites = () => {
    setLocalStorageItem(FAVORITES_KEY, favoriteList.value);
  };

  const addToFavorite = (song: SongResult) => {
    if (!song?.id) return;
    if (favoriteList.value.some((existing) => existing.id === song.id)) return;

    favoriteList.value.unshift(song);
    persistFavorites();
  };

  const removeFromFavorite = (id: FavoriteId) => {
    favoriteList.value = favoriteList.value.filter((song) => song.id !== id);
    persistFavorites();
  };

  const addToDislikeList = (id: FavoriteId) => {
    if (!id || dislikeList.value.includes(id)) return;

    dislikeList.value.push(id);
    setLocalStorageItem(DISLIKES_KEY, dislikeList.value);
  };

  const removeFromDislikeList = (id: FavoriteId) => {
    dislikeList.value = dislikeList.value.filter((existing) => existing !== id);
    setLocalStorageItem(DISLIKES_KEY, dislikeList.value);
  };

  const initializeFavoriteList = () => {
    persistFavorites();
  };

  const isFavorite = (id: FavoriteId): boolean => favoriteList.value.some((s) => s.id === id);

  const isDisliked = (id: FavoriteId): boolean => dislikeList.value.includes(id);

  return {
    favoriteList,
    favoriteIds,
    dislikeList,

    addToFavorite,
    removeFromFavorite,
    addToDislikeList,
    removeFromDislikeList,
    initializeFavoriteList,
    isFavorite,
    isDisliked
  };
});
