import { describe, expect, it } from 'vitest';

import { MockBolt12Provider } from './bolt12.js';

describe('MockBolt12Provider', () => {
  it('creates mock offers and invoices', async () => {
    const provider = new MockBolt12Provider();
    const offer = await provider.createOffer({ description: 'test offer' });
    expect(offer.offer).toMatch(/^lno1mock/);
    expect(offer.offerId).toBeTruthy();

    const invoice = await provider.fetchInvoice({ offer: offer.offer });
    expect(invoice.invoice).toMatch(/^lni1mock/);
  });
});
