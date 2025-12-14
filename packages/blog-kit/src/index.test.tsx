import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Comments, NostrstackProvider, ShareButton, TipButton } from './index';

vi.mock('@nostrstack/embed', () => {
  return {
    mountTipButton: vi.fn((el: HTMLElement) => {
      const btn = document.createElement('button');
      btn.textContent = 'Send sats';
      el.appendChild(btn);
    }),
    mountCommentWidget: vi.fn((el: HTMLElement) => {
      const div = document.createElement('div');
      div.textContent = 'Comments';
      el.appendChild(div);
    }),
    ensureNostrstackRoot: vi.fn(),
    themeToCssVars: vi.fn(() => ({})),
  };
});

vi.mock('nostr-tools', () => {
  return {
    relayInit: vi.fn(() => ({
      connect: vi.fn().mockResolvedValue(undefined),
      publish: vi.fn(() => ({
        on: vi.fn(),
      })),
      close: vi.fn(),
    })),
  };
});

const { mountTipButton, mountCommentWidget } = await import('@nostrstack/embed');

describe('blog-kit components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mounts tip button with ln address', async () => {
    render(
      <NostrstackProvider lnAddress="alice@example.com">
        <TipButton label="Tip" />
      </NostrstackProvider>,
    );
    await waitFor(() => {
      expect(mountTipButton).toHaveBeenCalled();
    });
    const call = (mountTipButton as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][1] as {
      username: string;
      host: string;
    };
    expect(call.username).toBe('alice');
    expect(call.host).toBe('example.com');
  });

  it('mounts comments with thread id', async () => {
    render(
      <NostrstackProvider relays={["wss://relay.test"]}>
        <Comments threadId="post-123" />
      </NostrstackProvider>,
    );
    await waitFor(() => {
      expect(mountCommentWidget).toHaveBeenCalled();
    });
    const call = (mountCommentWidget as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][1] as {
      threadId: string;
      relays: string[];
    };
    expect(call.threadId).toBe('post-123');
    expect(call.relays).toEqual(['wss://relay.test']);
  });

  it('share button falls back to copy/share', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    // @ts-ignore
    global.navigator.share = share;
    render(<ShareButton url="https://example.com/post" title="Post" />);
    const btn = await screen.findByRole('button');
    fireEvent.click(btn);
    await waitFor(() => expect(share).toHaveBeenCalled());
  });
});
