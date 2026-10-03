import type { AppUpdateState } from '@shared/appUpdate';
import type {
  CompletedDownload,
  DownloadBatchCompleteEvent,
  DownloadProgressEvent,
  DownloadRequestUrlEvent,
  DownloadStateChangeEvent,
  DownloadTask
} from '@shared/download';
import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { listen as tauriListen, type UnlistenFn } from '@tauri-apps/api/event';

import type { LocalMusicMeta } from '@/types/localMusic';

const GENERIC_INVOKE_CHANNELS = [
  'change-language',
  'check-file-exists',
  'clear-disk-cache',
  'get-cached-lyric',
  'get-content-zoom',
  'get-disk-cache-config',
  'get-disk-cache-stats',
  'get-downloads-path',
  'get-platform',
  'get-store-value',
  'get-system-fonts',
  'select-directory',
  'select-file',
  'save-file',
  'set-disk-cache-config',
  'set-store-value',
  'switch-disk-cache-directory',
  'clear-discord-presence',
  'discord-logout',
  'discord-webview-login',
  'discord-refresh-token',
  'discord-gateway-status',
  'open-directory',
  'restart',
  'set-content-zoom',
  'show-notification',
  'tray-lyric-update',
  'update-discord-presence',
  'update-play-state',
  'set-ignore-mouse',
  'set-lyric-lock-state',
  'lyric-ready',
  'close-lyric',
  'lyric-drag-start',
  'lyric-drag-move',
  'lyric-drag-end',
  'control-back',
  'ytm:request',
  'ytm:validate-stream',
  'fetch_best_lyrics'
] as const;

const EVENT_CHANNELS = [
  'global-shortcut',
  'mpris-pause',
  'mpris-play',
  'mpris-seek',
  'mpris-set-position',
  'mpris-next',
  'mpris-previous',
  'update-app-shortcuts',
  'receive-lyric',
  'lyric-mouse-presence',
  'lyric-window-closed',
  'lyric-window-ready',
  'app-update:state',
  'language-changed',
  'download:progress',
  'download:state-change',
  'download:batch-complete',
  'download:request-url',
  'playback-progress',
  'playback-ended'
] as const;

export type Unlisten = () => void;

export type DiscordGatewayStatus = {
  connected: boolean;
  lastError?: string | null;
  lastChangeAt?: number | null;
};

const listenerRegistry = new Map<string, Set<UnlistenFn>>();

async function rawInvoke<T>(channel: string, args?: unknown): Promise<T> {
  console.debug(`[bridge] rawInvoke ${channel}`, args);
  return tauriInvoke<T>(channel, args as Record<string, unknown> | undefined);
}

function assertAllowed(channel: string, allowed: readonly string[]): void {
  if (!allowed.includes(channel)) {
    throw new Error(`Blocked bridge channel: ${channel}`);
  }
}

function listenChannel<T>(channel: string, handler: (payload: T) => void): Unlisten {
  assertAllowed(channel, EVENT_CHANNELS);

  const bucket = listenerRegistry.get(channel) ?? new Set<UnlistenFn>();
  let inner: UnlistenFn | null = null;
  let disposed = false;

  void tauriListen<T>(channel, (event) => handler(event.payload)).then((dispose) => {
    if (disposed) {
      dispose();
      return;
    }
    inner = dispose;
    bucket.add(dispose);
    listenerRegistry.set(channel, bucket);
  });

  return () => {
    if (disposed) return;
    disposed = true;
    if (inner) {
      inner();
      bucket.delete(inner);
      inner = null;
    }
  };
}

export const bridge = {
  minimize: () => rawInvoke<void>('minimize-window'),
  maximize: () => rawInvoke<void>('maximize-window'),
  close: () => rawInvoke<void>('close-window'),
  quitApp: () => rawInvoke<void>('quit-app'),
  restore: () => rawInvoke<void>('restore-window'),
  restart: () => rawInvoke<void>('restart'),
  dragStart: (data: unknown) => rawInvoke<void>('drag-start', { data }),
  resizeWindow: (width: number, height: number) =>
    rawInvoke<void>('resize-window', { width, height }),
  setMiniConstraints: (entering: boolean) =>
    rawInvoke<void>('set-mini-constraints', { entering }),
  miniTray: () => rawInvoke<void>('mini-tray'),
  miniWindow: () => rawInvoke<void>('mini-window'),

  openLyric: () => rawInvoke<void>('open-lyric'),
  sendLyric: (data: unknown) => rawInvoke<void>('send-lyric', { data }),
  onLyricWindowClosed: (callback: () => void) => {
    void listenChannel<void>('lyric-window-closed', () => callback());
  },
  onLyricWindowReady: (callback: () => void) => {
    void listenChannel<void>('lyric-window-ready', () => callback());
  },

  sendSong: (data: unknown) => rawInvoke<void>('update-current-song', { data }),
  updatePlayState: (isPlaying: boolean) => rawInvoke<void>('update-play-state', { isPlaying }),
  setContentZoom: (zoom: number) => rawInvoke<void>('set-content-zoom', { zoom }),
  getContentZoom: () => rawInvoke<number>('get-content-zoom'),

  getStoreValue: (key: string) => rawInvoke<unknown>('get-store-value', { key }),
  setStoreValue: (key: string, value: unknown) =>
    rawInvoke<void>('set-store-value', { key, value }),

  invoke: <T = unknown>(channel: string, ...args: unknown[]): Promise<T> => {
    assertAllowed(channel, GENERIC_INVOKE_CHANNELS);
    return rawInvoke<T>(channel, args.length === 1 ? args[0] : { args });
  },

  send: <T = unknown>(channel: string, ...args: unknown[]): Promise<T> => {
    assertAllowed(channel, GENERIC_INVOKE_CHANNELS);
    return rawInvoke<T>(channel, args.length === 1 ? args[0] : { args });
  },

  on: <T = unknown>(channel: string, handler: (payload: T) => void): Unlisten =>
    listenChannel<T>(channel, handler),

  removeListener: <T = unknown>(channel: string, handler?: (payload: T) => void) => {
    if (handler) {
      for (const dispose of listenerRegistry.get(channel) ?? []) {
        dispose();
      }
    }
    listenerRegistry.delete(channel);
  },

  removeAllListeners: (channel: string) => {
    for (const dispose of listenerRegistry.get(channel) ?? []) {
      dispose();
    }
    listenerRegistry.delete(channel);
  },

  getAppUpdateState: () => rawInvoke<AppUpdateState>('app-update:get-state'),
  checkAppUpdate: (manual = false) => rawInvoke<AppUpdateState>('app-update:check', { manual }),
  downloadAppUpdate: () => rawInvoke<AppUpdateState>('app-update:download'),
  installAppUpdate: () => rawInvoke<boolean>('app-update:quit-and-install'),
  openAppUpdatePage: () => rawInvoke<boolean>('app-update:open-release-page'),
  onAppUpdateState: (callback: (state: AppUpdateState) => void) => {
    void listenChannel<AppUpdateState>('app-update:state', (state) => callback(state));
  },
  removeAppUpdateListeners: () => {
    for (const dispose of listenerRegistry.get('app-update:state') ?? []) dispose();
    listenerRegistry.delete('app-update:state');
  },

  onLanguageChanged: (callback: (locale: string) => void) => {
    void listenChannel<string>('language-changed', (locale) => callback(locale));
  },

  downloadAdd: (task: unknown) => rawInvoke<string>('download:add', { task }),
  downloadAddBatch: (tasks: unknown) =>
    rawInvoke<{ batchId: string; taskIds: string[] }>('download:add-batch', { tasks }),
  downloadPause: (taskId: string) => rawInvoke<void>('download:pause', { taskId }),
  downloadResume: (taskId: string) => rawInvoke<void>('download:resume', { taskId }),
  downloadCancel: (taskId: string) => rawInvoke<void>('download:cancel', { taskId }),
  downloadCancelAll: () => rawInvoke<void>('download:cancel-all'),
  downloadGetQueue: () => rawInvoke<DownloadTask[]>('download:get-queue'),
  downloadSetConcurrency: (n: number) => rawInvoke<void>('download:set-concurrency', { n }),
  downloadGetCompleted: () => rawInvoke<CompletedDownload[]>('download:get-completed'),
  downloadDeleteCompleted: (filePath: string) =>
    rawInvoke<boolean>('download:delete-completed', { filePath }),
  downloadClearCompleted: () => rawInvoke<boolean>('download:clear-completed'),
  getEmbeddedLyrics: (filePath: string) =>
    rawInvoke<string | null>('download:get-embedded-lyrics', { filePath }),
  downloadProvideUrl: (taskId: string, url: string) =>
    rawInvoke<void>('download:provide-url', { taskId, url }),
  onDownloadProgress: (cb: (data: DownloadProgressEvent) => void) => {
    listenChannel<DownloadProgressEvent>('download:progress', cb);
  },
  onDownloadStateChange: (cb: (data: DownloadStateChangeEvent) => void) => {
    listenChannel<DownloadStateChangeEvent>('download:state-change', cb);
  },
  onDownloadBatchComplete: (cb: (data: DownloadBatchCompleteEvent) => void) => {
    listenChannel<DownloadBatchCompleteEvent>('download:batch-complete', cb);
  },
  onDownloadRequestUrl: (cb: (data: DownloadRequestUrlEvent) => void) => {
    listenChannel<DownloadRequestUrlEvent>('download:request-url', cb);
  },
  removeDownloadListeners: () => {
    for (const channel of [
      'download:progress',
      'download:state-change',
      'download:batch-complete',
      'download:request-url'
    ]) {
      for (const dispose of listenerRegistry.get(channel) ?? []) dispose();
      listenerRegistry.delete(channel);
    }
  },

  scanLocalMusic: (folderPath: string) =>
    rawInvoke<{ files: string[]; count: number }>('scan-local-music', { folderPath }),
  scanLocalMusicWithStats: (folderPath: string) =>
    rawInvoke<{ files: { path: string; modifiedTime: number }[]; count: number }>(
      'scan-local-music-with-stats',
      { folderPath }
    ),
  parseLocalMusicMetadata: (filePaths: string[]) =>
    rawInvoke<LocalMusicMeta[]>('parse-local-music-metadata', { filePaths }),
  dbGetTrack: (id: string) => rawInvoke<unknown>('db_get_track', { id }),
  dbGetLikedTracks: () => rawInvoke<string[]>('db_get_liked_tracks'),
  dbAddLikedTrack: (trackId: string) => rawInvoke<void>('db_add_liked_track', { trackId }),
  dbAddDislikedTrack: (trackId: string) => rawInvoke<void>('db_add_disliked_track', { trackId }),
  dbGetTop50Tracks: () => rawInvoke<unknown[]>('db_get_top_50_tracks'),
  dbGetDownloadedTracksFull: () => rawInvoke<unknown[]>('db_get_downloaded_tracks_full'),
  dbExportUserData: (exportPath: string) => rawInvoke<void>('db_export_user_data', { exportPath }),
  dbGetFollowedArtists: () => rawInvoke<unknown[]>('db_get_followed_artists'),
  dbFollowArtist: (artistId: string, artistName: string, artworkUrl?: string) => rawInvoke<void>('db_follow_artist', { artistId, artistName, artworkUrl }),
  dbUnfollowArtist: (artistId: string) => rawInvoke<void>('db_unfollow_artist', { artistId }),
  dbTrackPlayed: (trackId: string, playedAt: number) =>
    rawInvoke<void>('db_track_played', { trackId, playedAt }),
  dbStorePlaylist: (id: string, name: string, description: string) =>
    rawInvoke<void>('db_store_playlist', { id, name, description }),
  dbAddTrackToPlaylist: (playlistId: string, trackId: string, trackIndex: number) =>
    rawInvoke<void>('db_add_track_to_playlist', { playlistId, trackId, trackIndex }),
  dbRemoveTrackFromPlaylist: (playlistId: string, trackId: string) =>
    rawInvoke<void>('db_remove_track_from_playlist', { playlistId, trackId }),
  dbGetTracksInPlaylist: (playlistId: string) =>
    rawInvoke<unknown[]>('db_get_tracks_in_playlist', { playlistId }),
  dbGetAllPlaylists: () => rawInvoke<unknown[]>('db_get_all_playlists'),
  dbSaveLocalMusic: (entry: LocalMusicMeta & { id: string }) =>
    rawInvoke<void>('db_save_local_music', { entry }),
  dbGetAllLocalMusic: () =>
    rawInvoke<(LocalMusicMeta & { id: string })[]>('db_get_all_local_music'),
  dbDeleteLocalMusic: (id: string) => rawInvoke<void>('db_delete_local_music', { id }),
  dbClearLocalMusic: () => rawInvoke<void>('db_clear_local_music'),
  getSystemAccentColor: () => rawInvoke<string | null>('get-system-accent-color'),
  getSystemFonts: () => rawInvoke<string[]>('get-system-fonts'),
  selectDirectory: (title?: string) => rawInvoke<string | null>('select-directory', { title }),
  selectFile: (title?: string) => rawInvoke<string | null>('select-file', { title }),
  saveFile: (title?: string, defaultName?: string) => rawInvoke<string | null>('save-file', { title, defaultName }),
  openDirectory: (path: string) => rawInvoke<void>('open-directory', { path }),
  getDownloadsPath: () => rawInvoke<string>('get-downloads-path'),
  getPlatform: () => rawInvoke<string>('get-platform'),
  checkFileExists: (path: string) => rawInvoke<boolean>('check-file-exists', { path }),
  showNotification: (title: string, body: string) =>
    rawInvoke<void>('show-notification', { title, body }),
  unblockMusic: (id: number, data: unknown, enabledSources?: string[]) =>
    rawInvoke<unknown>('unblock-music', { id, data, enabledSources }),
  getCachedLyric: (key: string) => rawInvoke<unknown>('get-cached-lyric', { key }),
  getLyrics: (payload: unknown) => rawInvoke<unknown>('get-lyrics', { payload }),
  clearLyricsCache: () => rawInvoke<void>('clear-lyrics-cache'),
  clearLyricCache: () => rawInvoke<void>('clear-lyric-cache'),
  cacheLyric: (key: string, value: unknown) => rawInvoke<void>('cache-lyric', { key, value }),
  fetchBestLyrics: (title: string, artist: string, videoId?: string) =>
    rawInvoke<any>('fetch_best_lyrics', { title, artist, videoId }),
  clearDiskCache: () => rawInvoke<void>('clear-disk-cache'),
  getDiskCacheConfig: () => rawInvoke<unknown>('get-disk-cache-config'),
  setDiskCacheConfig: (config: unknown) => rawInvoke<void>('set-disk-cache-config', { config }),
  getDiskCacheStats: () => rawInvoke<unknown>('get-disk-cache-stats'),
  switchDiskCacheDirectory: (path: string) =>
    rawInvoke<void>('switch-disk-cache-directory', { path }),
  changeLanguage: (locale: string) => rawInvoke<void>('change-language', { locale }),
  discordLogout: () => rawInvoke<void>('discord-logout'),
  updateDiscordPresence: (presence: unknown) =>
    rawInvoke<void>('update-discord-presence', { presence }),
  clearDiscordPresence: () => rawInvoke<void>('clear-discord-presence'),
  refreshDiscordToken: (refreshToken: string) =>
    rawInvoke<{ token: string; refreshToken?: string; expiresIn?: number }>(
      'discord-refresh-token',
      { refreshToken }
    ),
  discordGatewayStatus: () =>
    rawInvoke<DiscordGatewayStatus>('discord-gateway-status'),
  trayLyricUpdate: (data: unknown) => rawInvoke<void>('tray-lyric-update', { data }),

  onPlaybackProgress: (cb: (timeSecs: number) => void) => {
    listenChannel<number>('playback-progress', cb);
  },
  onPlaybackEnded: (cb: () => void) => {
    listenChannel<void>('playback-ended', cb);
  },

  audioPlay: (
    url: string,
    cookie?: string,
    durationMs?: number,
    container?: string,
    userAgent?: string
  ) => rawInvoke<void>('audio-play', { url, cookie, durationMs, container, userAgent }),
  audioPause: () => rawInvoke<void>('audio-pause'),
  audioResume: () => rawInvoke<void>('audio-resume'),
  audioStop: () => rawInvoke<void>('audio-stop'),
  audioSetVolume: (volume: number) => rawInvoke<void>('audio-set-volume', { volume }),
  audioSeek: (timeSecs: number) => rawInvoke<void>('audio-seek', { timeSecs }),
  audioGetTime: () => rawInvoke<number>('audio-get-time'),
  audioGetDuration: () => rawInvoke<number | null>('audio-get-duration'),
  audioSetEqBypass: (bypass: boolean) => rawInvoke<void>('audio-set-eq-bypass', { bypass }),
  audioSetEqBand: (frequency: number, gain: number) =>
    rawInvoke<void>('audio-set-eq-band', { frequency, gain }),
  audioSetPlaybackRate: (rate: number) => rawInvoke<void>('audio-set-playback-rate', { rate }),
  audioClearCache: () => rawInvoke<void>('audio-clear-cache'),

  spotifyLogin: (clientId: string) => rawInvoke<string>('integrations:spotify-login', { clientId }),
  spotifyExchangeToken: (code: string, clientId: string, clientSecret: string) =>
    rawInvoke<any>('integrations:spotify-exchange-token', { code, clientId, clientSecret }),
  spotifyFetchPlaylists: (accessToken: string) =>
    rawInvoke<any>('integrations:spotify-fetch-playlists', { accessToken }),
  spotifyFetchPlaylistTracks: (accessToken: string, playlistId: string, offset: number, limit: number) =>
    rawInvoke<any>('integrations:spotify-fetch-playlist-tracks', { accessToken, playlistId, offset, limit }),
  parsePlaylistUrl: (url: string) => rawInvoke<any>('integrations:parse-playlist-url', { url }),
  dbImportPlaylist: (id: string, name: string, description: string, tracks: { id: string; title: string; artist: string; durationMs: number }[]) =>
    rawInvoke<void>('db_import_playlist', { id, name, description, tracks })
};

export type Bridge = typeof bridge;

declare global {
  interface Window {
    api: Bridge;
    $message: unknown;
  }
}

export function installBridge(): void {
  if (typeof window === 'undefined') return;
  window.api = bridge;
}

installBridge();
