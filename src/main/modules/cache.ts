import { join } from 'path';
import * as fs from 'fs';
import * as os from 'os';

import { getStore } from './config';

type CacheCleanupPolicy = 'lru' | 'fifo';
type CacheItemType = 'music' | 'lyrics';
type CacheScope = 'all' | CacheItemType;

type DiskCacheConfig = {
  enabled: boolean;
  directory: string;
  maxSizeMB: number;
  cleanupPolicy: CacheCleanupPolicy;
};

type MusicCacheEntry = {
  key: string;
  songId: number;
  source: string;
  filePath: string;
  urlHash: string;
  size: number;
  createdAt: number;
  lastAccessAt: number;
  playCount: number;
  title?: string;
  artist?: string;
};

type LyricCacheEntry = {
  key: string;
  songId: number;
  filePath: string;
  size: number;
  createdAt: number;
  lastAccessAt: number;
  title?: string;
  artist?: string;
};

type CacheStoreSchema = {
  musicEntries: Record<string, MusicCacheEntry>;
  lyricEntries: Record<string, LyricCacheEntry>;
};

type ResolveMusicUrlPayload = {
  songId: number;
  source?: string;
  url: string;
  title?: string;
  artist?: string;
};

type ResolveMusicUrlResult = {
  url: string;
  cached: boolean;
  queued: boolean;
};

type DiskCacheStats = {
  enabled: boolean;
  directory: string;
  maxSizeMB: number;
  cleanupPolicy: CacheCleanupPolicy;
  totalSizeBytes: number;
  musicSizeBytes: number;
  lyricSizeBytes: number;
  totalFiles: number;
  musicFiles: number;
  lyricFiles: number;
  usage: number;
};

type SwitchCacheDirectoryPayload = {
  directory: string;
  action?: 'migrate' | 'destroy' | 'keep';
};

type SwitchCacheDirectoryResult = {
  success: boolean;
  config: DiskCacheConfig;
  migratedFiles: number;
  destroyedFiles: number;
};

type CacheEvictionItem = {
  type: CacheItemType;
  key: string;
  filePath: string;
  size: number;
  createdAt: number;
  lastAccessAt: number;
};

const DEFAULT_CACHE_MAX_SIZE_MB = 4096;
const MIN_CACHE_SIZE_MB = 256;
const MAX_CACHE_SIZE_MB = 102400;
const DEFAULT_CLEANUP_POLICY: CacheCleanupPolicy = 'lru';
const CACHE_ROOT_DIR_NAME = 'cache';
const MUSIC_CACHE_DIR = 'music';
const LYRIC_CACHE_DIR = 'lyrics';

const AUDIO_EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'audio/mp4': '.m4a',
  'audio/x-m4a': '.m4a',
  'audio/aac': '.aac',
  'audio/flac': '.flac',
  'audio/x-flac': '.flac',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/ogg': '.ogg',
  'audio/webm': '.webm'
};

class DiskCacheManager {
  private metadata: Map<string, MusicCacheEntry | LyricCacheEntry>;

  constructor() {
    this.metadata = new Map();
    this.initialize();
  }

  private getBaseDir(): string {
    const configStore = getStore();
    const defaultDir = path.join(os.homedir(), CACHE_ROOT_DIR_NAME);
    const savedDir = configStore?.get('set.diskCacheDir');
    const dir = savedDir ? String(savedDir) : defaultDir;
    return dir;
  }

  private getMusicDir(): string {
    return path.join(this.getBaseDir(), MUSIC_CACHE_DIR);
  }

  private getLyricDir(): string {
    return path.join(this.getBaseDir(), LYRIC_CACHE_DIR);
  }

  private ensureDirs(): void {
    try {
      fs.mkdirSync(this.getBaseDir(), { recursive: true });
      fs.mkdirSync(this.getMusicDir(), { recursive: true });
      fs.mkdirSync(this.getLyricDir(), { recursive: true });
    } catch (error) {
      console.error('Failed to create cache directories:', error);
    }
  }

  initialize(): void {
    this.ensureDirs();
    // Load existing metadata from stored state
    // In Tauri, this would use SQLite or localStorage instead of electron-store
    const stored = getStore().get('disk-cache-metadata');
    if (stored) {
      for (const [key, entry] of Object.entries(stored as any)) {
        this.metadata.set(key, entry);
      }
    }
  }

  getCacheConfig(): DiskCacheConfig {
    const configStore = getStore();
    const defaultDirectory = this.getBaseDir();
    const enabled = Boolean(configStore?.get('set.enableDiskCache') ?? true);
    const directory = this.getBaseDir();
    const rawMaxSize = Number(configStore?.get('set.diskCacheMaxSizeMB') ?? DEFAULT_CACHE_MAX_SIZE_MB);
    const maxSizeMB = Math.min(MAX_CACHE_SIZE_MB, Math.max(MIN_CACHE_SIZE_MB, Math.floor(rawMaxSize)));
    const rawPolicy = String(configStore?.get('set.diskCacheCleanupPolicy') ?? DEFAULT_CLEANUP_POLICY);
    const cleanupPolicy: CacheCleanupPolicy = rawPolicy === 'fifo' ? 'fifo' : 'lru';

    return {
      enabled,
      directory: this.normalizeDir(directory),
      maxSizeMB,
      cleanupPolicy
    };
  }

  private normalizeDir(dir: string): string {
    if (!dir) return this.getBaseDir();
    return dir.startsWith(os.homedir()) || path.isAbsolute(dir) ? dir : path.resolve(dir);
  }

  getMusicEntries(): Record<string, MusicCacheEntry> {
    const result: Record<string, MusicCacheEntry> = {};
    this.metadata.forEach((entry, key) => {
      if (entry.type === 'music') {
        result[key] = entry as MusicCacheEntry;
      }
    });
    return result;
  }

  getLyricEntries(): Record<string, LyricCacheEntry> {
    const result: Record<string, LyricCacheEntry> = {};
    this.metadata.forEach((entry, key) => {
      if (entry.type === 'lyrics') {
        result[key] = entry as LyricCacheEntry;
      }
    });
    return result;
  }

  setMusicEntries(entries: Record<string, MusicCacheEntry>): void {
    // Clear and replace
    this.metadata.clear();
    for (const [key, entry] of Object.entries(entries)) {
      entry.type = 'music';
      this.metadata.set(key, entry);
    }
    this.persistMetadata();
  }

  setLyricEntries(entries: Record<string, LyricCacheEntry>): void {
    // Clear and replace
    this.metadata.clear();
    for (const [key, entry] of Object.entries(entries)) {
      entry.type = 'lyrics';
      this.metadata.set(key, entry);
    }
    this.persistMetadata();
  }

  private persistMetadata(): void {
    try {
      getStore().set('disk-cache-metadata', Object.fromEntries(this.metadata));
    } catch (error) {
      console.error('Failed to persist cache metadata:', error);
    }
  }

  private buildMusicKey(songId: number, source?: string): string {
    const safeSource = (source || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${songId}_${safeSource}`;
  }

  private buildLyricKey(songId: number): string {
    return String(songId);
  }

  private buildUrlHash(url: string): string {
    // Simple hash without crypto (Node.js crypto is available but using simpler approach)
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      hash = ((hash << 5) - hash + url.charCodeAt(i)) | 0;
    }
    return 'hsh' + Math.abs(hash).toString(36);
  }

  private toLocalUrl(filePath: string): string {
    // In Tauri, use proper local URL conversion
    return 'file://' + filePath;
  }

  private isRemoteAudioUrl(url: string): boolean {
    return /^https?:\/\//i.test(url);
  }

  private getExtensionFromUrl(url: string): string {
    try {
      const pathname = new URL(url).pathname;
      const ext = pathname.slice(-4).toLowerCase();
      if (ext && ext.length <= 6) {
        return ext;
      }
    } catch { /* empty */ }
    return '';
  }

  private getExtensionFromContentType(contentType?: string): string {
    if (!contentType) return '';
    const normalizedType = contentType.split(';')[0].trim().toLowerCase();
    return AUDIO_EXTENSION_BY_CONTENT_TYPE[normalizedType] || '';
  }

  private getExtensionFromCodec(url: string, contentType?: string): string {
    const urlExtension = this.getExtensionFromUrl(url);
    if (urlExtension) return urlExtension;
    const contentTypeExtension = this.getExtensionFromContentType(contentType);
    if (contentTypeExtension) return contentTypeExtension;
    return '.mp3';
  }

  private async pruneMissingEntries(): Promise<void> {
    const nextMetadata = new Map<string, any>();
    for (const [key, entry] of this.metadata) {
      if (!entry.filePath) {
        nextMetadata.set(key, entry);
        continue;
      }
      try {
        if (!(await fs.promises.access(entry.filePath).then(() => true).catch(() => false))) {
          // File doesn't exist, remove from metadata
          continue;
        }
        nextMetadata.set(key, entry);
      } catch {
        // File doesn't exist, remove from metadata
        continue;
      }
    }
    this.metadata = nextMetadata;
    this.persistMetadata();
  }

  private async removeEntryFile(filePath: string): Promise<void> {
    try {
      await fs.promises.unlink(filePath);
    } catch { /* empty */ }
  }

  private async removeEntry(type: CacheItemType, key: string): Promise<void> {
    const entry = type === 'music' ? this.getMusicEntries()[key] : this.getLyricEntries()[key];
    if (!entry) return;

    await this.removeEntryFile(entry.filePath);
    // Remove from metadata
    this.metadata.delete(key);
    this.persistMetadata();
  }

  private async enforceCacheLimit(): Promise<void> {
    const config = this.getCacheConfig();
    await this.pruneMissingEntries();

    const items = [];
    const musicEntries = this.getMusicEntries();
    const lyricEntries = this.getLyricEntries();

    for (const [key, entry] of Object.entries(musicEntries)) {
      items.push({ type: 'music' as const, key, size: entry.size });
    }
    for (const [key, entry] of Object.entries(lyricEntries)) {
      items.push({ type: 'lyrics' as const, key, size: entry.size });
    }

    items.sort((a, b) => {
      if (config.cleanupPolicy === 'fifo') {
        return a.createdAt - b.createdAt;
      }
      return a.lastAccessAt - b.lastAccessAt;
    });

    const maxBytes = config.maxSizeMB * 1024 * 1024;
    let totalBytes = items.reduce((sum, item) => sum + item.size, 0);

    if (totalBytes <= maxBytes) return;

    for (const item of items) {
      if (totalBytes <= maxBytes) break;
      await this.removeEntry(item.type, item.key);
      totalBytes -= item.size;
    }
  }

  private updateMusicAccess(key: string): void {
    const entry = this.getMusicEntries()[key];
    if (!entry) return;
    entry.lastAccessAt = Date.now();
    entry.playCount = (entry.playCount || 0) + 1;
    this.persistMetadata();
  }

  private updateLyricAccess(key: string): void {
    const entry = this.getLyricEntries()[key];
    if (!entry) return;
    entry.lastAccessAt = Date.now();
    this.persistMetadata();
  }

  private async getCachedMusicUrl(payload: ResolveMusicUrlPayload): Promise<string | null> {
    const key = this.buildMusicKey(payload.songId, payload.source);
    const entries = this.getMusicEntries();
    const entry = entries[key];
    if (!entry) return null;
    if (!entry.filePath) return null;
    if (entry.urlHash !== this.buildUrlHash(payload.url)) return null;

    this.updateMusicAccess(key);
    return this.toLocalUrl(entry.filePath);
  }

  private async downloadAndCacheMusic(payload: ResolveMusicUrlPayload): Promise<void> {
    const config = this.getCacheConfig();
    if (!config.enabled || !this.isRemoteAudioUrl(payload.url)) return;

    this.ensureDirs();

    const key = this.buildMusicKey(payload.songId, payload.source);
    const source = payload.source || 'unknown';
    const urlHash = this.buildUrlHash(payload.url);
    const musicDir = this.getMusicDir();

    const existingEntry = this.getMusicEntries()[key];
    if (existingEntry && existingEntry.urlHash === urlHash && existingEntry.filePath) {
      return;
    }

    const tempFilePath = path.join(musicDir, `${key}_${Date.now()}.tmp`);
    let contentType: string | undefined;

    try {
      const axios = await import('axios');
      const response = await axios.default({
        url: payload.url,
        method: 'GET',
        responseType: 'stream',
        timeout: 30000,
        maxRedirects: 5
      });

      contentType =
        typeof response.headers['content-type'] === 'string'
          ? response.headers['content-type']
          : undefined;

      const writer = fs.createWriteStream(tempFilePath);
      await new Promise<void>((resolve, reject) => {
        response.data.on('error', reject);
        writer.on('error', reject);
        writer.on('finish', resolve);
        response.data.pipe(writer);
      });

      const extension = this.getExtensionFromCodec(payload.url, contentType);
      const filePath = path.join(musicDir, `${key}_${urlHash}${extension}`);

      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(tempFilePath);
      } else {
        await fs.promises.rename(tempFilePath, filePath);
      }

      if (existingEntry?.filePath && existingEntry.filePath !== filePath && fs.existsSync(existingEntry.filePath)) {
        await this.removeEntryFile(existingEntry.filePath);
      }

      const size = fs.statSync(filePath).size;
      const now = Date.now();

      const entries = this.getMusicEntries();
      entries[key] = {
        key,
        songId: payload.songId,
        source,
        filePath,
        urlHash,
        size,
        createdAt: existingEntry?.createdAt || now,
        lastAccessAt: now,
        playCount: (existingEntry?.playCount || 0) + 1,
        title: payload.title,
        artist: payload.artist
      };
      this.setMusicEntries(entries);

      await this.enforceCacheLimit();
    } catch (error) {
      console.error(`Caching music failed: ${payload.songId}`, error);
      if (fs.existsSync(tempFilePath)) {
        try { await fs.promises.unlink(tempFilePath); } catch { /* empty */ }
      }
    }
  }

  queueMusicCache(payload: ResolveMusicUrlPayload): void {
    const key = this.buildMusicKey(payload.songId, payload.source);
    const task = this.pendingMusicDownloads?.get(key);
    if (task) return;

    const pendingTask = this.downloadAndCacheMusic(payload).finally(() => {
      this.pendingMusicDownloads?.delete(key);
    });
    this.pendingMusicDownloads?.set(key, pendingTask);
  }

  public async resolveMusicUrl(payload: ResolveMusicUrlPayload): Promise<ResolveMusicUrlResult> {
    if (!payload || !payload.url || !payload.songId) {
      return { url: payload?.url || '', cached: false, queued: false };
    }

    if (/^(local|file):\/\//i.test(payload.url)) {
      return { url: payload.url, cached: true, queued: false };
    }

    const config = this.getCacheConfig();
    if (!config.enabled) {
      return { url: payload.url, cached: false, queued: false };
    }

    await this.pruneMissingEntries();

    const cachedUrl = await this.getCachedMusicUrl(payload);
    if (cachedUrl) {
      return { url: cachedUrl, cached: true, queued: false };
    }

    this.queueMusicCache(payload);
    return { url: payload.url, cached: false, queued: true };
  }

  public async cacheLyric(songId: number, lyricData: unknown): Promise<boolean> {
    try {
      const config = this.getCacheConfig();
      if (!config.enabled) return false;

      this.ensureDirs();
      const key = this.buildLyricKey(songId);
      const lyricDir = this.getLyricDir();
      const filePath = path.join(lyricDir, `${key}.json`);
      const content = JSON.stringify(lyricData);

      await fs.promises.writeFile(filePath, content, 'utf8');

      const now = Date.now();
      const entries = this.getLyricEntries();
      entries[key] = {
        key,
        songId,
        filePath,
        size: Buffer.byteLength(content, 'utf8'),
        createdAt: entries[key]?.createdAt || now,
        lastAccessAt: now
      };
      this.setLyricEntries(entries);

      await this.enforceCacheLimit();
      return true;
    } catch (error) {
      console.error('Failed to cache lyrics:', error);
      return false;
    }
  }

  public async getCachedLyric(songId: number): Promise<unknown | undefined> {
    try {
      const config = this.getCacheConfig();
      if (!config.enabled) return undefined;

      const key = this.buildLyricKey(songId);
      const entries = this.getLyricEntries();
      const entry = entries[key];
      if (!entry) return undefined;
      if (!entry.filePath) return undefined;

      const content = await fs.promises.readFile(entry.filePath, 'utf8');
      this.updateLyricAccess(key);
      return JSON.parse(content);
    } catch (error) {
      console.error('Failed to read cached lyrics:', error);
      return undefined;
    }
  }

  public async clearCache(scope: CacheScope = 'all'): Promise<boolean> {
    try {
      if (scope === 'all' || scope === 'music') {
        this.metadata.clear();
        this.persistMetadata();
      }
      if (scope === 'all' || scope === 'lyrics') {
        this.metadata.clear();
        this.persistMetadata();
      }
      return true;
    } catch (error) {
      console.error('Failed to clear cache:', error);
      return false;
    }
  }

  public async clearLyricCache(): Promise<boolean> {
    return await this.clearCache('lyrics');
  }

  public async getCacheStats(): Promise<DiskCacheStats> {
    const config = this.getCacheConfig();

    const musicEntries = Object.values(this.getMusicEntries());
    const lyricEntries = Object.values(this.getLyricEntries());

    const musicSizeBytes = musicEntries.reduce((sum, entry) => sum + entry.size, 0);
    const lyricSizeBytes = lyricEntries.reduce((sum, entry) => sum + entry.size, 0);
    const totalSizeBytes = musicSizeBytes + lyricSizeBytes;
    const totalLimitBytes = config.maxSizeMB * 1024 * 1024;
    const usage = totalLimitBytes > 0 ? Math.min(1, totalSizeBytes / totalLimitBytes) : 0;

    return {
      enabled: config.enabled,
      directory: config.directory,
      maxSizeMB: config.maxSizeMB,
      cleanupPolicy: config.cleanupPolicy,
      totalSizeBytes,
      musicSizeBytes,
      lyricSizeBytes,
      totalFiles: musicEntries.length + lyricEntries.length,
      musicFiles: musicEntries.length,
      lyricFiles: lyricEntries.length,
      usage
    };
  }
}

export const cacheManager = new DiskCacheManager();

export function initializeCacheManager(): void {
  // Cache manager initialized on creation
  // IPC handles are now routed through the Tauri preload bridge
  // The preload at src/preload/index.ts exposes these functions via contextBridge.invoke:
  //
  // - cache-lyric(id, lyricData) -> api.cacheLyric(id, lyricData)
  // - get-cached-lyric(id) -> api.getCachedLyric(id)
  // - resolve-cached-music-url(payload) -> api.resolveMusicUrl(payload)
  // - get-disk-cache-config() -> api.getCacheConfig()
  // - set-disk-cache-config(partial) -> api.updateCacheConfig(partial)
  // - switch-disk-cache-directory(payload) -> api.switchCacheDirectory(payload)
  // - get-disk-cache-stats() -> api.getCacheStats()
  // - clear-disk-cache(scope) -> api.clearCache(scope)
  // - clear-lyric-cache() -> api.clearLyricCache()
  //
  // Note: The ipcMain.handle calls have been replaced by the preload bridge.
  // The Rust side may also define corresponding #[tauri::command] functions.
}