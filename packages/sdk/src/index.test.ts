import { describe, expect, it, vi } from 'vitest';
import { SatoshisClient } from './index.js';

describe('SatoshisClient', () => {
  it('defaults to localhost baseURL', () => {
    const client = new SatoshisClient();
    // @ts-expect-error accessing private for test via cast
    expect((client as any).base).toBe('http://localhost:3001');
  });

  it('builds lnurlp url and parses response', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ callback: 'http://example.com/api', tag: 'payRequest' })
    });
    const client = new SatoshisClient({ baseURL: 'http://example.com', fetch: fetchMock as any });
    const data = await client.getLnurlpMetadata('alice');
    expect(fetchMock).toHaveBeenCalledWith('http://example.com/\\.well-known/lnurlp/alice', {
      headers: {}
    });
    expect(data.tag).toBe('payRequest');
  });
});
