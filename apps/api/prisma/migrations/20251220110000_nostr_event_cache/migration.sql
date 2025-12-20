CREATE TABLE "NostrEventCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "eventJson" TEXT NOT NULL,
    "pubkey" TEXT NOT NULL,
    "kind" INTEGER NOT NULL,
    "relays" TEXT,
    "fetchedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "NostrEventCache_eventId_key" ON "NostrEventCache"("eventId");
CREATE INDEX "NostrEventCache_expiresAt_idx" ON "NostrEventCache"("expiresAt");

CREATE TABLE "NostrAddressCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" INTEGER NOT NULL,
    "pubkey" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventJson" TEXT NOT NULL,
    "relays" TEXT,
    "fetchedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "NostrAddressCache_kind_pubkey_identifier_key" ON "NostrAddressCache"("kind", "pubkey", "identifier");
CREATE INDEX "NostrAddressCache_eventId_idx" ON "NostrAddressCache"("eventId");
CREATE INDEX "NostrAddressCache_expiresAt_idx" ON "NostrAddressCache"("expiresAt");
