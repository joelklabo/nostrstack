# Chrome DevTools MCP setup (local demo)

## Install
- Start Chrome with remote debugging: `./scripts/mcp-chrome.sh` (defaults port 9222).
- Run MCP server: `npx -y chrome-devtools-mcp@latest --browser-url=http://127.0.0.1:9222`.

## Client config (example)
```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest", "--browser-url=http://127.0.0.1:9222"]
    }
  }
}
```

## Targets
- Demo UI: http://localhost:4173
- API: http://localhost:3001

## Usage tips
- Use MCP tools to: open page, click buttons, capture screenshots, read console/network, run JS snippets.
- Combine with regtest payer: `docker compose -f deploy/regtest/docker-compose.yml exec lnd-payer lncli ... payinvoice <bolt11>`.
- Nostr real relays: set relays field to `wss://relay.damus.io` and have NIP-07 signer enabled in the debug profile.

## Verification flows (to script in child tasks)
- Tip: generate invoice, pay via regtest payer, confirm status PAID via network/console.
- Comment: post to real relay, confirm event emitted (relay subscription) and UI shows it.
- Capture: take screenshot + export trace for each flow.
