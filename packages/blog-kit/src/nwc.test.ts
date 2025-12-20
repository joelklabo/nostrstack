import { describe, expect, it } from 'vitest';

import { NwcClient } from './nwc';
import { parseNwcUri } from './utils';

const walletPubkey = 'a'.repeat(64);
const secretHex = 'b'.repeat(64);
const relayUrl = 'wss://relay.example/';
const encodedRelay = encodeURIComponent(relayUrl);
const validUri = `nostr+walletconnect://${walletPubkey}?secret=${secretHex}&relay=${encodedRelay}`;

describe('NWC helpers', () => {
  it('parses a valid NWC URI', () => {
    const parsed = parseNwcUri(validUri);
    expect(parsed.walletPubkey).toBe(walletPubkey);
    expect(parsed.secretHex).toBe(secretHex);
    expect(parsed.relays).toEqual([relayUrl]);
  });

  it('rejects invalid relay protocols', () => {
    expect(() => new NwcClient({ uri: validUri, relays: ['http://relay.example'] }))
      .toThrow(/Invalid NWC relay URL/);
  });

  it('enforces max payment limit before sending request', async () => {
    const client = new NwcClient({ uri: validUri, maxAmountMsat: 1000 });
    await expect(client.payInvoice('lnbc1dummy', 2000)).rejects.toThrow(/exceeds limit/i);
    client.close();
  });
});
