export const DOWNLOAD_TASK_STATE = {
  queued: 'queued',
  downloading: 'downloading',
  paused: 'paused',
  completed: 'completed',
  error: 'error',
  cancelled: 'cancelled'
} as const;

export type DownloadTaskState = (typeof DOWNLOAD_TASK_STATE)[keyof typeof DOWNLOAD_TASK_STATE];

export type DownloadSongInfo = {
  id: string;
  name: string;
  picUrl: string;
  ar: { name: string }[];
  al: { name: string; picUrl: string };
  mimeType?: string;
};

/**
 * Maps a YouTube stream mime type to a container extension.
 * Falls back to `m4a`, the most common YouTube audio container.
 */
export function guessAudioExtension(mimeType?: string): string {
  const type = (mimeType || '').toLowerCase();

  if (type.includes('webm')) return 'webm';
  if (type.includes('mp4') || type.includes('m4a') || type.includes('aac')) return 'm4a';
  if (type.includes('ogg') || type.includes('opus')) return 'ogg';
  if (type.includes('mp3') || type.includes('mpeg')) return 'mp3';
  if (type.includes('wav')) return 'wav';
  if (type.includes('flac')) return 'flac';

  return 'm4a';
}

export type DownloadTask = {
  taskId: string;
  url: string;
  filename: string;
  songInfo: DownloadSongInfo;
  type: string;
  state: DownloadTaskState;
  progress: number;
  loaded: number;
  total: number;
  tempFilePath: string;
  finalFilePath: string;
  error?: string;
  createdAt: number;
  batchId?: string;
};

export type DownloadSettings = {
  path: string;
  nameFormat: string;
  separator: string;
  saveLyric: boolean;
  maxConcurrent: number;
};

/**
 * A finished download as reported by the backend `download:get-completed`
 * command. `path` mirrors `filePath`; both are accepted by the UI.
 */
export type CompletedDownload = {
  filePath: string;
  path?: string;
  filename: string;
  displayName?: string;
  picUrl?: string;
  size: number;
  mimeType?: string;
  songId?: string;
  ar?: { name: string }[];
  createdAt?: number;
};

export type DownloadProgressEvent = {
  taskId: string;
  progress: number;
  loaded: number;
  total: number;
};

export type DownloadStateChangeEvent = {
  taskId: string;
  state: DownloadTaskState;
  task: DownloadTask;
};

export type DownloadBatchCompleteEvent = {
  batchId: string;
  total: number;
  success: number;
  failed: number;
};

export type DownloadRequestUrlEvent = {
  taskId: string;
  songInfo: DownloadSongInfo;
};

export function createDefaultDownloadSettings(): DownloadSettings {
  return {
    path: '',
    nameFormat: '{songName} - {artistName}',
    separator: ' - ',
    saveLyric: false,
    maxConcurrent: 3
  };
}
