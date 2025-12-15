#!/usr/bin/env bash
set -euo pipefail
PORT=${MCP_CHROME_PORT:-9222}
PROFILE=${MCP_CHROME_PROFILE:-/tmp/chrome-mcp-profile}
DISABLE_EXTENSIONS=${MCP_CHROME_DISABLE_EXTENSIONS:-1}

ARGS=(--remote-debugging-port="${PORT}" --user-data-dir="${PROFILE}" --no-first-run --no-default-browser-check)
if [[ "${DISABLE_EXTENSIONS}" != "0" ]]; then
  ARGS+=(--disable-extensions)
fi

open -a "Google Chrome" --args "${ARGS[@]}"
