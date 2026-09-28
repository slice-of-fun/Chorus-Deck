import { BrowserWindow, IpcMain, screen } from 'electron';
import path, { join } from 'path';

import { getSharedStore } from './modules/config';

const store = getSharedStore();
let lyricWindow: BrowserWindow | null = null;

let lyricBoundsSaveTimer: ReturnType<typeof setTimeout> | null = null;
const saveLyricWindowBounds = (bounds: Record<string, number>) => {
  if (lyricBoundsSaveTimer) {
    clearTimeout(lyricBoundsSaveTimer);
  }
  lyricBoundsSaveTimer = setTimeout(() => {
    lyricBoundsSaveTimer = null;
    try {
      store.set('lyricWindowBounds', bounds);
    } catch (error) {
      console.error('Failed to save lyrics window location:', error);
    }
  }, 500);
};

let isDragging = false;

let originalSize = { width: 0, height: 0 };

let mousePresenceTimer: ReturnType<typeof setInterval> | null = null;
let lastMouseInside: boolean | null = null;
let isLyricLocked = false;
let isLyricWindowVisible = false;

const isPointInsideWindow = (
  point: { x: number; y: number },
  bounds: { x: number; y: number; width: number; height: number }
) => {
  return (
    point.x >= bounds.x &&
    point.x < bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y < bounds.y + bounds.height
  );
};

const stopMousePresenceTracking = () => {
  if (mousePresenceTimer) {
    clearInterval(mousePresenceTimer);
    mousePresenceTimer = null;
  }
  lastMouseInside = null;
};

const emitMousePresence = () => {
  if (!lyricWindow || lyricWindow.isDestroyed()) return;

  const mousePoint = screen.getCursorScreenPoint();
  const bounds = lyricWindow.getBounds();
  const isInside = isPointInsideWindow(mousePoint, bounds);

  if (isInside === lastMouseInside) return;

  lastMouseInside = isInside;
  lyricWindow.webContents.send('lyric-mouse-presence', isInside);
};

const startMousePresenceTracking = () => {
  if (mousePresenceTimer) return;

  emitMousePresence();
  mousePresenceTimer = setInterval(() => {
    if (!lyricWindow || lyricWindow.isDestroyed()) {
      stopMousePresenceTracking();
      return;
    }
    emitMousePresence();
  }, 50);
};

const syncMousePresenceTracking = () => {
  if (isLyricLocked && isLyricWindowVisible && lyricWindow && !lyricWindow.isDestroyed()) {
    startMousePresenceTracking();
  } else {
    stopMousePresenceTracking();
  }
};

const createWin = () => {
  console.log('Creating lyric window');

  const windowBounds =
    (store.get('lyricWindowBounds') as {
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      displayId?: number;
    }) || {};

  const { x, y, width, height, displayId } = windowBounds;

  const displays = screen.getAllDisplays();
  let isValidPosition = false;
  let targetDisplay = displays[0];

  if (displayId) {
    const matchedDisplay = displays.find((d) => d.id === displayId);
    if (matchedDisplay) {
      targetDisplay = matchedDisplay;
      console.log('Found matching display by ID:', displayId);
    }
  }

  if (x !== undefined && y !== undefined) {
    for (const display of displays) {
      const { bounds } = display;
      if (
        x >= bounds.x - 50 &&
        x < bounds.x + bounds.width + 50 &&
        y >= bounds.y - 50 &&
        y < bounds.y + bounds.height + 50
      ) {
        isValidPosition = true;
        targetDisplay = display;
        break;
      }
    }
  }

  const defaultWidth = 800;
  const defaultHeight = 200;
  const maxWidth = 1600;
  const maxHeight = 800;

  const validWidth = width && width > 0 && width <= maxWidth ? width : defaultWidth;
  const validHeight = height && height > 0 && height <= maxHeight ? height : defaultHeight;

  let windowX = isValidPosition ? x : undefined;
  let windowY = isValidPosition ? y : undefined;

  if (windowX === undefined || windowY === undefined) {
    windowX = targetDisplay.bounds.x + (targetDisplay.bounds.width - validWidth) / 2;
    windowY = targetDisplay.bounds.y + (targetDisplay.bounds.height - validHeight) / 2;
  }

  lyricWindow = new BrowserWindow({
    width: validWidth,
    height: validHeight,
    x: windowX,
    y: windowY,
    frame: false,
    show: false,
    transparent: true,
    opacity: 1,
    hasShadow: false,
    alwaysOnTop: true,
    resizable: true,
    roundedCorners: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: false,

    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    },
    backgroundColor: '#00000000'
  });

  lyricWindow.on('closed', () => {
    stopMousePresenceTracking();
    isLyricLocked = false;
    isLyricWindowVisible = false;
    if (lyricWindow) {
      lyricWindow.destroy();
      lyricWindow = null;
    }
  });

  lyricWindow.on('show', () => {
    isLyricWindowVisible = true;
    syncMousePresenceTracking();
  });
  lyricWindow.on('hide', () => {
    isLyricWindowVisible = false;
    stopMousePresenceTracking();
  });
  lyricWindow.on('minimize', () => {
    isLyricWindowVisible = false;
    stopMousePresenceTracking();
  });
  lyricWindow.on('restore', () => {
    isLyricWindowVisible = true;
    syncMousePresenceTracking();
  });

  lyricWindow.on('resize', () => {
    if (isDragging) return;

    if (lyricWindow && !lyricWindow.isDestroyed()) {
      const [width, height] = lyricWindow.getSize();
      const [x, y] = lyricWindow.getPosition();

      saveLyricWindowBounds({ x, y, width, height });
    }
  });

  lyricWindow.on('blur', () => lyricWindow && lyricWindow.setMaximizable(false));

  return lyricWindow;
};

export const loadLyricWindow = (ipcMain: IpcMain, mainWin: BrowserWindow): void => {
  const showLyricWindow = () => {
    if (lyricWindow && !lyricWindow.isDestroyed()) {
      if (lyricWindow.isMinimized()) {
        lyricWindow.restore();
      }
      lyricWindow.focus();
      lyricWindow.show();
      return true;
    }
    return false;
  };

  ipcMain.on('open-lyric', () => {
    console.log('Received open-lyric request');

    if (showLyricWindow()) {
      return;
    }

    console.log('Creating new lyric window');
    const win = createWin();

    if (!win) {
      console.error('Failed to create lyric window');
      return;
    }

    if (process.env.NODE_ENV === 'development') {
      win.webContents.openDevTools({ mode: 'detach' });
      win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/#/lyric`);
    } else {
      const distPath = path.resolve(__dirname, '../renderer');
      win.loadURL(`file://${distPath}/index.html#/lyric`);
    }

    win.setMinimumSize(600, 200);
    win.setSkipTaskbar(true);

    win.once('ready-to-show', () => {
      console.log('Lyric window ready to show');
      win.show();
    });
  });

  ipcMain.on('lyric-ready', () => {
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('lyric-window-ready');
    }
  });

  ipcMain.on('send-lyric', (_, data) => {
    if (lyricWindow && !lyricWindow.isDestroyed()) {
      try {
        lyricWindow.webContents.send('receive-lyric', data);
      } catch (error) {
        console.error('Error processing lyric data:', error);
      }
    }
  });

  ipcMain.on('top-lyric', (_, data) => {
    if (lyricWindow && !lyricWindow.isDestroyed()) {
      lyricWindow.setAlwaysOnTop(data);
    }
  });

  ipcMain.on('close-lyric', () => {
    if (lyricWindow && !lyricWindow.isDestroyed()) {
      lyricWindow.webContents.send('lyric-window-close');
      mainWin.webContents.send('lyric-control-back', 'close');
      mainWin.webContents.send('lyric-window-closed');
      lyricWindow.destroy();
      lyricWindow = null;
    }
  });

  ipcMain.on('set-lyric-lock-state', (_, isLocked: boolean) => {
    isLyricLocked = isLocked;
    if (lyricWindow && !lyricWindow.isDestroyed()) {
      lyricWindow.setResizable(!isLocked);

      lyricWindow.setIgnoreMouseEvents(isLocked, { forward: true });
    }
    syncMousePresenceTracking();
  });

  ipcMain.on('mouseenter-lyric', () => {
    if (lyricWindow && !lyricWindow.isDestroyed()) {
      lyricWindow.setIgnoreMouseEvents(true);
    }
  });

  ipcMain.on('mouseleave-lyric', () => {
    if (lyricWindow && !lyricWindow.isDestroyed()) {
      lyricWindow.setIgnoreMouseEvents(false);
    }
  });

  ipcMain.on('lyric-drag-start', () => {
    isDragging = true;
    if (lyricWindow && !lyricWindow.isDestroyed()) {
      const [width, height] = lyricWindow.getSize();
      originalSize = { width, height };
    }
  });

  ipcMain.on('lyric-drag-end', () => {
    isDragging = false;
    if (lyricWindow && !lyricWindow.isDestroyed()) {
      lyricWindow.setSize(originalSize.width, originalSize.height);
    }
  });

  ipcMain.on('lyric-drag-move', (_, { deltaX, deltaY }) => {
    if (!lyricWindow || lyricWindow.isDestroyed() || !isDragging) return;

    const [currentX, currentY] = lyricWindow.getPosition();

    const windowWidth = originalSize.width;
    const windowHeight = originalSize.height;

    const newX = currentX + deltaX;
    const newY = currentY + deltaY;

    try {
      const mousePoint = screen.getCursorScreenPoint();
      const currentDisplay = screen.getDisplayNearestPoint(mousePoint);

      lyricWindow.setBounds(
        {
          x: newX,
          y: newY,
          width: windowWidth,
          height: windowHeight
        },
        false
      );

      const windowBounds = {
        x: newX,
        y: newY,
        width: windowWidth,
        height: windowHeight,
        displayId: currentDisplay.id
      };
      saveLyricWindowBounds(windowBounds);
    } catch (error) {
      console.error('Error during window drag:', error);

      lyricWindow.setPosition(newX, newY);
    }
  });

  ipcMain.on('set-ignore-mouse', (_, shouldIgnore) => {
    if (!lyricWindow || lyricWindow.isDestroyed()) return;

    lyricWindow.setIgnoreMouseEvents(shouldIgnore, { forward: true });
  });

  ipcMain.on('control-back', (_, command) => {
    console.log('command', command);
    if (mainWin && !mainWin.isDestroyed()) {
      console.log('Sending control-back command:', command);
      mainWin.webContents.send('lyric-control-back', command);
    }
  });
};
