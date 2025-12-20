-- CreateTable
CREATE TABLE "LnurlWithdrawSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "k1" TEXT NOT NULL,
    "minWithdrawable" INTEGER NOT NULL,
    "maxWithdrawable" INTEGER NOT NULL,
    "defaultDescription" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LnurlWithdrawSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "LnurlWithdrawSession_k1_key" ON "LnurlWithdrawSession"("k1");

-- CreateIndex
CREATE INDEX "LnurlWithdrawSession_tenantId_idx" ON "LnurlWithdrawSession"("tenantId");

-- CreateIndex
CREATE INDEX "LnurlWithdrawSession_expiresAt_idx" ON "LnurlWithdrawSession"("expiresAt");
