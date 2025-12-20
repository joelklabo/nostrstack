PRAGMA foreign_keys=OFF;

CREATE TABLE "new_LnurlWithdrawSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "k1" TEXT NOT NULL,
    "minWithdrawable" BIGINT NOT NULL,
    "maxWithdrawable" BIGINT NOT NULL,
    "defaultDescription" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LnurlWithdrawSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_LnurlWithdrawSession" ("id", "tenantId", "k1", "minWithdrawable", "maxWithdrawable", "defaultDescription", "status", "expiresAt", "createdAt", "updatedAt")
SELECT "id", "tenantId", "k1", "minWithdrawable", "maxWithdrawable", "defaultDescription", "status", "expiresAt", "createdAt", "updatedAt"
FROM "LnurlWithdrawSession";

DROP TABLE "LnurlWithdrawSession";

ALTER TABLE "new_LnurlWithdrawSession" RENAME TO "LnurlWithdrawSession";

CREATE UNIQUE INDEX "LnurlWithdrawSession_k1_key" ON "LnurlWithdrawSession"("k1");
CREATE INDEX "LnurlWithdrawSession_tenantId_idx" ON "LnurlWithdrawSession"("tenantId");
CREATE INDEX "LnurlWithdrawSession_expiresAt_idx" ON "LnurlWithdrawSession"("expiresAt");

PRAGMA foreign_keys=ON;
