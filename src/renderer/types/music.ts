export type Platform = 'ytmusic' | 'spotify';

export const DEFAULT_PLATFORMS: Platform[] = ['ytmusic', 'spotify'];

export interface IWordData {
  text: string;
  startTime: number;
  duration: number;
  space?: boolean;
}

export interface ILyricText {
  text: string;
  trText: string;
  romaText?: string;
  words?: IWordData[];
  hasWordByWord?: boolean;
  startTime?: number;
  duration?: number;
}

export interface ILyric {
  lrcTimeArray: number[];
  lrcArray: ILyricText[];

  hasWordByWord?: boolean;
}

export interface Artist {
  id?: string;
  name: string;
}

export interface Album {
  id?: string;
  name: string;
  picUrl?: string;
}

export interface SongResult {
  id: string;
  name: string;
  picUrl: string;
  artists?: Artist[];
  album?: string;

  ar?: Artist[];
  al?: Album;
  coverImgUrl?: string;
  dt?: number;
  count?: number;

  playCount?: number;
  copywriter?: string;
  type?: number;
  canDislike?: boolean;
  tns?: string[];
  alia?: string[];

  playMusicUrl?: string;
  playLoading?: boolean;
  lyric?: ILyric;
  backgroundColor?: string;
  primaryColor?: string;
  source?: 'ytmusic' | 'local' | 'spotify';

  videoId?: string;
  mimeType?: string;
  streamUserAgent?: string;
  expiredAt?: number;
  createdAt?: number;
  urlRejectedAt?: number;

  duration?: number;
  isFirstPlay?: boolean;
}
