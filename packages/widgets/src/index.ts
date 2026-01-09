import { renderBlockchainStats } from './blockchainStats.js';
import { copyToClipboard } from './copyButton.js';
import { getBrandAttr } from './helpers.js';
import { renderNostrProfile } from './nostrProfile.js';
import { renderShareButton } from './share.js';
import { ensureNsRoot } from './styles.js';
import type { CommentTipWidgetOptions, NostrEvent } from './types.js';
import { renderPayToAction } from './widgets/payToAction.js';
import { renderTipButton } from './widgets/tipButton.js';
import { renderTipFeed } from './widgets/tipFeed.js';
import { renderTipWidget } from './widgets/tipWidget.js';

export { renderBlockchainStats } from './blockchainStats.js';
export { invoicePopoverStyles, renderInvoicePopover } from './invoicePopover.js';
export { renderNostrProfile } from './nostrProfile.js';
export { nostrUserCardStyles, renderNostrUserCard } from './nostrUserCard.js';
export {
  type NsQrPreset,
  nsQrPresetOptions,
  type NsQrRenderOptions,
  type NsQrRenderResult,
  type NsQrStyleOptions,
  type NsQrVerifyMode,
  renderQrCodeInto
} from './qr.js';
export { relayBadgeStyles, renderRelayBadge, updateRelayBadge } from './relayBadge.js';
export { renderShareButton } from './share.js';
export type { NsTheme, NsThemeMode } from './styles.js';
export {
  applyNsTheme,
  ensureNsEmbedStyles,
  ensureNsRoot,
  nsComponentsCss,
  nsEmbedStyles,
  nsTokensCss,
  themeToCss,
  themeToCssVars
} from './styles.js';
export { createNsBrandTheme, type NsBrandPreset, nsBrandPresets } from './themePresets.js';
export { resolvePayWsUrl, resolveTelemetryWs } from './url-utils.js';

// WeakMap to store widget destroy functions without polluting DOM elements
const widgetDestroyMap = new WeakMap<HTMLElement, () => void>();

// Re-export widgets
export { renderCommentWidget } from './widgets/commentWidget.js';
export { renderPayToAction } from './widgets/payToAction.js';
export { renderTipButton } from './widgets/tipButton.js';
export { renderTipFeed } from './widgets/tipFeed.js';
export { renderTipWidget } from './widgets/tipWidget.js';

import { renderCommentWidget } from './widgets/commentWidget.js';

export async function renderCommentTipWidget(
  container: HTMLElement,
  opts: CommentTipWidgetOptions
) {
  ensureNsRoot(container);
  container.replaceChildren();

  const grid = document.createElement('div');
  grid.className = 'ns-support-grid ns-comment-tip__grid';
  grid.style.display = 'grid';
  grid.style.gap = 'var(--ns-space-4)';
  grid.style.alignItems = 'start';
  grid.style.gridTemplateColumns =
    opts.layout === 'compact' ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, 340px)';

  const left = document.createElement('div');
  const right = document.createElement('div');
  right.className = 'ns-support-sidebar';
  right.style.display = 'grid';
  right.style.gap = 'var(--ns-space-3)';

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
  const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-ns-tip]'));
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

  const payNodes = Array.from(document.querySelectorAll<HTMLElement>('[data-ns-pay]'));
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

  const commentNodes = Array.from(document.querySelectorAll<HTMLElement>('[data-ns-comments]'));
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

  const shareNodes = Array.from(document.querySelectorAll<HTMLElement>('[data-ns-share]'));
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
      el.dataset.nsShare ??
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

  const profileNodes = Array.from(document.querySelectorAll<HTMLElement>('[data-ns-profile]'));
  profileNodes.forEach((el) => {
    const existingDestroy = widgetDestroyMap.get(el);
    if (existingDestroy) {
      existingDestroy();
      widgetDestroyMap.delete(el);
    }

    const identifier = el.dataset.nsProfile ?? el.dataset.profile ?? '';
    const widget = renderNostrProfile(el, {
      identifier,
      baseURL: el.dataset.baseUrl,
      host: el.dataset.host,
      title: el.dataset.title
    });
    widgetDestroyMap.set(el, widget.destroy);
  });

  const blockchainNodes = Array.from(
    document.querySelectorAll<HTMLElement>('[data-ns-blockchain]')
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
  const w = window as unknown as { __nsDisableAutoMount?: boolean };
  if (!w.__nsDisableAutoMount) {
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
    container.dataset.nsShare ??
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
    container.dataset.nsProfile ??
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
