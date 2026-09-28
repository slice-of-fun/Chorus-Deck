import { ipcMain } from 'electron';
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

export function initializeFonts() {
  ipcMain.handle('get-system-fonts', async () => {
    return await getSystemFonts();
  });
}
