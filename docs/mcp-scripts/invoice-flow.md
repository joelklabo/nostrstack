# MCP script: invoice flow (regtest)

1. Launch Chrome debug:
   ```sh
   ./scripts/mcp/chrome.sh
   ```
2. Start MCP server:
   ```sh
   npx -y chrome-devtools-mcp@0.12.1 --browser-url=http://127.0.0.1:9222 (pinned to match repo dependency)
   ```
3. In your MCP client, run DevTools actions:
   - Open http://localhost:4173
   - Click "Send sats" (tip button).
   - Wait for invoice popover; read BOLT11 text from `<pre>` inside popover.
   - Save it as `invoice` variable.
   - Copy the `provider_ref` field from the POST /api/pay response JSON (needed to poll status).
   - Take screenshot of popover.
4. Pay via regtest payer (shell):
   ```sh
   docker compose -f deploy/regtest/docker-compose.yml exec lnd-payer \
     lncli --network=regtest --lnddir=/data --rpcserver=lnd-payer:10010 \
     --macaroonpath=/data/data/chain/bitcoin/regtest/admin.macaroon \
     --tlscertpath=/data/tls.cert payinvoice --force "$invoice"
   ```
5. In DevTools, poll `/api/lnurlp/pay/status/<provider_ref>`:
   - Use `fetch` in console:
     ```js
     await (await fetch(`/api/lnurlp/pay/status/${provider_ref}`)).json();
     ```
   - Assert `status === 'PAID'`. If not paid after 20s, flag failure.
   - Capture the Network request showing 200 + status=PAID.
6. Export trace/screenshot for evidence.
