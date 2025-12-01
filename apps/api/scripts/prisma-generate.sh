#!/usr/bin/env sh
set -e
SCHEMA=${PRISMA_SCHEMA_FILE:-prisma/schema.prisma}
prisma generate --schema "$SCHEMA"
