import { type ProfileMeta } from './types.js';

/**
 * Parse profile metadata from a kind:0 event's content field.
 * Returns null if content is empty or invalid JSON.
 */
export function parseProfileContent(content?: string): ProfileMeta | null {
  if (!content) return null;
  try {
    const parsed = JSON.parse(content) as ProfileMeta;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Get a display name from profile metadata, with fallbacks.
 * Priority: display_name > name > npub prefix
 */
export function getDisplayName(profile: ProfileMeta | null, npub?: string): string {
  if (profile?.display_name) return profile.display_name;
  if (profile?.name) return profile.name;
  if (npub) return `${npub.slice(0, 8)}...`;
  return 'Anonymous';
}

/**
 * Get the Lightning address (lud16) from profile metadata
 */
export function getLightningAddress(profile: ProfileMeta | null): string | undefined {
  return profile?.lud16;
}
