#!/usr/bin/env bash
set -euo pipefail

# Create basic scheduled-query alerts for LNbits prod.
#
# Required:
#   - az CLI logged in, correct subscription set
#   - Log Analytics workspace resource ID
#   - Action Group resource ID (for notifications)
#
# Usage:
#   RG=nostrstack-stg-west-rg \
#   WORKSPACE_ID="/subscriptions/<sub>/resourceGroups/.../providers/Microsoft.OperationalInsights/workspaces/<ws>" \
#   ACTION_GROUP_ID="/subscriptions/<sub>/resourceGroups/.../providers/microsoft.insights/actionGroups/<ag>" \
#   APP=lnbits-prod-west \
#   LOCATION=westus3 \
#   ./deploy/azure/observability/create-alerts.sh
#

: "${RG:?Resource group RG required}"
: "${WORKSPACE_ID:?Log Analytics WORKSPACE_ID required}"
: "${ACTION_GROUP_ID:?Action Group ACTION_GROUP_ID required}"

APP="${APP:-lnbits-prod-west}"
LOCATION="${LOCATION:-westus3}"

echo "Using RG=$RG"
echo "Workspace=$WORKSPACE_ID"
echo "Action Group=$ACTION_GROUP_ID"
echo "App=$APP, Location=$LOCATION"

# Alert 1: Console errors >0 in 5m
az monitor scheduled-query create \
  --resource-group "$RG" \
  --name "lnbits-${APP}-errors" \
  --description "LNbits console errors detected" \
  --location "$LOCATION" \
  --scopes "$WORKSPACE_ID" \
  --enabled true \
  --evaluation-frequency 5m \
  --window-size 5m \
  --condition "count 'ContainerAppConsoleLogs | where ContainerAppName == \"${APP}\" | where Log_s has_any (\"ERROR\", \"Exception\")' > 0" \
  --action-groups "$ACTION_GROUP_ID" \
  --severity 2 \
  --auto-mitigate true

# Alert 2: Container restarts >0 in 10m
az monitor scheduled-query create \
  --resource-group "$RG" \
  --name "lnbits-${APP}-restarts" \
  --description "LNbits container restart observed" \
  --location "$LOCATION" \
  --scopes "$WORKSPACE_ID" \
  --enabled true \
  --evaluation-frequency 10m \
  --window-size 10m \
  --condition "count 'ContainerAppSystemLogs | where ContainerAppName == \"${APP}\" | where Log_s has \"Restarting\"' > 0" \
  --action-groups "$ACTION_GROUP_ID" \
  --severity 2 \
  --auto-mitigate true

echo "Created alerts: lnbits-${APP}-errors, lnbits-${APP}-restarts"
