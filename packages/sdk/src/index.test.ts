import { describe, expect, it, vi } from 'vitest';

import { NostrstackClient } from './index.js';

describe('NostrstackClient', () => {
  it('defaults to localhost baseURL', () => {
    const client = new NostrstackClient();
    // @ts-expect-error accessing private for test via cast
    expect((client as unknown as { base: string }).base).toBe('http://localhost:3001');
  });

  it('builds lnurlp url and parses response', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ callback: 'http://example.com/api', tag: 'payRequest' })
    });
    const client = new NostrstackClient({
      baseURL: 'http://example.com',
      fetch: fetchMock as unknown as (input: RequestInfo, init?: RequestInit) => Promise<Response>
    });
    const data = await client.getLnurlpMetadata('alice');
    expect(fetchMock).toHaveBeenCalledWith('http://example.com/\\.well-known/lnurlp/alice', {
      headers: {}
    });
    expect(data.tag).toBe('payRequest');
  });
});
