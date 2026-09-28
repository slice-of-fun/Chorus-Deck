import { app, ipcMain } from 'electron';
import Store from 'electron-store';
import * as path from 'path';

import { createDefaultShortcuts, type ShortcutsConfig } from '../../shared/shortcuts';
import set from '../set.json';

type SetConfig = typeof set;
interface StoreType {
  set: SetConfig;
  shortcuts: ShortcutsConfig;
}

const store = new Store<StoreType>({
  name: 'config',
  defaults: {
    set: set as SetConfig,
    shortcuts: createDefaultShortcuts()
  }
});

let initialized = false;

export function initializeConfig() {
  if (initialized) {
    return store;
  }
  initialized = true;

  try {
    store.get('set.downloadPath') || store.set('set.downloadPath', app.getPath('downloads'));
    store.get('set.diskCacheDir') ||
      store.set('set.diskCacheDir', path.join(app.getPath('userData'), 'cache'));
    if (store.get('set.diskCacheMaxSizeMB') === undefined) {
      store.set('set.diskCacheMaxSizeMB', 4096);
    }
    if (!store.get('set.diskCacheCleanupPolicy')) {
      store.set('set.diskCacheCleanupPolicy', 'lru');
    }
    if (store.get('set.enableDiskCache') === undefined) {
      store.set('set.enableDiskCache', true);
    }
  } catch (error) {
    console.error('[config] Failed to initialize default configuration:', error);
  }

  ipcMain.on('set-store-value', (_, key, value) => {
    try {
      store.set(key, value);
    } catch (error) {
      console.error(`[config] Failed to write configuration key=${key}:`, error);
    }
  });

  ipcMain.on('get-store-value', (event, key) => {
    try {
      const value = store.get(key);
      event.returnValue = value || '';
    } catch (error) {
      console.error(`[config] Failed to read configuration key=${key}:`, error);
      event.returnValue = '';
    }
  });

  return store;
}

export function getStore() {
  return store;
}

export function getSharedStore(): Store<Record<string, unknown>> {
  return store as unknown as Store<Record<string, unknown>>;
}
