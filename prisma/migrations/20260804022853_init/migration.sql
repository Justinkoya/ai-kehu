-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "source" TEXT,
    "requirement" TEXT,
    "interested" TEXT,
    "stage" TEXT,
    "tags" TEXT,
    "lastAction" TEXT,
    "nextAction" TEXT,
    "nextFollowDate" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
