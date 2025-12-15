import { NostrstackClient } from '@nostrstack/sdk';
import QRCode from 'qrcode';

import { copyToClipboard, createCopyButton } from './copyButton.js';
import { renderInvoicePopover } from './invoicePopover.js';
import { renderQrCodeInto } from './qr.js';
import { renderRelayBadge } from './relayBadge.js';
import { ensureNostrstackRoot } from './styles.js';

export { invoicePopoverStyles, renderInvoicePopover } from './invoicePopover.js';
export { nostrUserCardStyles, renderNostrUserCard } from './nostrUserCard.js';
export {
  type NostrstackQrPreset,
  nostrstackQrPresetOptions,
  type NostrstackQrRenderOptions,
  type NostrstackQrRenderResult,
  type NostrstackQrStyleOptions,
  type NostrstackQrVerifyMode,
  renderQrCodeInto} from './qr.js';
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

type TipWidgetV2Options = {
  username: string;
  itemId: string;
  presetAmountsSats?: number[];
  defaultAmountSats?: number;
  allowCustomAmount?: boolean;
  showFeed?: boolean;
  text?: string;
  baseURL?: string;
  host?: string;
  metadata?: Record<string, unknown>;
  size?: 'full' | 'compact';
  onInvoice?: (info: { pr: string; providerRef: string | null; amountSats: number }) => void;
  onPaid?: (info: { pr: string; providerRef: string | null; amountSats: number; itemId: string; metadata?: unknown }) => void;
};

type TipFeedOptions = {
  itemId: string;
  maxItems?: number;
  baseURL?: string;
  host?: string;
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
  onRelayInfo?: (info: { relays: string[]; mode: 'real' }) => void;
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

export function resolvePayWsUrl(baseURL?: string): string | null {
  if (typeof window === 'undefined') return null;
  const raw = baseURL === undefined ? 'http://localhost:3001' : baseURL;
  const base = raw.replace(/\/$/, '');
  // Dev convenience: treat "/api" as a proxy prefix, not a server mountpoint.
  // This avoids generating "/api/ws/*" and "/api/api/*" footguns in local demos.
  if (base === '/api') {
    return `${window.location.origin.replace(/^http/i, 'ws')}/ws/pay`;
  }
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
  if (base && base !== '/api') return base;
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

  return {
    el: btn,
    destroy: () => {
      btn.removeEventListener('click', handler);
      btn.onclick = null;
    }
  };
}

function resolveTenantDomain(host?: string): string | null {
  if (host && host.trim()) return host.trim();
  if (typeof window === 'undefined') return null;
  const h = window.location.host || window.location.hostname;
  return h ? h : null;
}

function parseMaybeJson(raw: unknown): unknown | undefined {
  if (typeof raw !== 'string' || !raw) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

function extractPayEventItemId(msg: unknown): string | null {
  if (!msg || typeof msg !== 'object') return null;
  const rec = msg as Record<string, unknown>;
  if (typeof rec.itemId === 'string') return rec.itemId;
  const metadata = rec.metadata;
  if (metadata && typeof metadata === 'object' && typeof (metadata as Record<string, unknown>).itemId === 'string') {
    return (metadata as Record<string, unknown>).itemId as string;
  }
  const metaRaw = rec.meta;
  if (metaRaw && typeof metaRaw === 'object' && typeof (metaRaw as Record<string, unknown>).itemId === 'string') {
    return (metaRaw as Record<string, unknown>).itemId as string;
  }
  return null;
}

function extractPayEventAction(msg: unknown): string | null {
  if (!msg || typeof msg !== 'object') return null;
  const rec = msg as Record<string, unknown>;
  if (typeof rec.action === 'string') return rec.action;
  const metadata = rec.metadata;
  if (metadata && typeof metadata === 'object' && typeof (metadata as Record<string, unknown>).action === 'string') {
    return (metadata as Record<string, unknown>).action as string;
  }
  const metaRaw = rec.meta;
  if (metaRaw && typeof metaRaw === 'object' && typeof (metaRaw as Record<string, unknown>).action === 'string') {
    return (metaRaw as Record<string, unknown>).action as string;
  }
  return null;
}

function extractPayEventAmount(msg: unknown): number | null {
  if (!msg || typeof msg !== 'object') return null;
  const rec = msg as Record<string, unknown>;
  const raw = rec.amount ?? rec.amountSats;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  return null;
}

function extractPayEventProviderRef(msg: unknown): string | null {
  if (!msg || typeof msg !== 'object') return null;
  const rec = msg as Record<string, unknown>;
  if (typeof rec.providerRef === 'string') return rec.providerRef;
  if (typeof rec.provider_ref === 'string') return rec.provider_ref;
  return null;
}

function extractPayEventInvoice(msg: unknown): string | null {
  if (!msg || typeof msg !== 'object') return null;
  const rec = msg as Record<string, unknown>;
  if (typeof rec.pr === 'string') return rec.pr;
  if (typeof rec.payment_request === 'string') return rec.payment_request;
  return null;
}

function renderTipFeedRow(opts: { amountSats: number; createdAt: Date; note?: string; newPulse?: boolean }) {
  const row = document.createElement('div');
  row.className = 'nostrstack-tip-feed__row';
  if (opts.newPulse) row.dataset.pulse = 'true';

  const left = document.createElement('div');
  left.className = 'nostrstack-tip-feed__icon';
  left.textContent = '⚡';

  const body = document.createElement('div');
  body.className = 'nostrstack-tip-feed__body';

  const title = document.createElement('div');
  title.className = 'nostrstack-tip-feed__title';
  title.textContent = `${opts.amountSats} sats`;

  const sub = document.createElement('div');
  sub.className = 'nostrstack-tip-feed__sub';
  const ageSecs = Math.max(0, Math.round((Date.now() - opts.createdAt.getTime()) / 1000));
  const age = ageSecs < 60 ? `${ageSecs}s` : `${Math.round(ageSecs / 60)}m`;
  sub.textContent = `${age} ago${opts.note ? ` · ${opts.note}` : ''}`;

  body.append(title, sub);
  row.append(left, body);
  if (opts.newPulse) {
    // Let the CSS animation play once.
    window.setTimeout(() => {
      try {
        row.dataset.pulse = 'false';
      } catch {
        /* ignore */
      }
    }, 900);
  }
  return row;
}

export function renderTipFeed(container: HTMLElement, opts: TipFeedOptions) {
  ensureNostrstackRoot(container);
  container.classList.add('nostrstack-card', 'nostrstack-tip-feed');
  container.replaceChildren();

  const wsUrl = resolvePayWsUrl(opts.baseURL);
  const apiBaseUrl = resolveApiBaseUrl(opts.baseURL);
  const domain = resolveTenantDomain(opts.host);
  const itemId = opts.itemId;
  const maxItems = Math.max(5, Math.min(60, opts.maxItems ?? 25));
  const PAID_STATES = new Set(['PAID', 'COMPLETED', 'SETTLED', 'CONFIRMED']);

  const header = document.createElement('div');
  header.className = 'nostrstack-tip-feed__header';

  const title = document.createElement('div');
  title.className = 'nostrstack-tip-feed__heading';
  title.textContent = 'Tip activity';

  const stats = document.createElement('div');
  stats.className = 'nostrstack-tip-feed__stats';
  stats.textContent = '—';

  header.append(title, stats);

  const list = document.createElement('div');
  list.className = 'nostrstack-tip-feed__list';

  const status = document.createElement('div');
  status.className = 'nostrstack-status nostrstack-status--muted';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.textContent = 'Loading…';

  container.append(header, list, status);

  let totalAmountSats = 0;
  let count = 0;
  const seen = new Set<string>();

  const setStats = () => {
    stats.textContent = `${count} tips · ${totalAmountSats} sats`;
  };

  const insertTip = (tip: { id: string; amountSats: number; createdAt: Date; note?: string }) => {
    if (seen.has(tip.id)) return;
    seen.add(tip.id);
    count += 1;
    totalAmountSats += tip.amountSats;
    setStats();
    list.prepend(renderTipFeedRow({ amountSats: tip.amountSats, createdAt: tip.createdAt, note: tip.note, newPulse: true }));
    // Trim.
    while (list.children.length > maxItems) list.lastElementChild?.remove();
  };

  const hydrate = async () => {
    status.textContent = 'Loading…';
    try {
      const domainParam = domain ? `&domain=${encodeURIComponent(domain)}` : '';
      const res = await fetch(
        `${apiBaseUrl}/api/tips?itemId=${encodeURIComponent(itemId)}&limit=${encodeURIComponent(maxItems)}${domainParam}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as {
        count?: number;
        totalAmountSats?: number;
        tips?: Array<{ id?: string; amountSats?: number; createdAt?: string; metadata?: unknown }>;
      };
      totalAmountSats = typeof body.totalAmountSats === 'number' ? body.totalAmountSats : 0;
      count = typeof body.count === 'number' ? body.count : 0;
      setStats();
      list.replaceChildren();
      seen.clear();
      for (const tip of body.tips ?? []) {
        const id = typeof tip.id === 'string' ? tip.id : null;
        const amountSats = typeof tip.amountSats === 'number' ? tip.amountSats : null;
        const createdAt = typeof tip.createdAt === 'string' ? new Date(tip.createdAt) : null;
        if (!id || amountSats == null || !createdAt) continue;
        const note =
          tip.metadata && typeof tip.metadata === 'object' && typeof (tip.metadata as Record<string, unknown>).note === 'string'
            ? ((tip.metadata as Record<string, unknown>).note as string)
            : undefined;
        seen.add(id);
        list.append(renderTipFeedRow({ amountSats, createdAt, note }));
      }
      status.textContent = wsUrl ? 'Live' : '';
    } catch (e) {
      console.warn('tip feed hydrate failed', e);
      status.textContent = 'Failed to load tip activity';
      status.classList.remove('nostrstack-status--muted');
      status.classList.add('nostrstack-status--danger');
    }
  };

  hydrate();

  let ws: WebSocket | null = null;
  if (wsUrl) {
    try {
      ws = new WebSocket(wsUrl);
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string) as unknown;
          if (!msg || typeof msg !== 'object') return;
          const rec = msg as Record<string, unknown>;
          const kind = rec.type;
          const statusStr = typeof rec.status === 'string' ? rec.status.toUpperCase() : '';
          const paid =
            kind === 'invoice-paid' || (kind === 'invoice-status' && PAID_STATES.has(statusStr));
          if (!paid) return;
          const action = extractPayEventAction(msg);
          if (action !== 'tip') return;
          const evItemId = extractPayEventItemId(msg);
          if (evItemId !== itemId) return;
          const amountSats = extractPayEventAmount(msg);
          const providerRef = extractPayEventProviderRef(msg);
          if (amountSats == null || !providerRef) return;
          const meta =
            rec.metadata && typeof rec.metadata === 'object'
              ? rec.metadata
              : typeof rec.metadata === 'string'
                ? parseMaybeJson(rec.metadata)
                : undefined;
          const note =
            meta && typeof meta === 'object' && typeof (meta as Record<string, unknown>).note === 'string'
              ? ((meta as Record<string, unknown>).note as string)
              : undefined;
          insertTip({ id: providerRef, amountSats, createdAt: new Date(), note });
        } catch {
          /* ignore */
        }
      };
    } catch {
      /* ignore ws */
    }
  }

  return {
    refresh: hydrate,
    destroy: () => {
      try {
        ws?.close();
      } catch {
        /* ignore */
      } finally {
        ws = null;
      }
    }
  };
}

export function renderTipWidget(container: HTMLElement, opts: TipWidgetV2Options) {
  ensureNostrstackRoot(container);
  container.classList.add('nostrstack-card', 'nostrstack-tip');
  if (opts.size === 'compact') {
    container.classList.add('nostrstack-tip--compact');
  }
  container.replaceChildren();

  const wsUrl = resolvePayWsUrl(opts.baseURL);
  const apiBaseUrl = resolveApiBaseUrl(opts.baseURL);
  const domain = resolveTenantDomain(opts.host);
  const itemId = opts.itemId;

  // Header with lightning icon
  const header = document.createElement('div');
  header.className = 'nostrstack-tip__header';

  const headerLeft = document.createElement('div');
  headerLeft.className = 'nostrstack-tip__headerLeft';

  const title = document.createElement('div');
  title.className = 'nostrstack-tip__title';
  const titleIcon = document.createElement('span');
  titleIcon.className = 'nostrstack-tip__titleIcon';
  titleIcon.textContent = '⚡';
  titleIcon.setAttribute('aria-hidden', 'true');
  const titleText = document.createTextNode(opts.text ?? 'Send a tip');
  title.append(titleIcon, titleText);

  const subtitle = document.createElement('div');
  subtitle.className = 'nostrstack-tip__sub';
  subtitle.textContent = `Pay @${opts.username}`;

  headerLeft.append(title, subtitle);
  header.appendChild(headerLeft);

  const amountRow = document.createElement('div');
  amountRow.className = 'nostrstack-tip__amountRow';

  const presets = (opts.presetAmountsSats?.filter((n) => Number.isFinite(n) && n > 0) ?? [5, 10, 21])
    .slice(0, 3)
    .map((n) => Math.round(n));
  const defaultAmount = Math.round(opts.defaultAmountSats ?? presets[0] ?? 5);
  let selectedAmountSats = defaultAmount;

  const presetBtns: HTMLButtonElement[] = [];
  const setSelected = (n: number) => {
    selectedAmountSats = n;
    presetBtns.forEach((b) => {
      b.dataset.selected = b.dataset.amount === String(n) ? 'true' : 'false';
    });
    customInput.value = '';
    customInput.dataset.dirty = 'false';
  };

  presets.forEach((n) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'nostrstack-btn nostrstack-btn--sm nostrstack-tip__amt';
    const label = document.createElement('span');
    label.className = 'nostrstack-tip__amtLabel';
    label.textContent = `${n} sats`;
    b.appendChild(label);
    b.dataset.amount = String(n);
    b.dataset.selected = n === defaultAmount ? 'true' : 'false';
    b.onclick = async () => {
      setSelected(n);
      await startTip(n);
    };
    presetBtns.push(b);
    amountRow.appendChild(b);
  });

  const customWrap = document.createElement('div');
  customWrap.className = 'nostrstack-tip__custom';
  if (opts.allowCustomAmount === false) customWrap.style.display = 'none';

  const customInput = document.createElement('input');
  customInput.type = 'number';
  customInput.name = 'amountSats';
  customInput.inputMode = 'numeric';
  customInput.placeholder = 'Custom';
  customInput.min = '1';
  customInput.className = 'nostrstack-input nostrstack-tip__customInput';
  customInput.dataset.dirty = 'false';
  customInput.oninput = () => {
    customInput.dataset.dirty = customInput.value.trim() ? 'true' : 'false';
    presetBtns.forEach((b) => (b.dataset.selected = 'false'));
  };

  const tipBtn = document.createElement('button');
  tipBtn.type = 'button';
  tipBtn.className = 'nostrstack-btn nostrstack-btn--primary nostrstack-btn--sm nostrstack-tip__go';
  tipBtn.textContent = 'Tip';
  tipBtn.onclick = async () => {
    const n = Number(customInput.value);
    if (Number.isFinite(n) && n > 0) {
      selectedAmountSats = Math.round(n);
      await startTip(selectedAmountSats);
      return;
    }
    await startTip(selectedAmountSats);
  };

  customWrap.append(customInput, tipBtn);

  const note = document.createElement('input');
  note.type = 'text';
  note.name = 'note';
  note.placeholder = 'Add a note (optional)';
  note.className = 'nostrstack-input nostrstack-tip__note';
  note.maxLength = 140;

  const panel = document.createElement('div');
  panel.className = 'nostrstack-tip__panel';
  panel.dataset.state = 'initial';

  // Countdown ring
  const ring = document.createElement('div');
  ring.className = 'nostrstack-tip__ring';

  const ringSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  ringSvg.setAttribute('class', 'nostrstack-tip__ringSvg');
  ringSvg.setAttribute('viewBox', '0 0 72 72');

  const ringBg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  ringBg.setAttribute('class', 'nostrstack-tip__ringBg');
  ringBg.setAttribute('cx', '36');
  ringBg.setAttribute('cy', '36');
  ringBg.setAttribute('r', '30');

  const ringProgress = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  ringProgress.setAttribute('class', 'nostrstack-tip__ringProgress');
  ringProgress.setAttribute('cx', '36');
  ringProgress.setAttribute('cy', '36');
  ringProgress.setAttribute('r', '30');

  ringSvg.append(ringBg, ringProgress);

  const ringCenter = document.createElement('div');
  ringCenter.className = 'nostrstack-tip__ringCenter';

  const ringTime = document.createElement('div');
  ringTime.className = 'nostrstack-tip__ringTime';
  ringTime.textContent = '2:00';

  const ringLabel = document.createElement('div');
  ringLabel.className = 'nostrstack-tip__ringLabel';
  ringLabel.textContent = 'left';

  const ringIcon = document.createElement('div');
  ringIcon.className = 'nostrstack-tip__ringIcon';
  ringIcon.textContent = '⏳';
  ringIcon.style.display = 'none';

  ringCenter.append(ringTime, ringLabel, ringIcon);
  ring.append(ringSvg, ringCenter);

  const status = document.createElement('div');
  status.className = 'nostrstack-status nostrstack-status--muted';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.textContent = '';

  // Realtime indicator with pulse dot
  const realtime = document.createElement('div');
  realtime.className = 'nostrstack-tip__realtime';
  realtime.dataset.state = 'idle';

  const realtimeDot = document.createElement('span');
  realtimeDot.className = 'nostrstack-tip__realtimeDot';

  const realtimeText = document.createElement('span');
  realtimeText.textContent = '';

  realtime.append(realtimeDot, realtimeText);

  const qrWrap = document.createElement('div');
  qrWrap.className = 'nostrstack-tip__qr';

  const invoiceBox = document.createElement('div');
  invoiceBox.className = 'nostrstack-invoice-box';
  invoiceBox.style.position = 'relative'; // For inline copy button
  // invoiceBox.style.display = 'none'; // Hidden until invoice generated - handled by CSS class now
  const invoiceCode = document.createElement('code');
  invoiceCode.className = 'nostrstack-code';
  invoiceBox.appendChild(invoiceCode);

  const { el: inlineCopyBtn, reset: resetInlineCopyBtn } = createCopyButton({
    label: 'Copy',
    variant: 'icon',
    size: 'sm',
    getText: () => currentInvoice ?? ''
  });
  inlineCopyBtn.className += ' nostrstack-btn--ghost nostrstack-invoice-copy';
  inlineCopyBtn.style.position = 'absolute';
  inlineCopyBtn.style.top = '4px';
  inlineCopyBtn.style.right = '4px';
  inlineCopyBtn.style.padding = '4px';
  inlineCopyBtn.style.width = '28px';
  inlineCopyBtn.style.height = '28px';
  inlineCopyBtn.style.background = 'var(--nostrstack-color-surface)';
  inlineCopyBtn.style.border = '1px solid var(--nostrstack-color-border)';
  invoiceBox.appendChild(inlineCopyBtn);

  const actions = document.createElement('div');
  actions.className = 'nostrstack-tip__actions';

  const { el: copyBtn, reset: resetCopyBtn } = createCopyButton({
    label: 'Copy invoice',
    size: 'sm',
    getText: () => currentInvoice ?? ''
  });
  copyBtn.disabled = true;

  const openWallet = document.createElement('a');
  openWallet.textContent = 'Open in wallet';
  openWallet.className = 'nostrstack-btn nostrstack-btn--primary nostrstack-btn--sm';
  openWallet.rel = 'noreferrer';
  openWallet.style.display = 'none';

  const paidBtn = document.createElement('button');
  paidBtn.type = 'button';
  paidBtn.textContent = "I've paid";
  paidBtn.className = 'nostrstack-btn nostrstack-btn--sm nostrstack-tip__paid';
  paidBtn.disabled = true;

  actions.append(copyBtn, openWallet, paidBtn);

  panel.append(ring, status, realtime, qrWrap, actions, invoiceBox);

  let feed: { refresh: () => void; destroy: () => void } | null = null;
  let feedWrap: HTMLDivElement | null = null;
  if (opts.showFeed !== false) {
    feedWrap = document.createElement('div');
    feedWrap.className = 'nostrstack-tip__feedWrap';
    const feedHost = document.createElement('div');
    feedWrap.appendChild(feedHost);
    feed = renderTipFeed(feedHost, { itemId, baseURL: opts.baseURL, host: opts.host, maxItems: 12 });
  }

  container.append(header, amountRow, customWrap, note, panel);
  if (feedWrap) container.appendChild(feedWrap);

  let payWs: WebSocket | null = null;
  let pollId: number | null = null;
  let realtimeState: 'idle' | 'connecting' | 'open' | 'error' = 'idle';
  let currentInvoice: string | null = null;
  let currentProviderRef: string | null = null;
  let currentAmountSats: number | null = null;
  let didPay = false;
  let invoiceStartedAt: number | null = null;
  let invoiceTicker: number | null = null;
  let qrAbort: AbortController | null = null;

  const closePayWs = () => {
    const ws = payWs;
    payWs = null;
    if (!ws) return;
    try {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
    } catch {
      /* ignore */
    }
    try {
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

  const stopInvoiceTicker = () => {
    if (invoiceTicker === null || typeof window === 'undefined') return;
    try {
      window.clearInterval(invoiceTicker);
    } catch {
      /* ignore */
    } finally {
      invoiceTicker = null;
    }
  };

  const abortQr = () => {
    const ctrl = qrAbort;
    qrAbort = null;
    if (!ctrl) return;
    try {
      ctrl.abort();
    } catch {
      /* ignore */
    }
  };

  const fmtClock = (secs: number) => {
    const s = Math.max(0, Math.floor(secs));
    const m = Math.floor(s / 60)
      .toString()
      .padStart(2, '0');
    const r = (s % 60).toString().padStart(2, '0');
    return `${m}:${r}`;
  };

  const RING_CIRCUMFERENCE = 188.5; // 2 * PI * 30
  const INVOICE_TTL_SECS = 120;

  const updateRing = (remainingSecs: number, isPaid: boolean) => {
    if (isPaid) {
      // Show checkmark
      ringTime.textContent = '✓';
      ringTime.style.color = 'var(--nostrstack-color-success)';
      ringLabel.textContent = 'Paid';
      ringIcon.style.display = 'none';
      ringProgress.style.setProperty('--ring-offset', '0');
      panel.dataset.state = 'paid';
    } else {
      // Update countdown
      const progress = Math.max(0, Math.min(1, 1 - (remainingSecs / INVOICE_TTL_SECS)));
      const offset = progress * RING_CIRCUMFERENCE;
      ringProgress.style.setProperty('--ring-offset', String(offset));
      ringTime.textContent = fmtClock(remainingSecs);
      ringTime.style.color = '';
      ringLabel.textContent = remainingSecs > 0 ? 'left' : 'expired';
      ringIcon.style.display = 'none';
      panel.dataset.state = 'waiting';
    }
  };

  const startInvoiceTicker = () => {
    stopInvoiceTicker();
    if (typeof window === 'undefined' || invoiceStartedAt === null) return;
    const update = () => {
      if (invoiceStartedAt === null) return;
      const ageMs = Date.now() - invoiceStartedAt;
      const remainingSecs = Math.max(0, INVOICE_TTL_SECS - ageMs / 1000);
      updateRing(remainingSecs, didPay);
    };
    update();
    invoiceTicker = window.setInterval(update, 1000);
  };

  const setRealtime = (next: typeof realtimeState) => {
    realtimeState = next;
    realtime.dataset.state = next;
    if (!wsUrl || !currentInvoice) {
      realtimeText.textContent = '';
      return;
    }
    realtimeText.textContent =
      realtimeState === 'open'
        ? 'Watching for payment'
        : realtimeState === 'connecting'
          ? 'Connecting…'
          : realtimeState === 'error'
            ? 'Connection error'
            : '';
  };

  const normalizeInvoice = (pr: string | null | undefined) => {
    if (!pr) return null;
    return pr.trim().replace(/^(?:lightning:)+/i, '');
  };

  const celebrate = () => {
    container.dataset.celebrate = 'true';

    // Success burst ring
    const burst = document.createElement('div');
    burst.className = 'nostrstack-tip__successBurst';
    container.appendChild(burst);
    window.setTimeout(() => burst.remove(), 700);

    // Lightning bolts rain
    const celebration = document.createElement('div');
    celebration.className = 'nostrstack-tip__celebration';
    for (let i = 0; i < 8; i++) {
      const bolt = document.createElement('span');
      bolt.className = 'nostrstack-tip__celebrationBolt';
      bolt.textContent = '⚡';
      bolt.style.left = `${10 + Math.round(Math.random() * 80)}%`;
      bolt.style.animationDelay = `${Math.random() * 200}ms`;
      celebration.appendChild(bolt);
    }
    container.appendChild(celebration);

    // Confetti particles
    const confetti = document.createElement('div');
    confetti.className = 'nostrstack-tip__confetti';
    const colors = [
      'var(--nostrstack-color-primary)',
      'var(--nostrstack-color-accent)',
      'var(--nostrstack-color-success)',
      'var(--nostrstack-color-warning)'
    ];
    for (let i = 0; i < 20; i++) {
      const p = document.createElement('span');
      p.style.left = `${Math.round(Math.random() * 100)}%`;
      p.style.animationDelay = `${Math.random() * 300}ms`;
      p.style.background = colors[i % colors.length];
      confetti.appendChild(p);
    }
    container.appendChild(confetti);

    // Haptic feedback
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate([30, 50, 30]);
      }
    } catch {
      /* ignore */
    }

    // Cleanup
    window.setTimeout(() => {
      try {
        celebration.remove();
        confetti.remove();
        container.dataset.celebrate = 'false';
      } catch {
        /* ignore */
      }
    }, 1500);
  };

  const markPaid = () => {
    if (didPay) return;
    didPay = true;
    status.textContent = 'Payment confirmed. Thank you!';
    status.classList.remove('nostrstack-status--muted', 'nostrstack-status--danger');
    status.classList.add('nostrstack-status--success');
    paidBtn.textContent = 'Paid ✓';
    paidBtn.disabled = true;
    tipBtn.disabled = false;
    celebrate();
    stopPoll();
    startInvoiceTicker();
    if (currentInvoice && currentAmountSats != null) {
      opts.onPaid?.({
        pr: currentInvoice,
        providerRef: currentProviderRef,
        amountSats: currentAmountSats,
        itemId,
        metadata: opts.metadata
      });
    }
  };

  const startRealtime = () => {
    if (!wsUrl) return;
    if (payWs && (payWs.readyState === WebSocket.OPEN || payWs.readyState === WebSocket.CONNECTING)) return;
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
          const msg = JSON.parse(ev.data as string) as unknown;
          if (!msg || typeof msg !== 'object') return;
          const rec = msg as Record<string, unknown>;
          const kind = rec.type;
          const statusStr = typeof rec.status === 'string' ? rec.status.toUpperCase() : '';
          const paid =
            kind === 'invoice-paid' || (kind === 'invoice-status' && PAID_STATES.has(statusStr));
          if (!paid) return;
          const msgProviderRef = extractPayEventProviderRef(msg);
          const msgInvoice = normalizeInvoice(extractPayEventInvoice(msg));
          if (
            (msgInvoice && currentInvoice && msgInvoice === currentInvoice) ||
            (msgProviderRef && currentProviderRef && msgProviderRef === currentProviderRef)
          ) {
            markPaid();
          }
        } catch {
          /* ignore */
        }
      };
    } catch {
      setRealtime('error');
    }
  };

  const PAID_STATES = new Set(['PAID', 'COMPLETED', 'SETTLED', 'CONFIRMED']);
  const pollOnce = async () => {
    if (!currentProviderRef || didPay) return false;
    try {
      const domainParam = domain ? `?domain=${encodeURIComponent(domain)}` : '';
      const res = await fetch(
        `${apiBaseUrl}/api/lnurlp/pay/status/${encodeURIComponent(currentProviderRef)}${domainParam}`
      );
      if (!res.ok) return false;
      const body = (await res.json()) as { status?: unknown };
      const statusStr = String(body.status ?? '').toUpperCase();
      if (PAID_STATES.has(statusStr)) {
        markPaid();
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

  const startTip = async (amountSats: number) => {
    if (!domain) {
      status.textContent = 'Missing domain/host for tip payments';
      status.classList.remove('nostrstack-status--muted');
      status.classList.add('nostrstack-status--danger');
      return;
    }
    didPay = false;
    status.textContent = 'Generating invoice…';
    status.classList.remove('nostrstack-status--danger', 'nostrstack-status--success');
    status.classList.add('nostrstack-status--muted');
    tipBtn.disabled = true;
    copyBtn.disabled = true;
    paidBtn.disabled = true;
    paidBtn.textContent = "I've paid";
    openWallet.style.display = 'none';
    invoiceCode.textContent = '';
    invoiceBox.classList.remove('nostrstack-visible');
    qrWrap.replaceChildren();
    abortQr();
    currentInvoice = null;
    currentProviderRef = null;
    currentAmountSats = amountSats;
    stopPoll();
    stopInvoiceTicker();
    invoiceStartedAt = null;
    // Reset countdown ring
    ringTime.textContent = '2:00';
    ringTime.style.color = '';
    ringLabel.textContent = 'left';
    ringProgress.style.setProperty('--ring-offset', '0');
    panel.dataset.state = 'loading';

    try {
      const meta: Record<string, unknown> = { ...(opts.metadata ?? {}) };
      meta.itemId = itemId;
      meta.to = opts.username;
      const noteVal = note.value.trim();
      if (noteVal) meta.note = noteVal;
      const res = await fetch(`${apiBaseUrl}/api/pay`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              domain,
              action: 'tip',
              amount: amountSats,
              metadata: meta
            })
          });

      if (!res.ok) throw new Error(`HTTP ${'status' in res ? (res as Response).status : 0}`);
      const body = (await (res as Response).json()) as Record<string, unknown>;
      const pr = normalizeInvoice(extractPayEventInvoice(body));
      const providerRef =
        (typeof body.provider_ref === 'string' ? body.provider_ref : null) ??
        (typeof body.providerRef === 'string' ? body.providerRef : null) ??
        (typeof body.payment_hash === 'string' ? body.payment_hash : null);

      if (!pr) throw new Error('Invoice not returned by /api/pay');
      currentInvoice = pr;
      currentProviderRef = providerRef;
      invoiceCode.textContent = pr;
      invoiceBox.classList.add('nostrstack-visible');
      copyBtn.disabled = false;
      resetCopyBtn();
      resetInlineCopyBtn();
      openWallet.href = `lightning:${pr}`;
      openWallet.style.display = '';
      paidBtn.disabled = false;
      status.textContent = 'Waiting for payment…';
      invoiceStartedAt = Date.now();
      startInvoiceTicker();

      const qrPayload = /^lightning:/i.test(pr) ? pr : `lightning:${pr}`;
      try {
        abortQr();
        qrAbort = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const signal = qrAbort?.signal;
        const qrSize = opts.size === 'compact' ? 180 : 260;
        void renderQrCodeInto(qrWrap, qrPayload, { preset: 'brandLogo', verify: 'strict', size: qrSize, signal }).catch((err) => {
          const name = err && typeof err === 'object' && 'name' in err ? String((err as { name?: unknown }).name) : '';
          if (name === 'AbortError') return;
          console.warn('tip qr render failed', err);
        });
      } catch (err) {
        console.warn('tip qr render failed', err);
      }

      if (opts.onInvoice) {
        await opts.onInvoice({ pr, providerRef, amountSats });
      } else {
        try {
          await copyToClipboard(pr);
        } catch {
          /* ignore */
        }
      }
      startRealtime();
      startPoll();
      return pr;
    } catch (e) {
      console.error('tip v2 error', e);
      status.textContent = 'Failed to generate invoice';
      status.classList.remove('nostrstack-status--muted');
      status.classList.add('nostrstack-status--danger');
    } finally {
      tipBtn.disabled = false;
    }
  };

  paidBtn.onclick = async () => {
    status.textContent = 'Checking payment…';
    await pollOnce();
    if (!didPay) {
      status.textContent = 'Payment not detected yet';
      status.classList.remove('nostrstack-status--success');
      status.classList.add('nostrstack-status--muted');
    }
  };

  // Expose a small imperative API for tests / consumers.
  return {
    tip: startTip,
    refreshFeed: () => feed?.refresh(),
    destroy: () => {
      feed?.destroy();
      closePayWs();
      stopPoll();
      stopInvoiceTicker();
      abortQr();
    }
  };
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

  const { el: copyBtn, reset: resetCopyBtn } = createCopyButton({
    label: 'Copy invoice',
    size: 'sm',
    getText: () => currentInvoice ?? ''
  });
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

  const normalizeInvoice = (pr: string | null | undefined) => {
    if (!pr) return null;
    return pr.trim().replace(/^(?:lightning:)+/i, '');
  };

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
          const msg = JSON.parse(ev.data as string) as {
            type?: string;
            pr?: string;
            providerRef?: string;
            provider_ref?: string;
            status?: string;
          };
          const msgProviderRef =
            (typeof msg.providerRef === 'string' ? msg.providerRef : null) ??
            (typeof msg.provider_ref === 'string' ? msg.provider_ref : null);
          const msgInvoice = normalizeInvoice(msg.pr);
          const matches =
            (msgInvoice && msgInvoice === pr) || (msgProviderRef && msgProviderRef === currentProviderRef);
          if (!matches) return;
          if (msg.type === 'invoice-paid') unlock();
          if (msg.type === 'invoice-status' && PAID_STATES.has(String(msg.status ?? '').toUpperCase())) {
            unlock();
          }
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

      const invoiceRes = await (async () => {
            const client = createClient(opts);
            const meta = await client.getLnurlpMetadata(opts.username);
            const amount = opts.amountMsat ?? meta.minSendable ?? 1000;
            return await client.getLnurlpInvoice(opts.username, amount);
          })();

      const rawPr = invoiceRes.pr;
      const pr = normalizeInvoice(rawPr);
      const maybeProviderRef = (invoiceRes as unknown as { provider_ref?: unknown; providerRef?: unknown }).provider_ref;
      const maybeProviderRefCamel = (invoiceRes as unknown as { providerRef?: unknown }).providerRef;
      currentProviderRef = typeof maybeProviderRef === 'string' ? maybeProviderRef : null;
      if (!currentProviderRef) currentProviderRef = typeof maybeProviderRefCamel === 'string' ? maybeProviderRefCamel : null;

      if (!pr) throw new Error('Invoice not returned by LNURL endpoint');
      currentInvoice = pr;
      invoiceCode.textContent = pr;
      panel.style.display = 'block';
      openWallet.href = `lightning:${pr}`;
      openWallet.style.display = '';
      paidBtn.style.display = '';
      copyBtn.style.display = '';
      status.textContent = 'Pay invoice. Unlocks on confirmation.';

      if (opts.onInvoice) await opts.onInvoice(pr);
      else {
        try {
          await copyToClipboard(pr);
        } catch {
          /* ignore clipboard failures */
        }
      }
      resetCopyBtn();

      const qrPayload = /^lightning:/i.test(pr) ? pr : `lightning:${pr}`;
      QRCode.toDataURL(qrPayload, { errorCorrectionLevel: 'M', margin: 1, scale: 6 })
        .then((dataUrl) => {
          qrImg.src = dataUrl;
        })
        .catch((err) => console.warn('qr gen failed', err));

      startRealtime(pr);
      startPoll();

      const verify = opts.verifyPayment;
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

  return {
    el: btn,
    destroy: () => {
      closePayWs();
      stopPoll();
      btn.removeEventListener('click', getInvoice);
      paidBtn.removeEventListener('click', markPaid);
    }
  };
}

const DEFAULT_RELAYS = ['wss://relay.damus.io', 'wss://relay.snort.social'];

function getRelayInit() {
  return window.NostrTools?.relayInit;
}

type RelayConnection = {
  url?: string;
  connect: () => Promise<void>;
  close: () => void;
  sub: (filters: unknown) => { on: (type: string, cb: (ev: NostrEvent) => void) => void; un: () => void };
  publish: (ev: NostrEvent) => Promise<unknown>;
};

async function connectRelays(urls: string[]): Promise<RelayConnection[]> {
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

  let relays = await connectRelays(opts.relays ?? DEFAULT_RELAYS);
  if (!relays.length) {
    // If caller explicitly asked for relays and none reachable, show note.
    if (opts.relays && opts.relays.length) {
      const note = document.createElement('div');
      note.textContent = 'No relays reachable.';
      note.className = 'nostrstack-muted';
      container.appendChild(note);
    }
    relays = [];
  }
  const threadId = opts.threadId ?? (location?.href ?? 'thread');
  opts.onRelayInfo?.({
    relays: relays.map((r) => r.url ?? '').filter(Boolean),
    mode: 'real'
  });

  const header = document.createElement('div');
  header.className = 'nostrstack-comments-header';

  const headerText = document.createElement('div');
  headerText.className = 'nostrstack-comments-title';
  headerText.textContent = opts.headerText ?? 'Comments';

  const relayBadge = renderRelayBadge(
    relays.map((r) => r.url ?? '').filter(Boolean)
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

  const subs: Array<{ un: () => void }> = [];
  const filters = [{ kinds: [1], '#t': [threadId] }];
  relays.forEach((relay) => {
    const sub = relay.sub(filters);
    sub.on('event', (ev: NostrEvent) => {
      appendEvent(ev);
      opts.onEvent?.(ev, relay.url ?? undefined);
    });
    subs.push(sub);
  });

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    if (!window.nostr) {
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
    } catch (err) {
      console.error('nostr post failed', err);
      status.textContent = 'Failed to post comment';
      status.classList.remove('nostrstack-status--muted', 'nostrstack-status--success');
      status.classList.add('nostrstack-status--danger');
    } finally {
      submit.disabled = false;
    }
  };

  form.addEventListener('submit', handleSubmit);

  header.append(headerText, relayBadge);
  container.appendChild(header);
  container.appendChild(list);
  container.appendChild(status);
  container.appendChild(form);

  return {
    el: container,
    destroy: () => {
      form.removeEventListener('submit', handleSubmit);
      subs.forEach((s) => s.un());
      relays.forEach((r) => r.close());
    }
  };
}

export function autoMount() {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-nostrstack-tip]'));
  nodes.forEach((el) => {
    // @ts-ignore
    if (typeof el.__nostrstackDestroy === 'function') {
      // @ts-ignore
      el.__nostrstackDestroy();
      // @ts-ignore
      delete el.__nostrstackDestroy;
    }

    const username = getBrandAttr(el, 'Tip');
    if (!username) return;
    const amount = el.dataset.amountMsat ? Number(el.dataset.amountMsat) : undefined;
    const baseURL = el.dataset.baseUrl;
    const host = el.dataset.host;
    const itemId = el.dataset.itemId;
    if (itemId) {
      const presets = (el.dataset.presetAmountsSats ?? '')
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n) && n > 0);
      const defaultAmountSats = el.dataset.defaultAmountSats ? Number(el.dataset.defaultAmountSats) : undefined;
      const widget = renderTipWidget(el, {
        username,
        itemId,
        presetAmountsSats: presets.length ? presets : undefined,
        defaultAmountSats: Number.isFinite(defaultAmountSats as number) ? defaultAmountSats : undefined,
        baseURL,
        host,
        text: el.dataset.label
      });
      // @ts-ignore
      el.__nostrstackDestroy = widget.destroy;
      return;
    }
    const btn = renderTipButton(el, { username, amountMsat: amount, baseURL, host, text: el.dataset.label });
    // @ts-ignore
    el.__nostrstackDestroy = btn.destroy;
  });

  const payNodes = Array.from(document.querySelectorAll<HTMLElement>('[data-nostrstack-pay]'));
  payNodes.forEach((el) => {
    // @ts-ignore
    if (typeof el.__nostrstackDestroy === 'function') {
      // @ts-ignore
      el.__nostrstackDestroy();
      // @ts-ignore
      delete el.__nostrstackDestroy;
    }

    const username = getBrandAttr(el, 'Pay');
    if (!username) return;
    const amount = el.dataset.amountMsat ? Number(el.dataset.amountMsat) : undefined;
    const widget = renderPayToAction(el, { username, amountMsat: amount, text: el.dataset.label, baseURL: el.dataset.baseUrl, host: el.dataset.host });
    // @ts-ignore
    el.__nostrstackDestroy = widget.destroy;
  });

  const commentNodes = Array.from(document.querySelectorAll<HTMLElement>('[data-nostrstack-comments]'));
  commentNodes.forEach((el) => {
    // @ts-ignore
    if (typeof el.__nostrstackDestroy === 'function') {
      // @ts-ignore
      el.__nostrstackDestroy();
      // @ts-ignore
      delete el.__nostrstackDestroy;
    }

    const thread = getBrandAttr(el, 'Comments') || undefined;
    const relays = el.dataset.relays ? el.dataset.relays.split(',').map((r) => r.trim()) : undefined;
    renderCommentWidget(el, { threadId: thread, relays, headerText: el.dataset.header, placeholder: el.dataset.placeholder }).then((widget) => {
      // @ts-ignore
      el.__nostrstackDestroy = widget.destroy;
    });
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
        else await copyToClipboard(pr);
      } catch (e) {
        console.warn('clipboard copy failed', e);
      }
    }
  });
}

type MountTipWidgetOptions = {
  username?: string;
  itemId?: string;
  text?: string;
  presetAmountsSats?: number[];
  defaultAmountSats?: number;
  allowCustomAmount?: boolean;
  showFeed?: boolean;
  baseURL?: string;
  host?: string;
  metadata?: Record<string, unknown>;
  size?: 'full' | 'compact';
  onInvoice?: (info: { pr: string; providerRef: string | null; amountSats: number }) => void;
  onPaid?: (info: { pr: string; providerRef: string | null; amountSats: number; itemId: string; metadata?: unknown }) => void;
};

export function mountTipWidget(container: HTMLElement, opts: MountTipWidgetOptions = {}) {
  const username = opts.username ?? getBrandAttr(container, 'Tip') ?? 'anonymous';
  const itemId =
    opts.itemId ??
    container.dataset.itemId ??
    container.id ??
    (typeof window !== 'undefined' && window.location?.href ? window.location.href : 'item');
  return renderTipWidget(container, {
    username,
    itemId,
    presetAmountsSats: opts.presetAmountsSats,
    defaultAmountSats: opts.defaultAmountSats,
    allowCustomAmount: opts.allowCustomAmount,
    showFeed: opts.showFeed,
    text: opts.text,
    baseURL: opts.baseURL,
    host: opts.host,
    metadata: opts.metadata,
    size: opts.size,
    onInvoice: async (info) => {
      try {
        if (opts.onInvoice) await opts.onInvoice(info);
        else await copyToClipboard(info.pr);
      } catch (e) {
        console.warn('clipboard copy failed', e);
      }
    },
    onPaid: opts.onPaid
  });
}

type MountTipFeedOptions = {
  itemId?: string;
  maxItems?: number;
  baseURL?: string;
  host?: string;
};

export function mountTipFeed(container: HTMLElement, opts: MountTipFeedOptions = {}) {
  const itemId =
    opts.itemId ??
    container.dataset.itemId ??
    container.id ??
    (typeof window !== 'undefined' && window.location?.href ? window.location.href : 'item');
  return renderTipFeed(container, {
    itemId,
    maxItems: opts.maxItems,
    baseURL: opts.baseURL,
    host: opts.host
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
        else await copyToClipboard(pr);
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
  onRelayInfo?: (info: { relays: string[]; mode: 'real' }) => void;
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
