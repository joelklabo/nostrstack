/**
 * TipButton Widget - Simple button to generate lightning invoice
 */

import { createClient, setBrandAttr } from '../helpers.js';
import { renderInvoicePopover } from '../invoicePopover.js';
import { ensureNsRoot } from '../styles.js';
import type { TipWidgetOptions } from '../types.js';

export interface TipButtonResult {
  el: HTMLButtonElement;
  destroy: () => void;
}

/**
 * Render a simple tip button that generates an invoice when clicked
 */
export function renderTipButton(container: HTMLElement, opts: TipWidgetOptions): TipButtonResult {
  ensureNsRoot(container);
  container.replaceChildren();

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ns-btn ns-btn--primary';
  btn.textContent = opts.text ?? 'Send sats';
  setBrandAttr(btn, 'Tip', opts.username);

  const status = document.createElement('div');
  status.className = 'ns-status ns-status--muted';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.style.marginTop = '0.5rem';

  const handler = async () => {
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    status.textContent = 'Generating invoice…';
    status.classList.remove('ns-status--danger', 'ns-status--success');
    status.classList.add('ns-status--muted');

    try {
      const client = createClient(opts);
      const meta = await client.getLnurlpMetadata(opts.username);
      const amount = opts.amountMsat ?? meta.minSendable ?? 1000;
      const invoice = await client.getLnurlpInvoice(opts.username, amount);

      if (opts.onInvoice) {
        await opts.onInvoice(invoice.pr);
        status.textContent = '';
      } else {
        renderInvoicePopover(invoice.pr, {
          mount: container,
          title: 'Invoice',
          subtitle: `Pay @${opts.username}`
        });
        status.textContent = '';
      }
    } catch (e) {
      console.error('tip error', e);
      status.textContent = 'Failed to generate invoice';
      status.classList.remove('ns-status--muted');
      status.classList.add('ns-status--danger');
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
