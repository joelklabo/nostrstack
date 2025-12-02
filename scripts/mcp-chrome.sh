#!/usr/bin/env bash
set -euo pipefail
PORT=${MCP_CHROME_PORT:-9222}
PROFILE=${MCP_CHROME_PROFILE:-/tmp/chrome-mcp-profile}
open -a "Google Chrome" --args --remote-debugging-port=${PORT} --user-data-dir=${PROFILE} --no-first-run --no-default-browser-check
