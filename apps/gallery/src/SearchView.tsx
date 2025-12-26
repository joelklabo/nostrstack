import './styles/search-view.css';

import { useNostrstackConfig } from '@nostrstack/blog-kit';
import { nip19 } from 'nostr-tools';
import { useMemo, useState } from 'react';

import { useIdentityResolver } from './hooks/useIdentityResolver';
import { navigateToProfile } from './utils/navigation';

export function SearchView() {
  const cfg = useNostrstackConfig();
  const apiBase = cfg.apiBase ?? cfg.baseUrl ?? import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';
  const [query, setQuery] = useState('');
  const { status, result, error, resolveNow } = useIdentityResolver(query, { apiBase });

  const npub = useMemo(() => {
    if (!result) return null;
    try {
      return nip19.npubEncode(result.pubkey);
    } catch {
      return null;
    }
  }, [result]);

  const statusLabel = useMemo(() => {
    if (status === 'validating') return 'Checking format…';
    if (status === 'resolving') return 'Resolving identity…';
    if (status === 'resolved') return 'Identity ready.';
    if (status === 'error') return error?.message ?? 'Lookup failed.';
    return 'Paste an identifier to begin.';
  }, [status, error]);

  return (
    <div className="search-view">
      <header className="search-header">
        <div>
          <h2 className="search-title">Find friend</h2>
          <p className="search-subtitle">Search by npub, nprofile, hex pubkey, or NIP-05.</p>
        </div>
      </header>

      <form
        className="search-card"
        onSubmit={(event) => {
          event.preventDefault();
          void resolveNow(query);
        }}
      >
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
        <div className={`search-status search-status--${status}`}>
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
          <div>
            <div className="search-result-title">
              {result.nip05 ?? npub ?? result.pubkey}
              {result.verified && <span className="search-result-badge">Verified</span>}
            </div>
            <div className="search-result-meta">
              {npub && <code>{npub}</code>}
              {result.nip05 && <span>NIP-05: {result.nip05}</span>}
              <span className="search-result-source">Source: {result.source}</span>
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
