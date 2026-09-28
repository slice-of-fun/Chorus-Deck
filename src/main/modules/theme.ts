import { getStore } from './config';

export interface ThemePreferences {
  theme: 'light' | 'dark';
  fontFamily?: string;
  fontSize?: number;
  contentZoomFactor?: number;
}

export function initializeTheme(): void {
  // Theme initialization is handled by the Vue frontend
  // through the settings store (Pinia)
  // The Tauri preload bridge may expose theme functions:
  // - api.setTheme(theme: 'light' | 'dark')
  // - api.getTheme(): 'light' | 'dark'

  // For backward compatibility, this function is kept
  // but actual theme changes are handled through the Vue store
}