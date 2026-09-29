import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { listen as tauriListen, type UnlistenFn } from '@tauri-apps/api/event';

import type {
  CompletedDownload,
  DownloadBatchCompleteEvent,
  DownloadProgressEvent,
  DownloadRequestUrlEvent,
  DownloadStateChangeEvent,
  DownloadTask
} from '@shared/download';
import type { AppUpdateState } from '@shared/appUpdate';
import type { LocalMusicMeta } from '@/types/localMusic';

/**
 * Thin adapter over the Tauri v2 command/event system.
 *
 * The renderer was originally written against Electron's `ipcRenderer`, which
 * exposes three different shapes: `invoke` (request/response), `send`
 * (fire-and-forget) and `on`/`removeListener` (events). Tauri has only
 * `invoke` and `listen`, so this module normalises the old call sites onto the
 * Tauri primitives instead of forcing a churn of edits across ~120 usages.
 */

/** Channels the renderer is allowed to reach through the generic escape hatch. */
const GENERIC_INVOKE_CHANNELS = [
  'change-language',
  'check-file-exists',
  'clear-disk-cache',
  'discord-webview-login',
  'get-cached-lyric',
  'get-content-zoom',
  'get-disk-cache-config',
  'get-disk-cache-stats',
  'get-downloads-path',
  'get-platform',
  'get-store-value',
  'get-system-fonts',
  'select-directory',
  'set-disk-cache-config',
  'set-store-value',
  'switch-disk-cache-directory',
  'clear-discord-presence',
  'discord-logout',
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
  'ytm:search-keyword',
  'ytm:hot-search',
  'ytm:home',
  'ytm:charts',
  'ytm:search',
  'ytm:suggestions',
  'ytm:moods',
  'ytm:player',
  'ytm:playlist',
  'ytm:artist'
] as const;

const EVENT_CHANNELS = [
  'global-shortcut',
  'mpris-pause',
  'mpris-play',
  'mpris-seek',
  'mpris-set-position',
  'update-app-shortcuts',
  'receive-lyric',
  'lyric-mouse-presence'
] as const;

export type Unlisten = () => void;

/** Registry of active listeners so `removeListener` can detach by callback. */
const listenerRegistry = new Map<string, Set<UnlistenFn>>();

async function rawInvoke<T>(channel: string, args?: unknown): Promise<T> {
  return tauriInvoke<T>(channel, args as Record<string, unknown> | undefined);
}

function assertAllowed(channel: string, allowed: readonly string[]): void {
  if (!allowed.includes(channel)) {
    throw new Error(`Blocked bridge channel: ${channel}`);
  }
}

/**
 * Subscribes to a backend event.
 *
 * Tauri's `listen` resolves asynchronously, but the renderer was written
 * against Electron's `ipcRenderer.on`, which returns its disposer
 * synchronously and is stored/used in `onUnmounted`. Returning a synchronous
 * disposer keeps that contract intact: if the listener has not attached yet we
 * mark it disposed and tear it down as soon as `listen` resolves.
 */
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
  /* ------------------------------------------------------------------ *
   * Window management
   * ------------------------------------------------------------------ */
  minimize: () => rawInvoke<void>('minimize-window'),
  maximize: () => rawInvoke<void>('maximize-window'),
  close: () => rawInvoke<void>('close-window'),
  quitApp: () => rawInvoke<void>('quit-app'),
  restore: () => rawInvoke<void>('restore-window'),
  restart: () => rawInvoke<void>('restart'),
  dragStart: (data: unknown) => rawInvoke<void>('drag-start', { data }),
  resizeWindow: (width: number, height: number) => rawInvoke<void>('resize-window', { width, height }),
  resizeMiniWindow: (showPlaylist: boolean) => rawInvoke<void>('resize-mini-window', { showPlaylist }),
  miniTray: () => rawInvoke<void>('mini-tray'),
  miniWindow: () => rawInvoke<void>('mini-window'),

  /* ------------------------------------------------------------------ *
   * Lyric window
   * ------------------------------------------------------------------ */
  openLyric: () => rawInvoke<void>('open-lyric'),
  sendLyric: (data: unknown) => rawInvoke<void>('send-lyric', { data }),
  onLyricWindowClosed: (callback: () => void) => {
    void listenChannel<void>('lyric-window-closed', () => callback());
  },
  onLyricWindowReady: (callback: () => void) => {
    void listenChannel<void>('lyric-window-ready', () => callback());
  },

  /* ------------------------------------------------------------------ *
   * Playback / tray / shortcuts
   * ------------------------------------------------------------------ */
  sendSong: (data: unknown) => rawInvoke<void>('update-current-song', { data }),
  updatePlayState: (isPlaying: boolean) => rawInvoke<void>('update-play-state', { isPlaying }),
  setContentZoom: (zoom: number) => rawInvoke<void>('set-content-zoom', { zoom }),
  getContentZoom: () => rawInvoke<number>('get-content-zoom'),

  /* ------------------------------------------------------------------ *
   * Store (replaces electron-store)
   * ------------------------------------------------------------------ */
  getStoreValue: (key: string) => rawInvoke<unknown>('get-store-value', { key }),
  setStoreValue: (key: string, value: unknown) => rawInvoke<void>('set-store-value', { key, value }),

  /* ------------------------------------------------------------------ *
   * Generic escape hatch (Electron ipcRenderer parity)
   * ------------------------------------------------------------------ */
  invoke: <T = unknown>(channel: string, ...args: unknown[]): Promise<T> => {
    assertAllowed(channel, GENERIC_INVOKE_CHANNELS);
    return rawInvoke<T>(channel, args.length === 1 ? args[0] : { args });
  },

  /**
   * Electron's `ipcRenderer.send` was fire-and-forget, but several call sites
   * (`get-store-value` in particular) await its result. Tauri has no separate
   * send primitive, so this resolves through `invoke` and is safe to await.
   */
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

  /* ------------------------------------------------------------------ *
   * App updates
   * ------------------------------------------------------------------ */
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

  /* ------------------------------------------------------------------ *
   * Downloads
   * ------------------------------------------------------------------ */
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
  getEmbeddedLyrics: (filePath: string) => rawInvoke<string | null>('download:get-embedded-lyrics', { filePath }),
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

  /* ------------------------------------------------------------------ *
   * Local music
   * ------------------------------------------------------------------ */
  scanLocalMusic: (folderPath: string) =>
    rawInvoke<{ files: string[]; count: number }>('scan-local-music', { folderPath }),
  scanLocalMusicWithStats: (folderPath: string) =>
    rawInvoke<{ files: { path: string; modifiedTime: number }[]; count: number }>(
      'scan-local-music-with-stats',
      { folderPath }
    ),
  parseLocalMusicMetadata: (filePaths: string[]) =>
    rawInvoke<LocalMusicMeta[]>('parse-local-music-metadata', { filePaths }),

  /* ------------------------------------------------------------------ *
   * Misc
   * ------------------------------------------------------------------ */
  getSearchSuggestions: (keyword: string) => rawInvoke<unknown>('get-search-suggestions', { keyword }),
  getSystemAccentColor: () => rawInvoke<string | null>('get-system-accent-color'),
  getSystemFonts: () => rawInvoke<string[]>('get-system-fonts'),
  selectDirectory: (title?: string) => rawInvoke<string | null>('select-directory', { title }),
  openDirectory: (path: string) => rawInvoke<void>('open-directory', { path }),
  getDownloadsPath: () => rawInvoke<string>('get-downloads-path'),
  getPlatform: () => rawInvoke<string>('get-platform'),
  checkFileExists: (path: string) => rawInvoke<boolean>('check-file-exists', { path }),
  showNotification: (title: string, body: string) =>
    rawInvoke<void>('show-notification', { title, body }),
  unblockMusic: (id: number, data: unknown, enabledSources?: string[]) =>
    rawInvoke<unknown>('unblock-music', { id, data, enabledSources }),
  importCustomApiPlugin: () =>
    rawInvoke<{ name: string; content: string } | null>('import-custom-api-plugin'),
  importLxMusicScript: () => rawInvoke<{ name: string; content: string } | null>('import-lx-music-script'),
  lxMusicHttpRequest: (request: { url: string; options: unknown; requestId: string }) =>
    rawInvoke<unknown>('lx-music-http-request', { request }),
  lxMusicHttpCancel: (requestId: string) => rawInvoke<void>('lx-music-http-cancel', { requestId }),
  getCachedLyric: (key: string) => rawInvoke<unknown>('get-cached-lyric', { key }),
  getLyrics: (payload: unknown) => rawInvoke<unknown>('get-lyrics', { payload }),
  clearLyricsCache: () => rawInvoke<void>('clear-lyrics-cache'),
  clearLyricCache: () => rawInvoke<void>('clear-lyric-cache'),
  cacheLyric: (key: string, value: unknown) => rawInvoke<void>('cache-lyric', { key, value }),
  clearDiskCache: () => rawInvoke<void>('clear-disk-cache'),
  getDiskCacheConfig: () => rawInvoke<unknown>('get-disk-cache-config'),
  setDiskCacheConfig: (config: unknown) => rawInvoke<void>('set-disk-cache-config', { config }),
  getDiskCacheStats: () => rawInvoke<unknown>('get-disk-cache-stats'),
  switchDiskCacheDirectory: (path: string) => rawInvoke<void>('switch-disk-cache-directory', { path }),
  changeLanguage: (locale: string) => rawInvoke<void>('change-language', { locale }),
  discordWebviewLogin: () => rawInvoke<unknown>('discord-webview-login'),
  discordLogout: () => rawInvoke<void>('discord-logout'),
  updateDiscordPresence: (presence: unknown) => rawInvoke<void>('update-discord-presence', { presence }),
  clearDiscordPresence: () => rawInvoke<void>('clear-discord-presence'),
  trayLyricUpdate: (data: unknown) => rawInvoke<void>('tray-lyric-update', { data })
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
