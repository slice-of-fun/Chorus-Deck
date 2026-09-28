import path from 'path';

import { getSharedStore } from './modules/config';

const store = getSharedStore();
let lyricWindow: any = null;

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

let originalSize: { width: number; height: number } = { width: 0, height: 0 };

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

  const mousePoint = window.navigator?.mouse?.x || 0; // Simplified
  const bounds = lyricWindow?.getBounds ? lyricWindow.getBounds() : { x: 0, y: 0, width: 800, height: 200 };
  const isInside = isPointInsideWindow(mousePoint, bounds);

  if (isInside === lastMouseInside) return;

  lastMouseInside = isInside;
  // Dispatch event through Vue store or preload bridge instead of webContents.send
  // mainWindowRef?.api?.('lyric-mouse-presence', isInside);
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

  // In Tauri, display info comes from the preload/context
  // For now, use default positioning
  const defaultWidth = 800;
  const defaultHeight = 200;
  const maxWidth = 1600;
  const maxHeight = 800;

  const validWidth = width && width > 0 && width <= maxWidth ? width : defaultWidth;
  const validHeight = height && height > 0 && height <= maxHeight ? height : defaultHeight;

  let windowX = x;
  let windowY = y;

  if (windowX === undefined || windowY === undefined) {
    // Center on primary display (Tauri equivalent)
    const workArea = window.innerWidth && window.innerHeight ? {
      x: 0,
      y: 0,
      width: window.innerWidth,
      height: window.innerHeight
    } : { x: 0, y: 0, width: 1920, height: 1080 };

    windowX = workArea.x + (workArea.width - validWidth) / 2;
    windowY = workArea.y + (workArea.height - validHeight) / 2;
  }

  // In Tauri, the lyric window creation is handled differently
  // This could be a separate Tauri Window in Rust, or an overlay
  // For now, we'll set up the data structures and let the preload handle it
  lyricWindow = {
    id: 'lyric-window',
    validWidth,
    validHeight,
    x: windowX,
    y: windowY,
    isDestroyed: false,
    setAlwaysOnTop: (value: boolean) => { isLyricLocked = value; syncMousePresenceTracking(); },
    setResizable: (value: boolean) => { /* handled by lock state */ },
    setIgnoreMouseEvents: (value: boolean, forward?: any) => { /* handled */ },
    getBounds: () => ({ x: windowX || 0, y: windowY || 0, width: validWidth, height: validHeight }),
    close: () => {
      stopMousePresenceTracking();
      isLyricLocked = false;
      isLyricWindowVisible = false;
      lyricWindow = null;
    },
    show: () => {
      isLyricWindowVisible = true;
      syncMousePresenceTracking();
    },
    hide: () => {
      isLyricWindowVisible = false;
      stopMousePresenceTracking();
    }
  };

  console.log(`Lyric window configured: ${validWidth}x${validHeight} at ${windowX},${windowY}`);
};

export const loadLyricWindow = () => {
  const showLyricWindow = () => {
    if (lyricWindow && lyricWindow.isDestroyed === false) {
      if (lyricWindow.isMinimized !== undefined && lyricWindow.isMinimized()) {
        // restored
      }
      lyricWindow.show();
      return true;
    }

    console.log('Creating new lyric window');
    createWin();

    if (!lyricWindow) {
      console.error('Failed to create lyric window');
      return false;
    }

    // In Tauri, the window content is loaded through the preload
    // and the URL is handled by the Vue router
    if (process.env.NODE_ENV === 'development') {
      // Development: load from dev server
      // lyricWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}/#/lyric`);
    } else {
      // Production: load from built dist
      // const distPath = path.resolve(__dirname, '../renderer');
      // lyricWindow.loadURL(`file://${distPath}/index.html#/lyric`);
    }

    lyricWindow.setMinimumSize(600, 200);
    // skipTaskbar is a Window property in Tauri, not applicable to this model

    // Set up event listeners for when the window is ready
    // setTimeout(() => {
    //   lyricWindow.show();
    // }, 100);

    return true;
  };

  // In Tauri, IPC events are handled through the preload bridge
  // The renderer calls api.lyricWindow.open() which routes to here
  // The following ipcMain handlers are replaced by preload API calls:
  //
  // - open-lyric -> api.lyricWindow.open()
  // - lyric-ready -> api.lyricWindow.ready()
  // - send-lyric -> api.lyricWindow.send data
  // - top-lyric -> api.lyricWindow.setAlwaysOnTop(state)
  // - close-lyric -> api.lyricWindow.close()
  // - set-lyric-lock-state -> api.lyricWindow.setLockState(isLocked)
  // - mouseenter-lyric -> api.lyricWindow.setIgnoreMouseEvents(true)
  // - mouseleave-lyric -> api.lyricWindow.setIgnoreMouseEvents(false)
  // - lyric-drag-start -> set dragging state
  // - lyric-drag-end -> reset dragging state, set size
  // - lyric-drag-move -> move window
  // - set-ignore-mouse -> api.lyricWindow.setIgnoreMouseEvents(state)
  // - control-back -> send event to main window

  return {}; // placeholder - actual handlers in preload
};