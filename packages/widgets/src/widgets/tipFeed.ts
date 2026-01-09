/**
 * TipFeed Widget - Display real-time tip activity feed
 */

import { DEFAULT_FEED_ITEMS, MAX_FEED_ITEMS, MIN_FEED_ITEMS } from '../config.js';
import { type TipData, TipsFeedConnection } from '../core/index.js';
import { formatRelativeTime, resolveTenantDomain } from '../helpers.js';
import { ensureNsRoot } from '../styles.js';
import type { TipFeedOptions } from '../types.js';
import { resolveApiBaseUrl, resolvePayWsUrl } from '../url-utils.js';

export interface TipFeedResult {
  refresh: () => Promise<void>;
  destroy: () => void;
}

/**
 * Render a row in the tip feed
 */
function renderTipFeedRow(opts: {
  amountSats: number;
  createdAt: Date;
  note?: string;
  newPulse?: boolean;
}): HTMLElement {
  const row = document.createElement('div');
  row.className = 'ns-tip-feed__row';
  if (opts.newPulse) row.dataset.pulse = 'true';

  const left = document.createElement('div');
  left.className = 'ns-tip-feed__icon';
  left.textContent = '⚡';

  const body = document.createElement('div');
  body.className = 'ns-tip-feed__body';

  const title = document.createElement('div');
  title.className = 'ns-tip-feed__title';
  title.textContent = `${opts.amountSats} sats`;

  const sub = document.createElement('div');
  sub.className = 'ns-tip-feed__sub';
  const ageSecs = Math.max(0, Math.round((Date.now() - opts.createdAt.getTime()) / 1000));
  const age = formatRelativeTime(ageSecs);
  sub.textContent = `${age} ago${opts.note ? ` · ${opts.note}` : ''}`;

  body.append(title, sub);
  row.append(left, body);

  if (opts.newPulse) {
    // Let the CSS animation play once
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

/**
 * Render a tip feed widget with real-time updates
 */
export function renderTipFeed(container: HTMLElement, opts: TipFeedOptions): TipFeedResult {
  ensureNsRoot(container);
  container.classList.add('ns-card', 'ns-tip-feed');
  container.replaceChildren();

  const payWsUrl = resolvePayWsUrl(opts.baseURL);
  const apiBaseUrl = resolveApiBaseUrl(opts.baseURL);
  const domain = resolveTenantDomain(opts.host);
  const itemId = opts.itemId;
  const maxItems = Math.max(
    MIN_FEED_ITEMS,
    Math.min(MAX_FEED_ITEMS, opts.maxItems ?? DEFAULT_FEED_ITEMS)
  );
  const domainParam = domain ? `&domain=${encodeURIComponent(domain)}` : '';
  const tipsWsUrl = payWsUrl
    ? `${payWsUrl.replace(/\/ws\/pay$/, '/ws/tips')}?itemId=${encodeURIComponent(itemId)}${domainParam}`
    : null;

  // Create UI elements
  const header = document.createElement('div');
  header.className = 'ns-tip-feed__header';

  const title = document.createElement('div');
  title.className = 'ns-tip-feed__heading';
  title.textContent = 'Tip activity';

  const stats = document.createElement('div');
  stats.className = 'ns-tip-feed__stats';
  stats.textContent = '—';

  header.append(title, stats);

  const list = document.createElement('div');
  list.className = 'ns-tip-feed__list';

  const status = document.createElement('div');
  status.className = 'ns-status ns-status--muted';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.textContent = 'Loading…';

  container.append(header, list, status);

  // State
  let totalAmountSats = 0;
  let count = 0;
  const seen = new Set<string>();

  const setStatus = (text: string, tone: 'muted' | 'success' | 'danger') => {
    status.textContent = text;
    status.classList.remove('ns-status--muted', 'ns-status--success', 'ns-status--danger');
    status.classList.add(`ns-status--${tone}`);
  };

  const setStats = () => {
    stats.textContent = `${count} tips · ${totalAmountSats} sats`;
  };

  const updateLiveStatus = (connected: boolean) => {
    if (connected) {
      setStatus('Live', 'success');
    } else if (tipsWsUrl) {
      setStatus('Live updates paused', 'muted');
    } else {
      setStatus('', 'muted');
    }
  };

  const insertTip = (tip: TipData) => {
    const key = tip.paymentId ?? tip.id ?? `${tip.amountSats}-${tip.createdAt.getTime()}`;
    if (seen.has(key)) return;

    seen.add(key);
    count += 1;
    totalAmountSats += tip.amountSats;
    setStats();

    list.prepend(
      renderTipFeedRow({
        amountSats: tip.amountSats,
        createdAt: tip.createdAt,
        note: tip.note,
        newPulse: true
      })
    );

    // Trim excess items
    while (list.children.length > maxItems) {
      list.lastElementChild?.remove();
    }
  };

  // Create connection
  const connection = new TipsFeedConnection({
    wsUrl: tipsWsUrl,
    apiBaseUrl,
    itemId,
    maxItems,
    onTip: insertTip,
    onConnectionChange: updateLiveStatus
  });

  // Hydrate initial data
  const hydrate = async () => {
    setStatus('Loading…', 'muted');
    try {
      const tips = await connection.hydrate();

      // Calculate totals
      totalAmountSats = tips.reduce((sum, t) => sum + t.amountSats, 0);
      count = tips.length;
      setStats();

      // Render initial tips
      list.replaceChildren();
      seen.clear();

      for (const tip of tips) {
        const key = tip.paymentId ?? tip.id ?? `${tip.amountSats}-${tip.createdAt.getTime()}`;
        seen.add(key);
        list.append(renderTipFeedRow(tip));
      }

      updateLiveStatus(connection.isConnected());
    } catch (e) {
      console.warn('tip feed hydrate failed', e);
      setStatus('Failed to load tip activity', 'danger');
    }
  };

  // Start connection and hydrate
  void hydrate().then(() => {
    connection.start();
  });

  return {
    refresh: hydrate,
    destroy: () => {
      connection.destroy();
    }
  };
}
