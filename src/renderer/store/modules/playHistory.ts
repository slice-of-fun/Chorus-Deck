import { defineStore } from 'pinia';
import { ref } from 'vue';

import type { SongResult } from '@/types/music';
import { debouncedLocalStorage, flushDebouncedStorage } from '@/utils/debouncedStorage';
import type { MusicHistoryItem } from '@/utils/persistedSong';
import {
  minifyHistoryEntry,
  minifyHistoryList,
  stripBase64CoversList
} from '@/utils/persistedSong';

export type { MusicHistoryItem };

const LEGACY_KEYS = [
  'albumHistory',

  'playHistory-migrated',

  'playMode'
];

export const cleanupLegacyPlayHistoryStorage = (): void => {
  if (localStorage.getItem('playHistory-cleaned-v1')) return;
  LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
  localStorage.setItem('playHistory-cleaned-v1', '1');
};

export type PlaylistHistoryItem = {
  id: string | number;
  name: string;
  coverImgUrl?: string;
  picUrl?: string;
  trackCount?: number;
  playCount?: number;
  creator?: {
    nickname: string;
    userId: number;
  };
  count?: number;
  lastPlayTime?: number;
};

export type AlbumHistoryItem = {
  id: number;
  name: string;
  picUrl?: string;
  size?: number;
  artist?: {
    name: string;
    id: number;
  };
  count?: number;
  lastPlayTime?: number;
};



const MAX_HISTORY_SIZE = 500;

const PERSIST_KEY = 'play-history-store';

type PersistedPlayHistoryState = {
  musicHistory: MusicHistoryItem[];
  playlistHistory: PlaylistHistoryItem[];
  albumHistory: AlbumHistoryItem[];
};

const serializePlayHistoryState = (state: any): string => {
  const s = state as PersistedPlayHistoryState;
  return JSON.stringify({
    ...state,
    musicHistory: minifyHistoryList(
      s.musicHistory as unknown as (SongResult & {
        count?: number;
        lastPlayTime?: number;
      })[]
    ),
    playlistHistory: stripBase64CoversList(s.playlistHistory),
    albumHistory: stripBase64CoversList(s.albumHistory)
  });
};

export const usePlayHistoryStore = defineStore(
  'playHistory',
  () => {
    const musicHistory = ref<MusicHistoryItem[]>([]);
    const playlistHistory = ref<PlaylistHistoryItem[]>([]);
    const albumHistory = ref<AlbumHistoryItem[]>([]);

    const addMusic = (music: SongResult): void => {
      const index = musicHistory.value.findIndex((item) => item.id === music.id);

      let next: MusicHistoryItem[];
      if (index !== -1) {
        const existing = musicHistory.value[index];
        const refreshed: MusicHistoryItem = {
          ...minifyHistoryEntry(music),
          count: (existing.count || 0) + 1,
          lastPlayTime: Date.now()
        };
        next = [
          refreshed,
          ...musicHistory.value.slice(0, index),
          ...musicHistory.value.slice(index + 1)
        ];
      } else {
        next = [
          minifyHistoryEntry({ ...music, count: 1, lastPlayTime: Date.now() }),
          ...musicHistory.value
        ];
      }
      musicHistory.value = next.length > MAX_HISTORY_SIZE ? next.slice(0, MAX_HISTORY_SIZE) : next;
    };

    const delMusic = (music: { id: SongResult['id'] }): void => {
      const index = musicHistory.value.findIndex((item) => item.id === music.id);
      if (index !== -1) {
        musicHistory.value.splice(index, 1);
      }
    };


    const addPlaylist = (playlist: PlaylistHistoryItem): void => {
      const index = playlistHistory.value.findIndex((item) => item.id === playlist.id);
      const now = Date.now();
      let next: PlaylistHistoryItem[];
      if (index !== -1) {
        const existing = playlistHistory.value[index];
        next = [
          { ...existing, count: (existing.count || 0) + 1, lastPlayTime: now },
          ...playlistHistory.value.slice(0, index),
          ...playlistHistory.value.slice(index + 1)
        ];
      } else {
        next = [{ ...playlist, count: 1, lastPlayTime: now }, ...playlistHistory.value];
      }
      playlistHistory.value =
        next.length > MAX_HISTORY_SIZE ? next.slice(0, MAX_HISTORY_SIZE) : next;
    };

    const delPlaylist = (playlist: PlaylistHistoryItem): void => {
      const index = playlistHistory.value.findIndex((item) => item.id === playlist.id);
      if (index !== -1) {
        playlistHistory.value.splice(index, 1);
      }
    };

    const addAlbum = (album: AlbumHistoryItem): void => {
      const index = albumHistory.value.findIndex((item) => item.id === album.id);
      const now = Date.now();
      let next: AlbumHistoryItem[];
      if (index !== -1) {
        const existing = albumHistory.value[index];
        next = [
          { ...existing, count: (existing.count || 0) + 1, lastPlayTime: now },
          ...albumHistory.value.slice(0, index),
          ...albumHistory.value.slice(index + 1)
        ];
      } else {
        next = [{ ...album, count: 1, lastPlayTime: now }, ...albumHistory.value];
      }
      albumHistory.value = next.length > MAX_HISTORY_SIZE ? next.slice(0, MAX_HISTORY_SIZE) : next;
    };

    const delAlbum = (album: AlbumHistoryItem): void => {
      const index = albumHistory.value.findIndex((item) => item.id === album.id);
      if (index !== -1) {
        albumHistory.value.splice(index, 1);
      }
    };


    const clearMusicHistory = (): void => {
      musicHistory.value = [];
    };

    const clearPlaylistHistory = (): void => {
      playlistHistory.value = [];
    };

    const clearAlbumHistory = (): void => {
      albumHistory.value = [];
    };

    const clearAll = (): void => {
      clearMusicHistory();
      clearPlaylistHistory();
      clearAlbumHistory();

      flushDebouncedStorage();
      try {
        localStorage.setItem(
          PERSIST_KEY,
          serializePlayHistoryState({
            musicHistory: [],
            playlistHistory: [],
            albumHistory: []
          })
        );
      } catch (error) {
        console.error('[PlayHistory] Failed to clear disk:', error);
      }
    };

    return {
      musicHistory,
      playlistHistory,
      albumHistory,

      addMusic,
      delMusic,
      clearMusicHistory,

      addPlaylist,
      delPlaylist,
      clearPlaylistHistory,

      addAlbum,
      delAlbum,
      clearAlbumHistory,

      clearAll
    };
  },
  {
    persist: {
      key: PERSIST_KEY,

      storage: debouncedLocalStorage,
      pick: [
        'musicHistory',
        'playlistHistory',
        'albumHistory'
      ],

      serializer: {
        serialize: serializePlayHistoryState,
        deserialize: JSON.parse
      }
    }
  }
);
