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
});
