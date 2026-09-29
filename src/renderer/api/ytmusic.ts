export interface YTMSong {
  id: string;
  title: string;
  artists: { name: string; id?: string }[];
  album?: string;
  duration?: string;
  thumbnail: string;
}

export interface YTMPlaylist {
  id: string;
  title: string;
  subtitle?: string;
  thumbnail: string;
}

export interface YTMSection {
  title: string;
  items: (YTMSong | YTMPlaylist)[];
}

export interface YTMPlaylistDetail {
  id: string;
  title: string;
  author?: string;
  description?: string;
  thumbnail?: string;
  songCount?: number;
  songs: YTMSong[];
}

export interface YTMArtistDetail {
  id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  subscriberCount?: string;
  albums: YTMPlaylist[];
  playlists: YTMPlaylist[];
  songs: YTMSong[];
}

export interface YTMHomePage {
  sections: YTMSection[];
}

export interface YTMChartsPage {
  sections: YTMSection[];
}

export interface YTMSearchResult {
  topResult?: YTMSong | YTMPlaylist;
  songs: YTMSong[];
  playlists: YTMPlaylist[];
  albums: YTMPlaylist[];
  artists: YTMPlaylist[];
  videos: YTMSong[];
  total: number;
}

export interface YTMSearchSuggestion {
  query: string;
  fromHistory: boolean;
}

export interface YTMMood {
  id: string;
  title: string;
  thumbnail: string;
}

export interface YTMStream {
  videoId: string;
  url: string;
  mimeType: string;
  bitrate: number;
  approxDurationMs: number;
  contentLength?: number;
  expiresInSeconds: number;
  title?: string;
  author?: string;
  thumbnail?: string;
  durationSeconds?: number;
  clientNameId: number;
}

export interface YTMStreamResult {
  success: boolean;
  data?: YTMStream;
  error?: string;
  attempts?: any[];
}

// ─── Tauri Bridge ─────────────────────────────────────────────────────────────

/**
 * Routes a YouTube Music channel to the Rust backend.
 *
 * Tauri has no `contextBridge`/preload layer, so the renderer talks to the
 * `#[tauri::command]` handlers in `src-tauri` directly through `window.api.invoke`.
 * Channels are validated against the bridge allowlist.
 */
function ipc<T>(channel: string, ...args: unknown[]): Promise<T> {
  if (typeof window === 'undefined' || !window.api) {
    return Promise.reject(new Error('IPC not available (Tauri bridge is not installed)'));
  }
  return window.api.invoke<T>(channel, ...args);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getYTMHome(cookie?: string): Promise<YTMHomePage> {
  const res = await ipc<{ success: boolean; data?: YTMHomePage; error?: string }>('ytm:home', cookie);
  if (!res.success) throw new Error(res.error || 'YTM home failed');
  return res.data!;
}

export async function getYTMCharts(cookie?: string): Promise<YTMChartsPage> {
  const res = await ipc<{ success: boolean; data?: YTMChartsPage; error?: string }>('ytm:charts', cookie);
  if (!res.success) throw new Error(res.error || 'YTM charts failed');
  return res.data!;
}

export async function searchYTM(
  query: string,
  filter?: 'songs' | 'videos' | 'albums' | 'artists' | 'playlists',
  cookie?: string
): Promise<YTMSearchResult> {
  const res = await ipc<{ success: boolean; data?: YTMSearchResult; error?: string }>('ytm:search', query, filter, cookie);
  if (!res.success) throw new Error(res.error || 'YTM search failed');
  return res.data!;
}

export async function getYTMSuggestions(
  query: string,
  cookie?: string
): Promise<YTMSearchSuggestion[]> {
  const res = await ipc<{ success: boolean; data?: YTMSearchSuggestion[]; error?: string }>('ytm:suggestions', query, cookie);
  if (!res.success) return [];
  return res.data || [];
}

export async function getYTMMoods(cookie?: string): Promise<YTMMood[]> {
  const res = await ipc<{ success: boolean; data?: YTMMood[]; error?: string }>('ytm:moods', cookie);
  if (!res.success) return [];
  return res.data || [];
}

/**
 * Resolve a playable audio stream for a YouTube / YouTube Music video id.
 * Delegates to the main process, which uses the InnerTube `/player` endpoint
 * with an un-cipher-capable client.
 */
export async function getYTMStream(
  videoId: string,
  cookie?: string
): Promise<YTMStream | null> {
  const res = await ipc<YTMStreamResult>('ytm:player', videoId, cookie);
  if (!res.success) {
    throw new Error(res.error || 'Failed to resolve YouTube stream');
  }
  return res.data ?? null;
}

export async function getYTMPlaylist(
  playlistId: string,
  cookie?: string
): Promise<YTMPlaylistDetail> {
  const res = await ipc<{ success: boolean; data?: YTMPlaylistDetail; error?: string }>('ytm:playlist', playlistId, cookie);
  if (!res.success) throw new Error(res.error || 'YTM playlist failed');
  return res.data!;
}

export async function getYTMArtist(
  artistId: string,
  cookie?: string
): Promise<YTMArtistDetail> {
  const res = await ipc<{ success: boolean; data?: YTMArtistDetail; error?: string }>('ytm:artist', artistId, cookie);
  if (!res.success) throw new Error(res.error || 'YTM artist failed');
  return res.data!;
}

/** Alias kept for callers that use the longer name. */
export const getYTMPlaylistDetail = getYTMPlaylist;

// ─── Type Guards ─────────────────────────────────────────────────────────────

export function isYTMSong(item: YTMSong | YTMPlaylist): item is YTMSong {
  return 'artists' in item;
}