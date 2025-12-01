# @satoshis/sdk

Typed client for the nostrstack API.

## Install
```sh
npm install @satoshis/sdk
# or
pnpm add @satoshis/sdk
```

## Usage
```ts
import { SatoshisClient } from '@satoshis/sdk';

const client = new SatoshisClient({
  host: 'api.satoshis.lol', // or baseURL if full
  apiKey: 'your-admin-key'
});

// Health
await client.health();

// LNURL pay metadata and invoice
const meta = await client.getLnurlpMetadata('alice');
const invoice = await client.getLnurlpInvoice('alice', 1000);

// NIP-05
const nip05 = await client.getNip05('alice', 'example.com');

// Admin create tenant/user
await client.createTenant({ domain: 'example.com', displayName: 'Example' });
await client.createUser({ tenantId: 'tenant-id', pubkey: 'npub1...' });
```

## Auth
- Tenant/user endpoints may be open depending on deployment.
- Admin endpoints require `ADMIN_API_KEY` set server-side; pass as `apiKey`.
