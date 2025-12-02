# MCP script: invoice flow (regtest)

1) Launch Chrome debug:
   ```sh
   ./scripts/mcp-chrome.sh
   ```
2) Start MCP server:
   ```sh
   npx -y chrome-devtools-mcp@latest --browser-url=http://127.0.0.1:9222
   ```
3) In your MCP client, run DevTools actions:
   - Open http://localhost:4173
   - Click "Send sats" (tip button).
   - Wait for invoice popover; read BOLT11 text from `<pre>` inside popover.
   - Save it as `invoice` variable.
   - Take screenshot of popover.
4) Pay via regtest payer (shell):
   ```sh
   docker compose -f deploy/regtest/docker-compose.yml exec lnd-payer \
     lncli --network=regtest --lnddir=/data --rpcserver=lnd-payer:10010 \
     --macaroonpath=/data/data/chain/bitcoin/regtest/admin.macaroon \
     --tlscertpath=/data/tls.cert payinvoice --force "$invoice"
   ```
5) In DevTools, poll `/api/lnurlp/pay/status/<provider_ref>`:
   - Capture network log; expect status=PAID.
6) Export trace/screenshot for evidence.
