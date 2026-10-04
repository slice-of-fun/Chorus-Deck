/**
 * thumbnail.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for every cover / thumbnail URL in Chorus Deck.
 *
 * Why a separate file?
 *   Sizes were scattered across dozens of components, each hardcoding a
 *   different pixel spec.  This module centralises the sizing logic so that:
 *     • Full-player cards request 1000×1000  (was 500×500 → blurry on HiDPI)
 *     • Search / detail views request 800×800  (was 400×400)
 *     • List rows / mini bars stay at 100×100  (already fine)
 *     • Colour-extraction probes stay at 30×30  (intentionally tiny)
 *
 * Usage:
 *   import { thumbPlayer, thumbList, thumbSearch, thumbTiny } from '@/utils/thumbnail';
 *
 *   // in a template
 *   :src="thumbPlayer(playMusic?.picUrl)"
 *
 *   // anywhere a raw URL is needed
 *   const url = thumbPlayer(song.picUrl);
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const getImgUrl = (url: string | undefined, size: string = '') => {
  if (!url) return '';

  if (url.startsWith('data:') || url.startsWith('local://')) return url;

  if (url.includes('thumbnail')) {
    return url.replace(/thumbnail=\d+y\d+(?!.*thumbnail)/, `thumbnail=${size}`);
  }

  if (url.includes('googleusercontent.com') || url.includes('yt3.ggpht.com')) {
    const match = size.match(/^(\d+)y(\d+)$/);
    if (match) {
      const dim = Math.min(parseInt(match[1]), 544);
      let newUrl = url;
      if (newUrl.match(/[=-]w\d+-h\d+/)) {
        newUrl = newUrl.replace(/([=-])w\d+-h\d+/, `$1w${dim}-h${dim}`);
      } else if (newUrl.match(/[=-]s\d+/)) {
        newUrl = newUrl.replace(/([=-])s\d+/, `$1s${dim}`);
      } else {
        const base = newUrl.split('=')[0];
        newUrl = `${base}=w${dim}-h${dim}-l90-rj`;
      }
      return newUrl.replace(/-p([^a-zA-Z0-9]|$)/, '$1');
    }
  }
  if (url.includes('i.ytimg.com')) {
    const cleanUrl = url.split('?')[0];
    return cleanUrl.replace(/\/(sddefault|maxresdefault|hqdefault|default)\.(jpg|webp)/, '/mqdefault.jpg');
  }

  if (url.includes('music.126.net')) {
    const base = url.split('?')[0];
    return `${base}?param=${size}`;
  }

  if (url.includes('?')) return url;

  return `${url}?param=${size}`;
};

const PLAYER_SIZE = '1600y1600';

const SEARCH_SIZE = '800y800';
const LIST_SIZE = '100y100';
const TINY_SIZE = '30y30';
export const thumbPlayer = (picUrl: string | undefined | null): string =>
  getImgUrl(picUrl ?? undefined, PLAYER_SIZE);

export const thumbSearch = (picUrl: string | undefined | null): string =>
  getImgUrl(picUrl ?? undefined, SEARCH_SIZE);

export const thumbList = (picUrl: string | undefined | null): string =>
  getImgUrl(picUrl ?? undefined, LIST_SIZE);

export const thumbTiny = (picUrl: string | undefined | null): string =>
  getImgUrl(picUrl ?? undefined, TINY_SIZE);


