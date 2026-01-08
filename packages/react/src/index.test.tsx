import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BlockchainStats,
  Comments,
  CommentTipWidget,
  NostrProfileWidget,
  NostrstackProvider,
  ShareButton,
  ShareWidget,
  SupportSection,
  TipActivityFeed,
  TipButton,
  TipWidget
} from './index';

vi.mock('@nostrstack/widgets', () => {
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
      return Promise.resolve({ destroy: vi.fn() });
    }),
    mountBlockchainStats: vi.fn(() => ({ destroy: vi.fn(), refresh: vi.fn() })),
    mountNostrProfile: vi.fn(() => ({ destroy: vi.fn(), refresh: vi.fn() })),
    mountCommentTipWidget: vi.fn(() => Promise.resolve({ destroy: vi.fn() })),
    mountShareButton: vi.fn((el: HTMLElement) => {
      const btn = document.createElement('button');
      btn.textContent = 'Share';
      el.appendChild(btn);
      return { destroy: vi.fn() };
    }),
    createNostrstackBrandTheme: vi.fn(() => ({})),
    ensureNostrstackEmbedStyles: vi.fn(),
    ensureNostrstackRoot: vi.fn(),
    themeToCssVars: vi.fn(() => ({}))
  };
});

vi.mock('nostr-tools', () => {
  return {
    relayInit: vi.fn(() => ({
      connect: vi.fn().mockResolvedValue(undefined),
      publish: vi.fn(() => ({
        on: vi.fn()
      })),
      close: vi.fn()
    }))
  };
});

const {
  mountTipButton,
  mountTipWidget,
  mountTipFeed,
  mountCommentWidget,
  mountBlockchainStats,
  mountNostrProfile,
  mountCommentTipWidget,
  mountShareButton
} = await import('@nostrstack/widgets');

describe('blog-kit components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mounts tip button with ln address', async () => {
    render(
      <NostrstackProvider lnAddress="alice@example.com">
        <TipButton label="Tip" />
      </NostrstackProvider>
    );
    await waitFor(() => {
      expect(mountTipButton).toHaveBeenCalled();
    });
    const call = (mountTipButton as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0][1] as {
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
      </NostrstackProvider>
    );
    await waitFor(() => {
      expect(mountTipWidget).toHaveBeenCalled();
    });
    const call = (mountTipWidget as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0][1] as {
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
      </NostrstackProvider>
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
      <NostrstackProvider relays={['wss://relay.test']}>
        <Comments threadId="post-123" />
      </NostrstackProvider>
    );
    await waitFor(() => {
      expect(mountCommentWidget).toHaveBeenCalled();
    });
    const call = (mountCommentWidget as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0][1] as {
      threadId: string;
      relays: string[];
    };
    expect(call.threadId).toBe('post-123');
    expect(call.relays).toEqual(['wss://relay.test']);
  });

  it('mounts blockchain stats with base URL', async () => {
    render(
      <NostrstackProvider baseUrl="http://localhost:3001">
        <BlockchainStats title="Chain" />
      </NostrstackProvider>
    );
    await waitFor(() => {
      expect(mountBlockchainStats).toHaveBeenCalled();
    });
    const call = (mountBlockchainStats as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0][1] as {
      baseURL?: string;
      title?: string;
    };
    expect(call.baseURL).toBe('http://localhost:3001');
    expect(call.title).toBe('Chain');
  });

  it('mounts nostr profile with identifier', async () => {
    render(
      <NostrstackProvider>
        <NostrProfileWidget identifier="alice@example.com" />
      </NostrstackProvider>
    );
    await waitFor(() => {
      expect(mountNostrProfile).toHaveBeenCalled();
    });
    const call = (mountNostrProfile as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0][1] as {
      identifier?: string;
    };
    expect(call.identifier).toBe('alice@example.com');
  });

  it('mounts share button with url and title', async () => {
    render(<ShareButton url="https://example.com/post" title="Post" />);
    await waitFor(() => {
      expect(mountShareButton).toHaveBeenCalled();
    });
    const call = (mountShareButton as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0][1] as { url: string; title: string };
    expect(call.url).toBe('https://example.com/post');
    expect(call.title).toBe('Post');
  });

  it('renders share widget without relays', async () => {
    render(
      <ShareWidget itemId="post-123" url="https://example.com/post" title="Post" relays={[]} />
    );
    await screen.findByText('Shares');
    await screen.findByText(/No relays configured/i);
  });

  it('mounts comment tip widget with all options', async () => {
    render(
      <NostrstackProvider lnAddress="alice@example.com" relays={['wss://relay.test']}>
        <CommentTipWidget itemId="post-123" layout="compact" />
      </NostrstackProvider>
    );
    await waitFor(() => {
      expect(mountCommentTipWidget).toHaveBeenCalled();
    });
    const call = (mountCommentTipWidget as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0][1] as {
      username: string;
      itemId: string;
      layout: string;
      relays: string[];
    };
    expect(call.username).toBe('alice');
    expect(call.itemId).toBe('post-123');
    expect(call.layout).toBe('compact');
    expect(call.relays).toEqual(['wss://relay.test']);
  });

  it('renders support section with sub-components', async () => {
    render(
      <NostrstackProvider lnAddress="alice@example.com">
        <SupportSection
          title="Support Me"
          itemId="post-123"
          shareUrl="https://example.com"
          shareTitle="Post"
        />
      </NostrstackProvider>
    );
    expect(screen.getByText('Support Me')).toBeTruthy();
    // SupportSection uses sub-components TipWidget, ShareButton, Comments
    await waitFor(() => {
      expect(mountTipWidget).toHaveBeenCalled();
      expect(mountCommentWidget).toHaveBeenCalled();
      expect(mountShareButton).toHaveBeenCalled();
    });
  });

  it('renders support section in compact layout', async () => {
    render(
      <NostrstackProvider lnAddress="alice@example.com">
        <SupportSection
          title="Support Me"
          itemId="post-123"
          layout="compact"
          shareUrl="https://example.com"
          shareTitle="Post"
        />
      </NostrstackProvider>
    );
    expect(screen.getByText('Support Me')).toBeTruthy();
    await waitFor(() => {
      expect(mountTipWidget).toHaveBeenCalled();
      expect(mountCommentWidget).toHaveBeenCalled();
    });
  });

  it('renders support section with unavailable tips/share when missing data', async () => {
    render(
      <NostrstackProvider>
        <SupportSection itemId="post-123" shareUrl="" />
      </NostrstackProvider>
    );
    // Missing lnAddress
    expect(screen.getByText('Tips unavailable')).toBeTruthy();
    // Missing share title/url
    expect(screen.getByText('Share unavailable')).toBeTruthy();
  });
});
