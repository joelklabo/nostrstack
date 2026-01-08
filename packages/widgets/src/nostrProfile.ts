import { type NostrProfile, renderNostrUserCard } from './nostrUserCard.js';
import { ensureNostrstackRoot } from './styles.js';
import { isMockBase, resolveApiBaseUrl } from './url-utils.js';

type Nip05Record = {
  pubkey: string;
  relays?: string[];
  nip05?: string;
  name?: string;
  domain?: string;
};

type NostrEventResponse = {
  author?: {
    pubkey?: string;
    profile?: Partial<NostrProfile> | null;
  };
  event?: {
    pubkey?: string;
  };
};

export type NostrProfileOptions = {
  identifier: string;
  baseURL?: string;
  host?: string;
  relays?: string[];
  title?: string;
};

const normalizeIdentifier = (raw: string) => raw.trim().replace(/^nostr:/i, '');

const isNip05 = (value: string) => value.includes('@');

function mergeRelays(...lists: Array<string[] | undefined>) {
  const merged: string[] = [];
  for (const list of lists) {
    if (!list) continue;
    for (const entry of list) {
      const relay = entry.trim();
      if (!relay) continue;
      if (!merged.includes(relay)) merged.push(relay);
    }
  }
  return merged;
}

function createCallout(title: string, message: string, tone: 'danger' | 'warning' | 'accent') {
  const callout = document.createElement('div');
  callout.className = 'nostrstack-callout nostrstack-profile__callout';

  if (tone === 'danger') {
    callout.style.setProperty('--nostrstack-callout-tone', 'var(--nostrstack-color-danger)');
  } else if (tone === 'warning') {
    callout.style.setProperty('--nostrstack-callout-tone', 'var(--nostrstack-color-warning)');
  } else {
    callout.style.setProperty('--nostrstack-callout-tone', 'var(--nostrstack-color-accent)');
  }

  const titleEl = document.createElement('div');
  titleEl.className = 'nostrstack-callout__title';
  titleEl.textContent = title;

  const content = document.createElement('div');
  content.className = 'nostrstack-callout__content';
  content.textContent = message;

  callout.append(titleEl, content);
  return callout;
}

export function renderNostrProfile(container: HTMLElement, opts: NostrProfileOptions) {
  ensureNostrstackRoot(container);
  container.classList.add('nostrstack-card', 'nostrstack-profile');
  container.replaceChildren();

  const header = document.createElement('div');
  header.className = 'nostrstack-profile__header';

  const heading = document.createElement('div');
  heading.className = 'nostrstack-profile__heading';

  const title = document.createElement('div');
  title.className = 'nostrstack-profile__title';
  title.textContent = opts.title ?? 'Nostr profile';

  const badge = document.createElement('span');
  badge.className = 'nostrstack-badge nostrstack-profile__badge';
  badge.textContent = 'Verified';
  badge.hidden = true;

  heading.append(title, badge);

  const statusWrap = document.createElement('div');
  statusWrap.className = 'nostrstack-profile__status';

  const status = document.createElement('div');
  status.className = 'nostrstack-status nostrstack-status--muted';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.textContent = 'Loading…';

  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'nostrstack-btn nostrstack-btn--ghost nostrstack-btn--sm';
  retry.textContent = 'Retry';
  retry.hidden = true;

  statusWrap.append(status, retry);
  header.append(heading, statusWrap);

  const body = document.createElement('div');
  body.className = 'nostrstack-profile__body';

  const cardHost = document.createElement('div');
  cardHost.className = 'nostrstack-profile__card';

  body.append(cardHost);
  container.append(header, body);

  const apiBaseUrl = resolveApiBaseUrl(opts.baseURL);

  let active = true;
  let currentRequest = 0;

  const setStatus = (text: string, tone: 'muted' | 'success' | 'danger') => {
    status.textContent = text;
    status.classList.remove('nostrstack-status--muted', 'nostrstack-status--success', 'nostrstack-status--danger');
    status.classList.add(`nostrstack-status--${tone}`);
  };

  const showError = (titleText: string, message: string) => {
    cardHost.replaceChildren(createCallout(titleText, message, 'danger'));
    setStatus(titleText, 'danger');
    retry.hidden = false;
  };

  const showNotice = (titleText: string, message: string) => {
    cardHost.append(createCallout(titleText, message, 'warning'));
  };

  const loadProfile = async () => {
    const requestId = ++currentRequest;
    retry.hidden = true;
    badge.hidden = true;
    cardHost.replaceChildren();
    setStatus('Loading…', 'muted');

    const raw = normalizeIdentifier(opts.identifier ?? '');
    if (!raw) {
      showError('Missing profile identifier', 'Provide an npub, nprofile, or nip05 value.');
      return;
    }

    if (isMockBase(opts.baseURL)) {
      const mockProfile: NostrProfile = {
        pubkey: 'f'.repeat(64),
        name: 'Mock Nostr',
        nip05: isNip05(raw) ? raw : undefined,
        about: 'Mock profile for local previews.'
      };
      renderNostrUserCard(mockProfile, cardHost);
      setStatus('Mock profile', 'muted');
      badge.hidden = !isNip05(raw);
      return;
    }

    let resolvedId = raw;
    let nip05Record: Nip05Record | null = null;
    let relays: string[] = opts.relays ?? [];

    if (isNip05(raw)) {
      setStatus('Resolving NIP-05…', 'muted');
      try {
        const res = await fetch(`${apiBaseUrl}/api/nostr/identity?nip05=${encodeURIComponent(raw)}`);
        if (!res.ok) {
          if (res.status === 404) {
            showError('NIP-05 not found', 'Check the identifier and try again.');
          } else {
            showError('Unable to resolve NIP-05', 'Please retry in a moment.');
          }
          return;
        }
        nip05Record = (await res.json()) as Nip05Record;
        resolvedId = nip05Record.pubkey;
        relays = mergeRelays(relays, nip05Record.relays);
        badge.hidden = false;
      } catch (err) {
        console.warn('nostr profile nip05 lookup failed', err);
        showError('Unable to resolve NIP-05', 'Please retry in a moment.');
        return;
      }
    }

    setStatus('Loading profile…', 'muted');
    const relayParam = relays.length ? `?relays=${encodeURIComponent(relays.join(','))}` : '';

    try {
      const res = await fetch(`${apiBaseUrl}/api/nostr/event/${encodeURIComponent(resolvedId)}${relayParam}`);
      if (!res.ok) {
        if (res.status === 404) {
          showError('Profile not found', 'The profile could not be found on available relays.');
        } else if (res.status === 400) {
          showError('Invalid identifier', 'Provide an npub, nprofile, or nip05 value.');
        } else {
          showError('Profile unavailable', 'Please retry in a moment.');
        }
        return;
      }

      const bodyJson = (await res.json()) as NostrEventResponse;
      if (!active || requestId !== currentRequest) return;

      const pubkey = bodyJson.author?.pubkey ?? bodyJson.event?.pubkey ?? resolvedId;
      if (!pubkey) {
        showError('Profile unavailable', 'Missing profile metadata.');
        return;
      }

      const profileData = bodyJson.author?.profile ?? null;
      const profile: NostrProfile = {
        pubkey,
        ...profileData,
        nip05: nip05Record?.nip05 ?? profileData?.nip05
      };

      renderNostrUserCard(profile, cardHost);

      if (!profileData) {
        showNotice('Profile metadata missing', 'Showing a fallback profile based on the pubkey.');
        setStatus('Profile metadata missing', 'muted');
      } else if (nip05Record) {
        setStatus('NIP-05 verified', 'success');
      } else {
        setStatus('Profile loaded', 'success');
      }
    } catch (err) {
      console.warn('nostr profile fetch failed', err);
      showError('Profile unavailable', 'Please retry in a moment.');
    }
  };

  const handleRetry = () => {
    loadProfile();
  };

  retry.addEventListener('click', handleRetry);
  loadProfile();

  return {
    refresh: loadProfile,
    destroy: () => {
      active = false;
      retry.removeEventListener('click', handleRetry);
    }
  };
}
