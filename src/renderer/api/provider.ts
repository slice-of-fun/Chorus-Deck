import type { SongResult } from '@/types/music';
export type SearchFilter = 'songs' | 'videos' | 'albums' | 'artists' | 'playlists';
export interface PlaylistResult {
  id: string;
  name: string;
  picUrl: string;
  desc: string;
  type: 'playlist' | 'album' | 'artist';
  source: string;
}

export interface SearchResults {
  topResult?: SongResult | PlaylistResult;
  songs: SongResult[];
  playlists: PlaylistResult[];
  albums: PlaylistResult[];
  artists: PlaylistResult[];
  videos: SongResult[];
}

export interface SearchProvider {
  id: string;
  name: string;
  search(params: {
    keywords: string;
    type?: SearchFilter;
    limit?: number;
    offset?: number;
  }): Promise<SearchResults>;
  getSuggestions(keyword: string): Promise<string[]>;
}
