import { nip19 } from 'nostr-tools';
import { useCallback, useEffect, useMemo, useState } from 'react';

type Props = {
  npub?: string | null;
  hasSigner?: boolean;
  enableMock?: boolean;
};

type Status = 'checking' | 'ready' | 'missing' | 'error';

export function Nip07Status({ npub, hasSigner, enableMock }: Props) {
  const timeoutMs = 12000;
  const [status, setStatus] = useState<Status>('checking');
  const [detectedNpub, setDetectedNpub] = useState<string | null>(npub ?? null);
  const [demoOff, setDemoOff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const [nostrPresent, setNostrPresent] = useState<boolean | null>(null);
  const [lastHint, setLastHint] = useState<string | null>(null);

  // Dev shim: allows overriding signer for demos/tests if enableMock=true
  const nostr = useMemo(() => {
    if (enableMock && typeof window !== 'undefined') {
      // minimal mock signer that returns fixed key
      return {
        getPublicKey: async () => 'f'.repeat(64)
      } as Partial<typeof window.nostr>;
    }
    return typeof window !== 'undefined' ? window.nostr : undefined;
  }, [enableMock]);

  const tryOnce = useCallback(async (): Promise<Status> => {
    if (demoOff) {
      setStatus('missing');
      setError(null);
      return 'missing';
    }
    if (typeof window === 'undefined') return 'missing';
    const getPublicKey = nostr?.getPublicKey;
    const has = typeof getPublicKey === 'function';
    setNostrPresent(has);
    if (!has) {
      setStatus('missing');
      setError(null);
      setLastHint('No window.nostr found. Ensure a NIP-07 extension (Alby, nos2x, etc.) is installed and enabled for this site.');
      console.info('[nip07] window.nostr missing; check extension permission/host allowlist');
      return 'missing';
    }

    setStatus('checking');
    setError(null);
      const started = Date.now();
      try {
        const pub = await Promise.race([
        getPublicKey(),
        new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs))
      ]);
      const encoded = safe(() => nip19.npubEncode(pub)) ?? pub;
      setDetectedNpub(encoded);
      setStatus('ready');
      setLastCheckedAt(Date.now());
      setLastHint(null);
      console.info('[nip07] signer detected', { pubkey: pub, ms: Date.now() - started });
      return 'ready';
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
      setLastCheckedAt(Date.now());
      const errMsg = err instanceof Error ? err.message : String(err);
      const hint = errMsg === 'timeout'
        ? 'Signer did not respond. Open your NIP-07 extension, unlock it, and allow https://localhost:4173 then retry.'
        : 'Signer responded with error. It may need you to approve access in the extension popup or settings.';
      setLastHint(hint);
      console.warn('[nip07] signer error', { err, ms: Date.now() - started });
      return 'error';
    }
  }, [demoOff, nostr]);

  const detect = useCallback(async () => {
    if (status === 'ready') return;
    let finalStatus: Status = 'checking';
    // run up to 3 attempts quickly; stop if ready
    for (let i = 0; i < 3; i += 1) {
      finalStatus = await tryOnce();
      if (finalStatus === 'ready') break;
      if (i < 2) await new Promise((r) => setTimeout(r, 500));
    }
    if (finalStatus === 'checking') {
      setStatus('missing');
      setError('timeout');
      setLastHint('No response after 5s. Open your NIP-07 extension and allow this site.');
    }
  }, [status, tryOnce]);

  useEffect(() => {
    detect();
  }, [detect, hasSigner]);

  useEffect(() => {
    const onFocus = () => detect();
    window.addEventListener('focus', onFocus);
    const onVis = () => {
      if (document.visibilityState === 'visible') detect();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [detect]);

  const stateColor =
    status === 'ready' ? '#22c55e' : status === 'checking' ? '#f59e0b' : status === 'error' ? '#ef4444' : '#f97316';
  const badgeShadow = status === 'ready' ? '0 0 0 6px rgba(34,197,94,0.2)' : 'none';

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '0.75rem', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.15rem' }}>
        <span style={{ width: 10, height: 10, borderRadius: 999, background: stateColor, boxShadow: badgeShadow }} />
        <strong>
          {status === 'ready' && 'NIP-07 signer detected'}
          {status === 'checking' && 'Checking for NIP-07…'}
          {status === 'missing' && 'No NIP-07 signer'}
          {status === 'error' && 'Signer check failed'}
        </strong>
      </div>

      {status === 'ready' && (
        <div style={{ fontSize: '0.9rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', minWidth: 0 }}>
          <span>Pubkey:</span>
          <code style={{ background: '#fff', padding: '0.25rem 0.45rem', borderRadius: 8, border: '1px solid #e2e8f0', wordBreak: 'break-all', maxWidth: '100%', display: 'block' }}>
            {npub ?? detectedNpub ?? 'unknown'}
          </code>
        </div>
      )}

      {status === 'missing' && (
        <div style={{ fontSize: '0.9rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span>Tips to enable:</span>
          <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
            <li>Install Alby or nos2x</li>
            <li>Enable NIP-07 in the extension settings and refresh</li>
            <li>Allow this origin (https://localhost:4173) in the extension permissions</li>
            <li>Use https or localhost so the extension can inject</li>
          </ul>
          {nostrPresent === false && (
            <div style={{ color: '#ef4444' }}>No window.nostr detected on this origin.</div>
          )}
          {lastHint && <div style={{ color: '#9f1239' }}>{lastHint}</div>}
        </div>
      )}

      {status === 'error' && (
        <div style={{ fontSize: '0.9rem', color: '#ef4444' }}>
          {error ?? 'Unknown error checking signer'}
          {error === 'timeout' && (
            <div style={{ color: '#475569', marginTop: 4 }}>
              Extension may be waiting for permission — click request or allow in your NIP-07 wallet.
            </div>
          )}
          {error && (
            <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: 4 }}>
              Raw: {error}
            </div>
          )}
          {lastHint && <div style={{ color: '#9f1239', marginTop: 4 }}>{lastHint}</div>}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.1rem' }}>
        <button type="button" onClick={detect} style={{ padding: '0.4rem 0.75rem', borderRadius: 999, border: '1px solid #cbd5e1', background: '#fff' }}>
          Re-check
        </button>
        <button
          type="button"
          onClick={() => window.nostr?.getPublicKey && detect()}
          style={{ padding: '0.4rem 0.75rem', borderRadius: 999, border: '1px solid #cbd5e1', background: '#eef2ff' }}
        >
          Request permission
        </button>
        <button
          type="button"
          onClick={() => setDemoOff((v) => !v)}
          style={{ padding: '0.4rem 0.75rem', borderRadius: 999, border: '1px solid #cbd5e1', background: demoOff ? '#fee2e2' : '#fff' }}
        >
          {demoOff ? 'Show detected state' : 'Preview missing state'}
        </button>
        {lastCheckedAt && (
          <span style={{ fontSize: '0.85rem', color: '#475569' }}>
            Checked {new Date(lastCheckedAt).toLocaleTimeString()}
          </span>
        )}
      </div>
    </div>
  );
}

function safe<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}
