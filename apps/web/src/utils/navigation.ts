import { nip19 } from 'nostr-tools';
import { bytesToHex } from 'nostr-tools/utils';

export const APP_VIEW_PATHS = {
  feed: '/',
  search: '/search',
  offers: '/offers',
  profile: '/profile',
  settings: '/settings',
  help: '/help',
  relays: '/relays',
  demo: '/demo',
  searchAlias: '/find-friend',
  eventPrefix: '/nostr',
  profilePrefix: '/p',
  settingsPrefix: '/settings',
  unknown: '/'
} as const;

export type AppRouteKind =
  | 'feed'
  | 'search'
  | 'find-friend'
  | 'relays'
  | 'settings'
  | 'offers'
  | 'demo'
  | 'profile'
  | 'event'
  | 'help'
  | 'unknown';

export type AppRoute = {
  kind: AppRouteKind;
  pathname: string;
  profile?: ProfileRouteResult;
  eventId?: string;
};

type ProfileRouteResult = {
  pubkey: string | null;
  error?: string;
};

const PROFILE_ROUTE_RE = /^\/p\/([^/?#]+)/i;
const NOSTR_NOTE_ROUTE_RE = /^\/nostr\/([^/?#]+)/i;
const EVENT_NOTE_ROUTE_RE = /^\/e\/([^/?#]+)/i;

function normalizePath(path: string): string {
  const origin = typeof window === 'undefined' ? 'https://example.com' : window.location.origin;
  const url = new URL(path, origin);
  const basePath = normalizeRoutePath(url.pathname);
  const canonicalPath = canonicalizeRoutePath(basePath);
  const withQuery = `${canonicalPath}${url.search}${url.hash}`;
  return withQuery === '' ? '/' : withQuery;
}

function normalizeRoutePath(pathname: string): string {
  const basePath = pathname.split('?')[0].split('#')[0];
  if (!basePath) return '/';
  const withLeadingSlash = basePath.startsWith('/') ? basePath : `/${basePath}`;
  const trimmed = withLeadingSlash.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

function canonicalizeRoutePath(pathname: string): string {
  const normalized = normalizeRoutePath(pathname);
  return normalized === APP_VIEW_PATHS.searchAlias ? APP_VIEW_PATHS.search : normalized;
}

function safeDecodePathSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

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

function resolveProfileRoutePath(pathname: string): ProfileRouteResult {
  const match = pathname.match(PROFILE_ROUTE_RE);
  if (!match) return { pubkey: null };
  const rawId = safeDecodePathSegment(match[1]);
  const pubkey = normalizeProfileId(rawId);
  if (!pubkey) {
    return { pubkey: null, error: 'Invalid profile id.' };
  }
  return { pubkey };
}

function resolveEventRouteIdFromPath(pathname: string): string | null {
  const nostrMatch = pathname.match(NOSTR_NOTE_ROUTE_RE);
  if (nostrMatch) return safeDecodePathSegment(nostrMatch[1]).replace(/^nostr:/i, '');

  const legacyMatch = pathname.match(EVENT_NOTE_ROUTE_RE);
  if (!legacyMatch) return null;
  return safeDecodePathSegment(legacyMatch[1]).replace(/^nostr:/i, '');
}

export function parseAppRoute(pathname: string): AppRoute {
  const normalizedPath = normalizeRoutePath(pathname);

  if (normalizedPath === '/' || normalizedPath === '') {
    return { kind: 'feed', pathname: '/' };
  }

  const isProfileRoute = normalizedPath === '/profile' || PROFILE_ROUTE_RE.test(normalizedPath);
  if (isProfileRoute) {
    return {
      kind: 'profile',
      pathname: normalizedPath,
      profile: resolveProfileRoutePath(normalizedPath)
    };
  }

  if (normalizedPath === '/search') {
    return { kind: 'search', pathname: normalizedPath };
  }
  if (normalizedPath === '/find-friend') {
    return { kind: 'find-friend', pathname: normalizedPath };
  }
  if (normalizedPath === '/relays') {
    return { kind: 'relays', pathname: normalizedPath };
  }
  if (normalizedPath === '/settings') {
    return { kind: 'settings', pathname: normalizedPath };
  }
  if (normalizedPath === '/offers') {
    return { kind: 'offers', pathname: normalizedPath };
  }
  if (normalizedPath === '/demo') {
    return { kind: 'demo', pathname: normalizedPath };
  }
  if (normalizedPath === '/help') {
    return { kind: 'help', pathname: normalizedPath };
  }

  const eventId = resolveEventRouteIdFromPath(normalizedPath);
  if (eventId) {
    return { kind: 'event', pathname: normalizedPath, eventId };
  }

  return { kind: 'unknown', pathname: normalizedPath };
}

export function resolveProfileRoute(pathname: string): ProfileRouteResult {
  return resolveProfileRoutePath(normalizeRoutePath(pathname));
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

  const normalized = normalizePath(path);
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (normalized === current) return;

  window.history.pushState({}, '', normalized);
  window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
}

export function navigateToProfile(pubkey: string): string {
  const path = buildProfilePath(pubkey);
  navigateTo(path);
  return path;
}

export function getNostrRouteId(pathname: string): string | null {
  const route = parseAppRoute(pathname);
  return route.kind === 'event' ? route.eventId ?? null : null;
}

export function getEventRouteId(pathname: string): string | null {
  const route = parseAppRoute(pathname);
  return route.kind === 'event' && pathname.includes('/e/') ? route.eventId ?? null : null;
}
