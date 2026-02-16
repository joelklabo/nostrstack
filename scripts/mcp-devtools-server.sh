#!/usr/bin/env bash
set -euo pipefail

echo "deprecated: scripts/mcp-devtools-server.sh is kept for compatibility; use scripts/mcp/devtools-server.sh" >&2
exec "$(cd "$(dirname "$0")" && pwd)/mcp/devtools-server.sh" "$@"
