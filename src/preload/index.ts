import { contextBridge } from '@tauri/api/tauri';

import type { AppUpdateState } from '../shared/appUpdate';

const api = {
  minimize: () => contextBridge.invoke('minimize-window'),
  maximize: () => contextBridge.invoke('maximize-window'),
  close: () => contextBridge.invoke('close-window'),
  quitApp: () => contextBridge.invoke('quit-app'),
  dragStart: (data) => contextBridge.invoke('drag-start', data),
  miniTray: () => contextBridge.invoke('mini-tray'),
  miniWindow: () => contextBridge.invoke('mini-window'),
  restore: () => contextBridge.invoke('restore-window'),
  restart: () => contextBridge.invoke('restart'),
  resizeWindow: (width, height) => contextBridge.invoke('resize-window', width, height),
  resizeMiniWindow: (showPlaylist) => contextBridge.invoke('resize-mini-window', showPlaylist),
  openLyric: () => contextBridge.invoke('open-lyric'),
  sendLyric: (data) => contextBridge.invoke('send-lyric', data),
  sendSong: (data) => contextBridge.invoke('update-current-song', data),
  unblockMusic: (id, data, enabledSources) =>
    contextBridge.invoke('unblock-music', id, data, enabledSources),
  importCustomApiPlugin: () => contextBridge.invoke('import-custom-api-plugin'),
  importLxMusicScript: () => contextBridge.invoke('import-lx-music-script'),

  onLyricWindowClosed: (callback: () => void) => {
    contextBridge.on('lyric-window-closed', () => callback());
  },

  onLyricWindowReady: (callback: () => void) => {
    contextBridge.on('lyric-window-ready', () => callback());
  },
  getAppUpdateState: () => contextBridge.invoke('app-update:get-state') as Promise<AppUpdateState>,
  checkAppUpdate: (manual = false) =>
    contextBridge.invoke('app-update:check', { manual }) as Promise<AppUpdateState>,
  downloadAppUpdate: () => contextBridge.invoke('app-update:download') as Promise<AppUpdateState>,
  installAppUpdate: () => contextBridge.invoke('app-update:quit-and-install') as Promise<boolean>,
  openAppUpdatePage: () => contextBridge.invoke('app-update:open-release-page') as Promise<boolean>,
  onAppUpdateState: (callback: (state: AppUpdateState) => void) => {
    contextBridge.on('app-update:state', (_event, state: AppUpdateState) => callback(state));
  },

  removeAppUpdateListeners: () => {
    contextBridge.removeAllListeners('app-update:state');
  },

  onLanguageChanged: (callback: (locale: string) => void) => {
    contextBridge.on('language-changed', (_event, locale) => {
      callback(locale);
    });
  },

  invoke: (channel: string, ...args: any[]) => {
    const validChannels = [
      'get-lyrics',
      'clear-lyrics-cache',
      'get-system-fonts',
      'get-cached-lyric',
      'cache-lyric',
      'clear-lyric-cache',
      'scan-local-music',
      'scan-local-music-with-stats',
      'parse-local-music-metadata',
      'get-system-accent-color'
    ];
    if (validChannels.includes(channel)) {
      return contextBridge.invoke(channel, ...args);
    }
    return Promise.reject(new Error(`Unauthorized IPC aisle: ${channel}`));
  },

  getSearchSuggestions: (keyword: string) => contextBridge.invoke('get-search-suggestions', keyword),

  getSystemAccentColor: () => contextBridge.invoke('get-system-accent-color'),

  lxMusicHttpRequest: (request: { url: string; options: any; requestId: string }) =>
    contextBridge.invoke('lx-music-http-request', request),

  lxMusicHttpCancel: (requestId: string) => contextBridge.invoke('lx-music-http-cancel', requestId),

  scanLocalMusic: (folderPath: string) => contextBridge.invoke('scan-local-music', folderPath),
  scanLocalMusicWithStats: (folderPath: string) =>
    contextBridge.invoke('scan-local-music-with-stats', folderPath),
  parseLocalMusicMetadata: (filePaths: string[]) =>
    contextBridge.invoke('parse-local-music-metadata', filePaths),

  downloadAdd: (task: any) => contextBridge.invoke('download:add', task),
  downloadAddBatch: (tasks: any) => contextBridge.invoke('download:add-batch', tasks),
  downloadPause: (taskId: string) => contextBridge.invoke('download:pause', taskId),
  downloadResume: (taskId: string) => contextBridge.invoke('download:resume', taskId),
  downloadCancel: (taskId: string) => contextBridge.invoke('download:cancel', taskId),
  downloadCancelAll: () => contextBridge.invoke('download:cancel-all'),
  downloadGetQueue: () => contextBridge.invoke('download:get-queue'),
  downloadSetConcurrency: (n: number) => contextBridge.send('download:set-concurrency', n),
  downloadGetCompleted: () => contextBridge.invoke('download:get-completed'),
  downloadDeleteCompleted: (filePath: string) =>
    contextBridge.invoke('download:delete-completed', filePath),
  downloadClearCompleted: () => contextBridge.invoke('download:clear-completed'),
  getEmbeddedLyrics: (filePath: string) =>
    contextBridge.invoke('download:get-embedded-lyrics', filePath),
  downloadProvideUrl: (taskId: string, url: string) =>
    contextBridge.invoke('download:provide-url', { taskId, url }),
  onDownloadProgress: (cb: (data: any) => void) => {
    contextBridge.on('download:progress', (_event: any, data: any) => cb(data));
  },
  onDownloadStateChange: (cb: (data: any) => void) => {
    contextBridge.on('download:state-change', (_event: any, data: any) => cb(data));
  },
  onDownloadBatchComplete: (cb: (data: any) => void) => {
    contextBridge.on('download:batch-complete', (_event: any, data: any) => cb(data));
  },
  onDownloadRequestUrl: (cb: (data: any) => void) => {
    contextBridge.on('download:request-url', (_event: any, data: any) => cb(data));
  },
  removeDownloadListeners: () => {
    contextBridge.removeAllListeners('download:progress');
    contextBridge.removeAllListeners('download:state-change');
    contextBridge.removeAllListeners('download:batch-complete');
    contextBridge.removeAllListeners('download:request-url');
  }
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api);
  } catch (error) {
    console.error(error);
  }
} else {
  (window as any).api = api;
}