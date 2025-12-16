#!/usr/bin/env bash
set -euo pipefail
PORT=${MCP_CHROME_PORT:-9222}
PROFILE=${MCP_CHROME_PROFILE:-/tmp/chrome-mcp-profile}
DISABLE_EXTENSIONS=${MCP_CHROME_DISABLE_EXTENSIONS:-1}
ALLOW_INSECURE_LOCALHOST=${MCP_CHROME_ALLOW_INSECURE_LOCALHOST:-1}
IGNORE_CERT_ERRORS=${MCP_CHROME_IGNORE_CERT_ERRORS:-0}

ARGS=(--remote-debugging-port="${PORT}" --user-data-dir="${PROFILE}" --no-first-run --no-default-browser-check)
if [[ "${DISABLE_EXTENSIONS}" != "0" ]]; then
  ARGS+=(--disable-extensions)
fi
if [[ "${ALLOW_INSECURE_LOCALHOST}" != "0" ]]; then
  ARGS+=(--allow-insecure-localhost)
fi
if [[ "${IGNORE_CERT_ERRORS}" != "0" ]]; then
  ARGS+=(--ignore-certificate-errors)
fi

# Use a new Chrome instance so the remote debugging port is reliably enabled even if the user already has Chrome open.
open -na "Google Chrome" --args "${ARGS[@]}"
