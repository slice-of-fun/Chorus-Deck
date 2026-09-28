import { app, dialog, ipcMain, protocol, shell } from 'electron';
import Store from 'electron-store';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';

import { getStore } from './config';

const audioCacheStore = new Store({
  name: 'audioCache',
  defaults: {
    cache: {}
  }
});

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildLocalFileResponse(
  filePath: string,
  total: number,
  rangeHeader: string | null
): Response {
  const range416 = () =>
    new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${total}` } });

  let start = 0;
  let end = total - 1;
  let partial = false;

  if (rangeHeader) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
    if (!m || (!m[1] && !m[2])) return range416();
    if (m[1]) {
      start = parseInt(m[1], 10);
      if (m[2]) end = Math.min(parseInt(m[2], 10), end);
    } else {
      start = Math.max(0, total - parseInt(m[2], 10));
    }
    if (start > end || start >= total) return range416();
    partial = true;
  }

  return new Response(
    Readable.toWeb(fs.createReadStream(filePath, { start, end })) as ReadableStream,
    {
      status: partial ? 206 : 200,
      headers: {
        'Content-Length': String(end - start + 1),
        'Accept-Ranges': 'bytes',
        ...(partial && { 'Content-Range': `bytes ${start}-${end}/${total}` })
      }
    }
  );
}

export function initializeFileManager() {
  protocol.handle('local', async (request) => {
    try {
      let filePath = decodeURIComponent(request.url.replace(/^local:\/\/\/?/, ''));

      if (/^\/[a-zA-Z]:\//.test(filePath)) {
        filePath = filePath.slice(1);
      }

      if (process.platform !== 'win32' && !filePath.startsWith('/')) {
        filePath = '/' + filePath;
      }

      filePath = path.normalize(filePath);

      const stat = await fs.promises.stat(filePath).catch(() => null);
      if (!stat?.isFile()) {
        console.error('File not found:', filePath);
        return new Response(null, { status: 404 });
      }

      return buildLocalFileResponse(filePath, stat.size, request.headers.get('range'));
    } catch (error) {
      console.error('Error handling local protocol:', error);
      return new Response(null, { status: 500 });
    }
  });

  ipcMain.handle('check-file-exists', (_, filePath) => {
    try {
      return fs.existsSync(filePath);
    } catch (error) {
      console.error('Error checking if file exists:', error);
      return false;
    }
  });

  ipcMain.handle('get-supported-audio-formats', () => {
    return {
      formats: [
        { ext: 'mp3', name: 'MP3' },
        { ext: 'm4a', name: 'M4A/AAC' },
        { ext: 'flac', name: 'FLAC' },
        { ext: 'wav', name: 'WAV' },
        { ext: 'ogg', name: 'OGG Vorbis' },
        { ext: 'aac', name: 'AAC' }
      ],
      default: 'mp3'
    };
  });

  ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select directory'
    });
    return result;
  });

  ipcMain.on('open-directory', (_, filePath) => {
    try {
      if (!filePath) {
        console.error('Invalid file path: Path is empty');
        return;
      }

      const normalizedPath = path.normalize(filePath);

      if (fs.statSync(normalizedPath).isDirectory()) {
        shell.openPath(normalizedPath);
      } else {
        shell.showItemInFolder(normalizedPath);
      }
    } catch (error) {
      console.error('Failed to open path:', error);
    }
  });

  ipcMain.handle('get-downloads-path', () => {
    return app.getPath('downloads');
  });

  ipcMain.handle(
    'save-lyric-file',
    async (_, { filename, lrcContent }: { filename: string; lrcContent: string }) => {
      try {
        const configStore = getStore();
        const downloadPath =
          (configStore.get('set.downloadPath') as string) || app.getPath('downloads');
        const sanitizedName = sanitizeFilename(filename);
        let filePath = path.join(downloadPath, `${sanitizedName}.lrc`);

        let counter = 1;
        while (fs.existsSync(filePath)) {
          filePath = path.join(downloadPath, `${sanitizedName} (${counter}).lrc`);
          counter++;
        }

        await fs.promises.writeFile(filePath, lrcContent, 'utf-8');
        return { success: true, path: filePath };
      } catch (error: any) {
        console.error('Failed to save lyrics file:', error);
        return { success: false, error: error.message };
      }
    }
  );

  ipcMain.on('clear-audio-cache', () => {
    audioCacheStore.set('cache', {});

    const tempDir = path.join(app.getPath('userData'), 'AudioCache');
    if (fs.existsSync(tempDir)) {
      try {
        fs.readdirSync(tempDir).forEach((file) => {
          const filePath = path.join(tempDir, file);
          if (file.endsWith('.mp3') || file.endsWith('.m4a')) {
            fs.unlinkSync(filePath);
          }
        });
      } catch (error) {
        console.error('Failed to clear audio cache files:', error);
      }
    }
  });

  ipcMain.handle('import-custom-api-plugin', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select a custom audio source profile',
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
      properties: ['openFile']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const filePath = result.filePaths[0];
    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');

      const pluginData = JSON.parse(fileContent);
      if (!pluginData.name || !pluginData.apiUrl) {
        throw new Error('Invalid plugin file, missing name or apiUrl field.');
      }

      return {
        name: pluginData.name,
        content: fileContent
      };
    } catch (error: any) {
      console.error('Failed to read or parse plugin file:', error);

      throw new Error(`File reading or parsing failed: ${error.message}`);
    }
  });

  ipcMain.handle('import-lx-music-script', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Luoxue sound source script file',
      filters: [{ name: 'JavaScript Files', extensions: ['js'] }],
      properties: ['openFile']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const filePath = result.filePaths[0];
    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');

      if (
        !fileContent.includes('globalThis.lx') &&
        !fileContent.includes('lx.on') &&
        !fileContent.includes('EVENT_NAMES')
      ) {
        throw new Error('Invalid Luoxue sound source script, not found globalThis.lx Related code.');
      }

      const hasMetaComment = fileContent.includes('@name');
      if (!hasMetaComment) {
        console.warn('warn: Script is missing @name Meta information annotation');
      }

      return {
        name: path.basename(filePath, '.js'),
        content: fileContent
      };
    } catch (error: any) {
      console.error('Failed to read Luoxue sound source script:', error);
      throw new Error(`Script reading failed: ${error.message}`);
    }
  });
}
