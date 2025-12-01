import { NostrstackClient } from '@nostrstack/sdk';
import { renderInvoicePopover } from './invoicePopover.js';

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
  onEvent?: (event: NostrEvent) => void;
  onRelayInfo?: (info: { relays: string[]; mode: 'real' | 'mock' }) => void;
};

declare global {
  interface Window {
    nostr?: {
      getPublicKey: () => Promise<string>;
      signEvent: (event: NostrEvent) => Promise<NostrEvent>;
    };
    NostrTools?: { relayInit?: (url: string) => any };
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

const ATTR_PREFIXES = ['nostrstack'];

function getBrandAttr(el: HTMLElement, key: 'Tip' | 'Pay' | 'Comments') {
  for (const prefix of ATTR_PREFIXES) {
    const val = (el.dataset as any)[`${prefix}${key}`];
    if (val !== undefined) return val;
  }
  return undefined;
}

function setBrandAttr(el: HTMLElement, key: 'Tip' | 'Pay' | 'Comments', value: string) {
  (el.dataset as any)[`nostrstack${key}`] = value;
}

export function renderTipButton(container: HTMLElement, opts: TipWidgetOptions) {
  const btn = document.createElement('button');
  btn.textContent = opts.text ?? 'Send sats';
  setBrandAttr(btn, 'Tip', opts.username);
  const handler = async () => {
    btn.disabled = true;
    try {
      if (isMock(opts)) {
        const mockPr = 'lnbc1mock' + Math.random().toString(16).slice(2, 10);
        await opts.onInvoice?.(mockPr);
        if (!opts.onInvoice) {
          const pre = document.createElement('pre');
          pre.textContent = mockPr;
          container.appendChild(pre);
        }
        return;
      }

      const client = createClient(opts);
      const meta = await client.getLnurlpMetadata(opts.username);
      const amount = opts.amountMsat ?? meta.minSendable ?? 1000;
      const invoice = await client.getLnurlpInvoice(opts.username, amount);
      if (opts.onInvoice) {
        await opts.onInvoice(invoice.pr);
      } else {
        renderInvoicePopover(invoice.pr);
      }
    } catch (e: any) {
      console.error('tip error', e);
      alert('Failed to generate invoice');
    } finally {
      btn.disabled = false;
    }
  };

  // Support both DOM events and direct property invocation in tests
  btn.addEventListener('click', handler);
  btn.onclick = handler;
  container.appendChild(btn);
  return btn;
}

export function renderPayToAction(container: HTMLElement, opts: PayToActionOptions) {
  const btn = document.createElement('button');
  btn.textContent = opts.text ?? 'Unlock';
  const status = document.createElement('div');
  status.style.marginTop = '0.5rem';

  const invoiceBox = document.createElement('pre');
  invoiceBox.style.whiteSpace = 'pre-wrap';
  invoiceBox.style.wordBreak = 'break-all';
  invoiceBox.style.display = 'none';

  const openWallet = document.createElement('a');
  openWallet.textContent = 'Open in wallet';
  openWallet.style.display = 'none';

  const paidBtn = document.createElement('button');
  paidBtn.textContent = "I've paid";
  paidBtn.style.display = 'none';

  const unlock = () => {
    status.textContent = 'Unlocked';
    btn.disabled = true;
    paidBtn.disabled = true;
    opts.onUnlock?.();
  };

  const getInvoice = async () => {
    btn.disabled = true;
    status.textContent = 'Generating invoice…';
    try {
      const pr = isMock(opts)
        ? 'lnbc1mock' + Math.random().toString(16).slice(2, 10)
        : (await (async () => {
            const client = createClient(opts);
            const meta = await client.getLnurlpMetadata(opts.username);
            const amount = opts.amountMsat ?? meta.minSendable ?? 1000;
            const invoice = await client.getLnurlpInvoice(opts.username, amount);
            return invoice.pr;
          })());

      invoiceBox.textContent = pr;
      invoiceBox.style.display = 'block';
      openWallet.href = `lightning:${pr}`;
      openWallet.style.display = 'inline';
      paidBtn.style.display = 'inline';
      status.textContent = 'Pay invoice then confirm.';

      if (opts.onInvoice) await opts.onInvoice(pr);
      else if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(pr);
      }

      const verify = opts.verifyPayment;
      if (isMock(opts)) {
        unlock();
        return pr;
      }
      if (!verify) return pr;
      const ok = await verify(pr);
      if (ok) unlock();
      return pr;
    } catch (e: any) {
      console.error('pay-to-action error', e);
      status.textContent = 'Failed to generate invoice';
      alert('Failed to generate invoice');
    } finally {
      btn.disabled = false;
    }
  };

  const markPaid = async () => {
    try {
      paidBtn.disabled = true;
      if (opts.verifyPayment) {
        const ok = await opts.verifyPayment(invoiceBox.textContent ?? '');
        if (!ok) {
          status.textContent = 'Payment not detected yet';
          paidBtn.disabled = false;
          return;
        }
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

  container.appendChild(btn);
  container.appendChild(status);
  container.appendChild(invoiceBox);
  container.appendChild(openWallet);
  container.appendChild(paidBtn);
  return btn;
}

const DEFAULT_RELAYS = ['wss://relay.damus.io', 'wss://relay.snort.social'];

function getRelayInit() {
  return window.NostrTools?.relayInit;
}

async function connectRelays(urls: string[]) {
  if (urls.includes('mock')) {
    return [];
  }
  const relayInit = getRelayInit();
  if (!relayInit) return [];
  const relays = await Promise.all(urls.map(async (url) => {
    const relay = relayInit(url);
    try {
      await relay.connect();
      return relay;
    } catch (e) {
      console.warn('relay connect failed', url, e);
      return null;
    }
  }));
  return relays.filter(Boolean);
}

export async function renderCommentWidget(container: HTMLElement, opts: CommentWidgetOptions = {}) {
  const isMockMode = opts.relays?.includes('mock');
  let relays = isMockMode ? [] : await connectRelays(opts.relays ?? DEFAULT_RELAYS);
  let mockMode = isMockMode;
  const mockEvents: NostrEvent[] = [];
  if (!relays.length && !isMockMode) {
    // If caller explicitly asked for relays and none reachable, show note; otherwise stay quiet.
    if (opts.relays && opts.relays.length) {
      const note = document.createElement('div');
      note.textContent = 'No relays reachable; using mock comments.';
      note.style.marginBottom = '0.5rem';
      container.appendChild(note);
    }
    relays = [];
    mockMode = true;
  }
  const threadId = opts.threadId ?? (location?.href ?? 'thread');
  opts.onRelayInfo?.({
    relays: mockMode ? ['mock'] : relays.map((r: any) => r.url ?? '').filter(Boolean),
    mode: mockMode ? 'mock' : 'real'
  });

  const header = document.createElement('h4');
  header.textContent = opts.headerText ?? 'Comments';

  const list = document.createElement('div');
  list.style.display = 'flex';
  list.style.flexDirection = 'column';
  list.style.gap = '0.5rem';

  const form = document.createElement('form');
  form.style.display = 'flex';
  form.style.flexDirection = 'column';
  form.style.gap = '0.5rem';
  const textarea = document.createElement('textarea');
  textarea.placeholder = opts.placeholder ?? 'Add a comment (Nostr)';
  textarea.required = true;
  textarea.rows = 3;
  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.textContent = 'Post';
  form.appendChild(textarea);
  form.appendChild(submit);

  const appendEvent = (ev: NostrEvent) => {
    const row = document.createElement('div');
    row.style.border = '1px solid #ddd';
    row.style.padding = '0.5rem';
    row.style.borderRadius = '6px';
    row.textContent = ev.content;
    list.appendChild(row);
  };

  if (!mockMode) {
    const filters = [{ kinds: [1], '#t': [threadId] }];
    relays.forEach((relay: any) => {
      const sub = relay.sub(filters);
      sub.on('event', (ev: NostrEvent) => {
        appendEvent(ev);
        opts.onEvent?.(ev);
      });
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!window.nostr && !mockMode) {
      alert('Nostr signer (NIP-07) required to post');
      return;
    }
    const content = textarea.value.trim();
    if (!content) return;
    submit.disabled = true;
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
      alert('Failed to post comment');
    } finally {
      submit.disabled = false;
    }
  });

  container.appendChild(header);
  container.appendChild(list);
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
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoMount);
  } else {
    autoMount();
  }
}

export { NostrstackClient } from '@nostrstack/sdk';

type MountTipOptions = {
  username?: string;
  text?: string;
  amountSats?: number;
  baseURL?: string;
  host?: string;
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
        if (navigator?.clipboard?.writeText) await navigator.clipboard.writeText(pr);
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
};

export function mountCommentWidget(container: HTMLElement, opts: MountCommentOptions = {}) {
  return renderCommentWidget(container, {
    threadId: opts.threadId ?? getBrandAttr(container, 'Comments'),
    relays: opts.relays,
    placeholder: opts.placeholder ?? container.dataset.placeholder,
    headerText: opts.headerText ?? container.dataset.header
  });
}
