import { type Event, nip19 } from 'nostr-tools';
import { useEffect, useMemo, useState } from 'react';

import { fetchNostrEventFromApi } from './api';
import { getEventKindLabel, parseProfileContent, type ProfileMeta } from './eventRenderers';

type PreviewState = {
  status: 'loading' | 'ready' | 'error';
  error?: string;
  event?: Event;
  authorProfile?: ProfileMeta | null;
  authorPubkey?: string;
};

type ReferencePreviewProps = {
  target: string;
  apiBase: string;
  hrefTarget?: string;
};

const PREVIEW_TIMEOUT_MS = 7000;
const PREVIEW_TEXT_LIMIT = 180;

function withTimeout<T>(promise: Promise<T>, ms: number) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const id = globalThis.setTimeout(() => {
        globalThis.clearTimeout(id);
        reject(new Error('Request timed out'));
      }, ms);
    })
  ]);
}

function formatTime(ts?: number) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString([], { hour12: false });
}

function toNpub(pubkey?: string) {
  if (!pubkey) return '—';
  try {
    return nip19.npubEncode(pubkey);
  } catch {
    return pubkey;
  }
}

function toNote(id?: string) {
  if (!id) return '—';
  try {
    return nip19.noteEncode(id);
  } catch {
    return id;
  }
}

function getTagValue(event: Event, tag: string) {
  return event.tags.find((t) => t[0] === tag)?.[1];
}

function truncateText(text: string, maxLen: number) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= maxLen) return normalized;
  return `${normalized.slice(0, maxLen).trimEnd()}…`;
}

function buildPreviewText(event: Event, authorProfile?: ProfileMeta | null) {
  if (event.kind === 0) {
    const profile = authorProfile ?? parseProfileContent(event.content);
    return truncateText(
      profile?.about || profile?.display_name || profile?.name || 'Profile metadata',
      PREVIEW_TEXT_LIMIT
    );
  }
  if (event.kind === 30023) {
    const title = getTagValue(event, 'title') || getTagValue(event, 'subject');
    const summary = getTagValue(event, 'summary');
    const combined = [title, summary].filter(Boolean).join(' — ');
    return truncateText(combined || event.content || 'Longform event', PREVIEW_TEXT_LIMIT);
  }
  if (event.kind === 6) {
    return truncateText('Repost event', PREVIEW_TEXT_LIMIT);
  }
  if (event.kind === 7) {
    return truncateText(`Reaction: ${event.content?.trim() || '+'}`, PREVIEW_TEXT_LIMIT);
  }
  return truncateText(event.content || 'Event content unavailable.', PREVIEW_TEXT_LIMIT);
}

export function ReferencePreview({ target, apiBase, hrefTarget }: ReferencePreviewProps) {
  const [state, setState] = useState<PreviewState>({ status: 'loading' });
  const targetKey = useMemo(() => target.trim().toLowerCase(), [target]);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });

    const load = async () => {
      try {
        const result = await withTimeout(
          fetchNostrEventFromApi({ baseUrl: apiBase, id: target }),
          PREVIEW_TIMEOUT_MS
        );
        if (cancelled) return;
        setState({
          status: 'ready',
          event: result.event,
          authorProfile: result.author?.profile ?? null,
          authorPubkey: result.author?.pubkey ?? result.event.pubkey
        });
      } catch (err) {
        if (cancelled) return;
        setState({ status: 'error', error: err instanceof Error ? err.message : String(err) });
      }
    };

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- target is used via targetKey (normalized)
  }, [apiBase, targetKey]);

  if (state.status === 'loading') {
    return (
      <div className="nostr-event-preview-card nostr-event-preview-card--loading">
        Loading preview...
      </div>
    );
  }

  if (state.status === 'error' || !state.event) {
    const errorMessage = state.error ?? 'Unable to load reference.';
    const isNotFound = errorMessage.includes('not found');
    const isTimeout = errorMessage.includes('timed out') || errorMessage.includes('timeout');
    return (
      <div className="nostr-event-preview-card nostr-event-preview-card--error">
        {isNotFound
          ? 'Reference not found on relays.'
          : isTimeout
            ? 'Reference timed out. Tap to retry.'
            : 'Reference unavailable.'}
      </div>
    );
  }

  const event = state.event;
  const authorProfile = state.authorProfile;
  const title = getEventKindLabel(event.kind);
  const authorLabel = toNpub(state.authorPubkey ?? event.pubkey);
  const summary = buildPreviewText(event, authorProfile);
  const routeId = hrefTarget ?? toNote(event.id);

  return (
    <a className="nostr-event-preview-card" href={`/nostr/${encodeURIComponent(routeId)}`}>
      <div className="nostr-event-preview-title">{title}</div>
      <div className="nostr-event-preview-meta">
        {authorLabel} · {formatTime(event.created_at)}
      </div>
      {summary && <div className="nostr-event-preview-body">{summary}</div>}
    </a>
  );
}
