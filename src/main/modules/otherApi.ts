import { getStore } from './config';

export interface SearchSuggestion {
  keyword: string;
}

export function initializeOtherApi(): void {
  // Other API initializations are handled through the Tauri preload bridge
  // The config store provides access to settings
  // The ytmusic module handles YouTube Music API integration

  // This module is kept for type definitions and compatibility
  // IPC handlers are routed through the preload script's contextBridge
}