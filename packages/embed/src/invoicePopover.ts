import QRCode from 'qrcode';

import { ensureNostrstackEmbedStyles, nostrstackEmbedStyles, type NostrstackThemeMode } from './styles.js';

export type InvoicePopoverOptions = {
  mount?: HTMLElement;
  mode?: NostrstackThemeMode;
  title?: string;
  subtitle?: string;
};

export function renderInvoicePopover(pr: string, opts: InvoicePopoverOptions = {}) {
  const mount = opts.mount ?? document.body;
  ensureNostrstackEmbedStyles(mount.ownerDocument);

  const overlay = document.createElement('div');
  overlay.className = 'nostrstack nostrstack-popover-overlay';
  if (!mount.closest?.('.nostrstack-theme')) {
    overlay.classList.add('nostrstack-theme');
    if (opts.mode) overlay.setAttribute('data-nostrstack-theme', opts.mode);
  }
  overlay.tabIndex = -1;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', opts.title ?? 'Invoice');

  const pop = document.createElement('div');
  pop.className = 'nostrstack-popover';
  pop.addEventListener('click', (e) => e.stopPropagation());

  const header = document.createElement('div');
  header.className = 'nostrstack-popover-header';

  const titleWrap = document.createElement('div');
  titleWrap.style.display = 'flex';
  titleWrap.style.flexDirection = 'column';
  titleWrap.style.gap = '4px';

  const title = document.createElement('div');
  title.className = 'nostrstack-popover-title';
  title.textContent = opts.title ?? 'Invoice';

  const subtitle = document.createElement('div');
  subtitle.className = 'nostrstack-popover-sub';
  subtitle.textContent = opts.subtitle ?? 'Lightning (BOLT11)';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'nostrstack-btn nostrstack-btn--ghost nostrstack-btn--sm nostrstack-popover-close';
  closeBtn.type = 'button';
  closeBtn.textContent = 'Close';

  titleWrap.append(title, subtitle);
  header.append(titleWrap, closeBtn);

  const grid = document.createElement('div');
  grid.className = 'nostrstack-popover-grid';

  const qrWrap = document.createElement('div');
  qrWrap.className = 'nostrstack-qr';
  const qrImg = document.createElement('img');
  qrImg.alt = 'Lightning invoice QR';
  qrImg.decoding = 'async';
  qrImg.loading = 'lazy';
  qrWrap.appendChild(qrImg);

  const right = document.createElement('div');
  right.style.display = 'flex';
  right.style.flexDirection = 'column';
  right.style.gap = '10px';
  right.style.minWidth = '240px';

  const actions = document.createElement('div');
  actions.className = 'nostrstack-popover-actions';

  const copyBtn = document.createElement('button');
  copyBtn.className = 'nostrstack-btn nostrstack-btn--sm';
  copyBtn.type = 'button';
  copyBtn.textContent = 'Copy invoice';
  copyBtn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(pr);
      copyBtn.textContent = 'Copied';
      setTimeout(() => (copyBtn.textContent = 'Copy invoice'), 1200);
    } catch (e) {
      console.warn('copy failed', e);
      copyBtn.textContent = 'Copy failed';
      setTimeout(() => (copyBtn.textContent = 'Copy invoice'), 1200);
    }
  };

  const openWallet = document.createElement('a');
  openWallet.href = `lightning:${pr}`;
  openWallet.className = 'nostrstack-btn nostrstack-btn--primary nostrstack-btn--sm';
  openWallet.textContent = 'Open in wallet';
  openWallet.rel = 'noreferrer';

  actions.append(copyBtn, openWallet);

  const invoiceBox = document.createElement('div');
  invoiceBox.className = 'nostrstack-invoice-box';
  const code = document.createElement('code');
  code.className = 'nostrstack-code';
  code.textContent = pr;
  invoiceBox.appendChild(code);

  right.append(actions, invoiceBox);
  grid.append(qrWrap, right);

  pop.append(header, grid);
  overlay.appendChild(pop);

  const remove = () => overlay.remove();
  overlay.onclick = (e) => {
    if (e.target === overlay) remove();
  };
  closeBtn.onclick = remove;

  const keydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') remove();
  };
  overlay.addEventListener('keydown', keydown);

  mount.appendChild(overlay);
  closeBtn.focus();

  QRCode.toDataURL(pr, { errorCorrectionLevel: 'M', margin: 1, scale: 6 })
    .then((dataUrl) => {
      qrImg.src = dataUrl;
    })
    .catch((err) => {
      console.warn('qr gen failed', err);
    });

  return overlay;
}

// For SSR / manual inclusion (includes tokens + base primitives + popover styles).
export const invoicePopoverStyles = nostrstackEmbedStyles;
