#!/usr/bin/env sh
set -e
SCHEMA=prisma/pg/schema.prisma
DATABASE_URL=${DATABASE_URL:-postgresql://satoshis:satoshis@localhost:55432/satoshis}
prisma generate --schema "$SCHEMA"
