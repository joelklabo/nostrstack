import './styles/search-view.css';

import { PostEditor } from '@nostrstack/blog-kit'; // Might be needed for editor, but not used here? Remove unused imports.
// Actually SearchView imports PostItem. I will replace it with NostrEventCard.
import { emitTelemetryEvent, useNostrstackConfig } from '@nostrstack/blog-kit';
import { type Event, nip19 } from 'nostr-tools';
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIdentityResolver } from './hooks/useIdentityResolver';
import { useRelays } from './hooks/useRelays';
import { useSimplePool } from './hooks/useSimplePool';
import { fetchNostrEventFromApi, SEARCH_RELAYS, searchNotes } from './nostr/api';
import { type ProfileMeta, safeExternalUrl } from './nostr/eventRenderers';
import { Alert } from './ui/Alert';
import { NostrEventCard } from './ui/NostrEventCard';
import { navigateToProfile } from './utils/navigation';

export function SearchView() {
  const cfg = useNostrstackConfig();
  const apiBase =
    cfg.apiBase ?? cfg.baseUrl ?? import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';
  const { relays: relayList } = useRelays();
  const pool = useSimplePool();
  const [query, setQuery] = useState('');
  const { status, result, error, resolveNow } = useIdentityResolver(query, { apiBase });
  const pendingSearchRef = useRef<string | null>(null);

  const [fetchedProfile, setFetchedProfile] = useState<ProfileMeta | null>(null);
  const [notes, setNotes] = useState<Event[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [lastSearchQuery, setLastSearchQuery] = useState<string>('');

  const NOTES_PAGE_SIZE = 20;

  const npub = useMemo(() => {
    if (!result) return null;
    try {
      return nip19.npubEncode(result.pubkey);
    } catch {
      return null;
    }
  }, [result]);

  const profilePicture = useMemo(() => {
    return safeExternalUrl(fetchedProfile?.picture);
  }, [fetchedProfile]);

  const statusLabel = useMemo(() => {
    if (status === 'validating') return 'Checking format…';
    if (status === 'resolving') return 'Resolving identity…';
    if (status === 'resolved') return 'Identity ready.';
    if (status === 'error' && error?.code !== 'invalid_format')
      return error?.message ?? 'Lookup failed.';
    return 'Paste an identifier or search keywords.';
  }, [status, error]);

  const handleNotesSearch = useCallback(
    async (q: string) => {
      setNotesLoading(true);
      setNotesError(null);
      setNotes([]);
      setHasMore(false);
      setLastSearchQuery(q);
      try {
        // Merge user relays with dedicated search relays
        const searchRelays = [...new Set([...relayList, ...SEARCH_RELAYS])];
        const results = await searchNotes(pool, searchRelays, q, NOTES_PAGE_SIZE);
        setNotes(results);
        setHasMore(results.length >= NOTES_PAGE_SIZE);
        if (results.length === 0) {
          setNotesError('No notes found for this query.');
        }
      } catch (err) {
        console.error('Notes search failed', err);
        setNotesError('Search failed. Relays might not support NIP-50.');
      } finally {
        setNotesLoading(false);
      }
    },
    [relayList, pool]
  );

  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || notes.length === 0 || !lastSearchQuery) return;

    setIsLoadingMore(true);
    try {
      const searchRelays = [...new Set([...relayList, ...SEARCH_RELAYS])];
      // Get the oldest note's timestamp for pagination
      const oldestNote = notes.reduce((oldest, note) =>
        note.created_at < oldest.created_at ? note : oldest
      );
      const until = oldestNote.created_at;

      const moreResults = await searchNotes(
        pool,
        searchRelays,
        lastSearchQuery,
        NOTES_PAGE_SIZE,
        until
      );

      // Filter out duplicates
      const existingIds = new Set(notes.map((n) => n.id));
      const newNotes = moreResults.filter((n) => !existingIds.has(n.id));

      if (newNotes.length > 0) {
        setNotes((prev) => [...prev, ...newNotes]);
      }
      setHasMore(moreResults.length >= NOTES_PAGE_SIZE);
    } catch (err) {
      console.error('Load more failed', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, notes, lastSearchQuery, relayList, pool]);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = query.trim();
      if (!trimmed) return;
      pendingSearchRef.current = trimmed;
      emitTelemetryEvent({ type: 'search', stage: 'start', query: trimmed });

      // Always try identity resolution
      void resolveNow(trimmed);

      // Also try content search
      void handleNotesSearch(trimmed);
    },
    [query, resolveNow, handleNotesSearch]
  );

  useEffect(() => {
    const pending = pendingSearchRef.current;
    if (!pending) return;
    if (status === 'resolved' && result) {
      emitTelemetryEvent({
        type: 'search',
        stage: 'success',
        query: pending,
        source: result.source,
        pubkey: result.pubkey
      });
      pendingSearchRef.current = null;
      return;
    }
    if (status === 'error' && error) {
      emitTelemetryEvent({
        type: 'search',
        stage: 'failure',
        query: pending,
        reason: error.code
      });
      pendingSearchRef.current = null;
    }
  }, [status, result, error]);

  useEffect(() => {
    if (status !== 'resolved' || !result || !npub) {
      setFetchedProfile(null);
      return;
    }

    const controller = new AbortController();
    setFetchedProfile(null);

    fetchNostrEventFromApi({
      baseUrl: apiBase,
      id: npub,
      timeoutMs: 3000,
      signal: controller.signal
    })
      .then((res) => {
        if (res.author.profile) {
          setFetchedProfile(res.author.profile);
        }
      })
      .catch(() => {
        // Silent failure
      });

    return () => controller.abort();
  }, [status, result, npub, apiBase]);

  return (
    <div className="search-view">
      <header className="search-header">
        <div>
          <h2 className="search-title">Discovery</h2>
          <p className="search-subtitle">Search for profiles or keywords across Nostr.</p>
        </div>
      </header>

      <form className="search-card" onSubmit={handleSubmit} role="search" aria-label="Search Nostr">
        <label className="search-label" htmlFor="friend-search">
          Search query
        </label>
        <div className="search-input-row">
          <input
            id="friend-search"
            className="nostrstack-input search-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Keywords, npub, or name@domain"
            autoComplete="off"
            aria-describedby="search-helper"
          />
          <button className="action-btn" type="submit" aria-label="Execute search">
            Search
          </button>
        </div>
        <div id="search-helper" className="search-helper">
          Try "bitcoin", "nostr", or an npub1...
        </div>
        <div
          className={`search-status search-status--${status}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          role="status"
          aria-live="polite"
        >
          {(status === 'validating' || status === 'resolving' || notesLoading) && (
            <span
              className="nostrstack-spinner"
              style={{ width: '14px', height: '14px' }}
              aria-hidden="true"
            />
          )}
          {statusLabel}
        </div>
      </form>

      {error?.code === 'lightning_only' && error.lightning && (
        <Alert tone="info" title="Lightning address detected">
          We found a Lightning address but no Nostr profile mapping. You can still send sats if you
          have their pubkey.
          <div style={{ marginTop: '0.5rem' }}>
            <code className="search-alert-code">{error.lightning}</code>
          </div>
        </Alert>
      )}

      {status === 'resolved' && result && (
        <div className="search-result-card">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1, minWidth: 0 }}>
            {profilePicture && (
              <img
                src={profilePicture}
                alt=""
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  background: 'var(--color-canvas-subtle)'
                }}
              />
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="search-result-title">
                <span
                  style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
                >
                  {fetchedProfile?.display_name ||
                    fetchedProfile?.name ||
                    result.nip05 ||
                    npub ||
                    result.pubkey}
                </span>
                {result.verified && <span className="search-result-badge">Verified</span>}
              </div>
              <div className="search-result-meta">
                {fetchedProfile?.about && (
                  <div
                    style={{
                      fontSize: '0.85rem',
                      color: 'var(--color-fg-default)',
                      display: '-webkit-box',
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}
                  >
                    {fetchedProfile.about}
                  </div>
                )}
                <div
                  style={{ display: 'flex', gap: '0.5em', alignItems: 'center', flexWrap: 'wrap' }}
                >
                  {npub && <code>{npub.slice(0, 12)}…</code>}
                  {result.nip05 && <span>NIP-05: {result.nip05}</span>}
                  <span className="search-result-source">Source: {result.source}</span>
                </div>
              </div>
            </div>
          </div>
          <button
            className="action-btn search-result-action"
            type="button"
            onClick={() => navigateToProfile(result.pubkey)}
          >
            Open profile
          </button>
        </div>
      )}

      {status === 'error' &&
        error &&
        error.code !== 'lightning_only' &&
        error.code !== 'invalid_format' && (
          <Alert tone="danger" title="Identity resolution failed">
            {error.message}
          </Alert>
        )}

      <div className="search-notes-results">
        {notes.length > 0 && (
          <>
            <h3 style={{ margin: '2rem 0 1rem', fontSize: '1.2rem' }}>Matching Notes</h3>
            {notes.map((note) => (
              <NostrEventCard key={note.id} event={note} />
            ))}
            {hasMore && (
              <div style={{ padding: '1.5rem', textAlign: 'center' }}>
                <button
                  className="action-btn"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  aria-busy={isLoadingMore}
                  style={{ padding: '0.5rem 2rem' }}
                >
                  {isLoadingMore ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
            {!hasMore && notes.length > 0 && (
              <div
                style={{
                  padding: '1rem',
                  textAlign: 'center',
                  color: 'var(--color-fg-muted)',
                  fontSize: '0.85rem'
                }}
              >
                End of results
              </div>
            )}
          </>
        )}
        {notesLoading && notes.length === 0 && (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-fg-muted)' }}>
            Searching for notes...
          </div>
        )}
        {notesError && !notesLoading && query && (
          <div
            style={{
              padding: '2rem',
              textAlign: 'center',
              color: 'var(--color-fg-subtle)',
              fontSize: '0.9rem'
            }}
          >
            {notesError}
          </div>
        )}
      </div>
    </div>
  );
}
