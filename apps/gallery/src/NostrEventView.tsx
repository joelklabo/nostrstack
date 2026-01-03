import { parseRelays, useNostrstackConfig } from '@nostrstack/blog-kit';
import { type Event, nip19, SimplePool } from 'nostr-tools';
import { useEffect, useMemo, useState } from 'react';

import { fetchNostrEventFromApi } from './nostr/api';
import { type EventReferences, extractEventReferences, getEventKindLabel, parseProfileContent, ProfileCard, type ProfileMeta, renderEvent } from './nostr/eventRenderers';
import { ReferencePreview } from './nostr/ReferencePreview';
import { CopyButton } from './ui/CopyButton';
import { JsonView } from './ui/JsonView';
import { resolveGalleryApiBase } from './utils/api-base';

type Target =
  | { type: 'event'; id: string; relays: string[] }
  | { type: 'profile'; pubkey: string; relays: string[] }
  | { type: 'address'; kind: number; pubkey: string; identifier: string; relays: string[] };

type LoadState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  error?: string;
  targetLabel?: string;
  relays: string[];
  event?: Event;
  references?: EventReferences;
  authorProfile?: ProfileMeta | null;
  authorPubkey?: string;
};

const FALLBACK_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.snort.social',
  'wss://nos.lol'
];
const REQUEST_TIMEOUT_MS = 8000;

function normalizeId(raw: string) {
  return raw.trim().replace(/^nostr:/i, '');
}

function isHex64(value: string) {
  return /^[0-9a-f]{64}$/i.test(value);
}

function uniqRelays(relays: string[]) {
  return Array.from(new Set(relays.filter(Boolean)));
}

function resolveTarget(rawId: string): Target | null {
  const cleaned = normalizeId(rawId);

  if (isHex64(cleaned)) {
    return { type: 'event', id: cleaned.toLowerCase(), relays: [] };
  }

  try {
    const decoded = nip19.decode(cleaned.toLowerCase());
    if (decoded.type === 'note') {
      return { type: 'event', id: decoded.data as string, relays: [] };
    }
    if (decoded.type === 'nevent') {
      const data = decoded.data as { id: string; relays?: string[] };
      return { type: 'event', id: data.id, relays: data.relays ?? [] };
    }
    if (decoded.type === 'npub') {
      return { type: 'profile', pubkey: decoded.data as string, relays: [] };
    }
    if (decoded.type === 'nprofile') {
      const data = decoded.data as { pubkey: string; relays?: string[] };
      return { type: 'profile', pubkey: data.pubkey, relays: data.relays ?? [] };
    }
    if (decoded.type === 'naddr') {
      const data = decoded.data as { kind: number; pubkey: string; identifier: string; relays?: string[] };
      return {
        type: 'address',
        kind: data.kind,
        pubkey: data.pubkey,
        identifier: data.identifier,
        relays: data.relays ?? []
      };
    }
  } catch {
    // ignore decode errors
  }

  return null;
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

function toNaddr(coord: string) {
  const parts = coord.split(':');
  if (parts.length < 3) return coord;
  const kind = Number(parts[0]);
  const pubkey = parts[1];
  const identifier = parts.slice(2).join(':');
  if (!Number.isFinite(kind)) return coord;
  try {
    return nip19.naddrEncode({ kind, pubkey, identifier });
  } catch {
    return coord;
  }
}

function sliceWithOverflow(items: string[], limit: number) {
  if (items.length <= limit) {
    return { items, overflow: 0 };
  }
  return { items: items.slice(0, limit), overflow: items.length - limit };
}

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

export function NostrEventView({ rawId }: { rawId: string }) {
  const [state, setState] = useState<LoadState>({
    status: 'idle',
    relays: []
  });

  const cfg = useNostrstackConfig();
  const target = useMemo(() => resolveTarget(rawId), [rawId]);
  const apiBaseConfig = useMemo(
    () =>
      resolveGalleryApiBase({
        apiBase: cfg.apiBase,
        baseUrl: cfg.baseUrl,
        apiBaseConfig: cfg.apiBaseConfig
      }),
    [cfg.apiBase, cfg.apiBaseConfig, cfg.baseUrl]
  );
  const apiBase = apiBaseConfig.baseUrl;
  const relayList = useMemo(() => {
    const envRelays = cfg.relays ?? parseRelays(import.meta.env.VITE_NOSTRSTACK_RELAYS);
    const targetRelays = target?.relays ?? [];
    return uniqRelays([...targetRelays, ...envRelays, ...FALLBACK_RELAYS]);
  }, [cfg.relays, target]);

  useEffect(() => {
    if (!target) {
      setState({
        status: 'error',
        relays: [],
        error: 'Unsupported or invalid nostr identifier.'
      });
      return;
    }

    let cancelled = false;

    const loadFromRelays = async () => {
      const pool = new SimplePool();
      const closePool = () => {
        globalThis.setTimeout(() => {
          try {
            pool.close(relayList);
          } catch {
            // ignore close errors
          }
        }, 0);
      };

      try {
        let event: Event | null = null;
        if (target.type === 'event') {
          event = await withTimeout(pool.get(relayList, { ids: [target.id] }), REQUEST_TIMEOUT_MS);
        } else if (target.type === 'profile') {
          event = await withTimeout(
            pool.get(relayList, { kinds: [0], authors: [target.pubkey] }),
            REQUEST_TIMEOUT_MS
          );
        } else {
          const identifier = target.identifier ?? '';
          event = await withTimeout(
            pool.get(relayList, { kinds: [target.kind], authors: [target.pubkey], '#d': [identifier] }),
            REQUEST_TIMEOUT_MS
          );
        }

        if (!event) {
          throw new Error('Event not found on available relays.');
        }

        let authorProfile: ProfileMeta | null = null;
        if (event.kind !== 0) {
          const profileEvent = await withTimeout(
            pool.get(relayList, { kinds: [0], authors: [event.pubkey] }),
            REQUEST_TIMEOUT_MS
          );
          authorProfile = parseProfileContent(profileEvent?.content);
        } else {
          authorProfile = parseProfileContent(event.content);
        }

        return { event, authorProfile, authorPubkey: event.pubkey };
      } finally {
        closePool();
      }
    };

    const load = async () => {
      setState({
        status: 'loading',
        relays: relayList,
        error: undefined,
        event: undefined,
        references: undefined,
        authorProfile: undefined,
        authorPubkey: undefined,
        targetLabel: rawId
      });

      let apiError: string | null = null;

      try {
        if (apiBaseConfig.isConfigured) {
          try {
            const apiResult = await withTimeout(
              fetchNostrEventFromApi({
                baseUrl: apiBase,
                id: rawId,
                relays: relayList
              }),
              REQUEST_TIMEOUT_MS
            );
            if (cancelled) return;
            const relays = apiResult.target?.relays?.length ? apiResult.target.relays : relayList;
            setState({
              status: 'ready',
              relays,
              event: apiResult.event,
              references: apiResult.references,
              authorProfile: apiResult.author?.profile ?? null,
              authorPubkey: apiResult.author?.pubkey ?? apiResult.event.pubkey,
              targetLabel: apiResult.target?.input ?? rawId
            });
            return;
          } catch (err) {
            apiError = err instanceof Error ? err.message : String(err);
          }
        }

        if (cancelled) return;
        const relayResult = await loadFromRelays();
        if (cancelled) return;
        setState({
          status: 'ready',
          relays: relayList,
          event: relayResult.event,
          references: extractEventReferences(relayResult.event),
          authorProfile: relayResult.authorProfile,
          authorPubkey: relayResult.authorPubkey,
          targetLabel: rawId
        });
      } catch (err) {
        if (cancelled) return;
        const relayMessage = err instanceof Error ? err.message : String(err);
        setState({
          status: 'error',
          relays: relayList,
          error: apiError ? `${relayMessage} (API: ${apiError})` : relayMessage
        });
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [apiBase, apiBaseConfig.isConfigured, rawId, relayList, target]);

  const event = state.event;
  const authorProfile = state.authorProfile;
  const title = event ? getEventKindLabel(event.kind) : 'Nostr Event';
  const rendered = event ? renderEvent(event) : null;
  const references = state.references;
  const hasReferences =
    !!references &&
    (references.root.length > 0 ||
      references.reply.length > 0 ||
      references.mention.length > 0 ||
      references.quote.length > 0 ||
      references.address.length > 0 ||
      references.profiles.length > 0);
  const previewsEnabled = apiBaseConfig.isConfigured;

  const referencePreviewSections = useMemo(() => {
    if (!references || !previewsEnabled) return [];
    const sections = [
      { key: 'root', label: 'Thread root', items: references.root, limit: 1 },
      { key: 'reply', label: 'In reply to', items: references.reply, limit: 1 },
      { key: 'quote', label: 'Quoted events', items: references.quote, limit: 3 },
      {
        key: 'address',
        label: 'Addressable references',
        items: references.address.map(toNaddr),
        limit: 3
      },
      { key: 'mention', label: 'Mentions', items: references.mention, limit: 3 }
    ];

    return sections.map((section) => {
      const deduped = Array.from(new Set(section.items.filter(Boolean)));
      const { items, overflow } = sliceWithOverflow(deduped, section.limit);
      return { ...section, items, overflow };
    });
  }, [previewsEnabled, references]);

  const profileChips = useMemo(() => {
    if (!references) return { items: [], overflow: 0 };
    const deduped = Array.from(new Set(references.profiles.filter(Boolean)));
    return sliceWithOverflow(deduped, 8);
  }, [references]);

  const addressChips = useMemo(() => {
    if (!references) return { items: [], overflow: 0 };
    const deduped = Array.from(new Set(references.address.filter(Boolean).map(toNaddr)));
    return sliceWithOverflow(deduped, 8);
  }, [references]);

  return (
    <div className="nostr-event-page">
      <header className="nostr-event-header">
        <div>
          <div className="nostr-event-title">{title}</div>
          <div className="nostr-event-subtitle">Rendered by NostrStack</div>
        </div>
        <div className="nostr-event-actions">
          <a className="nostr-event-back" href="/">
            Back to App
          </a>
        </div>
      </header>

      <section className="nostr-event-card">
        <div className="nostr-event-meta">
          <div>
            <span className="nostr-event-label">Target</span>
            <div className="nostr-event-value">
              {state.targetLabel ?? rawId}
              <CopyButton text={state.targetLabel ?? rawId} label="Copy" size="sm" />
            </div>
          </div>
          <div>
            <span className="nostr-event-label">Relays</span>
            <div className="nostr-event-value">{state.relays.length}</div>
          </div>
          <div>
            <span className="nostr-event-label">Status</span>
            <div className="nostr-event-value">{state.status.toUpperCase()}</div>
          </div>
        </div>

        {state.status === 'loading' && (
          <div className="nostr-event-loading" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} role="status">
            <span className="nostrstack-spinner" aria-hidden="true" />
            Fetching event data...
          </div>
        )}
        {state.status === 'error' && (
          <div className="nostr-event-error">ERROR: {state.error}</div>
        )}

        {event && (
          <>
            <div className="nostr-event-details">
              <div className="nostr-event-detail">
                <span className="nostr-event-label">Event ID</span>
                <div className="nostr-event-value">
                  {toNote(event.id)}
                  <CopyButton text={event.id} label="Copy ID" size="sm" />
                </div>
              </div>
              <div className="nostr-event-detail">
                <span className="nostr-event-label">Author</span>
                <div className="nostr-event-value">
                  {toNpub(event.pubkey)}
                  <CopyButton text={event.pubkey} label="Copy Pubkey" size="sm" />
                </div>
              </div>
              <div className="nostr-event-detail">
                <span className="nostr-event-label">Created</span>
                <div className="nostr-event-value">{formatTime(event.created_at)}</div>
              </div>
              <div className="nostr-event-detail">
                <span className="nostr-event-label">Kind</span>
                <div className="nostr-event-value">{event.kind}</div>
              </div>
            </div>

            <div className="nostr-event-content">
              {authorProfile && event.kind !== 0 && <ProfileCard profile={authorProfile} />}
              {rendered?.body}
              {rendered?.footer}
            </div>

            {hasReferences && (
              <div className="nostr-event-reference-sections">
                {previewsEnabled && referencePreviewSections.map((section) => {
                  if (section.items.length === 0) return null;
                  return (
                    <div key={section.key} className="nostr-event-preview-group">
                      <div className="nostr-event-preview-header">
                        <span className="nostr-event-label">{section.label}</span>
                        {section.overflow > 0 && (
                          <span className="nostr-event-preview-overflow">+{section.overflow} more</span>
                        )}
                      </div>
                      <div className="nostr-event-preview-grid">
                        {section.items.map((id) => (
                          <ReferencePreview
                            key={`${section.key}-${id}`}
                            target={id}
                            apiBase={apiBase}
                            hrefTarget={section.key === 'address' ? id : undefined}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}

                {profileChips.items.length > 0 && (
                  <div className="nostr-event-ref">
                    <span className="nostr-event-label">Mentioned profiles</span>
                    <div className="nostr-event-chiplist">
                      {profileChips.items.map((pk) => {
                        const npub = toNpub(pk);
                        return (
                          <a key={pk} href={`/nostr/${encodeURIComponent(npub)}`} className="nostr-event-chip">
                            {npub}
                          </a>
                        );
                      })}
                      {profileChips.overflow > 0 && (
                        <span className="nostr-event-chip">+{profileChips.overflow} more</span>
                      )}
                    </div>
                  </div>
                )}

                {addressChips.items.length > 0 && (
                  <div className="nostr-event-ref">
                    <span className="nostr-event-label">Addressable coords</span>
                    <div className="nostr-event-chiplist">
                      {addressChips.items.map((coord) => (
                        <a
                          key={coord}
                          href={`/nostr/${encodeURIComponent(coord)}`}
                          className="nostr-event-chip"
                        >
                          {coord}
                        </a>
                      ))}
                      {addressChips.overflow > 0 && (
                        <span className="nostr-event-chip">+{addressChips.overflow} more</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="nostr-event-tags">
              <span className="nostr-event-label">Tags</span>
              <div className="nostr-event-taglist">
                {event.tags.length === 0 && <span className="nostr-event-tag">No tags</span>}
                {event.tags.map((tag, idx) => (
                  <span key={`${tag[0]}-${idx}`} className="nostr-event-tag">
                    {tag.join(':')}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
      </section>

      {event && (
        <section className="nostr-event-raw">
          <JsonView value={event} title="Raw Event" />
        </section>
      )}
    </div>
  );
}
