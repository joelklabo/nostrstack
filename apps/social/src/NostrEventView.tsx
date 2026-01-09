import { parseRelays, useNostrstackConfig } from '@nostrstack/react';
import { Alert } from '@nostrstack/ui';
import { type Event, nip19 } from 'nostr-tools';
import { SimplePool } from 'nostr-tools/pool';
import { useEffect, useMemo, useState } from 'react';

import { fetchNostrEventFromApi } from './nostr/api';
import {
  type EventReferences,
  extractEventReferences,
  parseProfileContent,
  type ProfileMeta
} from './nostr/eventRenderers';
import { ReferencePreview } from './nostr/ReferencePreview';
import { CopyButton } from './ui/CopyButton';
import { JsonView } from './ui/JsonView';
import { NostrEventCard } from './ui/NostrEventCard';
import { ThreadedReplies } from './ui/ThreadedReplies';
import { resolveGalleryApiBase } from './utils/api-base';

type Target =
  | { type: 'event'; id: string; relays: string[] }
  | { type: 'profile'; pubkey: string; relays: string[] }
  | { type: 'address'; kind: number; pubkey: string; identifier: string; relays: string[] };

type LoadState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  error?: string;
  apiError?: string;
  targetLabel?: string;
  relays: string[];
  event?: Event;
  references?: EventReferences;
  authorProfile?: ProfileMeta | null;
  authorPubkey?: string;
  replies: RepliesState;
};

type RepliesState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  items: Event[];
  hasMore: boolean;
  nextCursor: string | null;
  error?: string;
  loadMoreError?: string;
  isLoadingMore: boolean;
  source?: 'api' | 'relay';
};

const FALLBACK_RELAYS = ['wss://relay.damus.io', 'wss://relay.snort.social', 'wss://nos.lol'];
const REQUEST_TIMEOUT_MS = 8000;
const REPLY_PAGE_LIMIT = 50;
const EMPTY_REPLIES_STATE: RepliesState = {
  status: 'idle',
  items: [],
  hasMore: false,
  nextCursor: null,
  isLoadingMore: false
};

function normalizeId(raw: string) {
  return raw.trim().replace(/^nostr:/i, '');
}

function isHex64(value: string) {
  return /^[0-9a-f]{64}$/i.test(value);
}

function uniqRelays(relays: string[]) {
  return Array.from(new Set(relays.filter(Boolean)));
}

function isMockRelay(relay: string) {
  const trimmed = relay.trim().toLowerCase();
  return trimmed === 'mock' || trimmed === 'ws://mock' || trimmed === 'wss://mock';
}

function normalizeMockRelay(relay: string) {
  return isMockRelay(relay) ? 'ws://mock' : relay;
}

function trustMockRelays(pool: SimplePool, relays: string[]) {
  relays.forEach((relay) => {
    if (isMockRelay(relay)) {
      pool.trustedRelayURLs.add(normalizeMockRelay(relay));
    }
  });
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
      const data = decoded.data as {
        kind: number;
        pubkey: string;
        identifier: string;
        relays?: string[];
      };
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

function toNpub(pubkey?: string) {
  if (!pubkey) return '—';
  try {
    return nip19.npubEncode(pubkey);
  } catch {
    return pubkey;
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

function sortReplies(items: Event[]) {
  return [...items].sort((a, b) => {
    if (a.created_at !== b.created_at) return a.created_at - b.created_at;
    return a.id.localeCompare(b.id);
  });
}

function normalizeReplies(items: Event[]) {
  const deduped = new Map<string, Event>();
  items.forEach((item) => {
    if (!item?.id) return;
    if (deduped.has(item.id)) return;
    deduped.set(item.id, item);
  });
  return sortReplies(Array.from(deduped.values()));
}

function mergeReplies(existing: Event[], incoming: Event[]) {
  return normalizeReplies([...existing, ...incoming]);
}

export function NostrEventView({ rawId }: { rawId: string }) {
  const [state, setState] = useState<LoadState>({
    status: 'idle',
    relays: [],
    replies: EMPTY_REPLIES_STATE
  });
  const [reloadToken, setReloadToken] = useState(0);

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
  const enableRegtestPay =
    String(import.meta.env.VITE_ENABLE_REGTEST_PAY ?? '').toLowerCase() === 'true' ||
    import.meta.env.DEV;
  const repliesEnabled = target?.type === 'event';

  const relayList = useMemo(() => {
    const rawEnvRelays = cfg.relays ?? parseRelays(import.meta.env.VITE_NOSTRSTACK_RELAYS);
    const rawTargetRelays = target?.relays ?? [];
    const usesMockRelays = [...rawEnvRelays, ...rawTargetRelays].some((relay) =>
      isMockRelay(relay)
    );
    const envRelays = rawEnvRelays.map(normalizeMockRelay);
    const targetRelays = rawTargetRelays.map(normalizeMockRelay);
    const relays = usesMockRelays
      ? [...targetRelays, ...envRelays]
      : [...targetRelays, ...envRelays, ...FALLBACK_RELAYS];
    return uniqRelays(relays);
  }, [cfg.relays, target]);

  useEffect(() => {
    if (!target) {
      setState({
        status: 'error',
        relays: [],
        error: 'Unsupported or invalid nostr identifier.',
        apiError: undefined,
        replies: EMPTY_REPLIES_STATE
      });
      return;
    }

    let cancelled = false;

    const fetchRepliesFromRelays = async (
      eventId: string,
      relays: string[],
      pool?: SimplePool
    ): Promise<RepliesState> => {
      const activePool = pool ?? new SimplePool();
      trustMockRelays(activePool, relays);
      const shouldClose = !pool;
      const closePool = () => {
        if (!shouldClose) return;
        globalThis.setTimeout(() => {
          try {
            activePool.close(relays);
          } catch {
            // ignore close errors
          }
        }, 0);
      };

      try {
        const replyEvents = await withTimeout(
          activePool.querySync(relays, { kinds: [1], '#e': [eventId], limit: REPLY_PAGE_LIMIT }),
          REQUEST_TIMEOUT_MS
        );
        return {
          status: 'ready',
          items: normalizeReplies(replyEvents),
          hasMore: false,
          nextCursor: null,
          isLoadingMore: false,
          source: 'relay'
        };
      } catch (err) {
        return {
          ...EMPTY_REPLIES_STATE,
          status: 'error',
          error: err instanceof Error ? err.message : 'Unable to load replies from relays.',
          source: 'relay'
        };
      } finally {
        closePool();
      }
    };

    const loadFromRelays = async () => {
      const pool = new SimplePool();
      trustMockRelays(pool, relayList);
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
        let repliesState: RepliesState = EMPTY_REPLIES_STATE;

        if (target.type === 'event') {
          event = await withTimeout(pool.get(relayList, { ids: [target.id] }), REQUEST_TIMEOUT_MS);
          if (event) {
            repliesState = await fetchRepliesFromRelays(event.id, relayList, pool);
          }
        } else if (target.type === 'profile') {
          event = await withTimeout(
            pool.get(relayList, { kinds: [0], authors: [target.pubkey] }),
            REQUEST_TIMEOUT_MS
          );
        } else {
          const identifier = target.identifier ?? '';
          event = await withTimeout(
            pool.get(relayList, {
              kinds: [target.kind],
              authors: [target.pubkey],
              '#d': [identifier]
            }),
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

        return { event, authorProfile, authorPubkey: event.pubkey, repliesState };
      } finally {
        closePool();
      }
    };

    const load = async () => {
      setState({
        status: 'loading',
        relays: relayList,
        error: undefined,
        apiError: undefined,
        event: undefined,
        references: undefined,
        authorProfile: undefined,
        authorPubkey: undefined,
        targetLabel: rawId,
        replies: repliesEnabled
          ? { ...EMPTY_REPLIES_STATE, status: 'loading' }
          : EMPTY_REPLIES_STATE
      });

      let apiError: string | null = null;

      try {
        if (apiBaseConfig.isConfigured) {
          try {
            const apiResult = await withTimeout(
              fetchNostrEventFromApi({
                baseUrl: apiBase,
                id: rawId,
                relays: relayList,
                replyLimit: repliesEnabled ? REPLY_PAGE_LIMIT : undefined,
                replyTimeoutMs: repliesEnabled ? REQUEST_TIMEOUT_MS : undefined
              }),
              REQUEST_TIMEOUT_MS
            );
            if (cancelled) return;
            const relays = apiResult.target?.relays?.length ? apiResult.target.relays : relayList;

            let repliesState = repliesEnabled
              ? {
                  status: 'ready' as const,
                  items: normalizeReplies(apiResult.replies ?? []),
                  hasMore: apiResult.replyPage?.hasMore ?? false,
                  nextCursor: apiResult.replyPage?.nextCursor ?? null,
                  isLoadingMore: false,
                  source: 'api' as const
                }
              : EMPTY_REPLIES_STATE;

            if (repliesEnabled && apiResult.replies === undefined) {
              repliesState = await fetchRepliesFromRelays(apiResult.event.id, relays);
            }

            setState({
              status: 'ready',
              relays,
              event: apiResult.event,
              references: apiResult.references,
              authorProfile: apiResult.author?.profile ?? null,
              authorPubkey: apiResult.author?.pubkey ?? apiResult.event.pubkey,
              targetLabel: apiResult.target?.input ?? rawId,
              replies: repliesState,
              apiError: undefined
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
          targetLabel: rawId,
          replies: relayResult.repliesState,
          apiError: apiError ?? undefined
        });
      } catch (err) {
        if (cancelled) return;
        const relayMessage = err instanceof Error ? err.message : String(err);
        setState({
          status: 'error',
          relays: relayList,
          error: apiError ? `${relayMessage} (API: ${apiError})` : relayMessage,
          replies: repliesEnabled
            ? {
                ...EMPTY_REPLIES_STATE,
                status: 'error',
                error: 'Replies unavailable while event failed to load.'
              }
            : EMPTY_REPLIES_STATE
        });
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [apiBase, apiBaseConfig.isConfigured, rawId, relayList, target, repliesEnabled, reloadToken]);

  const event = state.event;
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
  const handleRetry = () => setReloadToken((prev) => prev + 1);

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

  const repliesState = state.replies;
  const replyCountLabel =
    repliesState.status === 'ready'
      ? `${repliesState.items.length}${repliesState.hasMore ? '+' : ''}`
      : '—';
  const canLoadMore =
    apiBaseConfig.isConfigured &&
    repliesState.status === 'ready' &&
    repliesState.hasMore &&
    Boolean(repliesState.nextCursor) &&
    !repliesState.isLoadingMore;

  const loadMoreReplies = async () => {
    if (!canLoadMore || !repliesState.nextCursor) return;
    const cursor = repliesState.nextCursor;
    setState((prev) => ({
      ...prev,
      replies: { ...prev.replies, isLoadingMore: true, loadMoreError: undefined }
    }));

    try {
      const result = await fetchNostrEventFromApi({
        baseUrl: apiBase,
        id: rawId,
        relays: state.relays,
        replyCursor: cursor,
        replyLimit: REPLY_PAGE_LIMIT,
        replyTimeoutMs: REQUEST_TIMEOUT_MS
      });
      if (result.replies === undefined) {
        throw new Error('Replies missing from API response.');
      }
      setState((prev) => {
        const merged = mergeReplies(prev.replies.items, result.replies ?? []);
        return {
          ...prev,
          replies: {
            ...prev.replies,
            status: 'ready',
            items: merged,
            hasMore: result.replyPage?.hasMore ?? false,
            nextCursor: result.replyPage?.nextCursor ?? null,
            isLoadingMore: false,
            loadMoreError: undefined,
            source: 'api'
          }
        };
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState((prev) => ({
        ...prev,
        replies: { ...prev.replies, isLoadingMore: false, loadMoreError: message }
      }));
    }
  };

  return (
    <div className="nostr-event-page">
      <header className="nostr-event-header">
        <div>
          <div className="nostr-event-title">{state.targetLabel ?? 'Event'}</div>
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
          <div
            className="nostr-event-loading"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            role="status"
          >
            <span className="ns-spinner" aria-hidden="true" />
            Fetching event data...
          </div>
        )}
        {state.status === 'error' && (
          <Alert tone="danger" title="Event Error">
            <div className="nostr-event-error">
              <span>{state.error}</span>
              <button className="action-btn" type="button" onClick={handleRetry}>
                Retry
              </button>
            </div>
          </Alert>
        )}

        {event && (
          <>
            <NostrEventCard
              event={event}
              variant="hero"
              apiBase={apiBase}
              enableRegtestPay={enableRegtestPay}
            />

            {repliesEnabled && (
              <div className="nostr-event-replies">
                <div className="nostr-event-replies-header">
                  <div>
                    <div className="nostr-event-section-title">Replies</div>
                    <div className="nostr-event-section-subtitle">{replyCountLabel} replies</div>
                  </div>
                </div>
                {state.apiError && repliesState.status === 'ready' && (
                  <Alert
                    tone="warning"
                    title="API unavailable"
                    className="nostr-event-replies-fallback"
                  >
                    Showing relay results while the API is unavailable. {state.apiError}
                  </Alert>
                )}

                {repliesState.status === 'loading' && (
                  <div className="nostr-event-replies-loading" role="status">
                    <span className="ns-spinner" aria-hidden="true" />
                    Loading replies...
                  </div>
                )}

                {repliesState.status === 'error' && (
                  <Alert tone="danger" title="Replies unavailable">
                    <div className="nostr-event-replies-error">
                      <span>{repliesState.error ?? 'Unable to load replies.'}</span>
                      <button className="action-btn" type="button" onClick={handleRetry}>
                        Retry
                      </button>
                    </div>
                  </Alert>
                )}

                {repliesState.status === 'ready' && repliesState.items.length === 0 && (
                  <div className="nostr-event-replies-empty">
                    No replies yet. Check your relays or try again later.
                  </div>
                )}

                {repliesState.status === 'ready' && repliesState.items.length > 0 && (
                  <div className="nostr-event-replies-list">
                    <ThreadedReplies
                      events={repliesState.items}
                      rootId={event.id}
                      apiBase={apiBase}
                      enableRegtestPay={enableRegtestPay}
                    />
                  </div>
                )}

                {repliesState.loadMoreError && (
                  <Alert tone="warning" title="Some replies are unavailable">
                    {repliesState.loadMoreError}
                  </Alert>
                )}

                {repliesState.status === 'ready' && repliesState.hasMore && (
                  <button
                    className="action-btn nostr-event-replies-load"
                    type="button"
                    onClick={loadMoreReplies}
                    disabled={repliesState.isLoadingMore}
                  >
                    {repliesState.isLoadingMore ? 'Loading more…' : 'Load more replies'}
                  </button>
                )}
              </div>
            )}

            {hasReferences && (
              <div className="nostr-event-reference-sections">
                {previewsEnabled &&
                  referencePreviewSections.map((section) => {
                    if (section.items.length === 0) return null;
                    return (
                      <div key={section.key} className="nostr-event-preview-group">
                        <div className="nostr-event-preview-header">
                          <span className="nostr-event-label">{section.label}</span>
                          {section.overflow > 0 && (
                            <span className="nostr-event-preview-overflow">
                              +{section.overflow} more
                            </span>
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
                          <a
                            key={pk}
                            href={`/nostr/${encodeURIComponent(npub)}`}
                            className="nostr-event-chip"
                          >
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
