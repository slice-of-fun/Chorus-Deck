import { getSharedStore } from './config';

export interface TrayIcon {
  path: string;
  tooltip: string;
}

export interface TrayMenuItem {
  label: string;
  click: () => void;
  shortcut?: string;
}

export interface TrayMenu {
  default: TrayMenuItem[];
  mac?: { about?: TrayMenuItem; services?: { items: TrayMenuItem[] } };
}

export function initializeTray(iconPath: string, mainWindow: any): void {
  // In Tauri, tray is configured in tauri.conf.json
  // The tray module handles creation through the Tauri API
  // This module is kept for compatibility with existing code structure

  // The preload bridge may expose tray functions:
  // - api.tray.addMenu(items)
  // - api.tray.removeAll()
  // - api.tray.destroy()

  // For now, this is a no-op; tray is managed by tauri.conf.json configuration
}