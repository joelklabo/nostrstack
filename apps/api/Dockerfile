# syntax=docker/dockerfile:1
FROM node:20-slim AS base
WORKDIR /app
RUN corepack enable

# Install dependencies
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps apps
COPY packages packages
COPY deploy deploy

# System deps for Prisma (openssl)
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Use Postgres schema for generated client
ENV PRISMA_SCHEMA_FILE=prisma/pg/schema.prisma
RUN pnpm install --frozen-lockfile

# Build API and generate OpenAPI schema
RUN pnpm --filter api exec tsx scripts/openapi-schema.ts && \
    pnpm --filter api build

# Runtime image
FROM node:20-slim
WORKDIR /app
RUN corepack enable
# Runtime needs OpenSSL for Prisma native engine
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY --from=base /app .
ENV NODE_ENV=production \
    PRISMA_SCHEMA_FILE=prisma/pg/schema.prisma
EXPOSE 3001
CMD ["sh", "-c", "pnpm --filter api exec prisma db push --accept-data-loss --schema $PRISMA_SCHEMA_FILE && pnpm --filter api start"]
