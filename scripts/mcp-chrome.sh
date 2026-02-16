#!/usr/bin/env bash
set -euo pipefail

echo "deprecated: scripts/mcp-chrome.sh is kept for compatibility; use scripts/mcp/chrome.sh" >&2
exec "$(cd "$(dirname "$0")" && pwd)/mcp/chrome.sh" "$@"
