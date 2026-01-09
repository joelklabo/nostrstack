import { createCopyButton } from './copyButton.js';
import { renderQrCodeInto } from './qr.js';
import { ensureNsEmbedStyles, nsEmbedStyles, type NsThemeMode } from './styles.js';

export type InvoicePopoverOptions = {
  mount?: HTMLElement;
  mode?: NsThemeMode;
  title?: string;
  subtitle?: string;
};

export function renderInvoicePopover(pr: string, opts: InvoicePopoverOptions = {}) {
  const mount = opts.mount ?? document.body;
  ensureNsEmbedStyles(mount.ownerDocument);

  const overlay = document.createElement('div');
  overlay.className = 'ns ns-popover-overlay';
  if (!mount.closest?.('.ns-theme')) {
    overlay.classList.add('ns-theme');
    if (opts.mode) overlay.setAttribute('data-ns-theme', opts.mode);
  }
  overlay.tabIndex = -1;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', opts.title ?? 'Invoice');

  const pop = document.createElement('div');
  pop.className = 'ns-popover';
  pop.addEventListener('click', (e) => e.stopPropagation());

  const header = document.createElement('div');
  header.className = 'ns-popover-header';

  const titleWrap = document.createElement('div');
  titleWrap.style.display = 'flex';
  titleWrap.style.flexDirection = 'column';
  titleWrap.style.gap = '4px';

  const title = document.createElement('div');
  title.className = 'ns-popover-title';
  title.textContent = opts.title ?? 'Invoice';

  const subtitle = document.createElement('div');
  subtitle.className = 'ns-popover-sub';
  subtitle.textContent = opts.subtitle ?? 'Lightning (BOLT11)';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'ns-btn ns-btn--ghost ns-btn--sm ns-popover-close';
  closeBtn.type = 'button';
  closeBtn.textContent = 'Close';

  titleWrap.append(title, subtitle);
  header.append(titleWrap, closeBtn);

  const grid = document.createElement('div');
  grid.className = 'ns-popover-grid';

  const qrWrap = document.createElement('div');
  qrWrap.className = 'ns-qr';

  const right = document.createElement('div');
  right.style.display = 'flex';
  right.style.flexDirection = 'column';
  right.style.gap = '10px';
  right.style.minWidth = '240px';

  const actions = document.createElement('div');
  actions.className = 'ns-popover-actions';

  const { el: copyBtn } = createCopyButton({
    label: 'Copy invoice',
    size: 'sm',
    getText: () => pr
  });

  const openWallet = document.createElement('a');
  openWallet.href = `lightning:${pr}`;
  openWallet.className = 'ns-btn ns-btn--primary ns-btn--sm';
  openWallet.textContent = 'Open in wallet';
  openWallet.rel = 'noreferrer';

  actions.append(copyBtn, openWallet);

  const invoiceBox = document.createElement('div');
  invoiceBox.className = 'ns-invoice-box';
  const code = document.createElement('code');
  code.className = 'ns-code';
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
    if (e.key === 'Escape') {
      e.preventDefault();
      remove();
      return;
    }
    if (e.key === 'Tab') {
      const focusable = Array.from(
        overlay.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true');

      if (!focusable.length) {
        e.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement; // Works for light DOM

      if (e.shiftKey) {
        if ((active === first || active === overlay) && last) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last && first) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  };
  overlay.addEventListener('keydown', keydown);

  mount.appendChild(overlay);
  closeBtn.focus();

  renderQrCodeInto(qrWrap, pr, { preset: 'brandLogo', verify: 'strict', size: 320 }).catch(
    (err) => {
      console.warn('qr render failed', err);
    }
  );

  return overlay;
}

// For SSR / manual inclusion (includes tokens + base primitives + popover styles).
export const invoicePopoverStyles = nsEmbedStyles;
