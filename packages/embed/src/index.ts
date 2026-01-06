import { renderBlockchainStats } from './blockchainStats.js';
import { copyToClipboard } from './copyButton.js';
import { getBrandAttr } from './helpers.js';
import { renderNostrProfile } from './nostrProfile.js';
import { renderRelayBadge, updateRelayBadge } from './relayBadge.js';
import { connectRelays, normalizeRelayUrls, type RelayConnection } from './relays.js';
import { renderShareButton } from './share.js';
import { ensureNostrstackRoot } from './styles.js';
import type { CommentTipWidgetOptions, CommentWidgetOptions, NostrEvent } from './types.js';
import { renderPayToAction } from './widgets/payToAction.js';
import { renderTipButton } from './widgets/tipButton.js';
import { renderTipFeed } from './widgets/tipFeed.js';
import { renderTipWidget } from './widgets/tipWidget.js';

export { renderBlockchainStats } from './blockchainStats.js';
export { invoicePopoverStyles, renderInvoicePopover } from './invoicePopover.js';
export { renderNostrProfile } from './nostrProfile.js';
export { nostrUserCardStyles, renderNostrUserCard } from './nostrUserCard.js';
export {
  type NostrstackQrPreset,
  nostrstackQrPresetOptions,
  type NostrstackQrRenderOptions,
  type NostrstackQrRenderResult,
  type NostrstackQrStyleOptions,
  type NostrstackQrVerifyMode,
  renderQrCodeInto
} from './qr.js';
export { relayBadgeStyles, renderRelayBadge, updateRelayBadge } from './relayBadge.js';
export { renderShareButton } from './share.js';
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
export { resolvePayWsUrl, resolveTelemetryWs } from './url-utils.js';

// WeakMap to store widget destroy functions without polluting DOM elements
const widgetDestroyMap = new WeakMap<HTMLElement, () => void>();

// Re-export widgets
export { renderPayToAction } from './widgets/payToAction.js';
export { renderTipButton } from './widgets/tipButton.js';
export { renderTipFeed } from './widgets/tipFeed.js';
export { renderTipWidget } from './widgets/tipWidget.js';

export async function renderCommentWidget(container: HTMLElement, opts: CommentWidgetOptions = {}) {
  ensureNostrstackRoot(container);
  container.classList.add('nostrstack-card', 'nostrstack-comments');
  container.replaceChildren();

  const maxItems = Math.max(1, Math.min(200, opts.maxItems ?? 50));
  const maxAgeDays =
    typeof opts.maxAgeDays === 'number' && opts.maxAgeDays > 0 ? opts.maxAgeDays : null;
  const since = maxAgeDays
    ? Math.floor(Date.now() / 1000) - Math.round(maxAgeDays * 86400)
    : undefined;
  const lazyConnect = opts.lazyConnect ?? false;
  const validateEvents = opts.validateEvents ?? false;

  const threadId = opts.threadId ?? location?.href ?? 'thread';

  const header = document.createElement('div');
  header.className = 'nostrstack-comments-header';

  const headerText = document.createElement('div');
  headerText.className = 'nostrstack-comments-title';
  headerText.textContent = opts.headerText ?? 'Comments';

  const relayBadge = renderRelayBadge([]);
  relayBadge.classList.add('nostrstack-comments-relays');

  const notice = document.createElement('div');
  notice.className = 'nostrstack-status nostrstack-status--muted nostrstack-comments__notice';
  notice.setAttribute('role', 'status');
  notice.setAttribute('aria-live', 'polite');
  notice.hidden = true;

  const list = document.createElement('div');
  list.className = 'nostrstack-comments-list';

  const actions = document.createElement('div');
  actions.className = 'nostrstack-comments-actions';

  const loadMoreBtn = document.createElement('button');
  loadMoreBtn.type = 'button';
  loadMoreBtn.className = 'nostrstack-btn nostrstack-btn--ghost nostrstack-comments-more';
  loadMoreBtn.textContent = lazyConnect ? 'Load comments' : 'Load more';

  actions.append(loadMoreBtn);

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

  const setStatus = (text: string, tone: 'muted' | 'success' | 'danger') => {
    status.textContent = text;
    status.classList.remove(
      'nostrstack-status--muted',
      'nostrstack-status--success',
      'nostrstack-status--danger'
    );
    status.classList.add(`nostrstack-status--${tone}`);
  };

  const setNotice = (text: string, tone: 'muted' | 'danger') => {
    notice.textContent = text;
    notice.hidden = !text;
    notice.classList.remove('nostrstack-status--muted', 'nostrstack-status--danger');
    notice.classList.add(`nostrstack-status--${tone}`);
  };

  const setFormEnabled = (enabled: boolean) => {
    textarea.disabled = !enabled;
    submit.disabled = !enabled;
  };

  const verifySignature =
    typeof window !== 'undefined' ? window.NostrTools?.verifySignature : undefined;
  const validateEvent =
    typeof window !== 'undefined' ? window.NostrTools?.validateEvent : undefined;
  if (validateEvents && !verifySignature && !validateEvent) {
    setNotice('Signature validation unavailable in this environment.', 'muted');
  }

  let relays: RelayConnection[] = [];
  const subs: Array<{ un: () => void }> = [];
  const seen = new Set<string>();
  let oldestTimestamp: number | null = null;
  let hasMore = false;
  let loading = false;
  let connected = false;
  let destroyed = false;

  const updateActions = () => {
    if (lazyConnect && !connected) {
      loadMoreBtn.hidden = false;
      loadMoreBtn.textContent = loading ? 'Loading…' : 'Load comments';
      loadMoreBtn.disabled = loading;
      return;
    }
    if (!hasMore) {
      loadMoreBtn.hidden = true;
      return;
    }
    loadMoreBtn.hidden = false;
    loadMoreBtn.textContent = loading ? 'Loading…' : 'Load more';
    loadMoreBtn.disabled = loading;
  };

  const isValidEvent = (ev: NostrEvent) => {
    if (!ev || !ev.id) return false;
    if (validateEvents) {
      if (!ev.sig) return false;
      if (verifySignature && !verifySignature(ev)) return false;
      if (validateEvent && !validateEvent(ev)) return false;
    }
    return true;
  };

  const appendEvent = (ev: NostrEvent, relayUrl?: string) => {
    if (!isValidEvent(ev)) return;
    if (seen.has(ev.id!)) return;
    seen.add(ev.id!);
    if (typeof ev.created_at === 'number') {
      oldestTimestamp =
        oldestTimestamp === null ? ev.created_at : Math.min(oldestTimestamp, ev.created_at);
    }
    const row = document.createElement('div');
    row.className = 'nostrstack-comment';
    row.textContent = ev.content;
    list.appendChild(row);
    opts.onEvent?.(ev, relayUrl ?? undefined);
  };

  const startLiveSubscriptions = () => {
    if (!relays.length) return;
    loading = true;
    updateActions();
    setStatus('Loading…', 'muted');
    const filters = [
      {
        kinds: [1],
        '#t': [threadId],
        limit: maxItems,
        ...(since ? { since } : {})
      }
    ];
    let pending = relays.length;
    let received = 0;
    relays.forEach((relay) => {
      const sub = relay.sub(filters);
      subs.push(sub);
      sub.on('event', (ev: NostrEvent) => {
        const before = seen.size;
        appendEvent(ev, relay.url ?? undefined);
        if (seen.size > before) received += 1;
      });
      let eoseHandled = false;
      const handleEose = () => {
        if (eoseHandled) return;
        eoseHandled = true;
        pending -= 1;
        if (pending <= 0) {
          hasMore = received >= maxItems;
          loading = false;
          updateActions();
          setStatus('', 'muted');
        }
      };
      sub.on('eose', handleEose);
      if (typeof window !== 'undefined') {
        window.setTimeout(handleEose, 1500);
      } else {
        handleEose();
      }
    });
  };

  const loadMore = async () => {
    if (!relays.length || loading) return;
    if (since && oldestTimestamp !== null && oldestTimestamp <= since) {
      hasMore = false;
      updateActions();
      return;
    }
    loading = true;
    updateActions();
    const until = oldestTimestamp ? oldestTimestamp - 1 : Math.floor(Date.now() / 1000);
    const filters = [
      {
        kinds: [1],
        '#t': [threadId],
        limit: maxItems,
        ...(since ? { since } : {}),
        until
      }
    ];
    let received = 0;
    await Promise.all(
      relays.map(
        (relay) =>
          new Promise<void>((resolve) => {
            const sub = relay.sub(filters);
            const handleEvent = (ev: NostrEvent) => {
              const before = seen.size;
              appendEvent(ev, relay.url ?? undefined);
              if (seen.size > before) received += 1;
            };
            sub.on('event', handleEvent);
            let eoseHandled = false;
            const handleEose = () => {
              if (eoseHandled) return;
              eoseHandled = true;
              sub.un();
              resolve();
            };
            sub.on('eose', handleEose);
            if (typeof window !== 'undefined') {
              window.setTimeout(handleEose, 1500);
            } else {
              handleEose();
            }
          })
      )
    );
    hasMore = received >= maxItems;
    loading = false;
    updateActions();
  };

  const connectAndLoad = async () => {
    if (connected || destroyed) return;
    const { valid, invalid } = normalizeRelayUrls(opts.relays);
    if (invalid.length) {
      setNotice(
        `Ignored ${invalid.length} invalid relay${invalid.length === 1 ? '' : 's'}.`,
        'muted'
      );
    }
    if (!valid.length) {
      setNotice('No relays configured.', 'danger');
      updateActions();
      return;
    }
    relays = await connectRelays(valid);
    if (!relays.length) {
      setNotice('No relays reachable.', 'danger');
      updateActions();
      return;
    }
    connected = true;
    updateRelayBadge(relayBadge, relays.map((r) => r.url ?? '').filter(Boolean));
    opts.onRelayInfo?.({
      relays: relays.map((r) => r.url ?? '').filter(Boolean),
      mode: 'real'
    });
    setFormEnabled(true);
    startLiveSubscriptions();
  };

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    if (!window.nostr) {
      setStatus('Nostr signer (NIP-07) required to post', 'danger');
      return;
    }
    if (!relays.length) {
      setStatus('Connect to a relay to post', 'danger');
      return;
    }
    const content = textarea.value.trim();
    if (!content) return;
    submit.disabled = true;
    setStatus('', 'muted');
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
      setStatus('Failed to post comment', 'danger');
    } finally {
      submit.disabled = false;
    }
  };

  const handleLoadMoreClick = () => {
    if (lazyConnect && !connected) {
      void connectAndLoad();
      return;
    }
    void loadMore();
  };

  loadMoreBtn.addEventListener('click', handleLoadMoreClick);

  form.addEventListener('submit', handleSubmit);

  if (lazyConnect) {
    setFormEnabled(false);
    setStatus('Click "Load comments" to connect', 'muted');
  } else {
    await connectAndLoad();
  }

  updateActions();

  header.append(headerText, relayBadge);
  container.appendChild(header);
  container.appendChild(notice);
  container.appendChild(list);
  container.appendChild(actions);
  container.appendChild(status);
  container.appendChild(form);

  return {
    el: container,
    destroy: () => {
      destroyed = true;
      form.removeEventListener('submit', handleSubmit);
      loadMoreBtn.removeEventListener('click', handleLoadMoreClick);
      subs.forEach((s) => s.un());
      relays.forEach((r) => r.close());
    }
  };
}

export async function renderCommentTipWidget(
  container: HTMLElement,
  opts: CommentTipWidgetOptions
) {
  ensureNostrstackRoot(container);
  container.replaceChildren();

  const grid = document.createElement('div');
  grid.className = 'nostrstack-support-grid nostrstack-comment-tip__grid';
  grid.style.display = 'grid';
  grid.style.gap = 'var(--nostrstack-space-4)';
  grid.style.alignItems = 'start';
  grid.style.gridTemplateColumns =
    opts.layout === 'compact' ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, 340px)';

  const left = document.createElement('div');
  const right = document.createElement('div');
  right.className = 'nostrstack-support-sidebar';
  right.style.display = 'grid';
  right.style.gap = 'var(--nostrstack-space-3)';

  if (opts.layout === 'compact') {
    grid.append(right, left);
  } else {
    grid.append(left, right);
  }
  container.appendChild(grid);

  const tip = renderTipWidget(right, opts);
  const comments = await renderCommentWidget(left, opts);

  return {
    destroy: () => {
      tip.destroy();
      comments.destroy();
    }
  };
}

export function autoMount() {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-nostrstack-tip]'));
  nodes.forEach((el) => {
    const existingDestroy = widgetDestroyMap.get(el);
    if (existingDestroy) {
      existingDestroy();
      widgetDestroyMap.delete(el);
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
      const defaultAmountSats = el.dataset.defaultAmountSats
        ? Number(el.dataset.defaultAmountSats)
        : undefined;
      const widget = renderTipWidget(el, {
        username,
        itemId,
        presetAmountsSats: presets.length ? presets : undefined,
        defaultAmountSats: Number.isFinite(defaultAmountSats as number)
          ? defaultAmountSats
          : undefined,
        baseURL,
        host,
        text: el.dataset.label
      });
      widgetDestroyMap.set(el, widget.destroy);
      return;
    }
    const btn = renderTipButton(el, {
      username,
      amountMsat: amount,
      baseURL,
      host,
      text: el.dataset.label
    });
    widgetDestroyMap.set(el, btn.destroy);
  });

  const payNodes = Array.from(document.querySelectorAll<HTMLElement>('[data-nostrstack-pay]'));
  payNodes.forEach((el) => {
    const existingDestroy = widgetDestroyMap.get(el);
    if (existingDestroy) {
      existingDestroy();
      widgetDestroyMap.delete(el);
    }

    const username = getBrandAttr(el, 'Pay');
    if (!username) return;
    const amount = el.dataset.amountMsat ? Number(el.dataset.amountMsat) : undefined;
    const widget = renderPayToAction(el, {
      username,
      amountMsat: amount,
      text: el.dataset.label,
      baseURL: el.dataset.baseUrl,
      host: el.dataset.host
    });
    widgetDestroyMap.set(el, widget.destroy);
  });

  const commentNodes = Array.from(
    document.querySelectorAll<HTMLElement>('[data-nostrstack-comments]')
  );
  commentNodes.forEach((el) => {
    const existingDestroy = widgetDestroyMap.get(el);
    if (existingDestroy) {
      existingDestroy();
      widgetDestroyMap.delete(el);
    }

    const thread = getBrandAttr(el, 'Comments') || undefined;
    const relays = el.dataset.relays
      ? el.dataset.relays.split(',').map((r) => r.trim())
      : undefined;
    renderCommentWidget(el, {
      threadId: thread,
      relays,
      headerText: el.dataset.header,
      placeholder: el.dataset.placeholder
    }).then((widget) => {
      widgetDestroyMap.set(el, widget.destroy);
    });
  });

  const shareNodes = Array.from(document.querySelectorAll<HTMLElement>('[data-nostrstack-share]'));
  shareNodes.forEach((el) => {
    const existingDestroy = widgetDestroyMap.get(el);
    if (existingDestroy) {
      existingDestroy();
      widgetDestroyMap.delete(el);
    }

    const relays = el.dataset.relays
      ? el.dataset.relays
          .split(',')
          .map((r) => r.trim())
          .filter(Boolean)
      : undefined;
    const url =
      el.dataset.nostrstackShare ??
      el.dataset.url ??
      (typeof window !== 'undefined' ? window.location?.href ?? '' : '');
    const title =
      el.dataset.title ?? (typeof document !== 'undefined' ? document.title ?? 'Share' : 'Share');
    const widget = renderShareButton(el, {
      url,
      title,
      lnAddress: el.dataset.lnAddress ?? el.dataset.ln,
      tag: el.dataset.tag,
      relays,
      label: el.dataset.label
    });
    widgetDestroyMap.set(el, widget.destroy);
  });

  const profileNodes = Array.from(
    document.querySelectorAll<HTMLElement>('[data-nostrstack-profile]')
  );
  profileNodes.forEach((el) => {
    const existingDestroy = widgetDestroyMap.get(el);
    if (existingDestroy) {
      existingDestroy();
      widgetDestroyMap.delete(el);
    }

    const identifier = el.dataset.nostrstackProfile ?? el.dataset.profile ?? '';
    const widget = renderNostrProfile(el, {
      identifier,
      baseURL: el.dataset.baseUrl,
      host: el.dataset.host,
      title: el.dataset.title
    });
    widgetDestroyMap.set(el, widget.destroy);
  });

  const blockchainNodes = Array.from(
    document.querySelectorAll<HTMLElement>('[data-nostrstack-blockchain]')
  );
  blockchainNodes.forEach((el) => {
    const existingDestroy = widgetDestroyMap.get(el);
    if (existingDestroy) {
      existingDestroy();
      widgetDestroyMap.delete(el);
    }

    const widget = renderBlockchainStats(el, {
      baseURL: el.dataset.baseUrl,
      host: el.dataset.host,
      title: el.dataset.title
    });
    widgetDestroyMap.set(el, widget.destroy);
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
  const widget = renderTipButton(container, {
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
  const el = widget.el as HTMLElement & { destroy?: () => void };
  el.destroy = widget.destroy;
  return el;
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
  onPaid?: (info: {
    pr: string;
    providerRef: string | null;
    amountSats: number;
    itemId: string;
    metadata?: unknown;
  }) => void;
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
  const widget = renderPayToAction(container, {
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
  const el = widget.el as HTMLElement & { destroy?: () => void };
  el.destroy = widget.destroy;
  return el;
}

type MountCommentOptions = {
  threadId?: string;
  relays?: string[];
  placeholder?: string;
  headerText?: string;
  maxItems?: number;
  maxAgeDays?: number;
  lazyConnect?: boolean;
  validateEvents?: boolean;
  onRelayInfo?: (info: { relays: string[]; mode: 'real' }) => void;
  onEvent?: (event: NostrEvent, relay?: string) => void;
};

export function mountCommentWidget(container: HTMLElement, opts: MountCommentOptions = {}) {
  return renderCommentWidget(container, {
    threadId: opts.threadId ?? getBrandAttr(container, 'Comments'),
    relays: opts.relays,
    placeholder: opts.placeholder ?? container.dataset.placeholder,
    headerText: opts.headerText ?? container.dataset.header,
    maxItems: opts.maxItems,
    maxAgeDays: opts.maxAgeDays,
    lazyConnect: opts.lazyConnect,
    validateEvents: opts.validateEvents,
    onRelayInfo: opts.onRelayInfo,
    onEvent: opts.onEvent
  });
}

type MountShareOptions = {
  url?: string;
  title?: string;
  lnAddress?: string;
  relays?: string[];
  tag?: string;
  label?: string;
};

export function mountShareButton(container: HTMLElement, opts: MountShareOptions = {}) {
  const url =
    opts.url ??
    container.dataset.url ??
    container.dataset.nostrstackShare ??
    (typeof window !== 'undefined' ? window.location?.href ?? '' : '');
  const title =
    opts.title ??
    container.dataset.title ??
    (typeof document !== 'undefined' ? document.title ?? 'Share' : 'Share');
  const relays =
    opts.relays ??
    (container.dataset.relays
      ? container.dataset.relays
          .split(',')
          .map((r) => r.trim())
          .filter(Boolean)
      : undefined);
  const widget = renderShareButton(container, {
    url,
    title,
    lnAddress: opts.lnAddress ?? container.dataset.lnAddress ?? container.dataset.ln,
    relays,
    tag: opts.tag ?? container.dataset.tag,
    label: opts.label ?? container.dataset.label
  });
  const el = widget.el as HTMLElement & { destroy?: () => void };
  el.destroy = widget.destroy;
  return el;
}

type MountBlockchainStatsOptions = {
  baseURL?: string;
  host?: string;
  title?: string;
};

export function mountBlockchainStats(
  container: HTMLElement,
  opts: MountBlockchainStatsOptions = {}
) {
  return renderBlockchainStats(container, {
    baseURL: opts.baseURL,
    host: opts.host,
    title: opts.title ?? container.dataset.title
  });
}

type MountNostrProfileOptions = {
  identifier?: string;
  baseURL?: string;
  host?: string;
  relays?: string[];
  title?: string;
};

export function mountNostrProfile(container: HTMLElement, opts: MountNostrProfileOptions = {}) {
  const identifier =
    opts.identifier ??
    container.dataset.nostrstackProfile ??
    container.dataset.profile ??
    container.id ??
    '';
  return renderNostrProfile(container, {
    identifier,
    baseURL: opts.baseURL,
    host: opts.host,
    relays: opts.relays,
    title: opts.title ?? container.dataset.title
  });
}

type MountCommentTipOptions = MountTipWidgetOptions &
  MountCommentOptions & {
    layout?: 'full' | 'compact';
  };

export function mountCommentTipWidget(container: HTMLElement, opts: MountCommentTipOptions = {}) {
  const username = opts.username ?? getBrandAttr(container, 'Tip') ?? 'anonymous';
  const itemId =
    opts.itemId ??
    container.dataset.itemId ??
    container.id ??
    (typeof window !== 'undefined' && window.location?.href ? window.location.href : 'item');
  const threadId = opts.threadId ?? getBrandAttr(container, 'Comments') ?? itemId;

  return renderCommentTipWidget(container, {
    ...opts,
    username,
    itemId,
    threadId
  });
}
