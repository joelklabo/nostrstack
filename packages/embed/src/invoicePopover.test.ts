import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderInvoicePopover } from './invoicePopover.js';

vi.mock('./qr.js', () => ({
  renderQrCodeInto: vi.fn().mockResolvedValue({ ok: true })
}));
import { renderQrCodeInto } from './qr.js';

describe('renderInvoicePopover', () => {
  let mount: HTMLElement;

  beforeEach(() => {
    mount = document.createElement('div');
    document.body.appendChild(mount);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders popover with correct content', () => {
    const pr = 'lnbc1testinvoice';
    const popover = renderInvoicePopover(pr, { mount });

    expect(popover.getAttribute('role')).toBe('dialog');
    expect(popover.querySelector('.nostrstack-popover-title')?.textContent).toBe('Invoice');
    expect(popover.querySelector('code')?.textContent).toBe(pr);
    expect(renderQrCodeInto).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      pr,
      expect.objectContaining({ preset: 'brandLogo' })
    );
  });

  it('closes when close button is clicked', () => {
    const popover = renderInvoicePopover('lnbc1test', { mount });

    // Ensure it's mounted
    expect(mount.contains(popover)).toBe(true);

    const closeBtn = popover.querySelector('.nostrstack-popover-close') as HTMLButtonElement;
    closeBtn.click();

    expect(mount.contains(popover)).toBe(false);
  });

  it('closes when escape is pressed', () => {
    const popover = renderInvoicePopover('lnbc1test', { mount });

    popover.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(mount.contains(popover)).toBe(false);
  });

  it('traps focus within the modal', () => {
    const popover = renderInvoicePopover('lnbc1test', { mount });
    const closeBtn = popover.querySelector('.nostrstack-popover-close') as HTMLButtonElement;
    const copyBtn = popover.querySelector(
      '.nostrstack-popover-actions button'
    ) as HTMLButtonElement;

    // Setup focusable elements
    // We need to ensure elements are seen as focusable. jsdom might need help.

    closeBtn.focus();
    expect(document.activeElement).toBe(closeBtn);

    // Simulate Tab on last element (copyBtn is usually later, but check DOM structure)
    // Structure: Header(Close) -> Grid -> Right -> Actions(Copy, Open)
    // So Close is first, Copy is next.

    // Wait, the structure in renderInvoicePopover:
    // header.append(titleWrap, closeBtn);
    // actions.append(copyBtn, openWallet);
    // pop.append(header, grid);

    // So Close Button is first focusable?
    // Close button is in header. Actions are in body.
    // Order: Close -> Copy -> Open -> Close (bottom)? No, bottom Close is not there in `invoicePopover.ts`?
    // Let's check `invoicePopover.ts`.
    // It has `closeBtn` in header.
    // `actions` has `copyBtn` and `openWallet`.
    // That's it.

    // So order: Close -> Copy -> OpenWallet.

    // Tab on OpenWallet should go to Close.
    const openWallet = popover.querySelector('a.nostrstack-btn') as HTMLAnchorElement;
    openWallet.focus();

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    popover.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(closeBtn); // Manually moved focus in trap logic?
    // Wait, my trap logic calls `first.focus()`.
    // But `dispatchEvent` is synchronous. `document.activeElement` should update if `focus()` is called.
  });
});
