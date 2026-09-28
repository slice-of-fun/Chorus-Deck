import { app, dialog } from '@tauri/api';
import { join } from 'path';
import { nativeImage } from '@tauri/api/image';
import { protocol } from '@tauri/api/protocol';
import { session } from '@tauri/api/session';

const FILE_LOCK_ERROR_CODES = new Set(['EBUSY', 'EPERM', 'EACCES', 'EAGAIN', 'EMFILE', 'ENFILE']);
process.on('uncaughtException', (error: NodeJS.ErrnoException) => {
  if (error?.code && FILE_LOCK_ERROR_CODES.has(error.code) && typeof error.path === 'string') {
    console.error('[main] File is occupied/Locked, this read and write has been ignored:', error.message);
    return;
  }
  console.error('[main] Uncaught exception:', error);
  dialog.showErrorBox(
    'A JavaScript error occurred in the main process',
    error?.stack || String(error)
  );
});
process.on('unhandledRejection', (reason) => {
  console.error('[main] unprocessed Promise reject:', reason);
});

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true,
      corsEnabled: true
    }
  }
]);

import { loadLyricWindow } from './lyric';
import { initializeCacheManager } from './modules/cache';
import { initializeConfig } from './modules/config';
import { initializeDownloadManager, setDownloadManagerWindow } from './modules/downloadManager';
import { initializeFileManager } from './modules/fileManager';
import { initializeFonts } from './modules/fonts';
import { initializeLocalMusicScanner } from './modules/localMusicScanner';
import { initLxMusicHttp } from './modules/lxMusicHttp';
import { initializeMpris, updateMprisCurrentSong, updateMprisPlayState } from './modules/mpris';
import { initializeOtherApi } from './modules/otherApi';
import { initializeRemoteControl } from './modules/remoteControl';
import { initializeShortcuts } from './modules/shortcuts';
import { setupThemeHandlers } from './modules/theme';
import { initializeTray, updateCurrentSong, updatePlayState } from './modules/tray';
import { setupUpdateHandlers } from './modules/update';
import { createMainWindow, initializeWindowManager, setAppQuitting } from './modules/window';
import { initWindowSizeManager } from './modules/window-size';
import { initializeYTMusic } from './modules/ytmusic';
import { DiscordPresenceManager } from './modules/DiscordPresenceManager';

const iconPath = join(__dirname, '../../resources');
const icon = nativeImage.createFromPath(
  process.platform === 'darwin'
    ? join(iconPath, 'icon.icns')
    : process.platform === 'win32'
      ? join(iconPath, 'logo.png')
      : join(iconPath, 'logo.png')
);

let mainWindow: import('@tauri/api/window').Window;
let discordManager: DiscordPresenceManager | null = null;

function initialize(_configStore: any) {
  initializeFileManager();

  initializeDownloadManager();

  initializeCacheManager();

  initializeOtherApi();

  initializeWindowManager();

  initializeFonts();


  initializeLocalMusicScanner();

  mainWindow = createMainWindow(icon);

  setDownloadManagerWindow(mainWindow);

  initializeTray(iconPath, mainWindow);

  initLxMusicHttp();

  loadLyricWindow(mainWindow);

  initializeShortcuts(mainWindow);

  initializeRemoteControl(mainWindow);

  initializeMpris(mainWindow);

  setupUpdateHandlers(mainWindow);

  setupThemeHandlers();

  initializeYTMusic();

  if (!discordManager) {
    discordManager = new DiscordPresenceManager();
  }
}

const isSingleInstance = app.requestSingleInstanceLock();

if (!isSingleInstance) {
  app.quit();
} else {
  if (process.platform === 'linux') {
    app.commandLine.appendSwitch('disable-features', 'MediaSessionService');
  }

  try {
    initializeConfig();
  } catch (error) {
    console.error('Config settings initialization failed:', error);
  }

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    app.setAppUserModelId('com.chorus.deck');

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window);
    });

    initWindowSizeManager();

    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
      if (permission === ('media' as any) || permission === ('audioCapture' as any)) {
        callback(false);
        return;
      }
      callback(true);
    });

    session.defaultSession.setPermissionCheckHandler(() => {
      return true;
    });

    const store = initializeConfig();

    initialize(store);

    app.on('activate', () => {
      if (mainWindow === null) initialize(store);
    });
  });
}