import { useEffect, useState } from 'react';

type Props = {
  npub?: string | null;
  hasSigner: boolean;
};

export function Nip07Status({ npub, hasSigner }: Props) {
  const [ready, setReady] = useState(hasSigner);

  useEffect(() => {
    setReady(hasSigner);
  }, [hasSigner]);

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '0.75rem', background: '#f8fafc' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
        <span style={{ width: 10, height: 10, borderRadius: 999, background: ready ? '#22c55e' : '#f97316', boxShadow: ready ? '0 0 0 6px rgba(34,197,94,0.2)' : 'none' }} />
        <strong>{ready ? 'NIP-07 signer detected' : 'No NIP-07 signer'}</strong>
      </div>
      {ready ? (
        <div style={{ fontSize: '0.9rem', color: '#475569' }}>
          Pubkey: <code>{npub ?? 'unknown'}</code>
        </div>
      ) : (
        <div style={{ fontSize: '0.9rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span>Tips to enable:</span>
          <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
            <li>Install Alby or nos2x</li>
            <li>Enable the extension and refresh</li>
            <li>Use mock relays if you just want local posts</li>
          </ul>
        </div>
      )}
    </div>
  );
}

