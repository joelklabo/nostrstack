-- CreateTable
CREATE TABLE "NostrEventCache" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventJson" TEXT NOT NULL,
    "pubkey" TEXT NOT NULL,
    "kind" INTEGER NOT NULL,
    "relays" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NostrEventCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NostrAddressCache" (
    "id" TEXT NOT NULL,
    "kind" INTEGER NOT NULL,
    "pubkey" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventJson" TEXT NOT NULL,
    "relays" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NostrAddressCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NostrEventCache_eventId_key" ON "NostrEventCache"("eventId");

-- CreateIndex
CREATE INDEX "NostrEventCache_expiresAt_idx" ON "NostrEventCache"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "NostrAddressCache_kind_pubkey_identifier_key" ON "NostrAddressCache"("kind", "pubkey", "identifier");

-- CreateIndex
CREATE INDEX "NostrAddressCache_eventId_idx" ON "NostrAddressCache"("eventId");

-- CreateIndex
CREATE INDEX "NostrAddressCache_expiresAt_idx" ON "NostrAddressCache"("expiresAt");
