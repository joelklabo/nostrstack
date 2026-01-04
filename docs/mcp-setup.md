# Chrome DevTools MCP setup (local demo)

## Install / run
- Start Chrome with remote debugging: `./scripts/mcp-chrome.sh` (defaults port 9222).
- Start the MCP server: `./scripts/mcp-devtools-server.sh` (wraps `chrome-devtools-mcp@0.12.1`).
- The server writes logs to `.logs/dev/mcp-devtools.log` by default (override with `MCP_DEVTOOLS_LOG_FILE`).
- If a server is already running, the script reuses it (set `MCP_DEVTOOLS_REUSE_EXISTING=0` to restart).

## Codex CLI (global MCP config)
Codex uses a global MCP server list. If your MCP tools fail, re-add the server entry and restart Codex:
```bash
codex mcp remove chrome-devtools
codex mcp add chrome-devtools -- npx -y chrome-devtools-mcp@0.12.1 --browserUrl=http://127.0.0.1:9222 --acceptInsecureCerts
```

### Troubleshooting: `Transport closed`
If Codex MCP tool calls fail with `Transport closed`:

1) Ensure Codex has the MCP client feature enabled in `~/.codex/config.toml`:
```toml
[features]
rmcp_client = true
```
Then restart Codex CLI.

2) Verify Chrome remote debugging is running:
- Start Chrome: `./scripts/mcp-chrome.sh`
- Verify the port: `lsof -nP -iTCP:9222 -sTCP:LISTEN`

3) Check the MCP server log: `.logs/dev/mcp-devtools.log`

4) Restart Codex after MCP config changes (add/remove) so the client reloads the server entry.

5) Ensure only one MCP server is running:
```bash
pgrep -fl chrome-devtools-mcp
```
If needed, restart the server with `MCP_DEVTOOLS_REUSE_EXISTING=0 ./scripts/mcp-devtools-server.sh`.

6) If the MCP command is configured with a relative path (e.g., `./node_modules/.bin/chrome-devtools-mcp`), Codex tool calls launched from a non-repo CWD can exit immediately with `Transport closed`. Prefer the `npx -y chrome-devtools-mcp@0.12.1` config (or an absolute path) so the server can spawn from any working directory.

7) Re-add the server entry (above) and restart Codex again.

## Client config (example)
```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@0.12.1", "--browserUrl=http://127.0.0.1:9222", "--acceptInsecureCerts"]
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
