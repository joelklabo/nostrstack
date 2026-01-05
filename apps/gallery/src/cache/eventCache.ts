import type { Event, Filter } from 'nostr-tools';

import { getDB } from './db';

const STORE_EVENTS = 'events';
const STORE_METADATA = 'metadata';
const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours default TTL

type CachedEvent = Event & {
  cached_at: number;
};

type CacheStats = {
  hits: number;
  misses: number;
  evictions: number;
  lastCleanup: number;
};

export async function saveEvent(event: Event, _ttl: number = DEFAULT_TTL_MS) {
  const db = await getDB();
  const cachedEvent: CachedEvent = {
    ...event,
    cached_at: Date.now()
  };
  
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_EVENTS, 'readwrite');
    const store = tx.objectStore(STORE_EVENTS);
    const request = store.put(cachedEvent);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function saveEvents(events: Event[], _ttl: number = DEFAULT_TTL_MS) {
  const db = await getDB();
  const now = Date.now();
  
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_EVENTS, 'readwrite');
    const store = tx.objectStore(STORE_EVENTS);
    events.forEach(event => {
      const cachedEvent: CachedEvent = { ...event, cached_at: now };
      store.put(cachedEvent);
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getEvent(id: string): Promise<Event | undefined> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_EVENTS, 'readonly');
    const store = tx.objectStore(STORE_EVENTS);
    const request = store.get(id);
    request.onsuccess = () => {
      const result = request.result as CachedEvent | undefined;
      if (result && !isExpired(result)) {
        incrementCacheHits();
        resolve(result);
      } else {
        incrementCacheMisses();
        resolve(undefined);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// Enhanced query with composite index support and TTL filtering
export async function getEventsByFilter(filter: Filter, maxAge?: number): Promise<Event[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_EVENTS, 'readonly');
    const store = tx.objectStore(STORE_EVENTS);
    const events: Event[] = [];
    const now = Date.now();
    const cutoff = maxAge ? now - maxAge : now - DEFAULT_TTL_MS;

    let request: IDBRequest;
    
    // Optimization: Use composite index for kind + author queries
    if (filter.kinds?.length === 1 && filter.authors?.length === 1) {
      const index = store.index('kind_pubkey');
      request = index.openCursor(IDBKeyRange.only([filter.kinds[0], filter.authors[0]]));
    } else if (filter.authors?.length === 1) {
      const index = store.index('pubkey');
      request = index.openCursor(IDBKeyRange.only(filter.authors[0]));
    } else if (filter.kinds?.length === 1) {
      const index = store.index('kind');
      request = index.openCursor(IDBKeyRange.only(filter.kinds[0]));
    } else {
      request = store.openCursor();
    }

    request.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest).result as IDBCursorWithValue;
      if (cursor) {
        const ev = cursor.value as CachedEvent;
        // Check TTL
        if (ev.cached_at >= cutoff && matchFilter(ev, filter)) {
          events.push(ev);
        }
        // Limit check
        if (filter.limit && events.length >= filter.limit) {
          incrementCacheHits();
          resolve(events);
          return;
        }
        cursor.continue();
      } else {
        if (events.length > 0) {
          incrementCacheHits();
        } else {
          incrementCacheMisses();
        }
        resolve(events);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

function matchFilter(event: Event, filter: Filter): boolean {
  if (filter.ids && !filter.ids.includes(event.id)) return false;
  if (filter.authors && !filter.authors.includes(event.pubkey)) return false;
  if (filter.kinds && !filter.kinds.includes(event.kind)) return false;
  if (filter.since && event.created_at < filter.since) return false;
  if (filter.until && event.created_at > filter.until) return false;
  
  // Basic tag filtering for #p (most common)
  if (filter['#p']) {
    const pTags = event.tags.filter(t => t[0] === 'p').map(t => t[1]);
    if (!filter['#p'].some(p => pTags.includes(p))) return false;
  }
  
  return true;
}

function isExpired(event: CachedEvent, ttl: number = DEFAULT_TTL_MS): boolean {
  return Date.now() - event.cached_at > ttl;
}

// Clean up expired entries
export async function cleanupExpired(ttl: number = DEFAULT_TTL_MS): Promise<number> {
  const db = await getDB();
  const cutoff = Date.now() - ttl;
  let deleted = 0;
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_EVENTS, 'readwrite');
    const store = tx.objectStore(STORE_EVENTS);
    const index = store.index('cached_at');
    const request = index.openCursor(IDBKeyRange.upperBound(cutoff));
    
    request.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest).result as IDBCursorWithValue;
      if (cursor) {
        cursor.delete();
        deleted++;
        cursor.continue();
      } else {
        updateCacheStats({ evictions: deleted });
        resolve(deleted);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// Cache statistics
async function incrementCacheHits() {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_METADATA, 'readwrite');
    const store = tx.objectStore(STORE_METADATA);
    const request = store.get('stats');
    
    request.onsuccess = () => {
      const stats: CacheStats = request.result || { hits: 0, misses: 0, evictions: 0, lastCleanup: 0 };
      stats.hits++;
      store.put({ key: 'stats', ...stats });
    };
  } catch {
    // Ignore stats errors
  }
}

async function incrementCacheMisses() {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_METADATA, 'readwrite');
    const store = tx.objectStore(STORE_METADATA);
    const request = store.get('stats');
    
    request.onsuccess = () => {
      const stats: CacheStats = request.result || { hits: 0, misses: 0, evictions: 0, lastCleanup: 0 };
      stats.misses++;
      store.put({ key: 'stats', ...stats });
    };
  } catch {
    // Ignore stats errors
  }
}

async function updateCacheStats(updates: Partial<CacheStats>) {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_METADATA, 'readwrite');
    const store = tx.objectStore(STORE_METADATA);
    const request = store.get('stats');
    
    request.onsuccess = () => {
      const stats: CacheStats = request.result || { hits: 0, misses: 0, evictions: 0, lastCleanup: 0 };
      Object.assign(stats, updates);
      store.put({ key: 'stats', ...stats });
    };
  } catch {
    // Ignore stats errors
  }
}

export async function getCacheStats(): Promise<CacheStats> {
  const db = await getDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_METADATA, 'readonly');
    const store = tx.objectStore(STORE_METADATA);
    const request = store.get('stats');
    request.onsuccess = () => {
      resolve(request.result || { hits: 0, misses: 0, evictions: 0, lastCleanup: 0 });
    };
    request.onerror = () => {
      resolve({ hits: 0, misses: 0, evictions: 0, lastCleanup: 0 });
    };
  });
}

// Warm cache with initial data
export async function warmCache(events: Event[]) {
  if (events.length === 0) return;
  await saveEvents(events);
}
