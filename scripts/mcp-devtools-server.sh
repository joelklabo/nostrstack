#!/usr/bin/env bash
set -euo pipefail
# Run Chrome DevTools MCP server against the locally debug-enabled Chrome (default 9222).
exec npx -y chrome-devtools-mcp@latest \
  --browserUrl="${BROWSER_URL:-http://127.0.0.1:9222}" \
  --acceptInsecureCerts \
  "$@"
