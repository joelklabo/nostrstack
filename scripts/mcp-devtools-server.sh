#!/usr/bin/env bash
set -euo pipefail
# Run Chrome DevTools MCP server against the locally debug-enabled Chrome (default 9222).
if [[ -x "./node_modules/.bin/chrome-devtools-mcp" ]]; then
  exec ./node_modules/.bin/chrome-devtools-mcp \
    --browserUrl="${BROWSER_URL:-http://127.0.0.1:9222}" \
    --acceptInsecureCerts \
    "$@"
fi

if command -v pnpm >/dev/null 2>&1; then
  exec pnpm exec chrome-devtools-mcp \
    --browserUrl="${BROWSER_URL:-http://127.0.0.1:9222}" \
    --acceptInsecureCerts \
    "$@"
fi

exec npx -y chrome-devtools-mcp@latest \
  --browserUrl="${BROWSER_URL:-http://127.0.0.1:9222}" \
  --acceptInsecureCerts \
  "$@"
