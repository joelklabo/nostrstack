#!/usr/bin/env bash
set -euo pipefail

# Helper to configure Voltage LND secrets in Azure Key Vault for Mainnet cutover.
# Usage: ./scripts/voltage-setup.sh [VOLTAGE_API_KEY]

VOLTAGE_KEY="${1:-}"
KV="satoshis-kv-west"

if [[ -z "$VOLTAGE_KEY" ]]; then
  echo "Enter your Voltage Platform API Key (or pass as argument):"
  read -r VOLTAGE_KEY
fi

if [[ -z "$VOLTAGE_KEY" ]]; then
  echo "Error: Voltage API Key required."
  exit 1
fi

echo "Fetching nodes from Voltage..."
NODES=$(curl -s -H "X-VOLTAGE-AUTH: $VOLTAGE_KEY" https://api.voltage.cloud/v1/nodes)

# Check for auth error
if echo "$NODES" | grep -q "Unauthorized"; then
  echo "Error: Invalid Voltage API Key."
  exit 1
fi

echo "Found nodes:"
echo "$NODES" | jq -r '.nodes[] | "  - \(.name) (\(.network)) ID: \(.id)"'

echo ""
echo "Enter the ID of the MAINNET node to use:"
read -r NODE_ID

NODE_INFO=$(curl -s -H "X-VOLTAGE-AUTH: $VOLTAGE_KEY" "https://api.voltage.cloud/v1/nodes/$NODE_ID")
ENDPOINT=$(echo "$NODE_INFO" | jq -r '.node_api_url' | sed 's/https:\/\///' | sed 's/:8080/:10009/') # Convert REST to gRPC port

if [[ -z "$ENDPOINT" || "$ENDPOINT" == "null" ]]; then
  echo "Error: Could not retrieve endpoint for node $NODE_ID"
  exit 1
fi

echo ""
echo "✅ Resolved Endpoint: $ENDPOINT"
echo ""
echo "For security, the Admin Macaroon and TLS Cert cannot be fetched via API for existing nodes."
echo "Please retrieve them from the Voltage Dashboard (Connect > Admin Macaroon / TLS Cert)."
echo ""

echo "Enter Admin Macaroon (HEX format):"
read -r MACAROON

echo "Enter TLS Certificate (PEM format - paste content, press Ctrl+D when done):"
TLS_CERT=$(cat)

echo ""
echo "Setting secrets in Azure Key Vault ($KV)..."

az keyvault secret set --vault-name "$KV" --name "lnd-mainnet-endpoint" --value "$ENDPOINT" >/dev/null
echo "Updated lnd-mainnet-endpoint"

az keyvault secret set --vault-name "$KV" --name "lnd-mainnet-macaroon-hex" --value "$MACAROON" >/dev/null
echo "Updated lnd-mainnet-macaroon-hex"

az keyvault secret set --vault-name "$KV" --name "lnd-mainnet-tls" --value "$TLS_CERT" >/dev/null
echo "Updated lnd-mainnet-tls"

echo ""
echo "🎉 Setup complete! You can now run:"
echo "  ./scripts/lnbits-cutover-mainnet.sh --rev <tag>"
