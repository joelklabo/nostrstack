import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../utils/api-base', () => ({
  resolveRuntimeHost: () => 'example.com'
}));

import { LinkPreview } from './LinkPreview';

function createResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function uniqueUrl(prefix: string) {
  return `https://example.com/${prefix}-${Math.random().toString(16).slice(2)}`;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('LinkPreview', () => {
  it('does not issue duplicate fetches for the same URL during concurrent renders', async () => {
    const sharedUrl = uniqueUrl('shared');
    const fetcher = vi.fn();
    let resolveMock: (value: Response) => void = () => {};
    const response = new Promise<Response>((resolve) => {
      resolveMock = resolve;
    });
    fetcher.mockReturnValue(response);
    vi.spyOn(globalThis, 'fetch').mockImplementation(fetcher);

    render(
      <>
        <LinkPreview url={sharedUrl} />
        <LinkPreview url={sharedUrl} />
      </>
    );

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    resolveMock(
      createResponse(200, {
        status: 'success',
        data: {
          title: 'Shared preview',
          description: 'Preview description',
          image: 'https://example.com/image.png',
          publisher: 'Example',
          url: sharedUrl
        }
      })
    );

    await waitFor(() => {
      expect(screen.getAllByText('Shared preview')).toHaveLength(2);
      expect(screen.getAllByText('Preview description')).toHaveLength(2);
    });
  });

  it('reuses cached metadata on subsequent renders without refetching', async () => {
    const cachedUrl = uniqueUrl('cached');
    const fetcher = vi.fn();
    const response = createResponse(200, {
      status: 'success',
      data: {
        title: 'Cached preview',
        description: 'Loaded from cache',
        image: 'https://example.com/image.png',
        publisher: 'Example',
        url: cachedUrl
      }
    });

    fetcher.mockReturnValue(Promise.resolve(response));
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(fetcher);

    const { rerender } = render(<LinkPreview url={cachedUrl} />);

    await waitFor(() => {
      expect(screen.getByText('Cached preview')).toBeTruthy();
      expect(screen.getByText('Loaded from cache')).toBeTruthy();
    });

    const callCountAfterFirstRender = fetchMock.mock.calls.length;
    rerender(<LinkPreview url={cachedUrl} />);

    expect(fetchMock).toHaveBeenCalledTimes(callCountAfterFirstRender);
  });
});
