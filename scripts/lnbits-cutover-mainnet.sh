#!/usr/bin/env bash
set -euo pipefail

# Cut over LNbits prod to mainnet with preflight checks.
# Prereqs:
#   - az CLI installed + logged in, correct subscription set
#   - Key Vault secrets populated with mainnet values:
#       lnd-mainnet-endpoint       (host:port)
#       lnd-mainnet-macaroon-hex   (admin macaroon hex)
#       lnd-mainnet-tls            (PEM cert content)
#   - Container App name: lnbits-prod-west in RG: satoshis-stg-west-rg
#
# Usage:
#   ./scripts/lnbits-cutover-mainnet.sh --rev 20251202a
# Options:
#   --rev|-r <tag>     Revision stamp to set on LNBITS_REV (required)
#   --kv <name>        Key Vault name (default: satoshis-kv-west)
#   --rg <name>        Resource group (default: satoshis-stg-west-rg)
#   --app <name>       Container App name (default: lnbits-prod-west)
#   --network <net>    LND network to apply (mainnet|signet, default: mainnet)
#   --url <url>        LNbits base URL for post-update health hint
#   --dry-run          Skip the update, just run preflight

REV=""
KV="satoshis-kv-west"
RG="satoshis-stg-west-rg"
APP="lnbits-prod-west"
NETWORK="mainnet"
URL="${LNBITS_URL:-https://lnbits-prod-west.thankfulwater-904823f2.westus3.azurecontainerapps.io}"
DRY_RUN=0

usage() {
  grep '^# ' "$0" | sed 's/^# //'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -r|--rev)
      REV="$2"; shift 2 ;;
    --kv)
      KV="$2"; shift 2 ;;
    --rg)
      RG="$2"; shift 2 ;;
    --app)
      APP="$2"; shift 2 ;;
    --network)
      NETWORK="$2"; shift 2 ;;
    --url)
      URL="$2"; shift 2 ;;
    --dry-run)
      DRY_RUN=1; shift ;;
    -h|--help)
      usage; exit 0 ;;
    *)
      echo "Unknown arg: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ -z "$REV" ]]; then
  echo "REV tag required (e.g., 20251202a)" >&2
  exit 1
fi

if [[ "$NETWORK" != "mainnet" && "$NETWORK" != "signet" ]]; then
  echo "NETWORK must be mainnet or signet" >&2
  exit 1
fi

command -v az >/dev/null || { echo "az CLI is required" >&2; exit 1; }
echo "Checking Azure login..." >&2
az account show >/dev/null

echo "Preflight: verifying Key Vault secrets in $KV" >&2
missing=0
for secret in lnd-mainnet-endpoint lnd-mainnet-macaroon-hex lnd-mainnet-tls; do
  len=$(az keyvault secret show --vault-name "$KV" --name "$secret" --query value -o tsv 2>/dev/null | wc -c | tr -d ' ' || true)
  if [[ -z "$len" || "$len" -eq 0 ]]; then
    echo "  ✖ $secret missing" >&2
    missing=1
  else
    echo "  ✓ $secret present (${len} bytes)" >&2
  fi
done
if [[ "$missing" -ne 0 ]]; then
  echo "Populate Key Vault secrets before cutover" >&2
  exit 1
fi

echo "Fetching current container env for $APP..." >&2
current_network=$(az containerapp show -g "$RG" -n "$APP" --query "properties.template.containers[0].env[?name=='LND_NETWORK'].value" -o tsv 2>/dev/null || true)
current_rev=$(az containerapp show -g "$RG" -n "$APP" --query "properties.template.containers[0].env[?name=='LNBITS_REV'].value" -o tsv 2>/dev/null || true)
echo "  Current LND_NETWORK=${current_network:-unknown}, LNBITS_REV=${current_rev:-unset}" >&2

echo "Updating $APP to NETWORK=$NETWORK, REV=$REV" >&2
if [[ "$DRY_RUN" -eq 0 ]]; then
  az containerapp update \
    --resource-group "$RG" \
    --name "$APP" \
    --set-env-vars \
      LND_NETWORK="$NETWORK" \
      LNBITS_REV="$REV"
  echo "Update triggered. Tail logs to watch rollout:" >&2
  echo "  az containerapp logs show -n $APP -g $RG --type console --tail 200" >&2
else
  echo "DRY RUN: skipped az containerapp update" >&2
fi

echo "Post-update health probe (once rollout is healthy):" >&2
echo "  curl -s ${URL%/}/status/health" >&2
echo "Prod smoke (requires LNBITS_PROD_ADMIN_KEY):" >&2
echo "  pnpm --filter api test:lnbits-prod" >&2
