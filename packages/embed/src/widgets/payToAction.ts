import QRCode from 'qrcode';

import { copyToClipboard, createCopyButton } from '../copyButton.js';
import { type ConnectionState, PaymentConnection } from '../core/paymentConnection.js';
import { createClient } from '../helpers.js';
import { ensureNostrstackRoot } from '../styles.js';
import type { PayToActionOptions } from '../types.js';
import { resolveApiBaseUrl, resolvePayWsUrl } from '../url-utils.js';

function normalizeInvoice(pr: string | null | undefined): string | null {
  if (!pr) return null;
  return pr.trim().replace(/^(?:lightning:)+/i, '');
}

export function renderPayToAction(container: HTMLElement, opts: PayToActionOptions) {
  ensureNostrstackRoot(container);
  container.classList.add('nostrstack-card', 'nostrstack-pay');
  container.replaceChildren();

  const wsUrl = resolvePayWsUrl(opts.baseURL);
  const apiBaseUrl = resolveApiBaseUrl(opts.baseURL);
  let didUnlock = false;
  let currentInvoice: string | null = null;

  // UI Elements
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

  container.appendChild(header);
  container.appendChild(panel);

  const setRealtime = (state: ConnectionState) => {
    if (!wsUrl) {
      realtime.textContent = '';
      return;
    }
    realtime.textContent =
      state === 'open'
        ? 'Realtime: connected'
        : state === 'connecting'
          ? 'Realtime: connecting…'
          : state === 'error'
            ? 'Realtime: error'
            : 'Realtime: idle';
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

    connection.stop();
    setRealtime('idle');
    opts.onUnlock?.();
  };

  const connection = new PaymentConnection({
    wsUrl,
    apiBaseUrl,
    domain: opts.host ?? null,
    onStateChange: setRealtime,
    onPaid: unlock
  });

  const getInvoice = async () => {
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    status.textContent = 'Generating invoice…';
    status.classList.remove('nostrstack-status--danger', 'nostrstack-status--success');
    status.classList.add('nostrstack-status--muted');

    try {
      connection.stop();

      const client = createClient(opts);
      const meta = await client.getLnurlpMetadata(opts.username);
      const amount = opts.amountMsat ?? meta.minSendable ?? 1000;
      const invoiceRes = await client.getLnurlpInvoice(opts.username, amount);

      const rawPr = invoiceRes.pr;
      const pr = normalizeInvoice(rawPr);

      // Handle providerRef (camelCase or snake_case)
      const maybeProviderRef = (
        invoiceRes as unknown as { provider_ref?: unknown; providerRef?: unknown }
      ).provider_ref;
      const maybeProviderRefCamel = (invoiceRes as unknown as { providerRef?: unknown })
        .providerRef;
      let providerRef = typeof maybeProviderRef === 'string' ? maybeProviderRef : null;
      if (!providerRef)
        providerRef = typeof maybeProviderRefCamel === 'string' ? maybeProviderRefCamel : null;

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

      connection.setInvoice(pr, providerRef);
      connection.start();

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

      if (connection.hasPaid()) {
        unlock();
        return;
      }

      if (!opts.verifyPayment) {
        status.textContent = 'Waiting for payment confirmation…';
        // Ensure connection is active
        if (connection.getState() === 'idle' || connection.getState() === 'error') {
          connection.start();
        }
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

  return {
    el: btn,
    destroy: () => {
      connection.destroy();
      btn.removeEventListener('click', getInvoice);
      paidBtn.removeEventListener('click', markPaid);
    }
  };
}
