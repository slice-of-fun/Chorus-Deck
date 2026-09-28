import { getSharedStore } from './config';

export const DEFAULT_MAIN_WIDTH = 1200;
export const DEFAULT_MAIN_HEIGHT = 800;
export const DEFAULT_MINI_WIDTH = 340;
export const DEFAULT_MINI_HEIGHT = 64;
export const DEFAULT_MINI_EXPANDED_HEIGHT = 400;

export const WINDOW_STATE_KEY = 'windowState';

const ABSOLUTE_MIN_WIDTH = 800;
const ABSOLUTE_MIN_HEIGHT = 600;
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
  private store: Map<string, unknown>;
  private mainWindow: any = null;
  private savedState: WindowState | null = null;
  private isInitialized: boolean = false;
  private saveStateDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.store = new Map();
  }

  private scheduleSaveWindowState(win: any): void {
    if (this.saveStateDebounceTimer) {
      clearTimeout(this.saveStateDebounceTimer);
    }
    this.saveStateDebounceTimer = setTimeout(() => {
      this.saveStateDebounceTimer = null;
      if (!win.isDestroyed && !win.isMinimized()) {
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
    if (this.isInitialized) {
      return;
    }

    this.initMinimumWindowSize();
    this.setupIPCHandlers();
    this.isInitialized = true;
    console.log('Window size manager initialization completed');
  }

  setMainWindow(win: any): void {
    if (!this.isInitialized) {
      this.initialize();
    }

    this.mainWindow = win;

    this.savedState = this.getWindowState();

    this.setupEventListeners(win);

    this.saveWindowState(win);
  }

  private initMinimumWindowSize(): void {
    try {
      const workArea = typeof window !== 'undefined' ? window.innerWidth && window.innerHeight ? {
        x: 0,
        y: 0,
        width: typeof window !== 'undefined' ? window.innerWidth : 1920,
        height: typeof window !== 'undefined' ? window.innerHeight : 1080
      } : { x: 0, y: 0, width: 1920, height: 1080 };

      if (workArea && workArea.width) {
        MIN_WIDTH = Math.max(ABSOLUTE_MIN_WIDTH, Math.round(workArea.width * 0.3));
        MIN_HEIGHT = Math.max(ABSOLUTE_MIN_HEIGHT, Math.round(workArea.height * 0.3));

        console.log(`Set minimum window size: ${MIN_WIDTH}x${MIN_HEIGHT}`);
      }
    } catch (error) {
      console.error('Failed to initialize minimum window size:', error);
      MIN_WIDTH = ABSOLUTE_MIN_WIDTH;
      MIN_HEIGHT = ABSOLUTE_MIN_HEIGHT;
    }
  }

  setEventListeners(win: any): void {
    if (!win) return;

    win.addEventListener('resize', () => {
      if (!win.isDestroyed && !win.isMinimized()) {
        this.scheduleSaveWindowState(win);
      }
    });

    win.addEventListener('move', () => {
      if (!win.isDestroyed && !win.isMinimized()) {
        this.scheduleSaveWindowState(win);
      }
    });

    win.addEventListener('maximize', () => {
      if (!win.isDestroyed) {
        this.saveWindowState(win);
      }
    });

    win.addEventListener('unmaximize', () => {
      if (!win.isDestroyed) {
        this.saveWindowState(win);
      }
    });

    win.addEventListener('close', () => {
      this.flushScheduledSave();
      if (!win.isDestroyed) {
        this.saveWindowState(win);
      }
    });
  }

  saveWindowState(win: any): WindowState {
    if (win.isDestroyed) {
      return this.savedState || {
        width: DEFAULT_MAIN_WIDTH,
        height: DEFAULT_MAIN_HEIGHT,
        isMaximized: false
      };
    }

    const [currentWidth, currentHeight] = win.getSize ? win.getSize() : [DEFAULT_MAIN_WIDTH, DEFAULT_MAIN_HEIGHT];
    const isMiniMode =
      currentWidth === DEFAULT_MINI_WIDTH &&
      (currentHeight === DEFAULT_MINI_HEIGHT || currentHeight === DEFAULT_MINI_EXPANDED_HEIGHT);

    const isMaximized = win.isMaximized || false;
    let state: WindowState;

    if (isMaximized) {
      const currentBounds = win.getBounds ? win.getBounds() : { x: 0, y: 0, width: currentWidth, height: currentHeight };
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
    } else if (win.isMinimized) {
      console.log('state IsMinimized', this.savedState);
      return this.savedState || {
        width: DEFAULT_MAIN_WIDTH,
        height: DEFAULT_MAIN_HEIGHT,
        isMaximized: false
      };
    } else {
      const [width, height] = win.getSize ? win.getSize() : [DEFAULT_MAIN_WIDTH, DEFAULT_MAIN_HEIGHT];
      const [x, y] = win.getPosition ? win.getPosition() : [0, 0];

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
      console.log('detected mini modal window, not saved to persistent storage');
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
    if (!this.isInitialized) {
      return false;
    }

    try {
      // In Tauri, we'd get display info from the window API
      // Using a simple check for now
      return x >= 0 && y >= 0;
    } catch (error) {
      console.error('Checking location visibility failed:', error);
      return false;
    }

    return false;
  }

  calculateContentZoomFactor(): number {
    if (!this.isInitialized) {
      return 1;
    }

    try {
      // In Tauri, content zoom is handled differently
      // Fall back to system scaling or default 1
      const scaleFactor = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

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

  applyContentZoom(win: any): void {
    const zoomFactor = this.calculateContentZoomFactor();
    if (win.setZoomFactor) {
      win.setZoomFactor(zoomFactor);
    } else {
      win.webContents?.setZoomFactor?.(zoomFactor);
    }

    if (this.isInitialized) {
      try {
        console.log(
          `Apply page scaling factor: ${zoomFactor}, System scaling ratio: ${window.devicePixelRatio || 1}`
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
      console.log('IPC handler is already registered, skip repeated registration');
      return;
    }

    console.log('Registration window size related IPC handler');

    ipcHandlersRegistered = true;
  }
}

const windowSizeManager = new WindowSizeManager();

export const initWindowSizeManager = (): void => {
  // In Tauri, window size management is handled through
  // the tauri.conf.json configuration and the window-state plugin
  // The initialize() call is triggered during app startup
};

export const getWindowOptions = (): any => {
  return {
    width: DEFAULT_MAIN_WIDTH,
    height: DEFAULT_MAIN_HEIGHT,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    frame: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  };
};

export const applyInitialState = (win: any): void => {
  const savedState = getWindowState();

  if (!savedState) {
    if (win.center) win.center();
    return;
  }

  if (savedState.isMaximized && win.maximize) {
    win.maximize();
  } else if (!savedState.x || !savedState.y) {
    if (win.center) win.center();
  } else {
    if (win.setPosition) win.setPosition(savedState.x, savedState.y);
    if (win.setSize) win.setSize(savedState.width, savedState.height);
  }
};

export const calculateMinimumWindowSize = (): { minWidth: number; minHeight: number } => {
  return { minWidth: MIN_WIDTH, minHeight: MIN_HEIGHT };
};