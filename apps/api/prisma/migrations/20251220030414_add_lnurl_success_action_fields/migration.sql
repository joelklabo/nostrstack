-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN "lnurlCommentAllowed" INTEGER;
ALTER TABLE "Tenant" ADD COLUMN "lnurlMetadata" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "lnurlSuccessAction" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "lnurlCommentAllowed" INTEGER;
ALTER TABLE "User" ADD COLUMN "lnurlMetadata" TEXT;
ALTER TABLE "User" ADD COLUMN "lnurlSuccessAction" TEXT;
