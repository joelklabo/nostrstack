const DB_NAME = 'nostrstack-db';
const DB_VERSION = 2; // Increment version for schema changes
const STORE_EVENTS = 'events';
const STORE_METADATA = 'metadata'; // For cache stats and config

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const oldVersion = event.oldVersion;

      // Create events store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_EVENTS)) {
        const store = db.createObjectStore(STORE_EVENTS, { keyPath: 'id' });
        store.createIndex('pubkey', 'pubkey', { unique: false });
        store.createIndex('kind', 'kind', { unique: false });
        store.createIndex('created_at', 'created_at', { unique: false });
        store.createIndex('cached_at', 'cached_at', { unique: false }); // For TTL
        // Composite index for common queries
        store.createIndex('kind_pubkey', ['kind', 'pubkey'], { unique: false });
      } else if (oldVersion < 2) {
        // Add cached_at index to existing store
        const tx = (event.target as IDBOpenDBRequest).transaction!;
        const store = tx.objectStore(STORE_EVENTS);
        if (!store.indexNames.contains('cached_at')) {
          store.createIndex('cached_at', 'cached_at', { unique: false });
        }
        if (!store.indexNames.contains('kind_pubkey')) {
          store.createIndex('kind_pubkey', ['kind', 'pubkey'], { unique: false });
        }
      }

      // Create metadata store for cache stats
      if (!db.objectStoreNames.contains(STORE_METADATA)) {
        db.createObjectStore(STORE_METADATA, { keyPath: 'key' });
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
