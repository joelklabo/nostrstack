import './styles/search-view.css';

import { emitTelemetryEvent, useNostrstackConfig } from '@nostrstack/blog-kit';
import { nip19 } from 'nostr-tools';
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIdentityResolver } from './hooks/useIdentityResolver';
import { fetchNostrEventFromApi } from './nostr/api';
import { type ProfileMeta, safeExternalUrl } from './nostr/eventRenderers';
import { navigateToProfile } from './utils/navigation';

export function SearchView() {
  const cfg = useNostrstackConfig();
  const apiBase = cfg.apiBase ?? cfg.baseUrl ?? import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';
  const [query, setQuery] = useState('');
  const { status, result, error, resolveNow } = useIdentityResolver(query, { apiBase });
  const pendingSearchRef = useRef<string | null>(null);

  const [fetchedProfile, setFetchedProfile] = useState<ProfileMeta | null>(null);

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
    if (status === 'error') return error?.message ?? 'Lookup failed.';
    return 'Paste an identifier to begin.';
  }, [status, error]);

  const handleSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    pendingSearchRef.current = trimmed;
    emitTelemetryEvent({ type: 'search', stage: 'start', query: trimmed });
    void resolveNow(trimmed);
  }, [query, resolveNow]);

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
          <h2 className="search-title">Find friend</h2>
          <p className="search-subtitle">Search by npub, nprofile, hex pubkey, or NIP-05.</p>
        </div>
      </header>

      <form className="search-card" onSubmit={handleSubmit}>
        <label className="search-label" htmlFor="friend-search">
          Friend identifier
        </label>
        <div className="search-input-row">
          <input
            id="friend-search"
            className="nostrstack-input search-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="npub1... or name@domain"
            autoComplete="off"
          />
          <button className="action-btn" type="submit">
            Search
          </button>
        </div>
        <div className="search-helper">
          Examples: npub1…, nprofile1…, or alice@nostr.example
        </div>
        <div className={`search-status search-status--${status}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} role="status">
          {(status === 'validating' || status === 'resolving') && <span className="nostrstack-spinner" style={{ width: '14px', height: '14px' }} aria-hidden="true" />}
          {statusLabel}
        </div>
      </form>

      {error?.code === 'lightning_only' && error.lightning && (
        <div className="search-card search-alert">
          <div className="search-alert-title">Lightning address detected</div>
          <div className="search-alert-body">
            We found a Lightning address but no Nostr profile mapping. You can still send sats if you have their pubkey.
          </div>
          <code className="search-alert-code">{error.lightning}</code>
        </div>
      )}

      {status === 'resolved' && result && (
        <div className="search-result-card">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1, minWidth: 0 }}>
            {profilePicture && (
              <img
                src={profilePicture}
                alt=""
                style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', background: 'var(--color-canvas-subtle)' }}
              />
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="search-result-title">
                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {fetchedProfile?.display_name || fetchedProfile?.name || result.nip05 || npub || result.pubkey}
                </span>
                {result.verified && <span className="search-result-badge">Verified</span>}
              </div>
              <div className="search-result-meta">
                {fetchedProfile?.about && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--color-fg-default)', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {fetchedProfile.about}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.5em', alignItems: 'center', flexWrap: 'wrap' }}>
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

      {status === 'error' && error && error.code !== 'lightning_only' && (
        <div className="search-card search-alert search-alert--error">
          <div className="search-alert-title">Search failed</div>
          <div className="search-alert-body">{error.message}</div>
        </div>
      )}
    </div>
  );
}
