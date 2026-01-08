-- Schema unification migration
-- Aligns PostgreSQL schema with SQLite schema (adds missing fields/tables)

-- Add missing columns to Tenant
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "lnurlSuccessAction" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "lnurlCommentAllowed" INTEGER;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "lnurlMetadata" TEXT;

-- Add missing columns to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lnurlSuccessAction" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lnurlCommentAllowed" INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lnurlMetadata" TEXT;

-- Add missing columns to Payment
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "action" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "itemId" TEXT;

-- Add missing indexes to Payment
CREATE INDEX IF NOT EXISTS "Payment_tenantId_action_idx" ON "Payment"("tenantId", "action");
CREATE INDEX IF NOT EXISTS "Payment_tenantId_action_itemId_idx" ON "Payment"("tenantId", "action", "itemId");

-- Create LnurlAuthSession table
CREATE TABLE IF NOT EXISTS "LnurlAuthSession" (
    "id" TEXT NOT NULL,
    "k1" TEXT NOT NULL,
    "linkingKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LnurlAuthSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LnurlAuthSession_k1_key" ON "LnurlAuthSession"("k1");
CREATE INDEX IF NOT EXISTS "LnurlAuthSession_status_idx" ON "LnurlAuthSession"("status");
CREATE INDEX IF NOT EXISTS "LnurlAuthSession_expiresAt_idx" ON "LnurlAuthSession"("expiresAt");

-- Create LnurlWithdrawSession table
CREATE TABLE IF NOT EXISTS "LnurlWithdrawSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "k1" TEXT NOT NULL,
    "minWithdrawable" BIGINT NOT NULL,
    "maxWithdrawable" BIGINT NOT NULL,
    "defaultDescription" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LnurlWithdrawSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LnurlWithdrawSession_k1_key" ON "LnurlWithdrawSession"("k1");
CREATE INDEX IF NOT EXISTS "LnurlWithdrawSession_tenantId_idx" ON "LnurlWithdrawSession"("tenantId");
CREATE INDEX IF NOT EXISTS "LnurlWithdrawSession_expiresAt_idx" ON "LnurlWithdrawSession"("expiresAt");

-- Add foreign key for LnurlWithdrawSession -> Tenant
ALTER TABLE "LnurlWithdrawSession"
    ADD CONSTRAINT "LnurlWithdrawSession_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
