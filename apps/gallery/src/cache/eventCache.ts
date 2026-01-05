import type { Event, Filter } from 'nostr-tools';

import { getDB } from './db';

const STORE_EVENTS = 'events';

export async function saveEvent(event: Event) {
  const db = await getDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_EVENTS, 'readwrite');
    const store = tx.objectStore(STORE_EVENTS);
    const request = store.put(event);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function saveEvents(events: Event[]) {
  const db = await getDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_EVENTS, 'readwrite');
    const store = tx.objectStore(STORE_EVENTS);
    events.forEach(event => store.put(event));
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
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Very basic query implementation - full query support requires complex cursor logic
// This version supports basic kind/author filtering which covers most use cases (profiles, contact lists)
export async function getEventsByFilter(filter: Filter): Promise<Event[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_EVENTS, 'readonly');
    const store = tx.objectStore(STORE_EVENTS);
    const events: Event[] = [];

    // Optimization: If ID is present, just fetch that
    if (filter.ids?.length) {
       // Manual fetch for ids
       // ... simplified for now to just scan or index
    }

    // Fallback: full scan or simple index scan
    // We can use 'kind' index if kinds are present, or 'pubkey' (authors)
    let request: IDBRequest;
    
    if (filter.authors?.length === 1) {
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
        const ev = cursor.value as Event;
        if (matchFilter(ev, filter)) {
          events.push(ev);
        }
        // Limit check
        if (filter.limit && events.length >= filter.limit) {
           resolve(events);
           return;
        }
        cursor.continue();
      } else {
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
  // Tag filtering (e.g. #p) not efficiently supported here yet, but simplistic check:
  // (Ignoring tag filters for now in this basic cache implementation)
  return true;
}
