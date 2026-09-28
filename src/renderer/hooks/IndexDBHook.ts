import { ref } from 'vue';

export interface StoreConfig<T extends string> {
  name: T;
  keyPath?: string;
}

const useIndexedDB = async <T extends string, S extends Record<T, Record<string, any>>>(
  dbName: string,
  stores: StoreConfig<T>[],
  version: number = 1
) => {
  const db = ref<IDBDatabase | null>(null);

  const initDB = () => {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(dbName, version);

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        stores.forEach((store) => {
          if (!db.objectStoreNames.contains(store.name)) {
            db.createObjectStore(store.name, {
              keyPath: store.keyPath || 'id',
              autoIncrement: true
            });
          }
        });
      };

      request.onsuccess = (event: any) => {
        db.value = event.target.result;
        resolve();
      };

      request.onerror = (event: any) => {
        reject(event.target.error);
      };
    });
  };

  await initDB();

  const addData = <K extends T>(storeName: K, value: S[K]) => {
    return new Promise<void>((resolve, reject) => {
      if (!db.value) return reject('');
      const tx = db.value.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);

      const request = store.add(value);

      request.onsuccess = () => {
        console.log('success');
        resolve();
      };

      request.onerror = (event) => {
        console.error('Failed to add:', (event.target as IDBRequest).error);
        reject((event.target as IDBRequest).error);
      };
    });
  };

  const saveData = <K extends T>(storeName: K, value: S[K]) => {
    return new Promise<void>((resolve, reject) => {
      if (!db.value) return reject('');
      const tx = db.value.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(value);

      request.onsuccess = () => {
        console.log('success');
        resolve();
      };

      request.onerror = (event) => {
        reject((event.target as IDBRequest).error);
      };
    });
  };

  const getData = <K extends T>(storeName: K, key: string | number) => {
    return new Promise<S[K]>((resolve, reject) => {
      if (!db.value) return reject('');
      const tx = db.value.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = (event) => {
        if (event.target) {
          resolve((event.target as IDBRequest).result);
        } else {
          reject('');
        }
      };

      request.onerror = (event) => {
        reject((event.target as IDBRequest).error);
      };
    });
  };

  const deleteData = <K extends T>(storeName: K, key: string | number) => {
    return new Promise<void>((resolve, reject) => {
      if (!db.value) return reject('');
      const tx = db.value.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => {
        console.log('Delete successfully');
        resolve();
      };

      request.onerror = (event) => {
        reject((event.target as IDBRequest).error);
      };
    });
  };

  const getAllData = <K extends T>(storeName: K) => {
    return new Promise<S[K][]>((resolve, reject) => {
      if (!db.value) return reject('');
      const tx = db.value.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = (event) => {
        if (event.target) {
          resolve((event.target as IDBRequest).result);
        } else {
          reject('');
        }
      };

      request.onerror = (event) => {
        reject((event.target as IDBRequest).error);
      };
    });
  };

  const getDataWithPagination = <K extends T>(storeName: K, page: number, pageSize: number) => {
    return new Promise<S[K][]>((resolve, reject) => {
      if (!db.value) return reject('');
      const tx = db.value.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.openCursor();
      const results: S[K][] = [];
      let index = 0;
      const skip = (page - 1) * pageSize;

      request.onsuccess = (event: any) => {
        const cursor = event.target.result;
        if (!cursor) {
          resolve(results);
          return;
        }

        if (index >= skip && results.length < pageSize) {
          results.push(cursor.value);
        }

        index++;
        cursor.continue();
      };

      request.onerror = (event: any) => {
        reject(event.target.error);
      };
    });
  };

  const clearData = <K extends T>(storeName: K) => {
    return new Promise<void>((resolve, reject) => {
      if (!db.value) return reject(new Error(`Database ${dbName} is not open`));
      const tx = db.value.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = (event) => {
        reject((event.target as IDBRequest).error);
      };

      tx.onabort = () => {
        reject((tx.error ?? new Error(`Failed to clear store ${storeName}`)) as Error);
      };
    });
  };

  return {
    initDB,
    addData,
    saveData,
    getData,
    deleteData,
    getAllData,
    getDataWithPagination,
    clearData
  };
};

export default useIndexedDB;
