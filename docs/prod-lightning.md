# Prod Lightning (LNbits + Voltage)

## What’s running
- **LNbits** v1.3.1 in Azure Container Apps: `lnbits-prod-west.thankfulwater-904823f2.westus3.azurecontainerapps.io`
- **Funding source**: Voltage LND (currently mutinynet/signet) at `satoshis.u.voltageapp.io:10009`
- **Database**: Azure Postgres `nostrstack-pg-west`, DB `lnbitsprod` (user `nostrstack`, pass stored in KV)
- **Storage**: container-local (/data) – no Azure Files

## Secrets (Key Vault `nostrstack-kv-west`)
- `lnbits-prod-database-url` – postgres://nostrstack:Poop7037X%21Z@nostrstack-pg-west.postgres.database.azure.com:5432/lnbitsprod?sslmode=require
- `database-url-prod` – same as above for Prisma/overrides
- `lnd-mainnet-endpoint` – `satoshis.u.voltageapp.io:10009`
- `lnd-mainnet-macaroon-hex` – admin macaroon hex from Voltage (mutinynet)
- `lnd-mainnet-tls` – PEM TLS cert for the node
- Admin creds (UI): `lnbits-prod-admin-user`, `lnbits-prod-admin-password`

## Container app config (`lnbits-prod-west`)
- Env: `LNBITS_BACKEND_WALLET_CLASS=LndWallet`, `LND_NETWORK=signet` by default (set to `mainnet` on cutover), `LND_GRPC_PORT=10009`
- Secrets wired via secretrefs above; image `${acrServer}/lnbits:${imageTag}` (Bicep params `network`, `imageTag`, `rev`)
- Health: `curl -s https://lnbits-prod-west.thankfulwater-904823f2.westus3.azurecontainerapps.io/status/health`

## Runbook
1) **Rotate DB password** (if needed): `az postgres flexible-server update -g nostrstack-stg-west-rg -n nostrstack-pg-west --admin-password '<new>'`, then update KV `lnbits-prod-database-url` + `database-url-prod` and redeploy with a new `LNBITS_REV` stamp.
2) **Swap LND to mainnet**:
   - Update KV secrets `lnd-mainnet-endpoint`, `lnd-mainnet-macaroon-hex`, `lnd-mainnet-tls` with mainnet values (preflight will verify presence).
   - Preferred: deploy Bicep with `network=mainnet imageTag=stg rev=<stamp>` or run the helper: `./scripts/lnbits-cutover-mainnet.sh --rev <stamp>` (preflight checks KV + current env, then flips `LND_NETWORK` and bumps `LNBITS_REV`).
   - Check logs: `az containerapp logs show -n lnbits-prod-west -g nostrstack-stg-west-rg --type console --tail 100`
   - Confirm: `/status/health` returns `funding_source=LndWallet` and non-null balance/error.
3) **Admin access**: use KV secrets above; reset via UI `/wallet` or CLI `uv run lnbits-cli superuser` inside the container (needs `az containerapp exec` from a TTY-enabled shell).
4) **Smoke tests**:
   - Health: see above.
   - Create invoice (needs Admin API key from UI): `curl -s -X POST $LNBITS_URL/api/v1/payments -H "X-Api-Key: $ADMINKEY" -H 'Content-Type: application/json' -d '{"out":false,"amount":1000,"memo":"prod-smoke"}'`
   - Pay from a matching network wallet (mutinynet now; mainnet after cut-over) and poll `/api/v1/payments/{id}`.

## Notes
- DB was recreated on 2025-11-30 so settings come from env; first-install finished (no redirect). Balance currently 0 on mutinynet; expected `invalid hash length of 1` warning on startup (harmless watcher noise from LND).
- Postgres firewall already includes Container App outbound IPs; public IPs must be added manually for local psql access.
