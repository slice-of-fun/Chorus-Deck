import type { LocalMusicEntry, LocalMusicMeta } from '@/types/localMusic';
import { SUPPORTED_AUDIO_FORMATS } from '@/types/localMusic';
import type { ILyric, ILyricText, IWordData, SongResult } from '@/types/music';
import { parseLyrics as parseYrcLyrics } from '@/utils/yrcParser';

import { filePathToLocalUrl } from '../../shared/localUrl';

export { filePathToLocalUrl };

export function isSupportedAudioFormat(filePath: string): boolean {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  return (SUPPORTED_AUDIO_FORMATS as readonly string[]).includes(ext);
}

export function extractTitleFromFilename(filePath: string): string {
  const separator = filePath.includes('\\') ? '\\' : '/';
  const filename = filePath.split(separator).pop() || filePath;

  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex > 0) {
    return filename.slice(0, dotIndex);
  }
  return filename;
}

export function buildFallbackMeta(filePath: string): LocalMusicMeta {
  return {
    filePath,
    title: extractTitleFromFilename(filePath),
    artist: 'unknown artist',
    album: 'unknown album',
    duration: 0,
    coverPath: null,
    lyrics: null,
    fileSize: 0,
    modifiedTime: 0
  };
}

export function parseLrcToILyric(lrcString: string | null): ILyric | null {
  if (!lrcString || typeof lrcString !== 'string') {
    return null;
  }

  try {
    const parseResult = parseYrcLyrics(lrcString);
    if (!parseResult.success) {
      return null;
    }

    const { lyrics: parsedLyrics } = parseResult.data;
    const lrcArray: ILyricText[] = [];
    const lrcTimeArray: number[] = [];
    let hasWordByWord = false;

    for (const line of parsedLyrics) {
      const hasWords = line.words && line.words.length > 0;
      if (hasWords) hasWordByWord = true;

      lrcArray.push({
        text: line.fullText,
        trText: '',
        words: hasWords ? (line.words as IWordData[]) : undefined,
        hasWordByWord: hasWords,
        startTime: line.startTime,
        duration: line.duration
      });

      lrcTimeArray.push(line.startTime / 1000);
    }

    if (lrcArray.length === 0) {
      return null;
    }

    return { lrcTimeArray, lrcArray, hasWordByWord };
  } catch {
    return null;
  }
}

export function toSongResult(entry: LocalMusicEntry): SongResult {
  const lyric = parseLrcToILyric(entry.lyrics);

  const coverUrl = entry.coverPath ? filePathToLocalUrl(entry.coverPath) : '';

  return {
    id: entry.id,
    name: entry.title,
    picUrl: coverUrl,
    ar: [{ name: entry.artist }],
    artists: [{ name: entry.artist }],
    al: { name: entry.album, picUrl: coverUrl },
    album: entry.album,
    playMusicUrl: filePathToLocalUrl(entry.filePath),
    duration: entry.duration,
    dt: entry.duration,
    source: 'local' as const,

    lyric: lyric ?? undefined,

    createdAt: Date.now(),
    expiredAt: Date.now() + 365 * 24 * 60 * 60 * 1000
  };
}

export function filterByKeyword(list: LocalMusicEntry[], keyword: string): LocalMusicEntry[] {
  if (!keyword || keyword.trim() === '') {
    return list;
  }
  const lowerKeyword = keyword.toLowerCase();
  return list.filter((entry) => {
    return (
      entry.title.toLowerCase().includes(lowerKeyword) ||
      entry.artist.toLowerCase().includes(lowerKeyword)
    );
  });
}

export function getChangedFiles(
  files: { path: string; modifiedTime: number }[],
  cached: LocalMusicEntry[]
): string[] {
  const cachedMap = new Map<string, number>();
  for (const entry of cached) {
    cachedMap.set(entry.filePath, entry.modifiedTime);
  }

  return files
    .filter((file) => {
      const cachedTime = cachedMap.get(file.path);

      return cachedTime === undefined || cachedTime !== file.modifiedTime;
    })
    .map((file) => file.path);
}

export function removeStaleEntries(
  entries: LocalMusicEntry[],
  existsMap: Record<string, boolean>
): LocalMusicEntry[] {
  return entries.filter((entry) => existsMap[entry.filePath] === true);
}
