import React from 'react';

export function WalletPanel({
  lnbitsUrl,
  adminKey,
  visible = true
}: {
  lnbitsUrl: string;
  adminKey: string;
  visible?: boolean;
}) {
  if (!visible) return null;
  return (
    <div style={{ padding: '0.75rem 1rem', background: '#eef2ff', borderRadius: 10, marginBottom: '1rem', color: '#1e1b4b' }}>
      <strong>Test wallet (LNbits regtest)</strong>
      <ul style={{ marginTop: '0.5rem', paddingLeft: '1.2rem' }}>
        <li>
          Open LNbits UI: <a href={lnbitsUrl} target="_blank" rel="noreferrer">{lnbitsUrl}</a>
        </li>
        <li>Admin key: <code>{adminKey}</code></li>
        <li>
          Need funds? Run <code>./scripts/regtest-fund.sh</code> (mines coins + opens outbound channel for spending).
        </li>
        <li>
          Create a wallet inside LNbits, then use its Admin key in the widgets (username defaults to the wallet name).
        </li>
      </ul>
    </div>
  );
}
