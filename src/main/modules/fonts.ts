import { getFonts } from 'font-list';

function cleanFontName(fontName: string): string {
  return fontName
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/\s+/g, ' ');
}

async function getSystemFonts(): Promise<string[]> {
  try {
    const fonts = await getFonts();

    const cleanedFonts = [...new Set(fonts.map(cleanFontName))];

    return ['system-ui', ...cleanedFonts].sort();
  } catch (error) {
    console.error('Failed to obtain system font:', error);

    return ['system-ui'];
  }
}

// IPC handler is now routed through the Tauri preload bridge
// The preload at src/preload/index.ts exposes this function via contextBridge.invoke:
// - get-system-fonts -> api.getSystemFonts()
// 
// The actual implementation is in this module. The Rust side may also
// define a corresponding #[tauri::command] function.

export function initializeFonts() {
  // IPC handle registration is now handled through the preload bridge
  // instead of direct ipcMain.handle calls
}