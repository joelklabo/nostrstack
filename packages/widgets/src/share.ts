import { copyToClipboard } from './copyButton.js';
import { ensureNsRoot } from './styles.js';

type NostrEvent = {
  id?: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig?: string;
};

type ShareButtonOptions = {
  url: string;
  title: string;
  lnAddress?: string;
  relays?: string[];
  tag?: string;
  label?: string;
};

type RelayConnection = {
  url?: string;
  connect: () => Promise<void>;
  close: () => void;
  publish: (ev: NostrEvent) => Promise<unknown>;
};

const DEFAULT_RELAYS = ['wss://relay.damus.io', 'wss://relay.snort.social'];

const normalizeRelays = (relays: string[] | undefined) =>
  (relays ?? DEFAULT_RELAYS)
    .map((r) => r.trim())
    .filter(Boolean)
    .filter((r) => r.startsWith('wss://') || r.startsWith('ws://'));

const buildNote = (title: string, url: string, lnAddress?: string) =>
  `${title}\n${url}${lnAddress ? `\n⚡ ${lnAddress}` : ''}`.trim();

const getRelayInit = () =>
  typeof window === 'undefined' ? undefined : window.NostrTools?.relayInit;

async function connectRelays(urls: string[]): Promise<RelayConnection[]> {
  const relayInit = getRelayInit();
  if (!relayInit) return [];
  const relays = await Promise.all(
    urls.map(async (url) => {
      const relay = relayInit(url) as RelayConnection;
      relay.url = relay.url ?? url;
      try {
        await relay.connect();
        return relay;
      } catch (err) {
        console.warn('relay connect failed', url, err);
        return null;
      }
    })
  );
  return relays.filter((r): r is RelayConnection => Boolean(r));
}

export function renderShareButton(container: HTMLElement, opts: ShareButtonOptions) {
  ensureNsRoot(container);
  container.classList.add('ns-card', 'ns-share');
  container.replaceChildren();

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ns-btn ns-btn--primary';

  const status = document.createElement('div');
  status.className = 'ns-status ns-status--muted ns-share__status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.hidden = true;

  const idleLabel = opts.label ?? 'Share to Nostr';

  const setStatus = (text: string, tone: 'muted' | 'success' | 'danger') => {
    status.textContent = text;
    status.hidden = !text;
    status.classList.remove('ns-status--muted', 'ns-status--success', 'ns-status--danger');
    status.classList.add(`ns-status--${tone}`);
  };

  let resetId: number | null = null;

  const setState = (state: 'idle' | 'sharing' | 'shared' | 'error') => {
    button.disabled = state === 'sharing';
    if (state === 'sharing') button.setAttribute('aria-busy', 'true');
    else button.removeAttribute('aria-busy');
    button.textContent =
      state === 'sharing' ? 'Sharing…' : state === 'shared' ? 'Shared' : idleLabel;
    if (state === 'idle') setStatus('', 'muted');
  };

  const scheduleReset = () => {
    if (typeof window === 'undefined') return;
    if (resetId) window.clearTimeout(resetId);
    resetId = window.setTimeout(() => setState('idle'), 2000);
  };

  const handleShare = async () => {
    const note = buildNote(opts.title, opts.url, opts.lnAddress);
    setState('sharing');
    setStatus('Sharing…', 'muted');

    const nostr = typeof window === 'undefined' ? undefined : window.nostr;
    const relayTargets =
      opts.relays === undefined ? normalizeRelays(undefined) : normalizeRelays(opts.relays);
    if (nostr?.getPublicKey && nostr.signEvent && relayTargets.length) {
      try {
        const relays = await connectRelays(relayTargets);
        if (relays.length) {
          const pubkey = await nostr.getPublicKey();
          const unsigned: NostrEvent = {
            kind: 1,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['r', opts.url], ...(opts.tag ? [['t', opts.tag]] : [])],
            content: note,
            pubkey
          };
          const signed = await nostr.signEvent(unsigned);
          await Promise.all(relays.map((relay) => relay.publish(signed)));
          relays.forEach((relay) => relay.close());
          setState('shared');
          setStatus('Shared to Nostr', 'success');
          scheduleReset();
          return;
        }
      } catch (err) {
        console.warn('nostr share failed, falling back', err);
      }
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: opts.title, text: note, url: opts.url });
        setState('shared');
        setStatus('Shared', 'success');
        scheduleReset();
        return;
      }
      await copyToClipboard(note);
      setState('shared');
      setStatus('Copied to clipboard', 'success');
      scheduleReset();
    } catch (err) {
      console.warn('share failed', err);
      setState('error');
      setStatus('Share failed', 'danger');
    }
  };

  button.addEventListener('click', handleShare);
  button.onclick = handleShare;

  setState('idle');

  container.append(button, status);

  return {
    el: container,
    destroy: () => {
      button.removeEventListener('click', handleShare);
    }
  };
}
