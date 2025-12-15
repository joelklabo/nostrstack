import { NostrstackClient } from '@nostrstack/sdk';
import QRCode from 'qrcode';

import { renderInvoicePopover } from './invoicePopover.js';
import { renderRelayBadge } from './relayBadge.js';
import { ensureNostrstackRoot } from './styles.js';

export { invoicePopoverStyles, renderInvoicePopover } from './invoicePopover.js';
export { nostrUserCardStyles, renderNostrUserCard } from './nostrUserCard.js';
export { relayBadgeStyles, renderRelayBadge, updateRelayBadge } from './relayBadge.js';
export type { NostrstackTheme, NostrstackThemeMode } from './styles.js';
export {
  applyNostrstackTheme,
  ensureNostrstackEmbedStyles,
  ensureNostrstackRoot,
  nostrstackComponentsCss,
  nostrstackEmbedStyles,
  nostrstackTokensCss,
  themeToCss,
  themeToCssVars
} from './styles.js';
export {
  createNostrstackBrandTheme,
  type NostrstackBrandPreset,
  nostrstackBrandPresets
} from './themePresets.js';
export { designTokens } from './tokens/designTokens.js';

type TipWidgetOptions = {
  username: string;
  amountMsat?: number;
  text?: string;
  baseURL?: string;
  host?: string;
  onInvoice?: (pr: string) => void;
};

type PayToActionOptions = {
  username: string;
  amountMsat?: number;
  text?: string;
  baseURL?: string;
  host?: string;
  verifyPayment?: (pr: string) => Promise<boolean>;
  onUnlock?: () => void;
  onInvoice?: (pr: string) => void;
};

type CommentWidgetOptions = {
  threadId?: string;
  relays?: string[];
  placeholder?: string;
  headerText?: string;
  onEvent?: (event: NostrEvent, relay?: string) => void;
  onRelayInfo?: (info: { relays: string[]; mode: 'real' | 'mock' }) => void;
};

declare global {
  interface Window {
    nostr?: {
      getPublicKey: () => Promise<string>;
      signEvent: (event: NostrEvent) => Promise<NostrEvent>;
    };
    NostrTools?: { relayInit?: (url: string) => unknown };
  }
}

type NostrEvent = {
  id?: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig?: string;
};

function createClient(opts: { baseURL?: string; host?: string }) {
  return new NostrstackClient({
    baseURL: opts.baseURL,
    host: opts.host
  });
}

function isMock(opts: { baseURL?: string; host?: string }) {
  return opts.baseURL === 'mock' || opts.host === 'mock';
}

export function resolvePayWsUrl(baseURL?: string): string | null {
  if (typeof window === 'undefined') return null;
  const raw = baseURL === undefined ? 'http://localhost:3001' : baseURL;
  if (raw === 'mock') return null;
  const base = raw.replace(/\/$/, '');
  if (!base) {
    return `${window.location.origin.replace(/^http/i, 'ws')}/ws/pay`;
  }
  if (/^https?:\/\//i.test(base)) {
    return `${base.replace(/^http/i, 'ws')}/ws/pay`;
  }
  return `${window.location.origin.replace(/^http/i, 'ws')}${base}/ws/pay`;
}

function resolveApiBaseUrl(baseURL?: string) {
  const raw = baseURL === undefined ? 'http://localhost:3001' : baseURL;
  const base = raw.replace(/\/$/, '');
  if (base) return base;
  if (typeof window === 'undefined') return 'http://localhost:3001';
  return window.location.origin;
}

const ATTR_PREFIXES = ['nostrstack'];

function getBrandAttr(el: HTMLElement, key: 'Tip' | 'Pay' | 'Comments') {
  for (const prefix of ATTR_PREFIXES) {
    const val = (el.dataset as Record<string, string | undefined>)[`${prefix}${key}`];
    if (val !== undefined) return val;
  }
  return undefined;
}

function setBrandAttr(el: HTMLElement, key: 'Tip' | 'Pay' | 'Comments', value: string) {
  (el.dataset as Record<string, string>)[`nostrstack${key}`] = value;
}

export function renderTipButton(container: HTMLElement, opts: TipWidgetOptions) {
  ensureNostrstackRoot(container);
  container.replaceChildren();
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'nostrstack-btn nostrstack-btn--primary';
  btn.textContent = opts.text ?? 'Send sats';
  setBrandAttr(btn, 'Tip', opts.username);
  const status = document.createElement('div');
  status.className = 'nostrstack-status nostrstack-status--muted';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.style.marginTop = '0.5rem';
  const handler = async () => {
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    status.textContent = 'Generating invoice…';
    status.classList.remove('nostrstack-status--danger', 'nostrstack-status--success');
    status.classList.add('nostrstack-status--muted');
    try {
      if (isMock(opts)) {
        const mockPr = 'lnbc1mock' + Math.random().toString(16).slice(2, 10);
        await opts.onInvoice?.(mockPr);
        if (!opts.onInvoice) {
          renderInvoicePopover(mockPr, { mount: container, title: 'Invoice', subtitle: 'Mock payment' });
        }
        status.textContent = '';
        return;
      }

      const client = createClient(opts);
      const meta = await client.getLnurlpMetadata(opts.username);
      const amount = opts.amountMsat ?? meta.minSendable ?? 1000;
      const invoice = await client.getLnurlpInvoice(opts.username, amount);
      if (opts.onInvoice) {
        await opts.onInvoice(invoice.pr);
        status.textContent = '';
      } else {
        renderInvoicePopover(invoice.pr, { mount: container, title: 'Invoice', subtitle: `Pay @${opts.username}` });
        status.textContent = '';
      }
    } catch (e) {
      console.error('tip error', e);
      status.textContent = 'Failed to generate invoice';
      status.classList.remove('nostrstack-status--muted');
      status.classList.add('nostrstack-status--danger');
    } finally {
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
    }
  };

  // Support both DOM events and direct property invocation in tests
  btn.addEventListener('click', handler);
  btn.onclick = handler;
  container.appendChild(btn);
  container.appendChild(status);
  return btn;
}

export function renderPayToAction(container: HTMLElement, opts: PayToActionOptions) {
  ensureNostrstackRoot(container);
  container.classList.add('nostrstack-card', 'nostrstack-pay');
  container.replaceChildren();

  const wsUrl = resolvePayWsUrl(opts.baseURL);
  const apiBaseUrl = resolveApiBaseUrl(opts.baseURL);
  let payWs: WebSocket | null = null;
  let pollId: number | null = null;
  let realtimeState: 'idle' | 'connecting' | 'open' | 'error' = 'idle';
  let didUnlock = false;

  const closePayWs = () => {
    const ws = payWs;
    payWs = null;
    if (!ws) return;
    try {
      // Detach handlers so we don't mutate UI after unlock/unmount.
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
    } catch {
      /* ignore */
    }
    try {
      // Avoid the noisy browser warning when closing while CONNECTING.
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
        return;
      }
      if (ws.readyState === WebSocket.CONNECTING) {
        ws.addEventListener(
          'open',
          () => {
            try {
              ws.close();
            } catch {
              /* ignore */
            }
          },
          { once: true }
        );
      }
    } catch {
      /* ignore */
    }
  };

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'nostrstack-btn nostrstack-btn--primary';
  btn.textContent = opts.text ?? 'Unlock';

  const status = document.createElement('div');
  status.className = 'nostrstack-pay-status nostrstack-status nostrstack-status--muted';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  const realtime = document.createElement('div');
  realtime.className = 'nostrstack-pay-realtime';
  realtime.textContent = '';

  const header = document.createElement('div');
  header.className = 'nostrstack-pay-header';
  header.append(btn, status);

  const panel = document.createElement('div');
  panel.className = 'nostrstack-pay-panel';
  panel.style.display = 'none';

  const grid = document.createElement('div');
  grid.className = 'nostrstack-pay-grid';

  const qrWrap = document.createElement('div');
  qrWrap.className = 'nostrstack-pay-qr';
  const qrImg = document.createElement('img');
  qrImg.alt = 'Lightning invoice QR';
  qrImg.decoding = 'async';
  qrImg.loading = 'lazy';
  qrWrap.appendChild(qrImg);

  const right = document.createElement('div');
  right.className = 'nostrstack-pay-right';

  const invoiceBox = document.createElement('div');
  invoiceBox.className = 'nostrstack-invoice-box';
  const invoiceCode = document.createElement('code');
  invoiceCode.className = 'nostrstack-code';
  invoiceBox.appendChild(invoiceCode);

  const openWallet = document.createElement('a');
  openWallet.textContent = 'Open in wallet';
  openWallet.className = 'nostrstack-btn nostrstack-btn--primary nostrstack-btn--sm';
  openWallet.rel = 'noreferrer';
  openWallet.style.display = 'none';

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.textContent = 'Copy invoice';
  copyBtn.className = 'nostrstack-btn nostrstack-btn--sm';
  copyBtn.style.display = 'none';

  const paidBtn = document.createElement('button');
  paidBtn.type = 'button';
  paidBtn.textContent = "I've paid";
  paidBtn.className = 'nostrstack-btn nostrstack-btn--sm nostrstack-pay-confirm';
  paidBtn.style.display = 'none';

  const actions = document.createElement('div');
  actions.className = 'nostrstack-pay-actions';
  actions.append(copyBtn, openWallet, paidBtn);

  right.append(realtime, actions, invoiceBox);
  grid.append(qrWrap, right);
  panel.appendChild(grid);

  const stopPoll = () => {
    if (pollId === null || typeof window === 'undefined') return;
    try {
      window.clearInterval(pollId);
    } catch {
      /* ignore */
    } finally {
      pollId = null;
    }
  };

  const unlock = () => {
    if (didUnlock) return;
    didUnlock = true;
    status.textContent = 'Unlocked';
    status.classList.remove('nostrstack-status--muted', 'nostrstack-status--danger');
    status.classList.add('nostrstack-status--success');
    btn.disabled = true;
    paidBtn.disabled = true;
    copyBtn.disabled = true;
    container.classList.add('nostrstack-pay--unlocked');
    opts.onUnlock?.();
    closePayWs();
    stopPoll();
    setRealtime('idle');
  };

  let currentInvoice: string | null = null;
  let currentProviderRef: string | null = null;

  const setRealtime = (next: typeof realtimeState) => {
    realtimeState = next;
    if (!wsUrl) {
      realtime.textContent = '';
      return;
    }
    realtime.textContent =
      realtimeState === 'open'
        ? 'Realtime: connected'
        : realtimeState === 'connecting'
          ? 'Realtime: connecting…'
          : realtimeState === 'error'
            ? 'Realtime: error'
            : 'Realtime: idle';
  };

  const startRealtime = (pr: string) => {
    if (!wsUrl) return;
    closePayWs();
    try {
      setRealtime('connecting');
      const ws = new WebSocket(wsUrl);
      payWs = ws;
      ws.onopen = () => setRealtime('open');
      ws.onerror = () => setRealtime('error');
      ws.onclose = () => setRealtime(realtimeState === 'error' ? 'error' : 'idle');
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string) as { type?: string; pr?: string };
          if (msg.type === 'invoice-paid' && msg.pr && msg.pr === pr) unlock();
        } catch {
          /* ignore malformed frames */
        }
      };
    } catch {
      setRealtime('error');
    }
  };

  const PAID_STATES = new Set(['PAID', 'COMPLETED', 'SETTLED', 'CONFIRMED']);

  const pollOnce = async () => {
    if (!currentProviderRef || didUnlock) return false;
    try {
      const domainParam = opts.host ? `?domain=${encodeURIComponent(opts.host)}` : '';
      const res = await fetch(
        `${apiBaseUrl}/api/lnurlp/pay/status/${encodeURIComponent(currentProviderRef)}${domainParam}`
      );
      if (!res.ok) return false;
      const body = (await res.json()) as { status?: unknown };
      const statusStr = String(body.status ?? '').toUpperCase();
      if (PAID_STATES.has(statusStr)) {
        unlock();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const startPoll = () => {
    stopPoll();
    if (!currentProviderRef || typeof window === 'undefined') return;
    pollOnce();
    pollId = window.setInterval(pollOnce, 1500);
  };

  const getInvoice = async () => {
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    status.textContent = 'Generating invoice…';
    status.classList.remove('nostrstack-status--danger', 'nostrstack-status--success');
    status.classList.add('nostrstack-status--muted');
    try {
      stopPoll();
      currentProviderRef = null;

      const invoiceRes = isMock(opts)
        ? { pr: 'lnbc1mock' + Math.random().toString(16).slice(2, 10) }
        : await (async () => {
            const client = createClient(opts);
            const meta = await client.getLnurlpMetadata(opts.username);
            const amount = opts.amountMsat ?? meta.minSendable ?? 1000;
            return await client.getLnurlpInvoice(opts.username, amount);
          })();

      const pr = invoiceRes.pr;
      const maybeProviderRef = (invoiceRes as unknown as { provider_ref?: unknown }).provider_ref;
      currentProviderRef = typeof maybeProviderRef === 'string' ? maybeProviderRef : null;

      currentInvoice = pr;
      invoiceCode.textContent = pr;
      panel.style.display = 'block';
      openWallet.href = `lightning:${pr}`;
      openWallet.style.display = '';
      paidBtn.style.display = '';
      copyBtn.style.display = '';
      status.textContent = 'Pay invoice. Unlocks on confirmation.';

      if (opts.onInvoice) await opts.onInvoice(pr);
      else if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(pr);
      }

      copyBtn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(pr);
          copyBtn.textContent = 'Copied';
          window.setTimeout(() => (copyBtn.textContent = 'Copy invoice'), 1200);
        } catch (e) {
          console.warn('copy failed', e);
          copyBtn.textContent = 'Copy failed';
          window.setTimeout(() => (copyBtn.textContent = 'Copy invoice'), 1200);
        }
      };

      const qrPayload = /^lightning:/i.test(pr) ? pr : `lightning:${pr}`;
      QRCode.toDataURL(qrPayload, { errorCorrectionLevel: 'M', margin: 1, scale: 6 })
        .then((dataUrl) => {
          qrImg.src = dataUrl;
        })
        .catch((err) => console.warn('qr gen failed', err));

      startRealtime(pr);
      startPoll();

      const verify = opts.verifyPayment;
      if (isMock(opts)) {
        unlock();
        return pr;
      }
      if (verify) {
        // Fire-and-forget verification; realtime WS can unlock sooner.
        verify(pr)
          .then((ok) => {
            if (ok) unlock();
          })
          .catch(() => {
            /* ignore */
          });
      }
      return pr;
    } catch (e) {
      console.error('pay-to-action error', e);
      status.textContent = 'Failed to generate invoice';
      status.classList.remove('nostrstack-status--muted', 'nostrstack-status--success');
      status.classList.add('nostrstack-status--danger');
    } finally {
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
    }
  };

  const markPaid = async () => {
    try {
      paidBtn.disabled = true;
      const pr = currentInvoice ?? '';
      if (!pr) {
        paidBtn.disabled = false;
        return;
      }
      if (!opts.verifyPayment) {
        status.textContent = 'Waiting for payment confirmation…';
        startRealtime(pr);
        startPoll();
        paidBtn.disabled = false;
        return;
      }
      const ok = await opts.verifyPayment(pr);
      if (!ok) {
        status.textContent = 'Payment not detected yet';
        paidBtn.disabled = false;
        return;
      }
      unlock();
    } catch (e) {
      console.warn('verifyPayment failed', e);
      paidBtn.disabled = false;
    }
  };

  btn.addEventListener('click', getInvoice);
  btn.onclick = getInvoice;
  paidBtn.addEventListener('click', markPaid);
  paidBtn.onclick = markPaid;

  container.appendChild(header);
  container.appendChild(panel);
  return btn;
}

const DEFAULT_RELAYS = ['wss://relay.damus.io', 'wss://relay.snort.social'];

function getRelayInit() {
  return window.NostrTools?.relayInit;
}

type RelayConnection = {
  url?: string;
  connect: () => Promise<void>;
  sub: (filters: unknown) => { on: (type: string, cb: (ev: NostrEvent) => void) => void };
  publish: (ev: NostrEvent) => Promise<unknown>;
};

async function connectRelays(urls: string[]): Promise<RelayConnection[]> {
  if (urls.includes('mock')) {
    return [];
  }
  const relayInit = getRelayInit();
  if (!relayInit) return [];
  const relays = await Promise.all(urls.map(async (url) => {
    const relay = relayInit(url) as RelayConnection;
    relay.url = relay.url ?? url;
    try {
      await relay.connect();
      return relay;
    } catch (e) {
      console.warn('relay connect failed', url, e);
      return null;
    }
  }));
  return relays.filter((r): r is RelayConnection => Boolean(r));
}

export async function renderCommentWidget(container: HTMLElement, opts: CommentWidgetOptions = {}) {
  ensureNostrstackRoot(container);
  container.classList.add('nostrstack-card', 'nostrstack-comments');
  container.replaceChildren();

  const isMockMode = opts.relays?.includes('mock');
  let relays = isMockMode ? [] : await connectRelays(opts.relays ?? DEFAULT_RELAYS);
  let mockMode = isMockMode;
  const mockEvents: NostrEvent[] = [];
  if (!relays.length && !isMockMode) {
    // If caller explicitly asked for relays and none reachable, show note; otherwise stay quiet.
    if (opts.relays && opts.relays.length) {
      const note = document.createElement('div');
      note.textContent = 'No relays reachable; using mock comments.';
      note.className = 'nostrstack-muted';
      container.appendChild(note);
    }
    relays = [];
    mockMode = true;
  }
  const threadId = opts.threadId ?? (location?.href ?? 'thread');
  opts.onRelayInfo?.({
    relays: mockMode ? ['mock'] : relays.map((r) => r.url ?? '').filter(Boolean),
    mode: mockMode ? 'mock' : 'real'
  });

  const header = document.createElement('div');
  header.className = 'nostrstack-comments-header';

  const headerText = document.createElement('div');
  headerText.className = 'nostrstack-comments-title';
  headerText.textContent = opts.headerText ?? 'Comments';

  const relayBadge = renderRelayBadge(
    mockMode ? ['mock'] : relays.map((r) => r.url ?? '').filter(Boolean),
    mockMode ? 'mock' : 'real'
  );
  relayBadge.classList.add('nostrstack-comments-relays');

  const list = document.createElement('div');
  list.className = 'nostrstack-comments-list';

  const status = document.createElement('div');
  status.className = 'nostrstack-status nostrstack-status--muted';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  const form = document.createElement('form');
  form.className = 'nostrstack-comments-form';
  const textarea = document.createElement('textarea');
  textarea.className = 'nostrstack-textarea';
  textarea.name = 'comment';
  textarea.placeholder = opts.placeholder ?? 'Add a comment (Nostr)';
  textarea.required = true;
  textarea.rows = 3;
  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'nostrstack-btn nostrstack-btn--primary';
  submit.textContent = 'Post';
  form.appendChild(textarea);
  form.appendChild(submit);

  const appendEvent = (ev: NostrEvent) => {
    const row = document.createElement('div');
    row.className = 'nostrstack-comment';
    row.textContent = ev.content;
    list.appendChild(row);
  };

  if (!mockMode) {
    const filters = [{ kinds: [1], '#t': [threadId] }];
    relays.forEach((relay) => {
      const sub = relay.sub(filters);
      sub.on('event', (ev: NostrEvent) => {
        appendEvent(ev);
        opts.onEvent?.(ev, relay.url ?? undefined);
      });
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!window.nostr && !mockMode) {
      status.textContent = 'Nostr signer (NIP-07) required to post';
      status.classList.remove('nostrstack-status--muted', 'nostrstack-status--success');
      status.classList.add('nostrstack-status--danger');
      return;
    }
    const content = textarea.value.trim();
    if (!content) return;
    submit.disabled = true;
    status.textContent = '';
    status.classList.remove('nostrstack-status--danger', 'nostrstack-status--success');
    status.classList.add('nostrstack-status--muted');
    try {
      if (mockMode) {
        const mockEvent: NostrEvent = {
          kind: 1,
          created_at: Math.floor(Date.now() / 1000),
          tags: [['t', threadId]],
          content,
          pubkey: 'mock-' + Math.random().toString(16).slice(2, 8)
        };
        mockEvents.push(mockEvent);
        appendEvent(mockEvent);
        textarea.value = '';
      } else {
        const nostr = window.nostr;
        if (!nostr?.getPublicKey || !nostr.signEvent) {
          throw new Error('Nostr signer unavailable');
        }
        const pubkey = await nostr.getPublicKey();
        const unsigned: NostrEvent = {
          kind: 1,
          created_at: Math.floor(Date.now() / 1000),
          tags: [['t', threadId]],
          content,
          pubkey,
          id: '',
          sig: ''
        };
        const signed = await nostr.signEvent(unsigned);
        await Promise.all(relays.map((relay) => relay.publish(signed)));
        appendEvent(signed);
        textarea.value = '';
      }
    } catch (err) {
      console.error('nostr post failed', err);
      status.textContent = 'Failed to post comment';
      status.classList.remove('nostrstack-status--muted', 'nostrstack-status--success');
      status.classList.add('nostrstack-status--danger');
    } finally {
      submit.disabled = false;
    }
  });

  header.append(headerText, relayBadge);
  container.appendChild(header);
  container.appendChild(list);
  container.appendChild(status);
  container.appendChild(form);
  return container;
}

export function autoMount() {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-nostrstack-tip]'));
  nodes.forEach((el) => {
    const username = getBrandAttr(el, 'Tip');
    if (!username) return;
    const amount = el.dataset.amountMsat ? Number(el.dataset.amountMsat) : undefined;
    const baseURL = el.dataset.baseUrl;
    const host = el.dataset.host;
    renderTipButton(el, { username, amountMsat: amount, baseURL, host, text: el.dataset.label });
  });

  const payNodes = Array.from(document.querySelectorAll<HTMLElement>('[data-nostrstack-pay]'));
  payNodes.forEach((el) => {
    const username = getBrandAttr(el, 'Pay');
    if (!username) return;
    const amount = el.dataset.amountMsat ? Number(el.dataset.amountMsat) : undefined;
    renderPayToAction(el, { username, amountMsat: amount, text: el.dataset.label, baseURL: el.dataset.baseUrl, host: el.dataset.host });
  });

  const commentNodes = Array.from(document.querySelectorAll<HTMLElement>('[data-nostrstack-comments]'));
  commentNodes.forEach((el) => {
    const thread = getBrandAttr(el, 'Comments') || undefined;
    const relays = el.dataset.relays ? el.dataset.relays.split(',').map((r) => r.trim()) : undefined;
    renderCommentWidget(el, { threadId: thread, relays, headerText: el.dataset.header, placeholder: el.dataset.placeholder });
  });
}

// Auto-run if window is available
if (typeof window !== 'undefined') {
  const w = window as unknown as { __nostrstackDisableAutoMount?: boolean };
  if (!w.__nostrstackDisableAutoMount) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', autoMount);
    } else {
      autoMount();
    }
  }
}

export { NostrstackClient } from '@nostrstack/sdk';

type MountTipOptions = {
  username?: string;
  text?: string;
  amountSats?: number;
  baseURL?: string;
  host?: string;
  onInvoice?: (pr: string) => void;
};

export function mountTipButton(container: HTMLElement, opts: MountTipOptions = {}) {
  const amountMsat = opts.amountSats ? opts.amountSats * 1000 : undefined;
  return renderTipButton(container, {
    username: opts.username ?? getBrandAttr(container, 'Tip') ?? 'anonymous',
    text: opts.text,
    amountMsat,
    baseURL: opts.baseURL,
    host: opts.host,
    onInvoice: async (pr) => {
      try {
        if (opts.onInvoice) await opts.onInvoice(pr);
        else if (navigator?.clipboard?.writeText) await navigator.clipboard.writeText(pr);
      } catch (e) {
        console.warn('clipboard copy failed', e);
      }
    }
  });
}

type MountPayOptions = {
  username?: string;
  text?: string;
  amountSats?: number;
  baseURL?: string;
  host?: string;
  verifyPayment?: (pr: string) => Promise<boolean>;
  onUnlock?: () => void;
  onInvoice?: (pr: string) => void;
};

export function mountPayToAction(container: HTMLElement, opts: MountPayOptions = {}) {
  const amountMsat = opts.amountSats ? opts.amountSats * 1000 : undefined;
  return renderPayToAction(container, {
    username: opts.username ?? getBrandAttr(container, 'Pay') ?? 'anonymous',
    text: opts.text ?? container.dataset.label,
    amountMsat,
    baseURL: opts.baseURL,
    host: opts.host,
    verifyPayment: opts.verifyPayment,
    onUnlock: opts.onUnlock,
    onInvoice: async (pr) => {
      try {
        if (opts.onInvoice) await opts.onInvoice(pr);
        else if (navigator?.clipboard?.writeText) await navigator.clipboard.writeText(pr);
      } catch (e) {
        console.warn('clipboard copy failed', e);
      }
    }
  });
}

type MountCommentOptions = {
  threadId?: string;
  relays?: string[];
  placeholder?: string;
  headerText?: string;
  onRelayInfo?: (info: { relays: string[]; mode: 'real' | 'mock' }) => void;
  onEvent?: (event: NostrEvent, relay?: string) => void;
};

export function mountCommentWidget(container: HTMLElement, opts: MountCommentOptions = {}) {
  return renderCommentWidget(container, {
    threadId: opts.threadId ?? getBrandAttr(container, 'Comments'),
    relays: opts.relays,
    placeholder: opts.placeholder ?? container.dataset.placeholder,
    headerText: opts.headerText ?? container.dataset.header,
    onRelayInfo: opts.onRelayInfo,
    onEvent: opts.onEvent
  });
}
