import { render, screen, waitFor } from '@testing-library/react';
import { type Event,nip19 } from 'nostr-tools';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchNostrEventFromApi } from './api';
import { extractEventReferences, renderEvent } from './eventRenderers';
import { ReferencePreview } from './ReferencePreview';

vi.mock('./api', () => {
  return {
    fetchNostrEventFromApi: vi.fn()
  };
});

const fetchMock = vi.mocked(fetchNostrEventFromApi);

const baseEvent: Event = {
  id: 'a'.repeat(64),
  pubkey: 'b'.repeat(64),
  created_at: 1710000000,
  kind: 1,
  tags: [],
  content: 'hello',
  sig: 'c'.repeat(128)
};

function withOverrides(overrides: Partial<Event>): Event {
  return { ...baseEvent, ...overrides };
}

describe('nostr event renderers', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('parses nostr: mentions into references', () => {
    const noteId = '1'.repeat(64);
    const pubkey = '2'.repeat(64);
    const note = nip19.noteEncode(noteId);
    const npub = nip19.npubEncode(pubkey);
    const event = withOverrides({
      content: `See nostr:${note} and nostr:${npub} plus nostr:invalid`
    });

    const refs = extractEventReferences(event);

    expect(refs.mention).toContain(noteId);
    expect(refs.profiles).toContain(pubkey);
  });

  it('renders nostr and http links inside content', () => {
    const noteId = '3'.repeat(64);
    const note = nip19.noteEncode(noteId);
    const url = 'https://example.com/test';
    const event = withOverrides({
      content: `Link nostr:${note} and ${url}`
    });

    const rendered = renderEvent(event);
    render(<div>{rendered.body}</div>);

    const nostrLink = screen.getByText(`nostr:${note}`) as HTMLAnchorElement;
    expect(nostrLink.getAttribute('href')).toBe(`/nostr/${encodeURIComponent(note)}`);

    const httpLink = screen.getByText(url) as HTMLAnchorElement;
    expect(httpLink.getAttribute('href')).toBe(url);
    expect(httpLink.getAttribute('rel')).toBe('noreferrer noopener');
  });

  it('renders placeholder for empty content', () => {
    const event = withOverrides({ content: '' });
    render(<div>{renderEvent(event).body}</div>);
    expect(screen.getByText('No content for this event.')).toBeTruthy();
  });

  it('renders longform events with title and summary', () => {
    const event = withOverrides({
      kind: 30023,
      content: 'Longform body',
      tags: [
        ['title', 'Deep dive'],
        ['summary', 'Short summary']
      ]
    });

    render(<div>{renderEvent(event).body}</div>);

    expect(screen.getByText('Deep dive')).toBeTruthy();
    expect(screen.getByText('Short summary')).toBeTruthy();
    expect(screen.getByText('Longform body')).toBeTruthy();
  });

  it('renders reaction events with defaults', () => {
    const event = withOverrides({ kind: 7, content: '' });
    render(<div>{renderEvent(event).body}</div>);
    expect(screen.getByText('Reaction: +')).toBeTruthy();
  });
});

describe('ReferencePreview', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('shows unavailable state when preview data is missing', async () => {
    fetchMock.mockRejectedValueOnce(new Error('missing'));

    render(<ReferencePreview apiBase="https://api.test" target="nostr:note1deadbeef" />);

    await waitFor(() => {
      expect(screen.getByText('Reference unavailable.')).toBeTruthy();
    });
  });
});
