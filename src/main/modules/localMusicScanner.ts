import * as crypto from 'crypto';
import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as mm from 'music-metadata';
import * as os from 'os';
import * as path from 'path';

const SUPPORTED_AUDIO_FORMATS = ['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac'] as const;
const METADATA_PARSE_CONCURRENCY = Math.min(8, Math.max(2, os.cpus().length));
const MAX_COVER_BYTES = 8 * 1024 * 1024;

const COVER_DIR_NAME = 'AudioCovers';
let cachedCoverDir: string | null = null;

function getCoverDir(): string {
  if (cachedCoverDir) return cachedCoverDir;
  const dir = path.join(app.getPath('userData'), COVER_DIR_NAME);
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (error) {
    console.error('Failed to create cover directory:', error);
  }
  cachedCoverDir = dir;
  return dir;
}

function extFromMime(mime: string | undefined): string {
  const sub = mime?.split('/')[1]?.split(';')[0]?.trim().toLowerCase();
  if (!sub) return 'bin';
  return sub === 'jpeg' ? 'jpg' : sub;
}

type LocalMusicMeta = {
  filePath: string;

  title: string;

  artist: string;

  album: string;

  duration: number;

  coverPath: string | null;

  lyrics: string | null;

  fileSize: number;

  modifiedTime: number;
};

type ScannedMusicFile = {
  path: string;
  modifiedTime: number;
};

function isSupportedFormat(ext: string): boolean {
  return (SUPPORTED_AUDIO_FORMATS as readonly string[]).includes(ext.toLowerCase());
}

function extractTitleFromFilename(filePath: string): string {
  const basename = path.basename(filePath);
  const dotIndex = basename.lastIndexOf('.');
  if (dotIndex > 0) {
    return basename.slice(0, dotIndex);
  }
  return basename;
}

async function extractCoverToFile(
  picture: mm.IPicture | undefined,
  sourceFilePath: string
): Promise<string | null> {
  if (!picture) {
    return null;
  }
  try {
    if (picture.data.length > MAX_COVER_BYTES) {
      console.warn(
        `The cover exceeds the maximum size and is skipped: ${sourceFilePath} (${picture.data.length} bytes > ${MAX_COVER_BYTES})`
      );
      return null;
    }
    const ext = extFromMime(picture.format);
    const hash = crypto.createHash('sha256').update(sourceFilePath).digest('hex');
    const coverFile = path.join(getCoverDir(), `${hash}.${ext}`);

    await fs.promises.writeFile(coverFile, Buffer.from(picture.data));
    return coverFile;
  } catch (error) {
    console.error('Cover placement failed:', error);
    return null;
  }
}

function extractLyrics(lyrics: mm.ILyricsTag[] | undefined): string | null {
  if (!lyrics || lyrics.length === 0) {
    return null;
  }
  try {
    const firstLyric = lyrics[0];
    return firstLyric?.text ?? null;
  } catch (error) {
    console.error('Lyrics extraction failed:', error);
    return null;
  }
}

async function scanMusicFiles(folderPath: string): Promise<string[]> {
  const results: string[] = [];

  if (!fs.existsSync(folderPath)) {
    throw new Error(`Folder does not exist: ${folderPath}`);
  }

  const stat = await fs.promises.stat(folderPath);
  if (!stat.isDirectory()) {
    throw new Error(`path is not a folder: ${folderPath}`);
  }

  async function walkDirectory(dirPath: string): Promise<void> {
    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          await walkDirectory(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (isSupportedFormat(ext)) {
            results.push(fullPath);
          }
        }
      }
    } catch (error) {
      console.error(`Scan directory failed: ${dirPath}`, error);
    }
  }

  await walkDirectory(folderPath);
  return results;
}

async function scanMusicFilesWithStats(folderPath: string): Promise<ScannedMusicFile[]> {
  const results: ScannedMusicFile[] = [];

  if (!fs.existsSync(folderPath)) {
    throw new Error(`Folder does not exist: ${folderPath}`);
  }

  const stat = await fs.promises.stat(folderPath);
  if (!stat.isDirectory()) {
    throw new Error(`path is not a folder: ${folderPath}`);
  }

  async function walkDirectory(dirPath: string): Promise<void> {
    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          await walkDirectory(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (!isSupportedFormat(ext)) {
            continue;
          }

          try {
            const fileStat = await fs.promises.stat(fullPath);
            results.push({
              path: fullPath,
              modifiedTime: fileStat.mtimeMs
            });
          } catch (error) {
            console.error(`Failed to read file information: ${fullPath}`, error);
          }
        }
      }
    } catch (error) {
      console.error(`Scan directory failed: ${dirPath}`, error);
    }
  }

  await walkDirectory(folderPath);
  return results;
}

async function parseMetadata(filePath: string): Promise<LocalMusicMeta> {
  let fileSize = 0;
  let modifiedTime = 0;
  try {
    const stat = await fs.promises.stat(filePath);
    fileSize = stat.size;
    modifiedTime = stat.mtimeMs;
  } catch (error) {
    console.error(`Failed to obtain file information: ${filePath}`, error);
  }

  const fallback: LocalMusicMeta = {
    filePath,
    title: extractTitleFromFilename(filePath),
    artist: 'unknown artist',
    album: 'unknown album',
    duration: 0,
    coverPath: null,
    lyrics: null,
    fileSize,
    modifiedTime
  };

  try {
    const metadata = await mm.parseFile(filePath);
    const { common, format } = metadata;

    return {
      filePath,
      title: common.title || fallback.title,
      artist: common.artist || fallback.artist,
      album: common.album || fallback.album,
      duration: format.duration ? Math.round(format.duration * 1000) : 0,
      coverPath: await extractCoverToFile(common.picture?.[0], filePath),
      lyrics: extractLyrics(common.lyrics),
      fileSize,
      modifiedTime
    };
  } catch (error) {
    console.error(`Metadata parsing failed, using fallback: ${filePath}`, error);
    return fallback;
  }
}

async function batchParseMetadata(filePaths: string[]): Promise<LocalMusicMeta[]> {
  if (filePaths.length === 0) {
    return [];
  }

  const results = new Array<LocalMusicMeta>(filePaths.length);
  const workerCount = Math.min(METADATA_PARSE_CONCURRENCY, filePaths.length);
  let index = 0;

  const workers = Array.from({ length: workerCount }, async () => {
    while (index < filePaths.length) {
      const current = index;
      index += 1;
      results[current] = await parseMetadata(filePaths[current]);
    }
  });

  await Promise.all(workers);
  return results;
}

export function initializeLocalMusicScanner(): void {
  ipcMain.handle('scan-local-music', async (_, folderPath: string) => {
    try {
      const files = await scanMusicFiles(folderPath);
      return { files, count: files.length };
    } catch (error: any) {
      console.error('Scanning local music failed:', error);
      return { error: error.message || 'Scan failed' };
    }
  });

  ipcMain.handle('scan-local-music-with-stats', async (_, folderPath: string) => {
    try {
      const files = await scanMusicFilesWithStats(folderPath);
      return { files, count: files.length };
    } catch (error: any) {
      console.error('Scan local music(Contains file information)fail:', error);
      return { error: error.message || 'Scan failed' };
    }
  });

  ipcMain.handle('parse-local-music-metadata', async (_, filePaths: string[]) => {
    try {
      const metadataList = await batchParseMetadata(filePaths);
      return metadataList;
    } catch (error: any) {
      console.error('Failed to parse local music metadata:', error);
      return [];
    }
  });
}
