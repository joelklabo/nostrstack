#!/usr/bin/env bash
set -euo pipefail
PORT=${MCP_CHROME_PORT:-9222}
PROFILE=${MCP_CHROME_PROFILE:-/tmp/chrome-mcp-profile-${PORT}}
DISABLE_EXTENSIONS=${MCP_CHROME_DISABLE_EXTENSIONS:-1}
ALLOW_INSECURE_LOCALHOST=${MCP_CHROME_ALLOW_INSECURE_LOCALHOST:-1}
IGNORE_CERT_ERRORS=${MCP_CHROME_IGNORE_CERT_ERRORS:-0}
WAIT_ATTEMPTS=${MCP_CHROME_WAIT_ATTEMPTS:-40}
WAIT_DELAY=${MCP_CHROME_WAIT_DELAY:-0.5}
REUSE_EXISTING=${MCP_CHROME_REUSE_EXISTING:-1}

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

if command -v lsof >/dev/null 2>&1; then
  if lsof -nP -iTCP:"${PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Remote debugging port ${PORT} already in use." >&2
    if [[ "${REUSE_EXISTING}" != "0" ]]; then
      echo "Reusing existing Chrome instance (set MCP_CHROME_REUSE_EXISTING=0 to force a new one)." >&2
      exit 0
    fi
  fi
fi

mkdir -p "${PROFILE}"

# Use a new Chrome instance so the remote debugging port is reliably enabled even if the user already has Chrome open.
open -na "Google Chrome" --args "${ARGS[@]}"

for ((i=1; i<=WAIT_ATTEMPTS; i++)); do
  if curl -sf "http://127.0.0.1:${PORT}/json/version" >/dev/null 2>&1; then
    exit 0
  fi
  sleep "${WAIT_DELAY}"
done

echo "Timed out waiting for Chrome remote debugging on port ${PORT}." >&2
exit 1
