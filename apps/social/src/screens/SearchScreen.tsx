import '../styles/components/search-view.css';

import { emitTelemetryEvent, useNostrstackConfig } from '@nostrstack/react';
import { Alert } from '@nostrstack/ui';
import { type Event, nip19 } from 'nostr-tools';
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIdentityResolver } from '../hooks/useIdentityResolver';
import { useSimplePool } from '../hooks/useSimplePool';
import { fetchNostrEventFromApi, getSearchRelays, searchNotes } from '../nostr/api';
import { type ProfileMeta, safeExternalUrl } from '../nostr/eventRenderers';
import { Image } from '../ui/Image';
import { NostrEventCard } from '../ui/NostrEventCard';
import { resolveGalleryApiBase } from '../utils/api-base';
import { navigateToProfile } from '../utils/navigation';

const DIRECT_IDENTITY_QUERY = /^\s*(npub1|nprofile1)[0-9a-z]+$/i;
const HEX_IDENTITY_QUERY = /^\s*[0-9a-f]{64}\s*$/i;
const LIGHTNING_OR_NIP05_QUERY = /^\s*[^@\s]+@[^@\s]+\s*$/i;

function isDirectIdentitySearch(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || trimmed.includes(' ')) return false;
  return (
    DIRECT_IDENTITY_QUERY.test(trimmed) ||
    HEX_IDENTITY_QUERY.test(trimmed) ||
    LIGHTNING_OR_NIP05_QUERY.test(trimmed)
  );
}

export function SearchScreen() {
  const cfg = useNostrstackConfig();
  const apiBaseConfig = resolveGalleryApiBase(cfg);
  const apiBase = apiBaseConfig.baseUrl;
  const pool = useSimplePool();
  const [query, setQuery] = useState('');
  const { status, result, error, resolveNow } = useIdentityResolver(query, { apiBase });
  const pendingSearchRef = useRef<string | null>(null);

  const [fetchedProfile, setFetchedProfile] = useState<ProfileMeta | null>(null);
  const [notes, setNotes] = useState<Event[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [notesSearchTimedOut, setNotesSearchTimedOut] = useState(false);
  const [profileLookupError, setProfileLookupError] = useState<string | null>(null);
  const [isProfileLookupLoading, setIsProfileLookupLoading] = useState(false);
  const [profileRetryKey, setProfileRetryKey] = useState(0);
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
      setNotesSearchTimedOut(false);
      setNotes([]);
      setHasMore(false);
      setLastSearchQuery(q);
      try {
        const searchRelays = getSearchRelays();
        const results = await searchNotes(pool, searchRelays, q, NOTES_PAGE_SIZE);
        setNotes(results);
        setHasMore(results.length >= NOTES_PAGE_SIZE);
        if (results.length === 0) {
          setNotesError('No notes found for this query.');
        }
      } catch (err) {
        console.error('Notes search failed', err);
        const timedOut = err instanceof Error && /Request timed out after/.test(err.message);
        setNotesSearchTimedOut(timedOut);
        setNotesError(
          timedOut
            ? 'Notes search timed out. Retry to try again.'
            : 'Search failed. Relays might not support NIP-50.'
        );
      } finally {
        setNotesLoading(false);
      }
    },
    [pool]
  );

  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || notes.length === 0 || !lastSearchQuery) return;

    setIsLoadingMore(true);
    try {
      const searchRelays = getSearchRelays();
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
  }, [isLoadingMore, notes, lastSearchQuery, pool]);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = query.trim();
      if (!trimmed) return;
      setProfileLookupError(null);
      if (isDirectIdentitySearch(trimmed)) {
        setNotes([]);
        setNotesError(null);
        setNotesSearchTimedOut(false);
        setHasMore(false);
        setLastSearchQuery('');
      }
      pendingSearchRef.current = trimmed;
      emitTelemetryEvent({ type: 'search', stage: 'start', query: trimmed });

      // Always try identity resolution
      void resolveNow(trimmed);

      // Also try content search
      if (!isDirectIdentitySearch(trimmed)) {
        void handleNotesSearch(trimmed);
      }
    },
    [query, resolveNow, handleNotesSearch]
  );

  const retryProfileLookup = useCallback(() => {
    if (status !== 'resolved') return;
    setProfileRetryKey((value) => value + 1);
    setProfileLookupError(null);
  }, [status]);

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
      setProfileLookupError(null);
      setIsProfileLookupLoading(false);
      return;
    }

    const controller = new AbortController();
    setFetchedProfile(null);
    setProfileLookupError(null);
    setIsProfileLookupLoading(true);

    fetchNostrEventFromApi({
      baseUrl: apiBase,
      id: npub,
      timeoutMs: 8000,
      signal: controller.signal
    })
      .then((res) => {
        if (res.author.profile) {
          setFetchedProfile(res.author.profile);
          setProfileLookupError(null);
        }
        if (!res.author.profile) {
          setProfileLookupError('Metadata resolved to an empty profile.');
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        const message =
          error instanceof Error ? error.message : 'Unable to load profile metadata at this time.';
        setProfileLookupError(message);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsProfileLookupLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [status, result, npub, apiBase, profileRetryKey]);

  return (
    <div className="search-view">
      <header className="search-header">
        <div>
          <h2 className="search-title">Discovery</h2>
          <p className="search-subtitle">Search for profiles or keywords across Nostr.</p>
        </div>
      </header>

      <form
        className="search-card"
        onSubmit={handleSubmit}
        role="search"
        aria-label="Search Nostr"
        aria-busy={status === 'validating' || status === 'resolving' || notesLoading}
      >
        <label className="search-label" htmlFor="friend-search">
          Search query
        </label>
        <div className="search-input-row">
          <input
            id="friend-search"
            name="query"
            type="search"
            className="ns-input search-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Keywords, npub, or name@domain"
            autoComplete="off"
            inputMode="search"
            enterKeyHint="search"
            aria-describedby="search-helper"
          />
          <button className="action-btn" type="submit" aria-label="Execute search">
            Search
          </button>
        </div>
        <div id="search-helper" className="search-helper">
          Try &quot;bitcoin&quot;, &quot;nostr&quot;, or an npub1...
        </div>
        <div
          className={`search-status search-status--${status}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          role="status"
          aria-live="polite"
        >
          {(status === 'validating' || status === 'resolving' || notesLoading) && (
            <span
              className="ns-spinner"
              style={{ width: '14px', height: '14px' }}
              aria-hidden="true"
            />
          )}
          {statusLabel}
        </div>
      </form>

      {error?.code === 'lightning_only' && error.lightning && (
        <Alert tone="info" title="Lightning address detected" role="status" aria-live="polite">
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
              <Image
                src={profilePicture}
                alt={`${fetchedProfile?.display_name || fetchedProfile?.name || result.nip05 || npub || result.pubkey} avatar`}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  background: 'var(--ns-color-bg-subtle)'
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
                      color: 'var(--ns-color-text-default)',
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
            aria-label={`Open profile for ${fetchedProfile?.display_name || fetchedProfile?.name || result.nip05 || npub || result.pubkey}`}
          >
            Open profile
          </button>
        </div>
      )}

      {status === 'resolved' && result && profileLookupError && (
        <Alert tone="warning" title="Profile metadata not loaded" role="status">
          <p>{profileLookupError}</p>
          <button
            type="button"
            className="action-btn"
            onClick={retryProfileLookup}
            disabled={isProfileLookupLoading}
            aria-label="Retry profile metadata lookup"
            style={{ marginTop: '0.5rem' }}
          >
            {isProfileLookupLoading ? 'Retrying…' : 'Retry metadata lookup'}
          </button>
        </Alert>
      )}

      {status === 'error' &&
        error &&
        error.code !== 'lightning_only' &&
        error.code !== 'invalid_format' && (
          <Alert tone="danger" title="Identity resolution failed" role="alert">
            {error.message}
          </Alert>
        )}

      <div className="search-notes-results">
        {notes.length > 0 && (
          <>
            <h3 style={{ margin: '2rem 0 1rem', fontSize: '1.2rem' }}>Matching Notes</h3>
            <div className="search-notes-list" role="list">
              {notes.map((note) => (
                <div key={note.id} role="listitem">
                  <NostrEventCard event={note} />
                </div>
              ))}
            </div>
            {hasMore && (
              <div style={{ padding: '1.5rem', textAlign: 'center' }}>
                <button
                  type="button"
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
                  color: 'var(--ns-color-text-muted)',
                  fontSize: '0.85rem'
                }}
                role="status"
                aria-live="polite"
              >
                No more results. Try a different search term.
              </div>
            )}
          </>
        )}
        {notesLoading && notes.length === 0 && (
          <div
            style={{ padding: '2rem', textAlign: 'center', color: 'var(--ns-color-text-muted)' }}
            role="status"
            aria-live="polite"
          >
            Searching for notes...
          </div>
        )}
        {notesError && !notesLoading && query && (
          <div
            style={{
              padding: '2rem',
              textAlign: 'center',
              color: 'var(--ns-color-text-subtle)',
              fontSize: '0.9rem'
            }}
            role="status"
            aria-live="polite"
          >
            {notesError}
            {notesSearchTimedOut && (
              <div style={{ marginTop: '0.75rem' }}>
                <button
                  type="button"
                  className="action-btn"
                  onClick={() => void handleNotesSearch(query)}
                >
                  Retry search
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
