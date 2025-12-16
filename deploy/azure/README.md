# Azure deployment (nostrstack.com)

This folder provides a thin starting point for deploying the API to Azure Container Apps with Azure Database for PostgreSQL Flexible Server and Key Vault.

## Outline

1. Build/push container image (e.g. GHCR `ghcr.io/yourorg/nostrstack-api:latest`).
2. Deploy infra via Bicep (`main.bicep`) – creates:
   - Container Apps environment + container app for the API
   - Postgres Flexible Server + firewall allowing Container Apps
   - Key Vault with secrets for DB URL, admin key, OpenNode keys
3. Configure custom domains/ingress and point DNS per tenant domains.

## Quick start

```bash
# assumes az login + correct subscription
az group create -n nostrstack-rg -l eastus
az deployment group create \
  -g nostrstack-rg \
  -f main.bicep \
  -p containerImage=ghcr.io/yourorg/nostrstack-api:latest adminApiKey=change-me opNodeApiKey=change-me opNodeWebhookSecret=change-me
```

Parameters (see `main.bicep`):

- `containerImage`: full image ref
- `location`: default `eastus`
- `postgresSku`: default `Standard_B1ms`
- `adminApiKey`, `opNodeApiKey`, `opNodeWebhookSecret`: secrets pushed into Key Vault
- `otelEnabled` (bool, default false), `otelEndpoint` (OTLP HTTP), `otelHeaders` (comma-separated key=value) if you want OTEL trace/metrics export
- `logAnalyticsWorkspaceId`, `logAnalyticsSharedKey` (optional) to enable Azure Log Analytics for app/environment logs

After deploy:

- Fetch container app FQDN: `az containerapp show -n nostrstack-api -g nostrstack-rg -o tsv --query properties.configuration.ingress.fqdn`
- Set DNS for tenant domains to this host (or front with Azure Front Door/Ingress if desired).
- Run Prisma migrations against the Postgres connection string from Key Vault before first start (or during startup). The CI workflow already demonstrates `db push` for Postgres.

## GitHub Actions pipeline

`.github/workflows/azure-deploy.yml` builds/pushes a container (GHCR) and deploys `main.bicep` via `az deployment group create`.

Required GitHub secrets:

- `AZURE_CREDENTIALS` – JSON from `az ad sp create-for-rbac --sdk-auth` (must allow Container Apps + Key Vault + Postgres + RG write)
- `ADMIN_API_KEY`, `OP_NODE_API_KEY`, `OP_NODE_WEBHOOK_SECRET`

Defaults:

- Resource group `nostrstack-rg`, location `eastus`, image tag = commit SHA. Override via workflow_dispatch input `image_tag` and envs in the workflow if desired.
- Registry: GHCR. Container Apps auth uses `registryUsername=github.actor` and `registryPassword=GITHUB_TOKEN`; switch to ACR by passing `registryServer/registryUsername/registryPassword` inputs/secrets.
