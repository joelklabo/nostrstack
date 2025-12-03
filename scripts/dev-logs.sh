#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
LOG_DIR="$ROOT/.logs/dev"
mkdir -p "$LOG_DIR"
API_LOG="$LOG_DIR/api.log"
GALLERY_LOG="$LOG_DIR/gallery.log"
>"$API_LOG"
>"$GALLERY_LOG"

echo "🪵 writing logs to $LOG_DIR (api.log, gallery.log)"
echo "💡 view live: tail -f $API_LOG $GALLERY_LOG"

cd "$ROOT"

concurrently -k -p "[{name} {time}]" -n api,gallery \
  "stdbuf -oL pnpm --filter api dev | tee -a $API_LOG" \
  "stdbuf -oL pnpm --filter gallery dev -- --host --port 4173 | tee -a $GALLERY_LOG"
