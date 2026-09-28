import type { Artist, SongResult } from '@/types/music';

export type MinifiedSong = {
  id: SongResult['id'];
  name: SongResult['name'];
  picUrl: SongResult['picUrl'];
  ar: SongResult['ar'];

  al?: NonNullable<SongResult['al']>;
  source?: SongResult['source'];
  dt?: SongResult['dt'];
  playMusicUrl?: SongResult['playMusicUrl'];
};

export type MusicHistoryItem = MinifiedSong & {
  count: number;
  lastPlayTime?: number;
};

const stripDataUrl = (url: string | undefined): string =>
  !url || url.startsWith('data:') ? '' : url;

export const minifySong = (s: SongResult): MinifiedSong => {
  const artistList = s.ar?.length ? s.ar : s.artists;
  return {
    id: s.id,
    name: s.name,
    picUrl: stripDataUrl(s.picUrl),

    ar: (artistList?.map((a) => ({ id: a.id, name: a.name })) ?? []) as Artist[],

    al: (s.al?.id
      ? {
          id: s.al.id,
          name: s.al.name,
          picUrl: stripDataUrl(s.al.picUrl)
        }
      : undefined) as MinifiedSong['al'],
    source: s.source,
    dt: s.dt,
    playMusicUrl: s.playMusicUrl?.startsWith('local://') ? s.playMusicUrl : undefined
  };
};

export const minifySongList = (list: SongResult[] | undefined): MinifiedSong[] =>
  list?.map(minifySong) ?? [];

export const minifyHistoryEntry = (
  s: SongResult & { count?: number; lastPlayTime?: number }
): MusicHistoryItem => ({
  ...minifySong(s),

  count: s.count ?? 1,
  lastPlayTime: s.lastPlayTime
});

export const minifyHistoryList = (
  list: (SongResult & { count?: number; lastPlayTime?: number })[] | undefined
): MusicHistoryItem[] => list?.map(minifyHistoryEntry) ?? [];

const PIC_KEYS = ['picUrl', 'coverImgUrl', 'coverUrl'] as const;

export const stripBase64Covers = <T extends Record<string, any>>(item: T): T => {
  const result: Record<string, any> = { ...item };
  for (const key of PIC_KEYS) {
    const value = result[key];
    if (typeof value === 'string' && value.startsWith('data:')) {
      result[key] = '';
    }
  }
  return result as T;
};

export const stripBase64CoversList = <T extends Record<string, any>>(list: T[] | undefined): T[] =>
  list?.map(stripBase64Covers) ?? [];
