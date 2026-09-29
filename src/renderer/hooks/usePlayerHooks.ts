import { playbackRequestManager } from '@/services/playbackRequestManager';
import type { ILyric, ILyricText, IWordData, SongResult } from '@/types/music';
import { isDesktop } from '@/utils';
import { parseLyrics as parseYrcLyrics } from '@/utils/yrcParser';

export type ResolvedStream = {
  url: string;
  mimeType: string;
  videoId: string;
  isLocal: boolean;
};

/**
 * Resolves a playable URL for a track, preferring already-resolved URLs and
 * falling back to YouTube Music stream extraction.
 */
export const getSongStream = async (
  id: string | number,
  songData: SongResult,
  isDownloaded: boolean = false,
  requestId?: string
): Promise<ResolvedStream> => {
  if (requestId && !playbackRequestManager.isRequestValid(requestId)) {
    throw new Error('Request cancelled');
  }

  // Local files already carry a playable URL.
  if (songData.playMusicUrl?.startsWith('local://')) {
    return { url: songData.playMusicUrl, mimeType: '', videoId: String(id), isLocal: true };
  }

  // A still-valid resolved URL can be reused as-is.
  if (songData.playMusicUrl && !isDownloaded) {
    const expired = songData.expiredAt ? songData.expiredAt < Date.now() : false;
    if (!expired) {
      return {
        url: songData.playMusicUrl,
        mimeType: songData.mimeType || '',
        videoId: songData.videoId || String(id),
        isLocal: false
      };
    }
  }

  const { resolveYTMusicStream } = await import('@/services/ytmusicStream');
  const stream = await resolveYTMusicStream(songData);

  if (requestId && !playbackRequestManager.isRequestValid(requestId)) {
    throw new Error('Request cancelled');
  }

  return {
    url: stream.url,
    mimeType: stream.mimeType,
    videoId: stream.videoId,
    isLocal: false
  };
};

export const getSongUrl = async (
  id: string | number,
  songData: SongResult,
  isDownloaded: boolean = false,
  requestId?: string
): Promise<string | null> => {
  const stream = await getSongStream(id, songData, isDownloaded, requestId);
  return stream.url;
};

export const useSongUrl = () => {
  return { getSongUrl, getSongStream };
};

const parseLyrics = (lyricsString: string): { lyrics: ILyricText[]; times: number[] } => {
  if (!lyricsString || typeof lyricsString !== 'string') {
    return { lyrics: [], times: [] };
  }

  try {
    const parseResult = parseYrcLyrics(lyricsString);

    if (!parseResult.success) {
      console.error('Lyrics parsing failed:', parseResult.error.message);
      return { lyrics: [], times: [] };
    }

    const { lyrics: parsedLyrics } = parseResult.data;
    const lyrics: ILyricText[] = [];
    const times: number[] = [];

    for (const line of parsedLyrics) {
      const hasWords = line.words && line.words.length > 0;

      lyrics.push({
        text: line.fullText,
        trText: '',
        words: hasWords ? (line.words as IWordData[]) : undefined,
        hasWordByWord: hasWords,
        startTime: line.startTime,
        duration: line.duration
      });

      times.push(line.startTime / 1000);
    }

    return { lyrics, times };
  } catch (error) {
    console.error('An error occurred while parsing lyrics:', error);
    return { lyrics: [], times: [] };
  }
};

export const loadLrc = async (id: string | number): Promise<ILyric> => {
  try {
    let lyricData: any;

    // Use window.api for Tauri bridge instead of window.electron.ipcRenderer
    try {
      lyricData = await window.api.invoke('get-cached-lyric', id);
    } catch (error) {
      console.warn('Failed to read disk lyrics cache:', error);
    }

    const data = lyricData ?? {};
    const { lyrics, times } = parseLyrics(data?.yrc?.lyric || data?.lrc?.lyric);

    let hasWordByWord = false;
    for (const lyric of lyrics) {
      if (lyric.hasWordByWord) {
        hasWordByWord = true;
        break;
      }
    }

    if (data.tlyric && data.tlyric.lyric) {
      const { lyrics: tLyrics } = parseLyrics(data.tlyric.lyric);

      if (tLyrics.length === lyrics.length) {
        lyrics.forEach((item, index) => {
          item.trText = item.text && tLyrics[index] ? tLyrics[index].text : '';
        });
      } else {
        const tLyricMap = new Map<number, string>();
        tLyrics.forEach((lyric) => {
          if (lyric.text && lyric.startTime !== undefined) {
            const timeInSeconds = lyric.startTime / 1000;
            tLyricMap.set(timeInSeconds, lyric.text);
          }
        });

        lyrics.forEach((item, index) => {
          if (!item.text) {
            item.trText = '';
            return;
          }

          const currentTime = times[index];
          let closestTime = -1;
          let minDiff = 2.0;

          for (const [tTime] of tLyricMap.entries()) {
            const diff = Math.abs(tTime - currentTime);
            if (diff < minDiff) {
              minDiff = diff;
              closestTime = tTime;
            }
          }

          item.trText = closestTime !== -1 ? tLyricMap.get(closestTime) || '' : '';
        });
      }
    } else {
      lyrics.forEach((item) => {
        item.trText = '';
      });
    }

    return {
      lrcTimeArray: times,
      lrcArray: lyrics,
      hasWordByWord
    };
  } catch (err) {
    console.error('Error loading lyrics:', err);
    return {
      lrcTimeArray: [],
      lrcArray: [],
      hasWordByWord: false
    };
  }
};

export const useLyrics = () => {
  return { loadLrc, parseLyrics };
};

export const useSongDetail = () => {
  const getSongDetail = async (playMusic: SongResult, requestId?: string) => {
    if (requestId && !playbackRequestManager.isRequestValid(requestId)) {
      console.log(`[getSongDetail] The request has expired: ${requestId}`);
      throw new Error('Request cancelled');
    }

    if (playMusic.expiredAt && playMusic.expiredAt < Date.now()) {
      if (!playMusic.playMusicUrl?.startsWith('local://')) {
        console.info(`The song has expired, please retrieve it again: ${playMusic.name}`);
        playMusic.playMusicUrl = undefined;
      }
    }

    try {
      const playMusicUrl =
        playMusic.playMusicUrl || (await getSongUrl(playMusic.id, playMusic, false, requestId));

      if (requestId && !playbackRequestManager.isRequestValid(requestId)) {
        console.log(`[getSongDetail] URLThe request has expired after getting it: ${requestId}`);
        throw new Error('Request cancelled');
      }

      playMusic.createdAt = Date.now();

      playMusic.expiredAt = playMusic.createdAt + 1800000;

      playMusic.playLoading = false;

      return { ...playMusic, playMusicUrl } as SongResult;
    } catch (error) {
      if ((error as Error).message === 'Request cancelled') {
        throw error;
      }
      console.error('Get audioURLfail:', error);
      playMusic.playLoading = false;
      throw error;
    }
  };

  return { getSongDetail };
};
