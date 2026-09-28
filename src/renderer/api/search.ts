import { searchYTM, getYTMSuggestions, type YTMPlaylist, type YTMSong } from '@/api/ytmusic';

export type SearchFilter = 'songs' | 'videos' | 'albums' | 'artists' | 'playlists';

const parseDurationToMs = (dur?: string): number => {
  if (!dur) return 0;
  const parts = dur.split(':').reverse();
  let ms = 0;
  if (parts[0]) ms += parseInt(parts[0], 10) * 1000;
  if (parts[1]) ms += parseInt(parts[1], 10) * 60000;
  if (parts[2]) ms += parseInt(parts[2], 10) * 3600000;
  return ms;
};

export const toSongResult = (s: YTMSong) => ({
  id: s.id,
  name: s.title,
  artists: s.artists.map((a) => ({ name: a.name, id: a.id })),
  album: s.album,
  picUrl: s.thumbnail,
  dt: parseDurationToMs(s.duration),
  source: 'ytmusic' as const
});

export interface YtmSearchResults {
  songs: YTMSong[];
  playlists: YTMPlaylist[];
  albums: YTMPlaylist[];
  artists: YTMPlaylist[];
  videos: YTMSong[];
}

/**
 * YouTube Music is the only search provider.
 */
export const getSearch = async (params: {
  keywords: string;
  type?: SearchFilter;
  limit?: number;
  offset?: number;
}): Promise<{ data: YtmSearchResults }> => {
  const data = await searchYTM(params.keywords, params.type);
  return { data };
};

export const getSearchSuggestions = async (keyword: string): Promise<string[]> => {
  if (!keyword || !keyword.trim()) return [];

  try {
    const suggestions = await getYTMSuggestions(keyword);
    return suggestions
      .map((s) => s.query)
      .filter((q): q is string => Boolean(q))
      .slice(0, 10);
  } catch (error) {
    console.warn('[API] getSearchSuggestions failed:', error);
    return [];
  }
};
