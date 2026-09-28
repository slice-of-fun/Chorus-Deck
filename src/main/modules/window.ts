import { is } from '@electron-toolkit/utils';
import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  nativeImage,
  screen,
  session,
  shell
} from 'electron';
import { join } from 'path';

import { getSharedStore } from './config';
import {
  applyContentZoom,
  applyInitialState,
  calculateMinimumWindowSize,
  DEFAULT_MAIN_HEIGHT,
  DEFAULT_MAIN_WIDTH,
  DEFAULT_MINI_HEIGHT,
  DEFAULT_MINI_WIDTH,
  getWindowOptions,
  getWindowState,
  initWindowSizeHandlers,
  saveWindowState,
  WindowState
} from './window-size';

const store = getSharedStore();

let mainWindowInstance: BrowserWindow | null = null;
let isPlaying = false;
let isAppQuitting = false;

let preMiniModeState: WindowState = {
  width: DEFAULT_MAIN_WIDTH,
  height: DEFAULT_MAIN_HEIGHT,
  x: undefined,
  y: undefined,
  isMaximized: false
};

export function setAppQuitting(quitting: boolean) {
  isAppQuitting = quitting;
}

function initializeProxy() {
  const defaultConfig = {
    enable: false,
    protocol: 'http',
    host: '127.0.0.1',
    port: 7890
  };

  const proxyConfig = store.get('set.proxyConfig', defaultConfig) as {
    enable: boolean;
    protocol: string;
    host: string;
    port: number;
  };

  if (proxyConfig?.enable) {
    const proxyRules = `${proxyConfig.protocol}://${proxyConfig.host}:${proxyConfig.port}`;
    session.defaultSession.setProxy({ proxyRules });
  } else {
    session.defaultSession.setProxy({ proxyRules: '' });
  }

  session.defaultSession.webRequest.onBeforeSendHeaders(
    {
      urls: [
        'https://yt3.ggpht.com/*',
        'https://yt3.googleusercontent.com/*',
        'https://lh3.googleusercontent.com/*',
        'https://i.ytimg.com/*'
      ]
    },
    (details, callback) => {
      const headers = {
        ...details.requestHeaders,
        'Referer': 'https://music.youtube.com/',
        'Origin': 'https://music.youtube.com',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      };
      callback({ requestHeaders: headers });
    }
  );
}

function setThumbarButtons(window: BrowserWindow) {
  window.setThumbarButtons([
    {
      tooltip: 'prev',
      icon: nativeImage.createFromPath(join(__dirname, '../../resources/icons', 'prev.png')),
      click() {
        window.webContents.send('global-shortcut', 'prevPlay');
      }
    },

    {
      tooltip: isPlaying ? 'pause' : 'play',
      icon: nativeImage.createFromPath(
        join(__dirname, '../../resources/icons', isPlaying ? 'pause.png' : 'play.png')
      ),
      click() {
        window.webContents.send('global-shortcut', 'togglePlay');
      }
    },

    {
      tooltip: 'next',
      icon: nativeImage.createFromPath(join(__dirname, '../../resources/icons', 'next.png')),
      click() {
        window.webContents.send('global-shortcut', 'nextPlay');
      }
    }
  ]);
}

export function initializeWindowManager() {
  initializeProxy();

  ipcMain.on('minimize-window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.minimize();
    }
  });

  ipcMain.on('maximize-window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
    }
  });

  ipcMain.on('close-window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      if (process.platform === 'darwin') {
        win.hide();
      } else {
        win.destroy();
        app.quit();
      }
    }
  });

  ipcMain.on('quit-app', () => {
    setAppQuitting(true);
    app.quit();
  });

  ipcMain.on('mini-tray', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.hide();
    }
  });

  ipcMain.on('mini-window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      preMiniModeState = saveWindowState(win);
      console.log('Save normal mode state for recovery:', JSON.stringify(preMiniModeState));

      const display = screen.getDisplayMatching(win.getBounds());
      const { width: screenWidth, x: screenX } = display.workArea;

      win.unmaximize();
      win.setMinimumSize(DEFAULT_MINI_WIDTH, DEFAULT_MINI_HEIGHT);
      win.setMaximumSize(DEFAULT_MINI_WIDTH, DEFAULT_MINI_HEIGHT);
      win.setSize(DEFAULT_MINI_WIDTH, DEFAULT_MINI_HEIGHT, false);

      win.setPosition(
        screenX + screenWidth - DEFAULT_MINI_WIDTH - 20,
        display.workArea.y + 20,
        false
      );
      win.setAlwaysOnTop(true);
      win.setSkipTaskbar(false);
      win.setResizable(false);

      win.webContents.send('navigate', '/mini');

      win.webContents.send('mini-mode', true);

      win.webContents.setZoomFactor(1);
    }
  });

  ipcMain.on('restore-window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.setResizable(true);
      win.setMaximumSize(0, 0);

      console.log('Restore from mini mode, using saved state:', JSON.stringify(preMiniModeState));

      const { minWidth, minHeight } = calculateMinimumWindowSize();
      win.setMinimumSize(minWidth, minHeight);

      win.setAlwaysOnTop(false);
      win.setSkipTaskbar(false);

      win.webContents.send('navigate', '/');

      win.webContents.send('mini-mode', false);

      setTimeout(() => {
        if (preMiniModeState.x !== undefined && preMiniModeState.y !== undefined) {
          win.setPosition(preMiniModeState.x, preMiniModeState.y, false);
        } else {
          win.center();
        }

        if (preMiniModeState.isMaximized) {
          win.maximize();
        } else {
          win.setSize(preMiniModeState.width, preMiniModeState.height, false);
        }

        applyContentZoom(win);

        setTimeout(() => {
          if (!win.isDestroyed() && !win.isMaximized() && !win.isMinimized()) {
            const [width, height] = win.getSize();
            if (
              Math.abs(width - preMiniModeState.width) > 2 ||
              Math.abs(height - preMiniModeState.height) > 2
            ) {
              console.log(
                `The window size is inconsistent after recovery, adjust again: current=${width}x${height}, Target=${preMiniModeState.width}x${preMiniModeState.height}`
              );
              win.setSize(preMiniModeState.width, preMiniModeState.height, false);
            }
          }
        }, 150);
      }, 50);
    }
  });

  ipcMain.on('update-play-state', (_, playing: boolean) => {
    isPlaying = playing;
    if (mainWindowInstance) {
      setThumbarButtons(mainWindowInstance);
    }
  });

  store.onDidChange('set.proxyConfig', () => {
    initializeProxy();
  });

  initWindowSizeHandlers(mainWindowInstance);

  app.on('activate', () => {
    if (mainWindowInstance && !mainWindowInstance.isDestroyed()) {
      if (!mainWindowInstance.isVisible()) {
        mainWindowInstance.show();
      }
    }
  });
}

export function createMainWindow(icon: Electron.NativeImage): BrowserWindow {
  console.log('Start creating the main window...');

  const options = getWindowOptions();

  options.icon = icon;
  options.webPreferences = {
    preload: join(__dirname, '../preload/index.js'),
    sandbox: false,
    contextIsolation: true,
    webSecurity: false
  };

  console.log(
    `Create window, use options: ${JSON.stringify({
      width: options.width,
      height: options.height,
      x: options.x,
      y: options.y,
      minWidth: options.minWidth,
      minHeight: options.minHeight
    })}`
  );

  const mainWindow = new BrowserWindow(options);

  const appOrigin = (() => {
    if (!is.dev || !process.env.ELECTRON_RENDERER_URL) return null;
    try {
      return new URL(process.env.ELECTRON_RENDERER_URL).origin;
    } catch {
      return null;
    }
  })();

  const shouldOpenInBrowser = (targetUrl: string): boolean => {
    try {
      const parsedUrl = new URL(targetUrl);
      if (parsedUrl.protocol === 'mailto:' || parsedUrl.protocol === 'tel:') {
        return true;
      }

      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        return false;
      }

      if (appOrigin && parsedUrl.origin === appOrigin) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  };

  const openInSystemBrowser = (targetUrl: string) => {
    shell.openExternal(targetUrl).catch((error) => {
      console.error('Failed to open external link:', targetUrl, error);
    });
  };

  mainWindow.removeMenu();

  applyInitialState(mainWindow);

  const savedState = getWindowState();
  if (savedState) {
    preMiniModeState = { ...savedState };
  }

  mainWindow.on('show', () => {
    setThumbarButtons(mainWindow);
  });

  mainWindow.on('close', (event) => {
    if (process.platform === 'darwin') {
      if (!isAppQuitting) {
        event.preventDefault();
        mainWindow.hide();
        return;
      }
    }
  });

  mainWindow.on('ready-to-show', () => {
    const [width, height] = mainWindow.getSize();
    console.log(`The size of the window before it is displayed: ${width}x${height}`);

    if (savedState && !savedState.isMaximized) {
      mainWindow.setSize(savedState.width, savedState.height, false);
    }

    mainWindow.show();

    applyContentZoom(mainWindow);

    setTimeout(() => {
      if (!mainWindow.isDestroyed() && !mainWindow.isMaximized()) {
        const [currentWidth, currentHeight] = mainWindow.getSize();
        if (savedState && !savedState.isMaximized) {
          if (
            Math.abs(currentWidth - savedState.width) > 2 ||
            Math.abs(currentHeight - savedState.height) > 2
          ) {
            console.log(
              `Window size does not match, adjust again: current=${currentWidth}x${currentHeight}, Target=${savedState.width}x${savedState.height}`
            );
            mainWindow.setSize(savedState.width, savedState.height, false);
          }
        }
      }
    }, 100);
  });

  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    if (!shouldOpenInBrowser(targetUrl)) return;
    event.preventDefault();
    openInSystemBrowser(targetUrl);
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (shouldOpenInBrowser(details.url)) {
      openInSystemBrowser(details.url);
    }
    return { action: 'deny' };
  });

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);

    globalShortcut.register('CommandOrControl+Shift+I', () => {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    });
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  initWindowSizeHandlers(mainWindow);

  mainWindowInstance = mainWindow;

  return mainWindow;
}
