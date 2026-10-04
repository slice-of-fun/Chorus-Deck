import { getYTMSuggestions, searchYTM, type YTMPlaylist, type YTMSong } from '@/api/ytmusic';
import type { SongResult } from '@/types/music';

import type { PlaylistResult, SearchFilter, SearchProvider, SearchResults } from '../provider';

const parseDurationToMs = (dur?: string): number => {
  if (!dur) return 0;
  const parts = dur.split(':').reverse();
  let ms = 0;
  if (parts[0]) ms += parseInt(parts[0], 10) * 1000;
  if (parts[1]) ms += parseInt(parts[1], 10) * 60000;
  if (parts[2]) ms += parseInt(parts[2], 10) * 3600000;
  return ms;
};

export const toSongResult = (s: YTMSong): SongResult => ({
  id: s.id,
  name: s.title,
  artists: s.artists.map((a) => ({ name: a.name, id: a.id })),
  album: s.album,
  picUrl: s.thumbnail,
  dt: parseDurationToMs(s.duration),
  source: 'ytmusic'
});

export const ytmProvider: SearchProvider = {
  id: 'ytmusic',
  name: 'YouTube Music',
  async search(params: {
    keywords: string;
    type?: SearchFilter;
    limit?: number;
    offset?: number;
  }): Promise<SearchResults> {
    const data = await searchYTM(params.keywords, params.type);

    const mapPlaylist = (
      p: YTMPlaylist,
      type: 'playlist' | 'album' | 'artist'
    ): PlaylistResult => ({
      id: p.id,
      name: p.title,
      picUrl: p.thumbnail,
      desc: p.subtitle || '',
      type,
      source: 'ytmusic'
    });

    let topResult: SongResult | PlaylistResult | undefined = undefined;
    if (data.topResult) {
      const isSong = 'artists' in data.topResult;
      if (isSong) {
        topResult = toSongResult(data.topResult as YTMSong);
      } else {
        const p = data.topResult as any;
        let type: 'playlist' | 'album' | 'artist' = 'playlist';
        if (p.resultType === 'Artist') type = 'artist';
        else if (p.resultType === 'Album' || p.resultType === 'Single' || p.resultType === 'EP') type = 'album';
        topResult = mapPlaylist(p, type);
      }
    }

    return {
      topResult,
      songs: (data.songs || []).map(toSongResult),
      playlists: (data.playlists || []).map((p) => mapPlaylist(p, 'playlist')),
      albums: (data.albums || []).map((p) => mapPlaylist(p, 'album')),
      artists: (data.artists || []).map((p) => mapPlaylist(p, 'artist')),
      videos: (data.videos || []).map(toSongResult)
    };
  },

  async getSuggestions(keyword: string): Promise<string[]> {
    if (!keyword || !keyword.trim()) return [];
    try {
      const suggestions = await getYTMSuggestions(keyword);
      return suggestions
        .map((s) => s.query)
        .filter((q): q is string => Boolean(q))
        .slice(0, 10);
    } catch (error) {
      console.warn('[YTM Provider] getSuggestions failed:', error);
      return [];
    }
  }
};
