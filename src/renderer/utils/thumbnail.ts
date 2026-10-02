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
      const dim = Math.min(parseInt(match[1]), 1600);
      if (url.includes('=w')) {
        return url.replace(/=w\d+-h\d+/, `=w${dim}-h${dim}`);
      } else {
        const base = url.split('=')[0];
        return `${base}=w${dim}-h${dim}-p-l90-rj`;
      }
    }
  }
  if (url.includes('i.ytimg.com')) {
    const cleanUrl = url.split('?')[0];
    const match = size.match(/^(\d+)y(\d+)$/);
    if (match) {
      const dim = parseInt(match[1]);
      if (dim > 700) {
        return cleanUrl.replace(/\/(sddefault|maxresdefault|mqdefault|hqdefault|default)\.(jpg|webp)/, '/maxresdefault.jpg');
      }
    }
    return cleanUrl;
  }

  // Handle NetEase images
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


