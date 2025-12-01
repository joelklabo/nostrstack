#!/usr/bin/env bash
set -euo pipefail
SCHEMA=${PRISMA_SCHEMA_FILE:-prisma/pg/schema.prisma}
DATABASE_URL=${DATABASE_URL:?DATABASE_URL required}

pnpm exec prisma migrate deploy --schema "$SCHEMA"
