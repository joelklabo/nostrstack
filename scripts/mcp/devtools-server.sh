#!/usr/bin/env bash
set -euo pipefail
# Run Chrome DevTools MCP server against the locally debug-enabled Chrome (default 9222).
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT_DIR=$(cd "${SCRIPT_DIR}/.." && pwd)
PORT=${MCP_CHROME_PORT:-9222}
BROWSER_URL=${BROWSER_URL:-http://127.0.0.1:${PORT}}
LOG_DIR=${MCP_DEVTOOLS_LOG_DIR:-${ROOT_DIR}/.logs/dev}
LOG_FILE=${MCP_DEVTOOLS_LOG_FILE:-${LOG_DIR}/mcp-devtools.log}
WAIT_ATTEMPTS=${MCP_DEVTOOLS_WAIT_ATTEMPTS:-40}
WAIT_DELAY=${MCP_DEVTOOLS_WAIT_DELAY:-0.5}
AUTO_LAUNCH_CHROME=${MCP_DEVTOOLS_AUTO_LAUNCH_CHROME:-1}
REUSE_EXISTING=${MCP_DEVTOOLS_REUSE_EXISTING:-1}

mkdir -p "${LOG_DIR}"

if command -v pgrep >/dev/null 2>&1; then
  mapfile -t MCP_PIDS < <(pgrep -f "chrome-devtools-mcp" || true)
  if (( ${#MCP_PIDS[@]} > 0 )); then
    IFS=$'\n' mapfile -t MCP_PIDS_SORTED < <(printf '%s\n' "${MCP_PIDS[@]}" | sort -n)
    KEEP_PID=${MCP_PIDS_SORTED[-1]}
    if (( ${#MCP_PIDS_SORTED[@]} > 1 )); then
      echo "Multiple chrome-devtools-mcp processes detected; keeping PID ${KEEP_PID} and stopping others." >&2
      for pid in "${MCP_PIDS_SORTED[@]:0:${#MCP_PIDS_SORTED[@]}-1}"; do
        kill "${pid}" >/dev/null 2>&1 || true
      done
    fi
    if [[ "${REUSE_EXISTING}" != "0" ]]; then
      echo "chrome-devtools-mcp already running (PID ${KEEP_PID}); reusing it." >&2
      exit 0
    fi
    kill "${KEEP_PID}" >/dev/null 2>&1 || true
  fi
fi

if ! curl -sf "${BROWSER_URL}/json/version" >/dev/null 2>&1; then
  if [[ "${AUTO_LAUNCH_CHROME}" != "0" ]]; then
    "${SCRIPT_DIR}/mcp-chrome.sh"
  fi
  for ((i=1; i<=WAIT_ATTEMPTS; i++)); do
    if curl -sf "${BROWSER_URL}/json/version" >/dev/null 2>&1; then
      break
    fi
    sleep "${WAIT_DELAY}"
  done
fi

if ! curl -sf "${BROWSER_URL}/json/version" >/dev/null 2>&1; then
  echo "Chrome remote debugging not reachable at ${BROWSER_URL}." >&2
  echo "Start Chrome with ./scripts/mcp/chrome.sh or set BROWSER_URL to a valid debugging endpoint." >&2
  exit 1
fi

LOG_ARGS=()
if [[ "$*" != *"--logFile"* ]]; then
  LOG_ARGS=(--logFile="${LOG_FILE}")
fi

NODE_BIN=${MCP_NODE_BIN:-}
if [[ -z "${NODE_BIN}" ]]; then
  NODE_BIN=$(command -v node || true)
  if [[ -z "${NODE_BIN}" ]]; then
    for candidate in /opt/homebrew/bin/node /usr/local/bin/node /usr/bin/node; do
      if [[ -x "${candidate}" ]]; then
        NODE_BIN="${candidate}"
        break
      fi
    done
  fi
fi

if [[ -n "${NODE_BIN}" && -f "${ROOT_DIR}/node_modules/chrome-devtools-mcp/build/src/index.js" ]]; then
  exec "${NODE_BIN}" "${ROOT_DIR}/node_modules/chrome-devtools-mcp/build/src/index.js" \
    --browserUrl="${BROWSER_URL}" \
    --acceptInsecureCerts \
    "${LOG_ARGS[@]}" \
    "$@"
fi

if command -v pnpm >/dev/null 2>&1; then
  exec pnpm -C "${ROOT_DIR}" exec chrome-devtools-mcp \
    --browserUrl="${BROWSER_URL}" \
    --acceptInsecureCerts \
    "${LOG_ARGS[@]}" \
    "$@"
fi

exec npx -y chrome-devtools-mcp@0.12.1 \
  --browserUrl="${BROWSER_URL}" \
  --acceptInsecureCerts \
  "${LOG_ARGS[@]}" \
  "$@"
