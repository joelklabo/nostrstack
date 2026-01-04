# Chrome DevTools MCP — quick take

What it is: `chrome-devtools-mcp` is a Model Context Protocol (MCP) server that exposes a live Chrome instance (via DevTools protocol + Puppeteer) to an AI client. Lets a coding agent drive the browser, capture traces/screenshots/console, and inspect network activity.

Repo: https://github.com/ChromeDevTools/chrome-devtools-mcp
Install/run (per README):
```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@0.12.1"]
    }
  }
}
```
Pinned to 0.12.1 to match the repo dependency and avoid @latest drift.
Requires Chrome stable and Node ≥20.19. Connects to a browser (default 9222) and uses Puppeteer.

Usefulness for nostrstack:
- Could script full-browser demo/E2E flows (tip/pay/comments) with real DevTools captures, beyond Playwright, and keep traces/console/network for debugging Lightning/Nostr failures.
- Could run against staging/mainnet to collect HAR/trace on regressions.
- Security: MCP server exposes page data to the agent; avoid running against sensitive sessions.

Next steps (if we adopt):
1) Prototype running it locally with our demo (localhost:4173) to capture trace + screenshot of invoice flow.
2) Decide whether to keep this in dev-only tooling; do not expose in CI without sandboxing.
3) If valuable, add a short how-to in docs/devtools-mcp.md and a script to launch Chrome with `--remote-debugging-port=9222` plus `npx chrome-devtools-mcp`.
