import { INVOICE_TTL_SECS, RING_CIRCUMFERENCE } from '../config.js';
import { copyToClipboard } from '../copyButton.js';
import { type ConnectionState, PaymentConnection } from '../core/paymentConnection.js';
import { extractPayEventInvoice, resolveTenantDomain } from '../helpers.js';
import { renderQrCodeInto } from '../qr.js';
import { ensureNostrstackRoot } from '../styles.js';
import type { TipWidgetV2Options } from '../types.js';
import { isMockBase, resolveApiBaseUrl, resolvePayWsUrl } from '../url-utils.js';
import { renderTipFeed } from './tipFeed.js';

function normalizeInvoice(pr: string | null | undefined): string | null {
  if (!pr) return null;
  return pr.trim().replace(/^(?:lightning:)+/i, '');
}

function fmtClock(secs: number) {
  const s = Math.max(0, Math.floor(secs));
  const m = Math.floor(s / 60)
    .toString()
    .padStart(2, '0');
  const r = (s % 60).toString().padStart(2, '0');
  return `${m}:${r}`;
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
  const isMock = isMockBase(opts.baseURL);
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

  const presets = (
    opts.presetAmountsSats?.filter((n) => Number.isFinite(n) && n > 0) ?? [5, 10, 21]
  )
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

  const refreshBtn = document.createElement('button');
  refreshBtn.type = 'button';
  refreshBtn.className = 'nostrstack-btn--ghost nostrstack-tip__refresh';
  refreshBtn.title = 'Check payment status';
  refreshBtn.innerHTML =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>';
  refreshBtn.style.display = 'none';

  realtime.append(realtimeDot, realtimeText, refreshBtn);

  const qrWrap = document.createElement('div');
  qrWrap.className = 'nostrstack-tip__qr';

  const invoiceBox = document.createElement('button');
  invoiceBox.type = 'button';
  invoiceBox.className = 'nostrstack-invoice-box';
  invoiceBox.title = 'Click to copy invoice';

  const invoiceIcon = document.createElement('span');
  invoiceIcon.className = 'nostrstack-invoice-icon';
  invoiceIcon.innerHTML =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';

  const invoiceCode = document.createElement('code');
  invoiceCode.className = 'nostrstack-code';

  const invoiceCopyLabel = document.createElement('span');
  invoiceCopyLabel.className = 'nostrstack-invoice-label';
  invoiceCopyLabel.textContent = 'Copy';

  invoiceBox.append(invoiceIcon, invoiceCode, invoiceCopyLabel);

  const actions = document.createElement('div');
  actions.className = 'nostrstack-tip__actions';

  const openWallet = document.createElement('a');
  openWallet.textContent = 'Open in wallet';
  openWallet.className = 'nostrstack-btn nostrstack-btn--primary nostrstack-btn--sm';
  openWallet.rel = 'noreferrer';
  openWallet.style.display = 'none';

  actions.append(openWallet);

  panel.append(ring, status, realtime, qrWrap, invoiceBox, actions);

  let feed: { refresh: () => void; destroy: () => void } | null = null;
  let feedWrap: HTMLDivElement | null = null;
  if (opts.showFeed !== false) {
    feedWrap = document.createElement('div');
    feedWrap.className = 'nostrstack-tip__feedWrap';
    const feedHost = document.createElement('div');
    feedWrap.appendChild(feedHost);
    feed = renderTipFeed(feedHost, {
      itemId,
      baseURL: opts.baseURL,
      host: opts.host,
      maxItems: 12
    });
  }

  container.append(header, amountRow, customWrap, note, panel);
  if (feedWrap) container.appendChild(feedWrap);

  let currentInvoice: string | null = null;
  let currentProviderRef: string | null = null;
  let currentAmountSats: number | null = null;
  let didPay = false;
  let invoiceStartedAt: number | null = null;
  let invoiceTicker: number | null = null;
  let qrAbort: AbortController | null = null;

  invoiceBox.onclick = async () => {
    if (!currentInvoice) return;
    try {
      await copyToClipboard(currentInvoice);
      invoiceBox.dataset.copied = 'true';
      invoiceCopyLabel.textContent = 'Copied!';
      setTimeout(() => {
        invoiceBox.dataset.copied = 'false';
        invoiceCopyLabel.textContent = 'Copy';
      }, 2000);
    } catch {
      invoiceCopyLabel.textContent = 'Error';
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
      const progress = Math.max(0, Math.min(1, 1 - remainingSecs / INVOICE_TTL_SECS));
      const offset = progress * RING_CIRCUMFERENCE;
      ringProgress.style.setProperty('--ring-offset', String(offset));
      ringTime.textContent = fmtClock(remainingSecs);
      ringTime.style.color = '';
      ringLabel.textContent = remainingSecs > 0 ? 'left' : 'expired';
      ringIcon.style.display = 'none';
      panel.dataset.state = 'waiting';

      if (remainingSecs <= 0) {
        refreshBtn.style.display = 'inline-flex';
      }
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

  const setRealtime = (state: ConnectionState) => {
    realtime.dataset.state = state;
    if (!wsUrl || !currentInvoice) {
      realtimeText.textContent = '';
      return;
    }
    realtimeText.textContent =
      state === 'open'
        ? 'Watching for payment'
        : state === 'connecting'
          ? 'Connecting…'
          : state === 'error'
            ? 'Connection error'
            : '';
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
      p.style.background = colors[i % colors.length] ?? colors[0] ?? '#ffd700';
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
    refreshBtn.style.display = 'none';
    tipBtn.disabled = false;
    celebrate();

    connection.stop();
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

  const connection = new PaymentConnection({
    wsUrl,
    apiBaseUrl,
    domain,
    onStateChange: setRealtime,
    onPaid: markPaid
  });

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
    openWallet.style.display = 'none';
    refreshBtn.style.display = 'none';
    invoiceCode.textContent = '';
    invoiceBox.classList.remove('nostrstack-visible');
    qrWrap.replaceChildren();
    abortQr();
    currentInvoice = null;
    currentProviderRef = null;
    currentAmountSats = amountSats;

    connection.stop();
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

      let pr: string | null = null;
      let providerRef: string | null = null;

      if (isMock) {
        pr = `lnbc1mock${Math.max(1, Math.round(amountSats))}`;
        providerRef = null;
      } else {
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
        pr = normalizeInvoice(extractPayEventInvoice(body));
        providerRef =
          (typeof body.provider_ref === 'string' ? body.provider_ref : null) ??
          (typeof body.providerRef === 'string' ? body.providerRef : null) ??
          (typeof body.payment_hash === 'string' ? body.payment_hash : null);
      }

      if (!pr) throw new Error('Invoice not returned');

      currentInvoice = pr;
      currentProviderRef = providerRef;
      invoiceCode.textContent = pr.substring(0, 8) + '...' + pr.substring(pr.length - 8);
      invoiceBox.classList.add('nostrstack-visible');
      openWallet.href = `lightning:${pr}`;
      openWallet.style.display = '';
      status.textContent = 'Waiting for payment…';
      invoiceStartedAt = Date.now();
      startInvoiceTicker();

      const qrPayload = /^lightning:/i.test(pr) ? pr : `lightning:${pr}`;
      try {
        abortQr();
        qrAbort = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const signal = qrAbort?.signal;
        const qrSize = opts.size === 'compact' ? 240 : 320;
        void renderQrCodeInto(qrWrap, qrPayload, {
          preset: 'brandLogo',
          verify: 'strict',
          size: qrSize,
          signal
        }).catch((err) => {
          const name =
            err && typeof err === 'object' && 'name' in err
              ? String((err as { name?: unknown }).name)
              : '';
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

      connection.setInvoice(pr, providerRef);
      connection.start();

      return pr;
    } catch (e) {
      console.error('tip v2 error', e);
      status.textContent = 'Failed to generate invoice';
      status.classList.remove('nostrstack-status--muted');
      status.classList.add('nostrstack-status--danger');
      return null;
    } finally {
      tipBtn.disabled = false;
    }
  };

  refreshBtn.onclick = async () => {
    refreshBtn.disabled = true;
    refreshBtn.style.opacity = '0.5';

    // Force a poll
    connection.start();
    // We can't easily await the specific poll result from here since it's async in connection
    // But we can simulate the UI feedback

    setTimeout(() => {
      if (!didPay) {
        refreshBtn.style.color = 'var(--nostrstack-color-warning)';
        setTimeout(() => {
          refreshBtn.style.color = '';
          refreshBtn.disabled = false;
          refreshBtn.style.opacity = '';
        }, 500);
      } else {
        refreshBtn.style.display = 'none';
      }
    }, 1500);
  };

  // Expose a small imperative API for tests / consumers.
  return {
    tip: startTip,
    refreshFeed: () => feed?.refresh(),
    destroy: () => {
      feed?.destroy();
      connection.destroy();
      stopInvoiceTicker();
      abortQr();
    }
  };
}
