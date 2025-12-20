# Staging Lightning (LNbits + Voltage mutinynet)

## What’s running
- **LNbits** v1.3.1 in Azure Container Apps: `lnbits-stg-west.thankfulwater-904823f2.westus3.azurecontainerapps.io`
- **Funding source**: Voltage mutinynet LND (`satoshis.u.voltageapp.io:10009`)
- **Database**: Azure Postgres `nostrstack-pg-west`, DB name `lnbitsapp`
- **Storage**: AzureFile volume `lnbitsfs`

## Secrets & config (all in Key Vault `nostrstack-kv-west`)
- `lnbits-database-url` — postgres URL for LNbits
- `database-url` — prisma/database fallback URL
- `lnd-grpc-endpoint` — e.g. `satoshis.u.voltageapp.io:10009`
- `lnd-grpc-port` — `10009`
- `lnd-tls` — base64 TLS cert
- `lnd-macaroon-hex` — admin macaroon hex
- `lnd-macaroon` / `lnd-grpc-macaroon-b64` — base64 macaroon
- LNBITS uses `LNBITS_BACKEND_WALLET_CLASS=LndWallet`
- **Regtest-only flags**: keep `ENABLE_REGTEST_PAY` and `ENABLE_REGTEST_FUND` unset/false in staging/prod.

## First-install / admin
- First-install is **complete**. A superuser was created; if you need to reset, delete the DB or set `FIRST_INSTALL=true` and rerun `/first_install`.
- To create additional superusers, use `uv run lnbits-cli superuser` inside the container (or re-run first_install after resetting `first_install` flag).

## How to use (API smoke)
```sh
# 1) Log in via UI to grab an Admin key (adminkey) from your wallet.
# 2) Create an invoice (example, 1000 sats on mutinynet):
curl -s -X POST https://lnbits-stg-west.thankfulwater-904823f2.westus3.azurecontainerapps.io/api/v1/payments \
  -H "X-Api-Key: <ADMINKY>" \
  -H "Content-Type: application/json" \
  -d '{"out":false,"amount":1000,"memo":"smoke"}'
```
You should receive a BOLT11 and `status: pending`. Pay it from any mutinynet wallet.

### Health check (public)
```sh
curl -s https://lnbits-stg-west.thankfulwater-904823f2.westus3.azurecontainerapps.io/status/health
```
Returns funding backend name/error/balance; useful for probes/CI.

## Known warnings
- Binance price feed returns HTTP 451 (region blocked); invoices still work. We can switch to CoinGecko if noise is an issue.
- LND sometimes logs `invalid hash length of 1, want 32` on startup from the watcher; harmless so far.

## Admin/ops commands
- Deploy image: `az acr build -r nostrstackwestacr -t lnbits:stg -f deploy/lnbits/Dockerfile.azure .`
- Redeploy app: `az containerapp update -n lnbits-stg-west -g nostrstack-stg-west-rg --image nostrstackwestacr.azurecr.io/lnbits:stg --set-env-vars LNBITS_REV=<stamp>`
- Logs: `az containerapp logs show -n lnbits-stg-west -g nostrstack-stg-west-rg --tail 100`
