#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${DATABASE_URL:=file:./dev.db}"

if [ ! -f dev.db ]; then
  echo "[dev-seed] creating dev.db"
  pnpm exec prisma migrate deploy >/dev/null
fi
pnpm exec tsx prisma/seed-dev.ts
