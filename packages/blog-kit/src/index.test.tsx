import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Comments, NostrstackProvider, ShareButton, ShareWidget, TipActivityFeed, TipButton, TipWidget } from './index';

vi.mock('@nostrstack/embed', () => {
  return {
    mountTipButton: vi.fn((el: HTMLElement) => {
      const btn = document.createElement('button');
      btn.textContent = 'Send sats';
      el.appendChild(btn);
    }),
    mountTipWidget: vi.fn(() => ({ destroy: vi.fn() })),
    mountTipFeed: vi.fn(() => ({ destroy: vi.fn(), refresh: vi.fn() })),
    mountCommentWidget: vi.fn((el: HTMLElement) => {
      const div = document.createElement('div');
      div.textContent = 'Comments';
      el.appendChild(div);
    }),
    createNostrstackBrandTheme: vi.fn(() => ({})),
    ensureNostrstackEmbedStyles: vi.fn(),
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

const { mountTipButton, mountTipWidget, mountTipFeed, mountCommentWidget } = await import('@nostrstack/embed');

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

  it('mounts tip widget with item id and presets', async () => {
    render(
      <NostrstackProvider lnAddress="alice@example.com">
        <TipWidget itemId="post-123" presetAmountsSats={[5, 10, 21]} defaultAmountSats={10} />
      </NostrstackProvider>,
    );
    await waitFor(() => {
      expect(mountTipWidget).toHaveBeenCalled();
    });
    const call = (mountTipWidget as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][1] as {
      username: string;
      itemId: string;
      presetAmountsSats: number[];
      defaultAmountSats: number;
      host: string;
    };
    expect(call.username).toBe('alice');
    expect(call.itemId).toBe('post-123');
    expect(call.presetAmountsSats).toEqual([5, 10, 21]);
    expect(call.defaultAmountSats).toBe(10);
    expect(call.host).toBe('example.com');
  });

  it('mounts tip activity feed scoped to item id', async () => {
    render(
      <NostrstackProvider lnAddress="alice@example.com">
        <TipActivityFeed itemId="post-123" />
      </NostrstackProvider>,
    );
    await waitFor(() => {
      expect(mountTipFeed).toHaveBeenCalled();
    });
    const call = (mountTipFeed as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][1] as {
      itemId: string;
      host: string;
    };
    expect(call.itemId).toBe('post-123');
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

  it('renders share widget without relays', async () => {
    render(<ShareWidget itemId="post-123" url="https://example.com/post" title="Post" relays={[]} />);
    await screen.findByText('Shares');
    await screen.findByText(/No relays configured/i);
  });
});
