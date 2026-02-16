#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

NOSTRDEV_SESSION_DIR="${NOSTRDEV_SESSION_DIR:-$ROOT/.logs/dev/sessions}"
NOSTRDEV_BASE_API_PORT="${NOSTRDEV_BASE_API_PORT:-3001}"
NOSTRDEV_BASE_SOCIAL_PORT="${NOSTRDEV_BASE_SOCIAL_PORT:-4173}"
NOSTRDEV_MAX_SLOTS="${NOSTRDEV_MAX_SLOTS:-40}"
NOSTRDEV_AGENT="${NOSTRDEV_AGENT:-${NOSTR_AGENT:-${USER:-agent}}}"

mkdir -p "$NOSTRDEV_SESSION_DIR"

ndev_slot_file() {
  local slot="$1"
  printf '%s/slot-%s.session' "$NOSTRDEV_SESSION_DIR" "$slot"
}

ndev_parse_field() {
  local file="$1"
  local key="$2"
  sed -n "s/^${key}=//p" "$file" 2>/dev/null | head -n 1 || true
}

ndev_pid_alive() {
  local pid="$1"
  [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1
}

ndev_port_in_use() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$port" -sTCP:LISTEN -P -n >/dev/null 2>&1
    return $?
  fi

  if command -v ss >/dev/null 2>&1; then
    ss -ltnp 2>/dev/null | awk -v p=":${port}" '$4 ~ p' | grep -q . || return 1
    return 0
  fi

  return 1
}

ndev_cleanup_stale_session_file() {
  local file="$1"
  local pid
  if [[ ! -f "$file" ]]; then
    return 0
  fi
  pid="$(ndev_parse_field "$file" NOSTRDEV_SESSION_PID)"
  if [[ -z "$pid" ]] || ! ndev_pid_alive "$pid"; then
    rm -f "$file"
  fi
}

ndev_lock_slot() {
  local slot="$1"
  local lock_dir="$NOSTRDEV_SESSION_DIR/.lock-slot-${slot}"
  local lock_pid=""

  if mkdir "$lock_dir" 2>/dev/null; then
    printf '%s' "$$" > "$lock_dir/pid"
    return 0
  fi

  lock_pid="$(cat "$lock_dir/pid" 2>/dev/null || true)"
  if [[ -n "$lock_pid" ]] && ! ndev_pid_alive "$lock_pid"; then
    rm -rf "$lock_dir"
    if mkdir "$lock_dir" 2>/dev/null; then
      printf '%s' "$$" > "$lock_dir/pid"
      return 0
    fi
  fi

  return 1
}

ndev_unlock_slot() {
  local slot="$1"
  local lock_dir="$NOSTRDEV_SESSION_DIR/.lock-slot-${slot}"
  local lock_pid=""
  lock_pid="$(cat "$lock_dir/pid" 2>/dev/null || true)"
  if [[ "$lock_pid" == "$$" ]]; then
    rm -rf "$lock_dir" || true
  fi
}

ndev_write_session_file() {
  local slot="$1"
  local api_port="$2"
  local social_port="$3"
  local file
  local started_at

  file="$(ndev_slot_file "$slot")"
  started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  cat >"$file" <<EOF
NOSTRDEV_SESSION_SLOT=$slot
NOSTRDEV_SESSION_PID=$$
NOSTRDEV_SESSION_AGENT=$NOSTRDEV_AGENT
NOSTRDEV_SESSION_COMMAND=$NOSTRDEV_SESSION_COMMAND
NOSTRDEV_SESSION_API_PORT=$api_port
NOSTRDEV_SESSION_SOCIAL_PORT=$social_port
NOSTRDEV_SESSION_HOST=${HOSTNAME:-unknown}
NOSTRDEV_SESSION_STARTED_AT=$started_at
EOF

  export NOSTRDEV_SESSION_SLOT="$slot"
  export NOSTRDEV_SESSION_FILE="$file"
  export PORT="$api_port"
  export DEV_SERVER_PORT="$social_port"
}

ndev_claim_slot() {
  local slot="$1"
  local file
  local api_port
  local social_port
  local owner_pid

  if ! ndev_lock_slot "$slot"; then
    return 1
  fi

  file="$(ndev_slot_file "$slot")"
  ndev_cleanup_stale_session_file "$file"
  if [[ -f "$file" ]]; then
    owner_pid="$(ndev_parse_field "$file" NOSTRDEV_SESSION_PID)"
    if [[ -n "$owner_pid" ]] && ndev_pid_alive "$owner_pid"; then
      ndev_unlock_slot "$slot"
      return 1
    fi
    rm -f "$file"
  fi

  api_port=$((NOSTRDEV_BASE_API_PORT + slot))
  social_port=$((NOSTRDEV_BASE_SOCIAL_PORT + slot))
  if ndev_port_in_use "$api_port" || ndev_port_in_use "$social_port"; then
    ndev_unlock_slot "$slot"
    return 1
  fi

  ndev_write_session_file "$slot" "$api_port" "$social_port"
  ndev_unlock_slot "$slot"
}

ndev_claim_session() {
  local requested_slot="${NOSTRDEV_AGENT_SLOT:-}"
  local max_slot="$NOSTRDEV_MAX_SLOTS"
  local slot

  if [[ "${NOSTRDEV_MANAGED_SESSION:-1}" == "0" ]]; then
    local api_port="${PORT:-$NOSTRDEV_BASE_API_PORT}"
    local social_port="${DEV_SERVER_PORT:-$NOSTRDEV_BASE_SOCIAL_PORT}"
    if ndev_port_in_use "$api_port" || ndev_port_in_use "$social_port"; then
      local pid owner_file
      echo "Requested ports are already in use: API=$api_port Social=$social_port" >&2
      pid="$(lsof -iTCP:"$api_port" -sTCP:LISTEN -P -n -t 2>/dev/null | head -n 1 || true)"
      owner_file="$(ndev_slot_file "0")"
      [[ -n "$pid" ]] && echo "Hint: owning process PID=$pid (PORT $api_port)" >&2
      return 1
    fi
    ndev_write_session_file "manual-$$" "$api_port" "$social_port"
    return 0
  fi

  if [[ -n "$requested_slot" ]]; then
    if ndev_claim_slot "$requested_slot"; then
      return 0
    fi
    echo "Requested dev session slot unavailable: $requested_slot" >&2
    echo "Inspect active sessions with pnpm dev:ps, then retry." >&2
    return 1
  fi

  for ((slot = 0; slot <= max_slot; slot++)); do
    if ndev_claim_slot "$slot"; then
      return 0
    fi
  done

  echo "No free dev session slot available for agent '$NOSTRDEV_AGENT'." >&2
  echo "Inspect active sessions with pnpm dev:ps, then cleanup with pnpm dev:stop." >&2
  return 1
}

ndev_release_session() {
  local file="${NOSTRDEV_SESSION_FILE:-}"
  local owner_pid=""

  if [[ -z "$file" || ! -f "$file" ]]; then
    return 0
  fi
  owner_pid="$(ndev_parse_field "$file" NOSTRDEV_SESSION_PID)"
  if [[ "$owner_pid" == "$$" ]]; then
    rm -f "$file"
  fi
}

ndev_print_sessions() {
  local file
  local slot
  local pid
  local agent
  local command
  local api_port
  local social_port
  local state
  local found=0

  echo "SLOT AGENT PID API_PORT SOCIAL_PORT STATE CMD"
  shopt -s nullglob
  for file in "$NOSTRDEV_SESSION_DIR"/*.session; do
    ndev_cleanup_stale_session_file "$file"
    [[ -f "$file" ]] || continue

    slot="$(ndev_parse_field "$file" NOSTRDEV_SESSION_SLOT)"
    pid="$(ndev_parse_field "$file" NOSTRDEV_SESSION_PID)"
    agent="$(ndev_parse_field "$file" NOSTRDEV_SESSION_AGENT)"
    command="$(ndev_parse_field "$file" NOSTRDEV_SESSION_COMMAND)"
    api_port="$(ndev_parse_field "$file" NOSTRDEV_SESSION_API_PORT)"
    social_port="$(ndev_parse_field "$file" NOSTRDEV_SESSION_SOCIAL_PORT)"
    state="running"
    found=1
    if ! ndev_pid_alive "$pid"; then
      continue
    fi

    printf '%s %s %s %s %s %s %s\n' "$slot" "$agent" "$pid" "$api_port" "$social_port" "$state" "$command"
  done
  shopt -u nullglob

  if [[ "$found" == "0" ]]; then
    echo "(no active dev sessions)"
  fi
}

ndev_stop_sessions() {
  local mode="$1"
  local filter="$2"
  local file
  local slot
  local pid
  local agent
  local stopped=0

  shopt -s nullglob
  for file in "$NOSTRDEV_SESSION_DIR"/*.session; do
    ndev_cleanup_stale_session_file "$file"
    [[ -f "$file" ]] || continue

    slot="$(ndev_parse_field "$file" NOSTRDEV_SESSION_SLOT)"
    pid="$(ndev_parse_field "$file" NOSTRDEV_SESSION_PID)"
    agent="$(ndev_parse_field "$file" NOSTRDEV_SESSION_AGENT)"

    case "$mode" in
      all)
        true
        ;;
      slot)
        [[ "$slot" == "$filter" ]] || continue
        ;;
      agent)
        [[ "$agent" == "$filter" ]] || continue
        ;;
      pid)
        [[ "$pid" == "$filter" ]] || continue
        ;;
      *)
        echo "Unsupported stop mode: $mode" >&2
        return 1
        ;;
    esac

    echo "Stopping session $slot (pid=$pid, agent=$agent)"
    if [[ -n "${pid:-}" ]] && ndev_pid_alive "$pid"; then
      kill "$pid" >/dev/null 2>&1 || true
      sleep 1
      if ndev_pid_alive "$pid"; then
        kill -9 "$pid" >/dev/null 2>&1 || true
      fi
    fi
    rm -f "$file"
    stopped=1
  done
  shopt -u nullglob

  [[ "$stopped" == "1" ]] || echo "No matching sessions found."
}
