#!/usr/bin/env sh
set -e
SCHEMA=prisma/pg/schema.prisma
DATABASE_URL=${DATABASE_URL:-postgresql://nostrstack:nostrstack@localhost:5432/nostrstack}
prisma generate --schema "$SCHEMA"
