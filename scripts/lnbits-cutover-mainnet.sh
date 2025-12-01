#!/usr/bin/env bash
set -euo pipefail

# Cut over LNbits prod to mainnet.
# Prereqs:
#   - az CLI logged in, correct subscription set
#   - Key Vault secrets already populated with mainnet values:
#       lnd-mainnet-endpoint       (host:port)
#       lnd-mainnet-macaroon-hex   (admin macaroon hex)
#       lnd-mainnet-tls            (PEM cert content)
#   - Container App name: lnbits-prod-west in RG: nostrstack-stg-west-rg
#   - Image already pushed (we reuse current tag)
#
# Usage:
#   ./scripts/lnbits-cutover-mainnet.sh <REV_TAG>
# Example:
#   ./scripts/lnbits-cutover-mainnet.sh 20251201a
#

REV="${1:-}"
if [ -z "$REV" ]; then
  echo "REV tag required (e.g., 20251201a)" >&2
  exit 1
fi

RG="nostrstack-stg-west-rg"
APP="lnbits-prod-west"

echo "Setting LND_NETWORK=mainnet and bumping LNBITS_REV=${REV} on ${APP}..."

az containerapp update \
  --resource-group "$RG" \
  --name "$APP" \
  --set-env-vars \
    LND_NETWORK=mainnet \
    LNBITS_REV="$REV"

echo "Triggering rollout complete. Check logs:"
echo "  az containerapp logs show -n $APP -g $RG --type console --tail 200"
echo "Health check:"
echo "  curl -s https://lnbits-prod-west.thankfulwater-904823f2.westus3.azurecontainerapps.io/status/health"
