# Lightning Observability (prod)

Workspace: `workspace-nostrstackstgwestrg83os` (Log Analytics, westus3).

Sources already flowing
- ACA managed environment (`nostrstack-env-stg-west`): `ContainerAppConsoleLogs`, `ContainerAppSystemLogs`, `AllMetrics`.
- Postgres `nostrstack-pg-west`: metrics + logs (existing diagnostic setting `pg-all`).

Useful KQL snippets
- LNbits prod app logs (latest errors):
  ```
  ContainerAppConsoleLogs
  | where ContainerAppName == "lnbits-prod-west"
  | where Log_s contains "ERROR" or Log_s contains "WARNING"
  | project TimeGenerated, Log_s
  | order by TimeGenerated desc
  | take 200
  ```
- LNbits startup/health timeline:
  ```
  ContainerAppConsoleLogs
  | where ContainerAppName == "lnbits-prod-west"
  | where Log_s has_any ("LNbits started", "Backend LndWallet", "Application startup complete")
  | project TimeGenerated, Log_s
  | order by TimeGenerated desc
  ```
- Container restarts / OOM:
  ```
  ContainerAppSystemLogs
  | where ContainerAppName == "lnbits-prod-west"
  | where Log_s has_any ("Restarting", "OOM")
  | project TimeGenerated, Log_s
  | order by TimeGenerated desc
  ```
- Health check latency (from metrics):
  ```
  AzureMetrics
  | where Resource == "lnbits-prod-west"
  | where MetricName == "IngressRequestDuration"
  | summarize p95LatencyMs=percentile(Total, 95) by bin(TimeGenerated, 5m)
  | order by TimeGenerated desc
  ```
- Postgres connections vs CPU:
  ```
  AzureMetrics
  | where Resource == "nostrstack-pg-west"
  | where MetricName in ("cpu_percent", "connections")
  | summarize avgVal=avg(Total) by MetricName, bin(TimeGenerated, 5m)
  | render timechart
  ```
- LNbits payment failures (watcher noise filter):
  ```
  ContainerAppConsoleLogs
  | where ContainerAppName == "lnbits-prod-west"
  | where Log_s has "Unable to connect" or Log_s has "invalid hash length"
  | summarize count() by bin(TimeGenerated, 15m)
  | order by TimeGenerated desc
  ```

Regtest zap signals (dev)
- API logs include `regtest pay invoice settled` with `invoicePrefix`, `paymentHash`, and `feesSat` for successful regtest pays.
- `ws/pay` broadcasts emit `invoice-paid` with `source: "regtest"` and any stored `metadata` (NIP-57 zap request) when available.
- Disabled regtest pay returns 404 with `regtest_pay_disabled`, which should be visible in local API logs.

Alert ideas (configure in Azure Portal)
- LNbits health redirect/5xx: HTTP probe on `/status/health` expecting 200 JSON; alert if failed for 5 minutes.
- Container restarts: `ContainerAppSystemLogs` with `Restarting` count > 0 in 10 minutes.
- Latency: p95 `IngressRequestDuration` > 2000 ms for 10 minutes.
- Postgres CPU > 70% for 10 minutes; connections > 80% of limit.

Automation helpers
- Create alert rules via CLI: `deploy/azure/observability/create-alerts.sh` (requires `WORKSPACE_ID` and `ACTION_GROUP_ID`).
- Switch LNbits to mainnet: `scripts/lnbits-cutover-mainnet.sh <rev>` after populating `lnd-mainnet-*` secrets.
- Workbook template: `deploy/azure/observability/workbook-lnbits.json` (import in Log Analytics Workbook gallery; parameters: `app` name, timespan).
- CI smokes: regtest Playwright uses `NODE_OPTIONS=--no-experimental-strip-types`; mutinynet/staging smoke should use `scripts/lnbits-smoke.sh` (accepts 200/201).
- Secrets for CI mutinynet smoke: add `LNBITS_STG_ADMIN_KEY` to repo secrets (staging admin key from KV).
- Payer e2e (optional): set `LNBITS_URL` and `LNBITS_ADMIN_KEY` to allow pay-to-act tests to execute full settlement path in CI.

Notes
- Current funding backend is Voltage mutinynet (signet). When switching to mainnet, keep the same workspace/queries; watch for new error patterns (macaroon/cert issues).
- All diagnostic settings are in RG `satoshis-stg-west-rg`; adjust if a prod RG is added later.
