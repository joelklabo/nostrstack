#!/usr/bin/env bash
set -euo pipefail
# Run Chrome DevTools MCP server against the locally debug-enabled Chrome (default 9222).
exec npx -y chrome-devtools-mcp@latest --browser-url=${BROWSER_URL:-http://127.0.0.1:9222}
