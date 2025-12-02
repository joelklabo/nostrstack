import React from 'react';

import { CopyButton } from './CopyButton';

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
          Open LNbits UI:&nbsp;
          <a href={lnbitsUrl} target="_blank" rel="noreferrer">{lnbitsUrl}</a>
          <span style={{ marginLeft: '0.5rem' }}>
            <CopyButton text={lnbitsUrl} label="Copy URL" />
          </span>
        </li>
        <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span>Admin key: <code>{adminKey}</code></span>
          <CopyButton text={adminKey} label="Copy key" />
        </li>
        <li>
          Need funds? Click <em>Fund regtest wallet</em> above or POST <code>/regtest/fund</code> (mines coins + opens an outbound channel for spending).
        </li>
        <li>
          Create a wallet inside LNbits, then use its Admin key in the widgets (username defaults to the wallet name).
        </li>
      </ul>
    </div>
  );
}
