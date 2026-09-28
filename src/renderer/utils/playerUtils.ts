import type { SongResult } from '@/types/music';

export function getLocalStorageItem<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function setLocalStorageItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Failed to save to localStorage: ${key}`, error);
  }
}

export const isBilibiliIdMatch = (id1: string | number, id2: string | number): boolean => {
  const str1 = String(id1);
  const str2 = String(id2);

  if (!str1.includes('--') && !str2.includes('--')) {
    return str1 === str2;
  }

  if (str1.includes('--') || str2.includes('--')) {
    const extractBvIdAndCid = (str: string) => {
      if (!str.includes('--')) return { bvid: '', cid: '' };
      const parts = str.split('--');
      if (parts.length >= 3) {
        return { bvid: parts[0], cid: parts[2] };
      } else if (parts.length === 2) {
        return { bvid: '', cid: parts[1] };
      }
      return { bvid: '', cid: '' };
    };

    const { bvid: bvid1, cid: cid1 } = extractBvIdAndCid(str1);
    const { bvid: bvid2, cid: cid2 } = extractBvIdAndCid(str2);

    if (bvid1 && bvid2) {
      return bvid1 === bvid2 && cid1 === cid2;
    }

    if (cid1 && cid2) {
      return cid1 === cid2;
    }
  }

  return str1 === str2;
};

export const performShuffle = (list: SongResult[], currentSong?: SongResult): SongResult[] => {
  if (list.length <= 1) return [...list];

  const result: SongResult[] = [];
  const remainingSongs = [...list];

  if (currentSong && currentSong.id) {
    const currentSongIndex = remainingSongs.findIndex((song) => song.id === currentSong.id);
    if (currentSongIndex !== -1) {
      result.push(remainingSongs.splice(currentSongIndex, 1)[0]);
    }
  }

  if (remainingSongs.length > 0) {
    for (let i = remainingSongs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [remainingSongs[i], remainingSongs[j]] = [remainingSongs[j], remainingSongs[i]];
    }

    result.push(...remainingSongs);
  }

  return result;
};

export const preloadCoverImage = (
  picUrl: string,
  getImgUrl: (url: string, size: string) => string
) => {
  if (!picUrl) return;

  try {
    const imageUrl = getImgUrl(picUrl, '500y500');
    console.log('Preload cover image:', imageUrl);

    const img = new Image();
    img.src = imageUrl;

    img.onload = () => {
      console.log('Cover image preloaded successfully:', imageUrl);
    };

    img.onerror = () => {
      console.error('Cover image preload failed:', imageUrl);
    };
  } catch (error) {
    console.error('Error preloading cover image:', error);
  }
};
