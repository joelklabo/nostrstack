-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "action" TEXT;
ALTER TABLE "Payment" ADD COLUMN "itemId" TEXT;

-- CreateIndex
CREATE INDEX "Payment_tenantId_action_idx" ON "Payment"("tenantId", "action");

-- CreateIndex
CREATE INDEX "Payment_tenantId_action_itemId_idx" ON "Payment"("tenantId", "action", "itemId");
