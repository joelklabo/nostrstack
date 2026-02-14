import { nip19 } from 'nostr-tools';
import { bytesToHex } from 'nostr-tools/utils';

type ProfileRouteResult = {
  pubkey: string | null;
  error?: string;
};

const PROFILE_ROUTE_RE = /^\/p\/([^/?#]+)/i;

function normalizeProfileId(raw: string): string | null {
  const trimmed = raw.replace(/^nostr:/i, '').trim();
  if (!trimmed) return null;
  if (/^[0-9a-f]{64}$/i.test(trimmed)) return trimmed.toLowerCase();
  try {
    const decoded = nip19.decode(trimmed.toLowerCase());
    const data = decoded.data as unknown;
    if (decoded.type === 'npub') {
      if (data instanceof Uint8Array) {
        return bytesToHex(data);
      }
      if (typeof data === 'string' && /^[0-9a-f]{64}$/i.test(data)) {
        return data.toLowerCase();
      }
    }
  } catch {
    // ignore invalid ids
  }
  return null;
}

export function resolveProfileRoute(pathname: string): ProfileRouteResult {
  const match = pathname.match(PROFILE_ROUTE_RE);
  if (!match) return { pubkey: null };
  let rawId = match[1];
  try {
    rawId = decodeURIComponent(rawId);
  } catch {
    // ignore decode errors
  }
  const pubkey = normalizeProfileId(rawId);
  if (!pubkey) {
    return { pubkey: null, error: 'Invalid profile id.' };
  }
  return { pubkey };
}

export function buildProfilePath(pubkey: string): string {
  try {
    return `/p/${nip19.npubEncode(pubkey)}`;
  } catch {
    return `/p/${pubkey}`;
  }
}

export function buildNoteLink(eventId: string): string {
  try {
    return `${window.location.origin}/nostr/${nip19.noteEncode(eventId)}`;
  } catch {
    return `${window.location.origin}/nostr/${eventId}`;
  }
}

export function navigateTo(path: string): void {
  if (typeof window === 'undefined') return;
  if (window.location.pathname === path) return;
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function navigateToProfile(pubkey: string): string {
  const path = buildProfilePath(pubkey);
  navigateTo(path);
  return path;
}
