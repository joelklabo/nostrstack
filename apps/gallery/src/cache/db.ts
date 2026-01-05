const DB_NAME = 'nostrstack-db';
const DB_VERSION = 1;
const STORE_EVENTS = 'events';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_EVENTS)) {
        const store = db.createObjectStore(STORE_EVENTS, { keyPath: 'id' });
        store.createIndex('pubkey', 'pubkey', { unique: false });
        store.createIndex('kind', 'kind', { unique: false });
        store.createIndex('created_at', 'created_at', { unique: false });
        // Composite index simulation manually or just query efficiently
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });

  return dbPromise;
}

export async function getDB() {
  return openDB();
}
