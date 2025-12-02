import { useCallback, useEffect, useState } from 'react';
import { nip19 } from 'nostr-tools';

type Props = {
  npub?: string | null;
  hasSigner?: boolean;
};

type Status = 'checking' | 'ready' | 'missing' | 'error';

export function Nip07Status({ npub, hasSigner }: Props) {
  const [status, setStatus] = useState<Status>('checking');
  const [detectedNpub, setDetectedNpub] = useState<string | null>(npub ?? null);
  const [demoOff, setDemoOff] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detect = useCallback(async () => {
    if (demoOff) {
      setStatus('missing');
      setError(null);
      return;
    }
    if (typeof window === 'undefined' || !window.nostr?.getPublicKey) {
      setStatus('missing');
      setError(null);
      return;
    }

    setStatus('checking');
    setError(null);
    try {
      const pub = await Promise.race([
        window.nostr.getPublicKey(),
        new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
      ]);
      const encoded = safe(() => nip19.npubEncode(pub)) ?? pub;
      setDetectedNpub(encoded);
      setStatus('ready');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  }, [demoOff]);

  useEffect(() => {
    detect();
  }, [detect, hasSigner]);

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
        <div style={{ fontSize: '0.9rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span>Pubkey:</span>
          <code style={{ background: '#fff', padding: '0.25rem 0.45rem', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            {npub ?? detectedNpub ?? 'unknown'}
          </code>
        </div>
      )}

      {status === 'missing' && (
        <div style={{ fontSize: '0.9rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span>Tips to enable:</span>
          <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
            <li>Install Alby or nos2x</li>
            <li>Enable the extension and refresh</li>
            <li>Use mock relays if you just want local posts</li>
          </ul>
        </div>
      )}

      {status === 'error' && (
        <div style={{ fontSize: '0.9rem', color: '#ef4444' }}>
          {error ?? 'Unknown error checking signer'}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.1rem' }}>
        <button type="button" onClick={detect} style={{ padding: '0.4rem 0.75rem', borderRadius: 999, border: '1px solid #cbd5e1', background: '#fff' }}>
          Re-check
        </button>
        <button
          type="button"
          onClick={() => setDemoOff((v) => !v)}
          style={{ padding: '0.4rem 0.75rem', borderRadius: 999, border: '1px solid #cbd5e1', background: demoOff ? '#fee2e2' : '#fff' }}
        >
          {demoOff ? 'Show detected state' : 'Preview missing state'}
        </button>
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
