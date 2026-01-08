import { type Event } from 'nostr-tools';

/** Remove duplicates from an array */
export function uniq<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

/** Check if a string is a valid 64-character hex string */
export function isHex64(value: string): boolean {
  return /^[0-9a-f]{64}$/i.test(value);
}

/** Strip `nostr:` prefix and trim whitespace */
export function normalizeNostrInput(raw: string): string {
  return raw.trim().replace(/^nostr:/i, '');
}

/** Get all values for a specific tag from an event */
export function getTagValues(event: Event, tag: string): string[] {
  return event.tags
    .filter((t) => t[0] === tag)
    .map((t) => t[1])
    .filter((value): value is string => Boolean(value));
}

/** Get the first value for a specific tag from an event */
export function getTagValue(event: Event, tag: string): string | undefined {
  const values = getTagValues(event, tag);
  return values[0];
}
