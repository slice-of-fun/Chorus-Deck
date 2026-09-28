import { getStore } from './config';

export interface ConfigStore {
  get: <T>(key: string) => T | undefined;
  set: <T>(key: string, value: T) => void;
}

export const getStore = (): ConfigStore => {
  // In Tauri, the config store is managed through
  // SQLite (for persistent data) or localStorage (for session data)
  // The actual implementation is in the Tauri Rust land
  // This function returns a proxy that routes through the preload bridge

  // For now, return a minimal implementation
  return {
    get: <T>(key: string): T | undefined => {
      // Try localStorage first, fall back to default
      if (typeof window !== 'undefined') {
        const val = localStorage.getItem(key);
        if (val) return JSON.parse(val) as T;
      }
      return undefined;
    },
    set: <T>(key: string, value: T): void => {
      if (typeof window !== 'undefined') {
        localStorage.setItem(key, JSON.stringify(value));
      }
    }
  };
}