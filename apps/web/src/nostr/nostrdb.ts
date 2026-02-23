import type { Event, Filter } from 'nostr-tools';

export interface NostrDB {
  add(event: Event): Promise<boolean>;
  event(id: string): Promise<Event | undefined>;
  replaceable(kind: number, author: string, identifier?: string): Promise<Event | undefined>;
  count(filters: Filter[]): Promise<number>;
  supports(): Promise<string[]>;
  filters(filters: Filter[]): Promise<Event[]>;
  subscribe(filters: Filter[], handlers: StreamHandlers): Subscription;
}

export interface StreamHandlers {
  event?: (event: Event) => void;
  error?: (error: Error) => void;
  complete?: () => void;
}

export interface Subscription {
  close: () => void;
}

declare global {
  interface Window {
    nostrdb?: NostrDB;
  }
}

export function isNostrDBAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.nostrdb;
}

export async function getNostrDBFeatures(): Promise<string[]> {
  if (!isNostrDBAvailable()) {
    return [];
  }
  try {
    return await window.nostrdb!.supports();
  } catch {
    return [];
  }
}

export async function fetchEventFromNostrDB(eventId: string): Promise<Event | undefined> {
  if (!isNostrDBAvailable()) {
    return undefined;
  }
  try {
    return await window.nostrdb!.event(eventId);
  } catch {
    return undefined;
  }
}

export async function fetchReplaceableEvent(
  kind: number,
  author: string,
  identifier?: string
): Promise<Event | undefined> {
  if (!isNostrDBAvailable()) {
    return undefined;
  }
  try {
    return await window.nostrdb!.replaceable(kind, author, identifier);
  } catch {
    return undefined;
  }
}

export async function fetchEventsFromNostrDB(filters: Filter[]): Promise<Event[]> {
  if (!isNostrDBAvailable()) {
    return [];
  }
  try {
    return await window.nostrdb!.filters(filters);
  } catch {
    return [];
  }
}

export async function countEventsFromNostrDB(filters: Filter[]): Promise<number> {
  if (!isNostrDBAvailable()) {
    return 0;
  }
  try {
    return await window.nostrdb!.count(filters);
  } catch {
    return 0;
  }
}

export async function addEventToNostrDB(event: Event): Promise<boolean> {
  if (!isNostrDBAvailable()) {
    return false;
  }
  try {
    return await window.nostrdb!.add(event);
  } catch {
    return false;
  }
}

export function subscribeToNostrDB(
  filters: Filter[],
  handlers: StreamHandlers
): Subscription | null {
  if (!isNostrDBAvailable()) {
    return null;
  }
  try {
    return window.nostrdb!.subscribe(filters, handlers);
  } catch {
    return null;
  }
}
