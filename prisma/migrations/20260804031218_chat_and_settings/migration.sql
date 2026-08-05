-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "lastDraft" TEXT;
ALTER TABLE "Customer" ADD COLUMN "rawConversation" TEXT;

-- CreateTable
CREATE TABLE "Setting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "productContext" TEXT,
    "updatedAt" DATETIME NOT NULL
);
