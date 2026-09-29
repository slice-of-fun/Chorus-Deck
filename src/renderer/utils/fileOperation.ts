import type { MessageApi } from 'naive-ui';

export const selectDirectory = async (message: MessageApi): Promise<string | undefined> => {
  try {
    const result = await window.api.invoke<{ filePaths?: string[] } | null>('select-directory');
    if (result?.filePaths?.[0]) {
      return result.filePaths[0];
    }
  } catch (error) {
    console.error('Failed to select directory:', error);
    message.error('Failed to select directory');
  }
  return undefined;
};

export const openDirectory = (path: string | undefined, message: MessageApi, showTip = true) => {
  if (path) {
    window.api.send('open-directory', path);
  } else if (showTip) {
    message.info('Directory does not exist');
  }
};