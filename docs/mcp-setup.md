# Chrome DevTools MCP setup (local demo)

## Install / run
- Start Chrome with remote debugging: `./scripts/mcp-chrome.sh` (defaults port 9222).
- Start the MCP server: `./scripts/mcp-devtools-server.sh` (wraps `chrome-devtools-mcp@latest`).

## Codex CLI (global MCP config)
Codex uses a global MCP server list. If your MCP tools fail, re-add the server entry and restart Codex:
```bash
codex mcp remove chrome-devtools
codex mcp add chrome-devtools -- npx -y chrome-devtools-mcp@latest --browserUrl=http://127.0.0.1:9222 --acceptInsecureCerts
```

## Client config (example)
```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest", "--browserUrl=http://127.0.0.1:9222", "--acceptInsecureCerts"]
    }
  }
}
```
You can also copy `mcp.config.json` from the repo root into your MCP client config location (e.g., `~/.config/claude/claude_desktop_config.json` or `~/Library/Application Support/Code/User/globalStorage/mcp.json`) and merge it.

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
