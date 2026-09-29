import { createDiscreteApi } from 'naive-ui';
import { defineStore } from 'pinia';
import { ref } from 'vue';

import type { LocalMusicEntry } from '@/types/localMusic';
import { removeStaleEntries } from '@/utils/localMusicUtils';

const { message } = createDiscreteApi(['message']);

function generateId(filePath: string): string {
  let hash = 0;
  for (let i = 0; i < filePath.length; i++) {
    const char = filePath.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }

  return (hash >>> 0).toString(16);
}

function isUnderFolder(filePath: string, folder: string): boolean {
  if (!filePath.startsWith(folder)) return false;
  if (folder.endsWith('/') || folder.endsWith('\\')) return true;
  const next = filePath.charAt(folder.length);
  return next === '/' || next === '\\';
}

export const useLocalMusicStore = defineStore(
  'localMusic',
  () => {
    const folderPaths = ref<string[]>([]);

    const musicList = ref<LocalMusicEntry[]>([]);

    const scanning = ref(false);

    const scanProgress = ref(0);

    function addFolder(path: string): void {
      if (!path || folderPaths.value.includes(path)) {
        return;
      }
      folderPaths.value.push(path);
    }

    async function removeFolder(path: string): Promise<void> {
      const index = folderPaths.value.indexOf(path);
      if (index === -1) {
        return;
      }
      folderPaths.value.splice(index, 1);

      try {
        const entries = await window.api.dbGetAllLocalMusic();
        for (const entry of entries) {
          const stillConfigured = folderPaths.value.some((folder) =>
            isUnderFolder(entry.filePath, folder)
          );
          if (isUnderFolder(entry.filePath, path) && !stillConfigured) {
            await window.api.dbDeleteLocalMusic(entry.id);
          }
        }
        musicList.value = await window.api.dbGetAllLocalMusic();
      } catch (error) {
        console.error('Cleaning cache failed after removing folder:', error);
      }
    }

    async function clearAllEntries(): Promise<void> {
      try {
        await window.api.dbClearLocalMusic();
        musicList.value = [];
      } catch (error) {
        console.error('Failed to clear local music cache:', error);
      }
    }

    async function scanFolders(): Promise<void> {
      if (scanning.value) {
        return;
      }

      if (folderPaths.value.length === 0) {
        await clearAllEntries();
        return;
      }

      scanning.value = true;
      scanProgress.value = 0;

      try {
        const cachedEntries = await window.api.dbGetAllLocalMusic();
        const cachedMap = new Map<string, LocalMusicEntry>();
        for (const entry of cachedEntries) {
          cachedMap.set(entry.filePath, entry);
        }

        const diskFilePaths = new Set<string>();

        const unreadableFolders: string[] = [];

        for (const folderPath of folderPaths.value) {
          let files: { path: string; modifiedTime: number }[];
          try {
            const result = await window.api.scanLocalMusicWithStats(folderPath);

            if ((result as any).error) {
              console.error(`Scanning folder failed: ${folderPath}`, (result as any).error);
              message.error(`Scan failed: ${(result as any).error}`);
              unreadableFolders.push(folderPath);
              continue;
            }
            files = result.files;
          } catch (error) {
            console.error(`Error scanning folder: ${folderPath}`, error);
            message.error(`Error scanning folder: ${folderPath}`);
            unreadableFolders.push(folderPath);
            continue;
          }

          scanProgress.value += files.length;

          for (const file of files) {
            diskFilePaths.add(file.path);
          }

          const parseTargets: string[] = [];
          for (const file of files) {
            const cached = cachedMap.get(file.path);
            if (!cached || cached.modifiedTime !== file.modifiedTime || !('coverPath' in cached)) {
              parseTargets.push(file.path);
            }
          }

          if (parseTargets.length > 0) {
            try {
              const metas = await window.api.parseLocalMusicMetadata(parseTargets);
              for (const meta of metas) {
                const entry: LocalMusicEntry = {
                  ...meta,
                  id: generateId(meta.filePath)
                };
                await window.api.dbSaveLocalMusic(entry);
                cachedMap.set(entry.filePath, entry);
              }
            } catch (error) {
              console.error(`Failed to parse music metadata: ${folderPath}`, error);
              message.error(`Failed to parse music metadata: ${folderPath}`);
            }
          }
        }

        const isUnderUnreadableFolder = (filePath: string): boolean =>
          unreadableFolders.some((folder) => isUnderFolder(filePath, folder));

        for (const [filePath, entry] of cachedMap) {
          if (diskFilePaths.has(filePath) || isUnderUnreadableFolder(filePath)) {
            continue;
          }
          await window.api.dbDeleteLocalMusic(entry.id);
        }

        musicList.value = await window.api.dbGetAllLocalMusic();
      } catch (error) {
        console.error('Scanning local music failed:', error);
        message.error('Scanning local music failed');
      } finally {
        scanning.value = false;
      }
    }

    async function loadFromCache(): Promise<void> {
      try {
        musicList.value = await window.api.dbGetAllLocalMusic();
      } catch (error) {
        console.error('Loading local music from cache failed:', error);
        musicList.value = [];
      }
    }

    async function removeEntry(id: string): Promise<void> {
      await window.api.dbDeleteLocalMusic(id);
      const index = musicList.value.findIndex((entry) => entry.id === id);
      if (index !== -1) {
        musicList.value.splice(index, 1);
      }
    }

    async function clearCache(): Promise<void> {
      try {
        const allEntries = await window.api.dbGetAllLocalMusic();

        if (allEntries.length === 0) {
          return;
        }

        const existsMap: Record<string, boolean> = {};
        for (const entry of allEntries) {
          try {
            const exists = await window.api.invoke('check-file-exists', entry.filePath);
            existsMap[entry.filePath] = exists !== false;
          } catch {
            existsMap[entry.filePath] = true;
          }
        }

        const validEntries = removeStaleEntries(allEntries, existsMap);
        const removedEntries = allEntries.filter(
          (entry) => !validEntries.some((v) => v.id === entry.id)
        );

        for (const entry of removedEntries) {
          await window.api.dbDeleteLocalMusic(entry.id);
        }

        musicList.value = validEntries;
      } catch (error) {
        console.error('Failed to clear cache:', error);
      }
    }

    return {
      folderPaths,
      musicList,
      scanning,
      scanProgress,

      addFolder,
      removeFolder,
      scanFolders,
      loadFromCache,
      removeEntry,
      clearCache
    };
  },
  {
    persist: {
      key: 'local-music-store',
      storage: localStorage,
      pick: ['folderPaths']
    }
  }
);
