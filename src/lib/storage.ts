const DB_NAME = 'ContextNoteDB';
const DB_VERSION = 1;

export const STORES = {
    EMBEDDINGS_CACHE: 'embeddings_cache',
    NOTE_EMBEDDINGS: 'note_embeddings'
} as const;

export class StorageService {
    private db: IDBDatabase | null = null;

    async init(): Promise<void> {
        if (typeof window === 'undefined') return; // SSR check

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                console.error('Failed to open database:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(STORES.EMBEDDINGS_CACHE)) {
                    db.createObjectStore(STORES.EMBEDDINGS_CACHE);
                }
                if (!db.objectStoreNames.contains(STORES.NOTE_EMBEDDINGS)) {
                    db.createObjectStore(STORES.NOTE_EMBEDDINGS);
                }
            };
        });
    }

    async get<T>(storeName: string, key: string): Promise<T | undefined> {
        return this.transaction(storeName, 'readonly', (store) => store.get(key));
    }

    async set<T>(storeName: string, key: string, value: T): Promise<void> {
        await this.transaction(storeName, 'readwrite', (store) => {
            store.put(value, key);
        });
    }

    async getAllEntries<T>(storeName: string): Promise<[string, T][]> {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject(new Error('Database not initialized'));
            const transaction = this.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.openCursor();
            const entries: [string, T][] = [];

            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest).result;
                if (cursor) {
                    entries.push([cursor.key as string, cursor.value]);
                    cursor.continue();
                } else {
                    resolve(entries);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    async delete(storeName: string, key: string): Promise<void> {
        await this.transaction(storeName, 'readwrite', (store) => {
            store.delete(key);
        });
    }
    
    async clear(storeName: string): Promise<void> {
         return this.transaction(storeName, 'readwrite', (store) => store.clear());
    }

    private async transaction<T>(
        storeName: string,
        mode: IDBTransactionMode,
        callback: (store: IDBObjectStore) => IDBRequest<T> | void
    ): Promise<T> {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject(new Error('Database not initialized'));
            const transaction = this.db.transaction(storeName, mode);
            const store = transaction.objectStore(storeName);
            
            let request;
            try {
                request = callback(store);
            } catch (e) {
                reject(e);
                return;
            }

            transaction.oncomplete = () => {
                if (request instanceof IDBRequest) {
                    resolve(request.result);
                } else {
                    resolve(undefined as T);
                }
            };
            
            transaction.onerror = () => reject(transaction.error);
        });
    }
}

export const storage = new StorageService();
