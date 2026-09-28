import type { AppUpdateState } from '../shared/appUpdate';

interface API {
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  quitApp: () => void;
  dragStart: (data: any) => void;
  miniTray: () => void;
  miniWindow: () => void;
  restore: () => void;
  restart: () => void;
  resizeWindow: (width: number, height: number) => void;
  resizeMiniWindow: (showPlaylist: boolean) => void;
  openLyric: () => void;
  sendLyric: (data: any) => void;
  sendSong: (data: any) => void;
  unblockMusic: (id: number, data: any, enabledSources?: string[]) => Promise<any>;
  onLyricWindowClosed: (callback: () => void) => void;
  onLyricWindowReady: (callback: () => void) => void;
  getAppUpdateState: () => Promise<AppUpdateState>;
  checkAppUpdate: (manual?: boolean) => Promise<AppUpdateState>;
  downloadAppUpdate: () => Promise<AppUpdateState>;
  installAppUpdate: () => Promise<boolean>;
  openAppUpdatePage: () => Promise<boolean>;
  onAppUpdateState: (callback: (state: AppUpdateState) => void) => void;
  removeAppUpdateListeners: () => void;
  onLanguageChanged: (callback: (locale: string) => void) => void;
  importCustomApiPlugin: () => Promise<{ name: string; content: string } | null>;
  importLxMusicScript: () => Promise<{ name: string; content: string } | null>;
  invoke: (channel: string, ...args: any[]) => Promise<any>;
  getSearchSuggestions: (keyword: string) => Promise<any>;
  getSystemAccentColor: () => Promise<string | null>;
  lxMusicHttpRequest: (request: { url: string; options: any; requestId: string }) => Promise<any>;
  lxMusicHttpCancel: (requestId: string) => Promise<void>;

  scanLocalMusic: (folderPath: string) => Promise<{ files: string[]; count: number }>;

  scanLocalMusicWithStats: (
    folderPath: string
  ) => Promise<{ files: { path: string; modifiedTime: number }[]; count: number }>;

  parseLocalMusicMetadata: (
    filePaths: string[]
  ) => Promise<import('../renderer/types/localMusic').LocalMusicMeta[]>;

  downloadAdd: (task: any) => Promise<string>;
  downloadAddBatch: (tasks: any) => Promise<{ batchId: string; taskIds: string[] }>;
  downloadPause: (taskId: string) => Promise<void>;
  downloadResume: (taskId: string) => Promise<void>;
  downloadCancel: (taskId: string) => Promise<void>;
  downloadCancelAll: () => Promise<void>;
  downloadGetQueue: () => Promise<any[]>;
  downloadSetConcurrency: (n: number) => void;
  downloadGetCompleted: () => Promise<any[]>;
  downloadDeleteCompleted: (filePath: string) => Promise<boolean>;
  downloadClearCompleted: () => Promise<boolean>;
  getEmbeddedLyrics: (filePath: string) => Promise<string | null>;
  downloadProvideUrl: (taskId: string, url: string) => Promise<void>;
  onDownloadProgress: (cb: (data: any) => void) => void;
  onDownloadStateChange: (cb: (data: any) => void) => void;
  onDownloadBatchComplete: (cb: (data: any) => void) => void;
  onDownloadRequestUrl: (cb: (data: any) => void) => void;
  removeDownloadListeners: () => void;
}

declare global {
  interface Window {
    api: API;
    $message: any;
  }
}