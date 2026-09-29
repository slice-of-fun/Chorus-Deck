import { createDiscreteApi } from 'naive-ui';
import { defineStore } from 'pinia';
import { ref } from 'vue';

import useIndexedDB from '@/hooks/IndexDBHook';
import type { LocalMusicEntry } from '@/types/localMusic';
import { removeStaleEntries } from '@/utils/localMusicUtils';

const { message } = createDiscreteApi(['message']);

const LOCAL_MUSIC_STORE = 'local_music' as const;

type LocalMusicDBStores = {
  local_music: LocalMusicEntry;
};

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

async function initLocalMusicDB() {
  return await useIndexedDB<typeof LOCAL_MUSIC_STORE, LocalMusicDBStores>(
    'localMusicDB',
    [{ name: LOCAL_MUSIC_STORE, keyPath: 'id' }],
    1
  );
}

export const useLocalMusicStore = defineStore(
  'localMusic',
  () => {
    const folderPaths = ref<string[]>([]);

    const musicList = ref<LocalMusicEntry[]>([]);

    const scanning = ref(false);

    const scanProgress = ref(0);

    let db: Awaited<ReturnType<typeof initLocalMusicDB>> | null = null;

    async function getDB() {
      if (!db) {
        db = await initLocalMusicDB();
      }
      return db;
    }

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
        const localDB = await getDB();
        const entries = await localDB.getAllData(LOCAL_MUSIC_STORE);
        for (const entry of entries) {
          const stillConfigured = folderPaths.value.some((folder) =>
            isUnderFolder(entry.filePath, folder)
          );
          if (isUnderFolder(entry.filePath, path) && !stillConfigured) {
            await localDB.deleteData(LOCAL_MUSIC_STORE, entry.id);
          }
        }
        musicList.value = await localDB.getAllData(LOCAL_MUSIC_STORE);
      } catch (error) {
        console.error('Cleaning cache failed after removing folder:', error);
      }
    }

    async function clearAllEntries(): Promise<void> {
      try {
        const localDB = await getDB();
        const entries = await localDB.getAllData(LOCAL_MUSIC_STORE);
        for (const entry of entries) {
          await localDB.deleteData(LOCAL_MUSIC_STORE, entry.id);
        }
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
        const localDB = await getDB();

        const cachedEntries = await localDB.getAllData(LOCAL_MUSIC_STORE);
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
                await localDB.saveData(LOCAL_MUSIC_STORE, entry);
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
          await localDB.deleteData(LOCAL_MUSIC_STORE, entry.id);
        }

        musicList.value = await localDB.getAllData(LOCAL_MUSIC_STORE);
      } catch (error) {
        console.error('Scanning local music failed:', error);
        message.error('Scanning local music failed');
      } finally {
        scanning.value = false;
      }
    }

    async function loadFromCache(): Promise<void> {
      try {
        const localDB = await getDB();
        musicList.value = await localDB.getAllData(LOCAL_MUSIC_STORE);
      } catch (error) {
        console.error('Loading local music from cache failed:', error);
        musicList.value = [];
      }
    }

    async function removeEntry(id: string): Promise<void> {
      const localDB = await getDB();
      await localDB.deleteData(LOCAL_MUSIC_STORE, id);
      const index = musicList.value.findIndex((entry) => entry.id === id);
      if (index !== -1) {
        musicList.value.splice(index, 1);
      }
    }

    async function clearCache(): Promise<void> {
      try {
        const localDB = await getDB();
        const allEntries = await localDB.getAllData(LOCAL_MUSIC_STORE);

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
          await localDB.deleteData(LOCAL_MUSIC_STORE, entry.id);
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