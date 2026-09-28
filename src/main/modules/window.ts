import { dialog } from '@tauri/api';
import { join } from 'path';
import { open } from '@tauri/api/shell';
import { getSupportedPhysicalDisplays } from '@tauri/api/display';
import { getAppPath } from '@tauri/api/path';

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

let mainWindowInstance: any = null;
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
    // Tauri handles proxy differently; this is kept for reference
    console.log('Proxy enabled:', proxyRules);
  } else {
    console.log('Proxy disabled');
  }
}

function setupRoutes(app: express.Application) {
  app.get('/api/status', (_, res) => {
    res.json({
      isPlaying,
      currentSong
    });
  });

  app.post('/api/toggle-play', (_, res) => {
    if (!mainWindowInstance) {
      return res.status(500).json({ error: 'The main window is not initialized' });
    }
    mainWindowInstance?.api?.('global-shortcut', 'togglePlay');
    res.json({ success: true, message: 'Sent to play/pause command' });
  });

  app.post('/api/prev', (_, res) => {
    if (!mainWindowInstance) {
      return res.status(500).json({ error: 'The main window is not initialized' });
    }
    mainWindowInstance?.api?.('global-shortcut', 'prevPlay');
    res.json({ success: true, message: 'Previous command sent' });
  });

  app.post('/api/next', (_, res) => {
    if (!mainWindowInstance) {
      return res.status(500).json({ error: 'The main window is not initialized' });
    }
    mainWindowInstance?.api?.('global-shortcut', 'nextPlay');
    res.json({ success: true, message: 'Next command sent' });
  });

  app.post('/api/volume-up', (_, res) => {
    if (!mainWindowInstance) {
      return res.status(500).json({ error: 'The main window is not initialized' });
    }
    mainWindowInstance?.api?.('global-shortcut', 'volumeUp');
    res.json({ success: true, message: 'Volume increase command sent' });
  });

  app.post('/api/volume-down', (_, res) => {
    if (!mainWindowInstance) {
      return res.status(500).json({ error: 'The main window is not initialized' });
    }
    mainWindowInstance?.api?.('global-shortcut', 'volumeDown');
    res.json({ success: true, message: 'Volume down command sent' });
  });

  app.post('/api/toggle-favorite', (_, res) => {
    if (!mainWindowInstance) {
      return res.status(500).json({ error: 'The main window is not initialized' });
    }
    mainWindowInstance?.api?.('global-shortcut', 'toggleFavorite');
    res.json({ success: true, message: 'Favorites sent/Cancel favorite command' });
  });
}

export function initializeWindowManager() {
  initializeProxy();

  // Window management events are now handled via Tauri commands
  // and the preload bridge. The preload at src/preload/index.ts
  // exposes the necessary API functions to the Vue frontend.
}

export function createMainWindow(icon: any) {
  console.log('Start creating the main window...');

  const options = getWindowOptions();

  options.icon = icon;
  options.webPreferences = {
    preload: join(__dirname, '../preload/index.ts'),
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

  // In Tauri, the window is created by the Rust main process
  // This function is kept for compatibility but the actual
  // window creation happens in src-tauri/src/main.rs
  console.log('Window creation delegated to Tauri Rust main process');

  return null;
}

export function initializeWindowSizeHandlers(mainWindow: any) {
  // Window size handlers are now managed by Tauri's window-state plugin
  // and the window-size module
}

app.on('activate', () => {
  if (mainWindowInstance && !mainWindowInstance.isDestroyed()) {
    if (!mainWindowInstance.isVisible()) {
      mainWindowInstance.show();
    }
  }
});