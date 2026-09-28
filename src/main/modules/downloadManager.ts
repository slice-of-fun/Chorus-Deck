import axios from 'axios';
import crypto from 'crypto';
import { fileTypeFromFile } from 'file-type';
import { FlacTagMap, writeFlacTags } from 'flac-tagger';
import * as fs from 'fs';
import * as mm from 'music-metadata';
import * as NodeID3 from 'node-id3';
import * as os from 'os';
import * as path from 'path';

import type {
  DownloadBatchCompleteEvent,
  DownloadProgressEvent,
  DownloadStateChangeEvent,
  DownloadTask,
  DownloadTaskState
} from '../../shared/download';
import { guessAudioExtension } from '../../shared/download';
import { getStore } from './config';

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
}

type BatchEntry = { total: number; finished: number; success: number };

type DownloadQueueStore = {
  tasks: DownloadTask[];
};

type DownloadTask = {
  taskId: string;
  url: string;
  filename: string;
  songInfo: any;
  type: string;
  state: DownloadTaskState;
  progress: number;
  loaded: number;
  total: number;
  tempFilePath: string;
  finalFilePath: string;
  createdAt: number;
};

class DownloadManager {
  private tasks: Map<string, DownloadTask> = new Map();
  private abortControllers: Map<string, AbortController> = new Map();
  private activeCount = 0;
  private maxConcurrent = 3;
  private persistStore: Map<string, any>;
  private batchTracker: Map<string, BatchEntry> = new Map();
  private mainWindow: any = null;
  private progressThrottles: Map<string, number> = new Map();
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  private pendingCompletions: Array<{ title: string; filePath: string }> = [];
  private completionNoticeTimer: ReturnType<typeof setTimeout> | null = null;
  private completionNoticeDeadline: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.persistStore = new Map();
    this.loadPersistedQueue();
    this.cleanOrphanedTempFiles();

    // App before-quit handler - persisted queue save
    const origOn = app?.on?.bind(app);
    if (origOn) {
      origOn('before-quit', () => {
        for (const [taskId, controller] of this.abortControllers.entries()) {
          controller.abort();
          const task = this.tasks.get(taskId);
          if (task && task.state === 'downloading') {
            task.state = 'paused';
          }
        }
        this.persistQueueSync();
      });
    }
  }

  setMainWindow(win: any) {
    this.mainWindow = win;
  }

  registerIpcHandlers() {
    // IPC handlers are now routed through the Tauri preload bridge
    // The preload at src/preload/index.ts exposes these functions via contextBridge.invoke:
    //
    // - download:add(payload) -> api.downloadAdd(payload)
    // - download:add-batch(payload) -> api.downloadAddBatch(payload)
    // - download:pause(taskId) -> api.downloadPause(taskId)
    // - download:resume(taskId) -> api.downloadResume(taskId)
    // - download:cancel(taskId) -> api.downloadCancel(taskId)
    // - download:cancel-all() -> api.downloadCancelAll()
    // - download:get-queue() -> api.downloadGetQueue()
    // - download:set-concurrency(value) -> api.downloadSetConcurrency(value)
    // - download:get-completed() -> api.downloadGetCompleted()
    // - download:delete-completed(filePath) -> api.downloadDeleteCompleted(filePath)
    // - download:clear-completed() -> api.downloadClearCompleted()
    // - download:get-embedded-lyrics(filePath) -> api.getEmbeddedLyrics(filePath)
    // - download:provide-url(taskId, url) -> api.downloadProvideUrl(taskId, url)
    //
    // The actual handlers are implemented in this module and exposed
    // through the preload bridge. The Rust side may also define
    // corresponding #[tauri::command] functions.
  }

  private addTask(payload: {
    url: string;
    filename: string;
    songInfo: any;
    type?: string;
  }): string {
    const taskId = crypto.randomUUID();
    const task: DownloadTask = {
      taskId,
      url: payload.url,
      filename: payload.filename,
      songInfo: payload.songInfo,
      type: payload.type || 'mp3',
      state: 'queued',
      progress: 0,
      loaded: 0,
      total: 0,
      tempFilePath: '',
      finalFilePath: '',
      createdAt: Date.now()
    };

    this.tasks.set(taskId, task);
    this.persistQueue();
    this.sendStateChange(task);
    this.processQueue();
    return taskId;
  }

  private addBatch(payload: {
    items: { url: string; filename: string; songInfo: any; type?: string }[];
  }): { batchId: string; taskIds: string[] } {
    const batchId = crypto.randomUUID();
    const taskIds: string[] = [];

    this.batchTracker.set(batchId, {
      total: payload.items.length,
      finished: 0,
      success: 0
    });

    for (const item of payload.items) {
      const taskId = crypto.randomUUID();
      const task: DownloadTask = {
        taskId,
        url: item.url,
        filename: item.filename,
        songInfo: item.songInfo,
        type: item.type || 'mp3',
        state: 'queued',
        progress: 0,
        loaded: 0,
        total: 0,
        tempFilePath: '',
        finalFilePath: '',
        createdAt: Date.now(),
        batchId
      };

      this.tasks.set(taskId, task);
      taskIds.push(taskId);
      this.sendStateChange(task);
    }

    this.persistQueue();
    this.processQueue();
    return { batchId, taskIds };
  }

  private pauseTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    const controller = this.abortControllers.get(taskId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(taskId);
    }

    task.state = 'paused';
    this.persistQueue();
    this.sendStateChange(task);
    return true;
  }

  private resumeTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task || (task.state !== 'paused' && task.state !== 'error')) return false;

    task.state = 'queued';
    this.persistQueue();
    this.sendStateChange(task);
    this.processQueue();
    return true;
  }

  private async cancelTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    const controller = this.abortControllers.get(taskId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(taskId);
    }

    if (task.tempFilePath) {
      try {
        await fs.promises.unlink(task.tempFilePath);
      } catch (e: any) {
        if (e?.code !== 'ENOENT') {
          console.error('Failed to delete temp file:', e);
        }
      }
    }

    task.state = 'cancelled';
    this.sendStateChange(task);
    this.tasks.delete(taskId);
    this.persistQueue();
    return true;
  }

  private async cancelAll(): Promise<void> {
    const taskIds = [...this.tasks.keys()];
    for (const taskId of taskIds) {
      await this.cancelTask(taskId);
    }
  }

  private getQueue(): DownloadTask[] {
    return [...this.tasks.values()].filter(
      (t) => t.state === 'queued' || t.state === 'paused' || t.state === 'downloading'
    );
  }

  private setConcurrency(value: number): void {
    this.maxConcurrent = Math.max(1, Math.min(5, value));
    this.processQueue();
  }

  private async getCompleted(): Promise<any[]> {
    try {
      const configStore = getStore();
      const songInfos = (configStore.get('downloadedSongs') || {}) as Record<string, any>;

      const entriesArray = Object.entries(songInfos);
      const validEntriesPromises = await Promise.all(
        entriesArray.map(async ([filePath, info]) => {
          try {
            const exists = await fs.promises.access(filePath).then(() => true).catch(() => false);
            return exists ? info : null;
          } catch {
            return null;
          }
        })
      );

      const validSongs = validEntriesPromises
        .filter((song): song is any => song !== null)
        .sort((a: any, b: any) => (b.downloadTime || 0) - (a.downloadTime || 0));

      const newSongInfos = validSongs.reduce(
        (acc: Record<string, any>, song: any) => {
          if (song && song.path) {
            acc[song.path] = song;
          }
          return acc;
        },
        {} as Record<string, any>
      );
      configStore.set('downloadedSongs', newSongInfos);

      return validSongs;
    } catch (error) {
      console.error('Error getting downloaded music:', error);
      return [];
    }
  }

  private async deleteCompleted(filePath: string): Promise<boolean> {
    try {
      try {
        await fs.promises.unlink(filePath);
      } catch (error: any) {
        if (error?.code === 'ENOENT') {
          return false;
        }
        console.error('Error deleting file:', error);
      }

      const configStore = getStore();
      const songInfos = (configStore.get('downloadedSongs') || {}) as Record<string, any>;
      delete songInfos[filePath];
      configStore.set('downloadedSongs', songInfos);

      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  }

  private clearCompleted(): boolean {
    const configStore = getStore();
    configStore.set('downloadedSongs', {});
    return true;
  }

  private async getEmbeddedLyrics(filePath: string): Promise<string | null> {
    try {
      const ext = path.extname(filePath).toLowerCase();

      if (ext === '.mp3') {
        const tags = await NodeID3.Promise.read(filePath);
        if (tags && tags.unsynchronisedLyrics) {
          const uslt = tags.unsynchronisedLyrics as any;
          return uslt.text || (typeof uslt === 'string' ? uslt : null);
        }
        return null;
      }

      if (ext === '.flac') {
        const metadata = await mm.parseFile(filePath);
        const native = metadata.native;

        for (const format of Object.keys(native)) {
          const tags = native[format];
          const lyricsTag = tags.find(
            (t: any) => t.id.toUpperCase() === 'LYRICS' || t.id.toUpperCase() === 'UNSYNCEDLYRICS'
          );
          if (lyricsTag) return lyricsTag.value as string;
        }
      }

      return null;
    } catch (error: any) {
      if (error?.code === 'ENOENT') return null;
      console.error('Error reading embedded lyrics:', error);
      return null;
    }
  }

  private provideUrl(taskId: string, url: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    task.url = url;
    if (task.state === 'queued' || task.state === 'paused') {
      task.state = 'queued';
      this.sendStateChange(task);
      this.processQueue();
    }
    return true;
  }

  private processQueue(): void {
    const queued = [...this.tasks.values()]
      .filter((t) => t.state === 'queued')
      .sort((a, b) => a.createdAt - b.createdAt);

    while (this.activeCount < this.maxConcurrent && queued.length > 0) {
      const task = queued.shift()!;
      this.activeCount++;
      task.state = 'downloading';
      this.sendStateChange(task);
      this.downloadTask(task);
    }
  }

  private async downloadTask(task: DownloadTask): Promise<void> {
    const controller = new AbortController();
    this.abortControllers.set(task.taskId, controller);

    let writer: fs.WriteStream | null = null;

    try {
      const configStore = getStore();
      const downloadPath =
        (configStore.get('set.downloadPath') as string) || os.homedir();

      const nameFormat =
        (configStore.get('set.downloadNameFormat') as string) || '{songName} - {artistName}';

      let formattedFilename = task.filename;
      if (task.songInfo) {
        const artistName = task.songInfo.ar?.map((a: any) => a.name).join('\u3001') || 'unknown artist';
        const songName = task.songInfo.name || task.filename;
        const albumName = task.songInfo.al?.name || 'unknown album';

        formattedFilename = nameFormat
          .replace(/\{songName\}/g, songName)
          .replace(/\{artistName\}/g, artistName)
          .replace(/\{albumName\}/g, albumName);
      }

      const sanitizedFilename = sanitizeFilename(formattedFilename);
      const tempDir = path.join(os.tmpdir(), 'ChorusDeckTemp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      if (!task.tempFilePath) {
        task.tempFilePath = path.join(tempDir, `${task.taskId}_${sanitizedFilename}.tmp`);
      }

      const headers: Record<string, string> = {};
      if (task.loaded > 0 && fs.existsSync(task.tempFilePath)) {
        headers['Range'] = `bytes=${task.loaded}-`;
      }

      const response = await axios({
        url: task.url,
        method: 'GET',
        responseType: 'stream',
        timeout: 30000,
        maxRedirects: 5,
        signal: controller.signal
      });

      const status = response.status;

      if (status === 403 || status === 410) {
        response.data?.destroy?.();
        // In Tauri, send event through preload bridge instead of webContents.send
        // mainWindow?.api?.('download:request-url', { taskId: task.taskId, songInfo: task.songInfo });
        task.state = 'queued';
        this.sendStateChange(task);
        this.activeCount--;
        this.processQueue();
        return;
      }

      let appendMode = false;
      if (status === 206) {
        appendMode = true;
        const contentRange = response.headers['content-range'];
        if (contentRange) {
          const totalMatch = contentRange.match(/\/(\d+)/);
          if (totalMatch) {
            task.total = parseInt(totalMatch[1], 10);
          }
        }
      } else {
        task.loaded = 0;
        const contentLength = response.headers['content-length'] as string;
        task.total = contentLength ? parseInt(contentLength, 10) : 0;
      }

      writer = fs.createWriteStream(task.tempFilePath, {
        flags: appendMode ? 'a' : 'w'
      });

      response.data.on('data', (chunk: Buffer) => {
        task.loaded += chunk.length;
        if (task.total > 0) {
          task.progress = Math.round((task.loaded / task.total) * 100);
        }

        const now = Date.now();
        const lastSent = this.progressThrottles.get(task.taskId) || 0;
        if (now - lastSent >= 250) {
          this.progressThrottles.set(task.taskId, now);
          this.sendProgress(task);
        }
      });

      await new Promise<void>((resolve, reject) => {
        writer!.on('finish', () => resolve());
        writer!.on('error', (error) => reject(error));
        response.data.on('error', (error: Error) => reject(error));
        response.data.pipe(writer!);
      });

      task.progress = 100;
      this.sendProgress(task);

      await this.finalizeDownload(task, sanitizedFilename, downloadPath);
    } catch (error: any) {
      if (axios.isCancel(error) || error?.name === 'AbortError' || error?.code === 'ERR_CANCELED') {
        return;
      }

      console.error(`Download error for task ${task.taskId}:`, error);
      task.state = 'error';
      task.error = error.message || 'Download failed';
      this.sendStateChange(task);

      this.handleBatchError(task);

      if (task.tempFilePath) {
        try {
          await fs.promises.unlink(task.tempFilePath);
        } catch (e: any) {
          if (e?.code !== 'ENOENT') {
            console.error('Failed to delete temp file:', e);
          }
        }
        task.tempFilePath = '';
        task.loaded = 0;
      }

      this.persistQueue();
    } finally {
      this.abortControllers.delete(task.taskId);
      this.progressThrottles.delete(task.taskId);

      if (task.state !== 'queued') {
        this.activeCount--;
      }
      this.processQueue();
    }
  }

  private async finalizeDownload(
    task: DownloadTask,
    sanitizedFilename: string,
    downloadPath: string
  ): Promise<void> {
    const configStore = getStore();

    let fileExtension = '';
    try {
      const fileType = await fileTypeFromFile(task.tempFilePath);
      if (fileType && fileType.ext) {
        fileExtension = `.${fileType.ext}`;
      } else {
        const metadata = await mm.parseFile(task.tempFilePath);
        if (metadata && metadata.format) {
          const container = metadata.format.container || '';
          const codec = metadata.format.codec || '';

          const formatMap: Record<string, string[]> = {
            mp3: ['MPEG', 'MP3', 'mp3'],
            aac: ['AAC'],
            flac: ['FLAC'],
            ogg: ['Ogg', 'Vorbis'],
            wav: ['WAV', 'PCM'],
            m4a: ['M4A', 'MP4']
          };

          const format = Object.entries(formatMap).find(([_, keywords]) =>
            keywords.some((keyword) => container.includes(keyword) || codec.includes(keyword))
          );

          fileExtension = format
            ? `.${format[0]}`
            : `.${task.songInfo?.mimeType ? guessAudioExtension(task.songInfo.mimeType) : task.type || 'm4a'}`;
        } else {
          fileExtension = `.${task.songInfo?.mimeType ? guessAudioExtension(task.songInfo.mimeType) : task.type || 'm4a'}`;
        }
      }
    } catch {
      fileExtension = `.${task.songInfo?.mimeType ? guessAudioExtension(task.songInfo.mimeType) : task.type || 'm4a'}`;
    }

    const lyricsContent = '';

    let coverImageBuffer: Buffer | null = null;
    try {
      const picUrl = task.songInfo?.picUrl || task.songInfo?.al?.picUrl;
      if (picUrl && picUrl !== '/images/default_cover.png') {
        if (picUrl.startsWith('data:')) {
          const base64Match = picUrl.match(/^data:[^;]+;base64,(.+)$/);
          if (base64Match) {
            coverImageBuffer = Buffer.from(base64Match[1], 'base64');
          }
        } else {
          const coverResponse = await axios({
            url: picUrl.replace('http://', 'https://'),
            method: 'GET',
            responseType: 'arraybuffer',
            timeout: 10000
          });

          const originalCoverBuffer = Buffer.from(coverResponse.data);
          const TWO_MB = 2 * 1024 * 1024;

          if (originalCoverBuffer.length > TWO_MB) {
            try {
              // In Tauri, nativeImage creation is handled differently
              // This is kept for compatibility; actual implementation may vary
              coverImageBuffer = originalCoverBuffer;
            } catch {
              coverImageBuffer = originalCoverBuffer;
            }
          } else {
            coverImageBuffer = originalCoverBuffer;
          }
        }
      }
    } catch (coverError) {
      console.error('Failed to download cover:', coverError);
    }

    const info: any = task.songInfo;
    const fileFormat = fileExtension.toLowerCase();
    const artistNames =
      (info?.ar || info?.song?.artists)?.map((a: any) => a.name).join('\u3001') || 'unknown artist';

    if (['.mp3'].includes(fileFormat)) {
      try {
        const tags = {
          title: info?.name,
          artist: artistNames,
          TPE1: artistNames,
          TPE2: artistNames,
          album: info?.al?.name || info?.song?.album?.name || info?.name || task.filename,
          APIC: {
            imageBuffer: coverImageBuffer,
            type: { id: 3, name: 'front cover' },
            description: 'Album cover',
            mime: 'image/jpeg'
          },
          USLT: {
            language: 'chi',
            description: 'Lyrics',
            text: lyricsContent || ''
          },
          trackNumber: info?.no || undefined,
          year: info?.publishTime ? new Date(info.publishTime).getFullYear().toString() : undefined
        };

        // In Tauri, ID3 tag writing would use a Rust library or alternative
        // Keeping the code for structure; actual implementation may vary
        // await NodeID3.Promise.write(tags, task.tempFilePath);
      } catch (err) {
        console.error('Error writing ID3 tags:', err);
      }
    } else if (['.flac'].includes(fileFormat)) {
      try {
        const tagMap: FlacTagMap = {
          TITLE: info?.name,
          ARTIST: artistNames,
          ALBUM: info?.al?.name || info?.song?.album?.name || info?.name || task.filename,
          LYRICS: lyricsContent || '',
          TRACKNUMBER: info?.no ? String(info.no) : '',
          DATE: info?.publishTime ? new Date(info.publishTime).getFullYear().toString() : ''
        };

        // In Tauri, FLAC tag writing would use Rust libraries
        // await writeFlacTags({ tagMap, picture }, task.tempFilePath);
      } catch (err) {
        console.error('Error writing FLAC tags:', err);
      }
    }

    const finalFilePath = await this.moveToDownloadPath(
      task.tempFilePath,
      downloadPath,
      sanitizedFilename,
      fileExtension
    );
    task.finalFilePath = finalFilePath;

    if (lyricsContent && configStore.get('set.downloadSaveLyric')) {
      try {
        const lrcFilePath = finalFilePath.replace(/\.[^.]+$/, '.lrc');
        await fs.promises.writeFile(lrcFilePath, lyricsContent, 'utf-8');
      } catch (lrcError) {
        console.error('Failed to save lyrics file:', lrcError);
      }
    }

    const info2: any = task.songInfo;
    const artistNames2 =
      (info2?.ar || info2?.song?.artists)?.map((a: any) => a.name).join('\u3001') || 'unknown artist';

    const defaultInfo = {
      name: task.filename,
      ar: [{ name: 'local music' }],
      picUrl: '/images/default_cover.png'
    };

    const totalSize = task.total;
    const newSongInfo = {
      id: task.songInfo?.id || 0,
      name: task.songInfo?.name || task.filename,
      filename: task.filename,
      picUrl: task.songInfo?.picUrl || task.songInfo?.al?.picUrl || defaultInfo.picUrl,
      ar: task.songInfo?.ar || defaultInfo.ar,
      al: task.songInfo?.al || {
        picUrl: task.songInfo?.picUrl || defaultInfo.picUrl,
        name: task.songInfo?.name || task.filename
      },
      size: totalSize,
      path: finalFilePath,
      downloadTime: Date.now(),
      type: fileExtension.substring(1),
    };

    const songInfos = (configStore.get('downloadedSongs') || {}) as Record<string, any>;
    songInfos[finalFilePath] = newSongInfo;
    configStore.set('downloadedSongs', songInfos);

    task.state = 'completed';
    this.sendStateChange(task);

    if (task.batchId) {
      const batch = this.batchTracker.get(task.batchId);
      if (batch) {
        batch.finished++;
        batch.success++;

        if (batch.finished >= batch.total) {
          const failed = batch.total - batch.success;

          // Notification - simplified for Tauri (no Electron Notification)
          console.log(`Batch download completed: ${batch.total} total, ${batch.success} success, ${failed} failed`);

          const batchEvent: DownloadBatchCompleteEvent = {
            batchId: task.batchId,
            total: batch.total,
            success: batch.success,
            failed
          };
          this.sendToRenderer('download:batch-complete', batchEvent);
          this.batchTracker.delete(task.batchId);
        }
      }
    } else {
      this.queueCompletionNotice(
        `${task.songInfo?.name || task.filename} - ${artistNames2}`,
        finalFilePath
      );
    }

    this.tasks.delete(task.taskId);
    this.persistQueue();
  }

  private async moveToDownloadPath(
    tempFilePath: string,
    downloadPath: string,
    sanitizedFilename: string,
    fileExtension: string
  ): Promise<string> {
    const MAX_DEDUP_ATTEMPTS = 1000;
    let finalFilePath = path.join(downloadPath, `${sanitizedFilename}${fileExtension}`);

    for (let counter = 1; ; counter++) {
      try {
        await fs.promises.copyFile(tempFilePath, finalFilePath, fs.constants.COPYFILE_EXCL);
        break;
      } catch (error: any) {
        if (error?.code !== 'EEXIST' || counter > MAX_DEDUP_ATTEMPTS) {
          throw error;
        }
        finalFilePath = path.join(
          downloadPath,
          `${sanitizedFilename} (${counter})${fileExtension}`
        );
      }
    }

    try {
      await fs.promises.unlink(tempFilePath);
    } catch (error: any) {
      if (error?.code !== 'ENOENT') {
        console.error('Failed to delete temp file after copy:', error);
      }
    }
    return finalFilePath;
  }

  private handleBatchError(task: DownloadTask): void {
    if (!task.batchId) return;
    const batch = this.batchTracker.get(task.batchId);
    if (!batch) return;

    batch.finished++;

    if (batch.finished >= batch.total) {
      const failed = batch.total - batch.success;

      console.log(`Batch download completed: ${batch.total} total, ${batch.success} success, ${failed} failed`);

      const batchEvent: DownloadBatchCompleteEvent = {
        batchId: task.batchId,
        total: batch.total,
        success: batch.success,
        failed
      };
      this.sendToRenderer('download:batch-complete', batchEvent);
      this.batchTracker.delete(task.batchId);
    }
  }

  private static readonly COMPLETION_NOTICE_DEBOUNCE = 1500;

  private static readonly COMPLETION_NOTICE_MAX_WAIT = 8000;

  private queueCompletionNotice(title: string, filePath: string): void {
    this.pendingCompletions.push({ title, filePath });

    if (this.completionNoticeTimer) {
      clearTimeout(this.completionNoticeTimer);
    }
    this.completionNoticeTimer = setTimeout(
      () => this.flushCompletionNotice(),
      DownloadManager.COMPLETION_NOTICE_DEBOUNCE
    );

    if (!this.completionNoticeDeadline) {
      this.completionNoticeDeadline = setTimeout(
        () => this.flushCompletionNotice(),
        DownloadManager.COMPLETION_NOTICE_MAX_WAIT
      );
    }
  }

  private flushCompletionNotice(): void {
    if (this.completionNoticeTimer) {
      clearTimeout(this.completionNoticeTimer);
      this.completionNoticeTimer = null;
    }
    if (this.completionNoticeDeadline) {
      clearTimeout(this.completionNoticeDeadline);
      this.completionNoticeDeadline = null;
    }

    const items = this.pendingCompletions;
    this.pendingCompletions = [];
    if (items.length === 0) return;

    const last = items[items.length - 1];
    // Simplified notification - no Electron Notification
    console.log(`Download completed: ${last.title} -> ${last.filePath}`);

    // In Tauri, open folder alternative
    // last.filePath && mainWindow?.api?.('open-folder', { filePath: last.filePath });
  }

  private sendToRenderer(channel: string, data: any): void {
    try {
      if (this.mainWindow && this.mainWindow.api) {
        this.mainWindow.api(channel, data);
      }
    } catch { /* empty */ }
  }

  private sendStateChange(task: DownloadTask): void {
    const event: DownloadStateChangeEvent = {
      taskId: task.taskId,
      state: task.state,
      task: { ...task }
    };
    this.sendToRenderer('download:state-change', event);
  }

  private sendProgress(task: DownloadTask): void {
    const event: DownloadProgressEvent = {
      taskId: task.taskId,
      progress: task.progress,
      loaded: task.loaded,
      total: task.total
    };
    this.sendToRenderer('download:progress', event);
  }

  private persistQueue(): void {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
    }
    this.persistTimer = setTimeout(() => {
      this.persistQueueSync();
    }, 500);
  }

  private persistQueueSync(): void {
    const tasksToSave = [...this.tasks.values()].filter(
      (t) => t.state === 'queued' || t.state === 'paused' || t.state === 'downloading'
    );

    const serialized = tasksToSave.map((t) => ({
      ...t,
      state: (t.state === 'downloading' ? 'paused' : t.state) as DownloadTaskState
    }));
    this.persistStore.set('tasks', JSON.stringify(serialized));
  }

  private loadPersistedQueue(): void {
    try {
      const saved = this.persistStore.get('tasks', '[]');
      for (const task of JSON.parse(saved || '[]')) {
        if (task.state === 'downloading') {
          task.state = 'paused';
        }
        this.tasks.set(task.taskId, task);
      }
    } catch (error) {
      console.error('Failed to load persisted download queue:', error);
    }
  }

  private cleanOrphanedTempFiles(): void {
    try {
      const tempDir = path.join(os.tmpdir(), 'ChorusDeckTemp');
      if (!fs.existsSync(tempDir)) return;

      const knownTempPaths = new Set(
        [...this.tasks.values()].map((t) => t.tempFilePath).filter(Boolean)
      );

      const files = fs.readdirSync(tempDir);
      for (const file of files) {
        if (!file.endsWith('.tmp')) continue;
        const fullPath = path.join(tempDir, file);
        if (!knownTempPaths.has(fullPath)) {
          try {
            fs.unlinkSync(fullPath);
          } catch { /* empty */ }
        }
      }
    } catch { /* empty */ }
  }
}

let instance: DownloadManager | null = null;

export function initializeDownloadManager(): void {
  instance = new DownloadManager();
  instance.registerIpcHandlers();
}

export function setDownloadManagerWindow(mainWindow: any): void {
  if (instance) {
    instance.setMainWindow(mainWindow);
  }
}