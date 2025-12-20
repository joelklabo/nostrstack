-- CreateTable
CREATE TABLE "LnurlAuthSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "k1" TEXT NOT NULL,
    "linkingKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "LnurlAuthSession_k1_key" ON "LnurlAuthSession"("k1");

-- CreateIndex
CREATE INDEX "LnurlAuthSession_status_idx" ON "LnurlAuthSession"("status");

-- CreateIndex
CREATE INDEX "LnurlAuthSession_expiresAt_idx" ON "LnurlAuthSession"("expiresAt");
