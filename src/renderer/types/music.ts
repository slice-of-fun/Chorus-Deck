export type Platform = 'ytmusic';

export const DEFAULT_PLATFORMS: Platform[] = ['ytmusic'];

export interface IWordData {
  text: string;
  startTime: number;
  duration: number;
  space?: boolean;
}

export interface ILyricText {
  text: string;
  trText: string;
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

/**
 * A single playable track.
 *
 * `id` is always the YouTube video id (11 characters) for streamed tracks, a
 * `local://` path for local files, or a local download id for downloaded files.
 * `ar`/`al`/`dt` are kept as optional legacy aliases so older components that
 * still read them keep working; prefer `artists`/`album`/`duration`.
 */
export interface SongResult {
  id: string;
  name: string;
  picUrl: string;
  artists?: Artist[];
  album?: string;

  /**
   * Short-form aliases kept for compatibility with older cached track objects;
   * prefer `artists`/`album`/`duration` in new code.
   */
  ar?: Artist[];
  al?: Album;
  /** Cover image used by some cache/playlist entry shapes. */
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
  source?: 'ytmusic' | 'local';

  /** YouTube video id backing this track. */
  videoId?: string;
  /** Mime type of the most recently resolved stream, e.g. `audio/mp4`. */
  mimeType?: string;
  expiredAt?: number;
  createdAt?: number;

  duration?: number;
  isFirstPlay?: boolean;
}
