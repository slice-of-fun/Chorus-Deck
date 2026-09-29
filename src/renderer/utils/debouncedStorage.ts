import { debounce } from 'lodash';

const pendingWrites = new Map<string, string>();

const safeSetItem = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.error(
      `[debouncedStorage] localStorage Write failed key=${key}(May exceed quota):`,
      error
    );
  }
};

const flushPendingWrites = () => {
  pendingWrites.forEach((value, key) => {
    safeSetItem(key, value);
  });
  pendingWrites.clear();
};

const debouncedFlush = debounce(flushPendingWrites, 2000);

export const debouncedLocalStorage = {
  getItem: (key: string) => localStorage.getItem(key),
  setItem: (key: string, value: string) => {
    pendingWrites.set(key, value);
    debouncedFlush();
  },
  removeItem: (key: string) => {
    pendingWrites.delete(key);
    localStorage.removeItem(key);
  }
};

export const flushDebouncedStorage = () => {
  debouncedFlush.cancel();
  flushPendingWrites();
};

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushDebouncedStorage);
}
