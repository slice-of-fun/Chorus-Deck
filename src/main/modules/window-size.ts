import { app, BrowserWindow, ipcMain, screen } from 'electron';
import type Store from 'electron-store';

import { getSharedStore } from './config';

const store = getSharedStore();

export const DEFAULT_MAIN_WIDTH = 1200;
export const DEFAULT_MAIN_HEIGHT = 780;
export const DEFAULT_MINI_WIDTH = 340;
export const DEFAULT_MINI_HEIGHT = 64;
export const DEFAULT_MINI_EXPANDED_HEIGHT = 400;

export const WINDOW_STATE_KEY = 'windowState';

const ABSOLUTE_MIN_WIDTH = 900;
const ABSOLUTE_MIN_HEIGHT = 640;
let MIN_WIDTH = ABSOLUTE_MIN_WIDTH;
let MIN_HEIGHT = ABSOLUTE_MIN_HEIGHT;

let ipcHandlersRegistered = false;

export interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  isMaximized: boolean;
}

class WindowSizeManager {
  private store: Store<Record<string, unknown>>;
  private mainWindow: BrowserWindow | null = null;
  private savedState: WindowState | null = null;
  private isInitialized: boolean = false;
  private saveStateDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.store = store;
  }

  private scheduleSaveWindowState(win: BrowserWindow): void {
    if (this.saveStateDebounceTimer) {
      clearTimeout(this.saveStateDebounceTimer);
    }
    this.saveStateDebounceTimer = setTimeout(() => {
      this.saveStateDebounceTimer = null;
      if (!win.isDestroyed() && !win.isMinimized()) {
        this.saveWindowState(win);
      }
    }, 500);
  }

  private flushScheduledSave(): void {
    if (this.saveStateDebounceTimer) {
      clearTimeout(this.saveStateDebounceTimer);
      this.saveStateDebounceTimer = null;
    }
  }

  initialize(): void {
    if (!app.isReady()) {
      console.warn('WindowSizeManager.initialize() must be in app ready Call later!');
      return;
    }

    if (this.isInitialized) {
      return;
    }

    this.initMinimumWindowSize();
    this.setupIPCHandlers();
    this.isInitialized = true;
    console.log('Window size manager initialization completed');
  }

  setMainWindow(win: BrowserWindow): void {
    if (!this.isInitialized) {
      this.initialize();
    }

    this.mainWindow = win;

    this.savedState = this.getWindowState();

    this.setupEventListeners(win);

    this.saveWindowState(win);
  }

  private initMinimumWindowSize(): void {
    if (!app.isReady()) {
      console.warn('Can’t be there app ready visited before screen module');
      return;
    }

    try {
      const { width: workAreaWidth, height: workAreaHeight } = screen.getPrimaryDisplay().workArea;

      MIN_WIDTH = Math.max(ABSOLUTE_MIN_WIDTH, Math.round(workAreaWidth * 0.3));
      MIN_HEIGHT = Math.max(ABSOLUTE_MIN_HEIGHT, Math.round(workAreaHeight * 0.3));

      console.log(`Set minimum window size: ${MIN_WIDTH}x${MIN_HEIGHT}`);
    } catch (error) {
      console.error('Failed to initialize minimum window size:', error);

      MIN_WIDTH = ABSOLUTE_MIN_WIDTH;
      MIN_HEIGHT = ABSOLUTE_MIN_HEIGHT;
    }
  }

  private setupEventListeners(win: BrowserWindow): void {
    win.on('resize', () => {
      if (!win.isDestroyed() && !win.isMinimized()) {
        this.scheduleSaveWindowState(win);
      }
    });

    win.on('move', () => {
      if (!win.isDestroyed() && !win.isMinimized()) {
        this.scheduleSaveWindowState(win);
      }
    });

    win.on('maximize', () => {
      if (!win.isDestroyed()) {
        this.saveWindowState(win);
      }
    });

    win.on('unmaximize', () => {
      if (!win.isDestroyed()) {
        this.saveWindowState(win);
      }
    });

    win.on('close', () => {
      this.flushScheduledSave();
      if (!win.isDestroyed()) {
        this.saveWindowState(win);
      }
    });

    win.webContents.on('did-finish-load', () => {
      this.enforceCorrectSize(win);
    });

    win.on('ready-to-show', () => {
      this.enforceCorrectSize(win);
    });
  }

  private enforceCorrectSize(win: BrowserWindow): void {
    if (!this.savedState || win.isMaximized() || win.isMinimized() || win.isDestroyed()) {
      return;
    }

    const [currentWidth, currentHeight] = win.getSize();

    if (
      Math.abs(currentWidth - this.savedState.width) > 2 ||
      Math.abs(currentHeight - this.savedState.height) > 2
    ) {
      console.log(
        `Force window resize: current=${currentWidth}x${currentHeight}, Target=${this.savedState.width}x${this.savedState.height}`
      );

      const [minWidth, minHeight] = win.getMinimumSize();
      win.setMinimumSize(1, 1);

      win.setSize(this.savedState.width, this.savedState.height, false);

      win.setMinimumSize(minWidth, minHeight);

      const [newWidth, newHeight] = win.getSize();
      console.log(`Window size after adjustment: ${newWidth}x${newHeight}`);

      if (
        Math.abs(newWidth - this.savedState.width) > 1 ||
        Math.abs(newHeight - this.savedState.height) > 1
      ) {
        console.log(`The window size is still inconsistent after adjustment, and the adjustment will be tried again.`);
        setTimeout(() => {
          if (!win.isDestroyed() && !win.isMaximized() && !win.isMinimized()) {
            win.setSize(this.savedState!.width, this.savedState!.height, false);
          }
        }, 50);
      }
    }
  }

  getWindowOptions(): Electron.BrowserWindowConstructorOptions {
    if (!this.isInitialized && app.isReady()) {
      this.initialize();
    }

    const savedState = this.getWindowState();

    const options: Electron.BrowserWindowConstructorOptions = {
      width: savedState?.width || DEFAULT_MAIN_WIDTH,
      height: savedState?.height || DEFAULT_MAIN_HEIGHT,
      minWidth: MIN_WIDTH,
      minHeight: MIN_HEIGHT,
      show: false,
      frame: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    };

    if (savedState?.x !== undefined && savedState?.y !== undefined && app.isReady()) {
      if (this.isPositionVisible(savedState.x, savedState.y)) {
        options.x = savedState.x;
        options.y = savedState.y;
      }
    }

    console.log(
      `Window creation options: size=${options.width}x${options.height}, Location=(${options.x}, ${options.y})`
    );

    return options;
  }

  applyInitialState(win: BrowserWindow): void {
    const savedState = this.getWindowState();

    if (!savedState) {
      win.center();
      return;
    }

    if (savedState.isMaximized) {
      console.log('Apply saved maximized state');
      win.maximize();
    } else if (
      !app.isReady() ||
      savedState.x === undefined ||
      savedState.y === undefined ||
      !this.isPositionVisible(savedState.x, savedState.y)
    ) {
      console.log('The saved location is invalid and the window is centered.');
      win.center();
    }
  }

  saveWindowState(win: BrowserWindow): WindowState {
    if (win.isDestroyed()) {
      return (
        this.savedState || {
          width: DEFAULT_MAIN_WIDTH,
          height: DEFAULT_MAIN_HEIGHT,
          isMaximized: false
        }
      );
    }

    const [currentWidth, currentHeight] = win.getSize();
    const isMiniMode =
      currentWidth === DEFAULT_MINI_WIDTH &&
      (currentHeight === DEFAULT_MINI_HEIGHT || currentHeight === DEFAULT_MINI_EXPANDED_HEIGHT);

    const isMaximized = win.isMaximized();
    let state: WindowState;

    if (isMaximized) {
      const currentBounds = win.getBounds();
      const previousSize =
        this.savedState && !this.savedState.isMaximized
          ? { width: this.savedState.width, height: this.savedState.height }
          : { width: currentBounds.width, height: currentBounds.height };

      state = {
        width: previousSize.width,
        height: previousSize.height,
        x: currentBounds.x,
        y: currentBounds.y,
        isMaximized: true
      };
      console.log('state IsMaximized', state);
    } else if (win.isMinimized()) {
      console.log('state IsMinimized', this.savedState);
      return (
        this.savedState || {
          width: DEFAULT_MAIN_WIDTH,
          height: DEFAULT_MAIN_HEIGHT,
          isMaximized: false
        }
      );
    } else {
      const [width, height] = win.getSize();
      const [x, y] = win.getPosition();

      state = {
        width,
        height,
        x,
        y,
        isMaximized: false
      };
      console.log('state IsNormal', state);
    }

    if (isMiniMode) {
      console.log('detectedminiModal window, not saved to persistent storage');
      return state;
    }

    try {
      this.store.set(WINDOW_STATE_KEY, state);
      console.log(`Window state saved: ${JSON.stringify(state)}`);
    } catch (error) {
      console.error('Failed to save window state:', error);
    }

    this.savedState = state;
    console.log('state', state);

    return state;
  }

  getWindowState(): WindowState | null {
    let state: WindowState | undefined;
    try {
      state = this.store.get(WINDOW_STATE_KEY) as WindowState | undefined;
    } catch (error) {
      console.error('Failed to read window status:', error);
      return this.savedState;
    }

    if (!state) {
      console.log('No saved window state found, default will be used');
      return null;
    }

    const validatedState: WindowState = {
      width: Math.max(MIN_WIDTH, state.width || DEFAULT_MAIN_WIDTH),
      height: Math.max(MIN_HEIGHT, state.height || DEFAULT_MAIN_HEIGHT),
      x: state.x,
      y: state.y,
      isMaximized: !!state.isMaximized
    };

    console.log(`Read saved window state: ${JSON.stringify(validatedState)}`);

    return validatedState;
  }

  isPositionVisible(x: number, y: number): boolean {
    if (!app.isReady()) {
      return false;
    }

    try {
      const displays = screen.getAllDisplays();

      for (const display of displays) {
        const { x: screenX, y: screenY, width, height } = display.workArea;
        if (x >= screenX && x < screenX + width && y >= screenY && y < screenY + height) {
          return true;
        }
      }
    } catch (error) {
      console.error('Checking location visibility failed:', error);
      return false;
    }

    return false;
  }

  calculateContentZoomFactor(): number {
    if (!app.isReady()) {
      return 1;
    }

    try {
      const { scaleFactor } = screen.getPrimaryDisplay();

      let zoomFactor = 1;

      if (scaleFactor > 1) {
        if (scaleFactor >= 2.5) {
          zoomFactor = 0.7;
        } else if (scaleFactor >= 2) {
          zoomFactor = 0.8;
        } else if (scaleFactor >= 1.5) {
          zoomFactor = 0.85;
        } else if (scaleFactor > 1.25) {
          zoomFactor = 0.9;
        } else {
          zoomFactor = 1;
        }
      }

      const userZoomFactor = this.store.get('set.contentZoomFactor') as number | undefined;
      if (userZoomFactor) {
        zoomFactor = userZoomFactor;
      }

      return zoomFactor;
    } catch (error) {
      console.error('Calculating content scaling factor failed:', error);
      return 1;
    }
  }

  applyContentZoom(win: BrowserWindow): void {
    const zoomFactor = this.calculateContentZoomFactor();
    win.webContents.setZoomFactor(zoomFactor);

    if (app.isReady()) {
      try {
        console.log(
          `Apply page scaling factor: ${zoomFactor}, System scaling ratio: ${screen.getPrimaryDisplay().scaleFactor}`
        );
      } catch (error) {
        console.error('Failed to obtain system scaling ratio:', error);
      }
    } else {
      console.log(`Apply page scaling factor: ${zoomFactor}`);
    }
  }

  setupIPCHandlers(): void {
    if (ipcHandlersRegistered) {
      console.log('IPCThe handler is already registered, skip repeated registration');
      return;
    }

    console.log('Registration window size relatedIPChandler');

    ipcHandlersRegistered = true;

    const removeHandlerSafely = (channel: string) => {
      try {
        ipcMain.removeHandler(channel);
      } catch (error) {
        console.warn(`RemoveIPChandler ${channel} error:`, error);
      }
    };

    removeHandlerSafely('get-content-zoom');
    removeHandlerSafely('get-system-scale-factor');

    ipcMain.on('set-content-zoom', (event, zoomFactor) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win && !win.isDestroyed()) {
        win.webContents.setZoomFactor(zoomFactor);
        this.store.set('set.contentZoomFactor', zoomFactor);
      }
    });

    ipcMain.handle('get-content-zoom', (event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win && !win.isDestroyed()) {
        return win.webContents.getZoomFactor();
      }
      return 1;
    });

    ipcMain.handle('get-system-scale-factor', () => {
      if (!app.isReady()) {
        return 1;
      }

      try {
        return screen.getPrimaryDisplay().scaleFactor;
      } catch (error) {
        console.error('Failed to get system scaling factor:', error);
        return 1;
      }
    });

    ipcMain.on('reset-content-zoom', (event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win && !win.isDestroyed()) {
        this.store.delete('set.contentZoomFactor');
        this.applyContentZoom(win);
      }
    });

    ipcMain.on('resize-window', (event, width, height) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win && !win.isDestroyed()) {
        console.log(`Received window resize request: ${width}x${height}`);

        const adjustedWidth = Math.max(width, MIN_WIDTH);
        const adjustedHeight = Math.max(height, MIN_HEIGHT);

        win.setSize(adjustedWidth, adjustedHeight);
        console.log(`The window has been resized to: ${adjustedWidth}x${adjustedHeight}`);

        this.saveWindowState(win);
      }
    });

    ipcMain.on('resize-mini-window', (event, showPlaylist) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win && !win.isDestroyed()) {
        if (showPlaylist) {
          console.log(`Expand mini window to ${DEFAULT_MINI_WIDTH} x ${DEFAULT_MINI_EXPANDED_HEIGHT}`);
          win.setMinimumSize(DEFAULT_MINI_WIDTH, DEFAULT_MINI_HEIGHT);
          win.setMaximumSize(DEFAULT_MINI_WIDTH, DEFAULT_MINI_EXPANDED_HEIGHT);
          win.setSize(DEFAULT_MINI_WIDTH, DEFAULT_MINI_EXPANDED_HEIGHT, false);
        } else {
          console.log(`Reduce mini window to ${DEFAULT_MINI_WIDTH} x ${DEFAULT_MINI_HEIGHT}`);
          win.setMaximumSize(DEFAULT_MINI_WIDTH, DEFAULT_MINI_HEIGHT);
          win.setMinimumSize(DEFAULT_MINI_WIDTH, DEFAULT_MINI_HEIGHT);
          win.setSize(DEFAULT_MINI_WIDTH, DEFAULT_MINI_HEIGHT, false);
        }
      }
    });

    if (app.isReady()) {
      screen.on('display-metrics-changed', (_event, _display, changedMetrics) => {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          if (changedMetrics.includes('scaleFactor')) {
            this.applyContentZoom(this.mainWindow);
          }

          this.initMinimumWindowSize();
        }
      });
    }

    this.store.onDidChange('set.contentZoomFactor', () => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.applyContentZoom(this.mainWindow);
      }
    });
  }
}

const windowSizeManager = new WindowSizeManager();

export const initWindowSizeManager = (): void => {
  if (app.isReady()) {
    windowSizeManager.initialize();
  } else {
    app.on('ready', () => {
      windowSizeManager.initialize();
    });
  }
};

export const getWindowOptions = (): Electron.BrowserWindowConstructorOptions => {
  return windowSizeManager.getWindowOptions();
};

export const applyInitialState = (win: BrowserWindow): void => {
  windowSizeManager.applyInitialState(win);
};

export const saveWindowState = (win: BrowserWindow): WindowState => {
  return windowSizeManager.saveWindowState(win);
};

export const getWindowState = (): WindowState | null => {
  return windowSizeManager.getWindowState();
};

export const applyContentZoom = (win: BrowserWindow): void => {
  windowSizeManager.applyContentZoom(win);
};

export const initWindowSizeHandlers = (mainWindow: BrowserWindow | null): void => {
  if (!app.isReady()) {
    app.on('ready', () => {
      if (mainWindow) {
        windowSizeManager.setMainWindow(mainWindow);
      }
    });
  } else {
    if (mainWindow) {
      windowSizeManager.setMainWindow(mainWindow);
    }
  }
};

export const calculateMinimumWindowSize = (): { minWidth: number; minHeight: number } => {
  return { minWidth: MIN_WIDTH, minHeight: MIN_HEIGHT };
};
