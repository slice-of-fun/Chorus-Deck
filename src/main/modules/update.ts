import { getSharedStore } from './config';

export interface UpdateCheckResult {
  success: boolean;
  version?: string;
  releaseNotes?: string;
  error?: string;
}

export function initializeUpdateChecker(): void {
  // In Tauri, auto-updates are configured in tauri.conf.json
  // The updater is handled by the Tauri backend, not through direct Electron IPC
  // The preload bridge exposes update checking through contextBridge.invoke:
  // - app-update:check -> api.appUpdateCheck()
  // - app-update:get-state -> api.appUpdateGetState()
  // - app-update:download -> api.appUpdateDownload()
  // - app-update:quit-and-install -> api.appUpdateInstallAndQuit()

  // This module is kept for type definitions and compatibility
  // Actual update handling is configured in src-tauri/tauri.conf.json
}