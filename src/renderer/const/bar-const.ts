import type { SearchFilter } from '@/api/provider';

export const SEARCH_TYPES: { label: string; key: SearchFilter }[] = [
  {
    label: 'Songs',
    key: 'songs'
  },
  {
    label: 'Videos',
    key: 'videos'
  },
  {
    label: 'Albums',
    key: 'albums'
  },
  {
    label: 'Artists',
    key: 'artists'
  },
  {
    label: 'Playlists',
    key: 'playlists'
  }
];

export const SEARCH_TYPE = {
  MUSIC: 'songs',
  VIDEO: 'videos',
  ALBUM: 'albums',
  ARTIST: 'artists',
  PLAYLIST: 'playlists'
} as const satisfies Record<string, SearchFilter>;
