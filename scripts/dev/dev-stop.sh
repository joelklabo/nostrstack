#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT/scripts/dev/session-manager.sh"

MODE="agent"
VALUE="${NOSTRDEV_AGENT:-${NOSTR_AGENT:-${USER:-agent}}}"
FORCE_CLEANUP=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --all)
      MODE="all"
      VALUE=""
      shift
      ;;
    --slot)
      MODE="slot"
      VALUE="${2:-}"
      if [[ -z "$VALUE" ]]; then
        echo "Missing value for --slot" >&2
        exit 1
      fi
      shift 2
      ;;
    --agent)
      MODE="agent"
      VALUE="${2:-}"
      if [[ -z "$VALUE" ]]; then
        echo "Missing value for --agent" >&2
        exit 1
      fi
      shift 2
      ;;
    --pid)
      MODE="pid"
      VALUE="${2:-}"
      if [[ -z "$VALUE" ]]; then
        echo "Missing value for --pid" >&2
        exit 1
      fi
      shift 2
      ;;
    --cleanup|-c)
      FORCE_CLEANUP=1
      shift
      ;;
    --help|-h)
      echo "Usage: $(basename "$0") [--all|--slot N|--agent NAME|--pid PID] [--cleanup|-c]"
      echo ""
      echo "Options:"
      echo "  --all           Stop all sessions"
      echo "  --slot N        Stop session in slot N"
      echo "  --agent NAME    Stop session for agent NAME"
      echo "  --pid PID       Stop session with PID"
      echo "  --cleanup, -c  Force cleanup of ports even if no owning process (stale sockets)"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $(basename "$0") [--all|--slot N|--agent NAME|--pid PID] [--cleanup|-c]" >&2
      exit 1
      ;;
  esac
done

if [[ "$FORCE_CLEANUP" == "1" ]]; then
  export FORCE_KILL_PORTS=1
fi

ndev_stop_sessions "$MODE" "$VALUE"
