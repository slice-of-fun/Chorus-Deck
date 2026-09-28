import { ipcMain, systemPreferences } from 'electron';

export function setupThemeHandlers() {
  ipcMain.handle('get-system-accent-color', () => {
    try {
      if (process.platform === 'win32' || process.platform === 'darwin') {
        const color = systemPreferences.getAccentColor();
        return `#${color}`;
      }
    } catch (error) {
      console.error('Failed to get system accent color:', error);
    }
    return null;
  });
}
