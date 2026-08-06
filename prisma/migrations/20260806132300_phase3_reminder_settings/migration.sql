-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Setting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "productContext" TEXT,
    "aiBaseUrl" TEXT,
    "aiAuthToken" TEXT,
    "aiModel" TEXT,
    "botName" TEXT,
    "welcomeMessage" TEXT,
    "reminderEnabled" BOOLEAN NOT NULL DEFAULT true,
    "reminderStart" TEXT NOT NULL DEFAULT '09:00',
    "reminderEnd" TEXT NOT NULL DEFAULT '21:00',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Setting" ("aiAuthToken", "aiBaseUrl", "aiModel", "botName", "id", "productContext", "updatedAt", "welcomeMessage") SELECT "aiAuthToken", "aiBaseUrl", "aiModel", "botName", "id", "productContext", "updatedAt", "welcomeMessage" FROM "Setting";
DROP TABLE "Setting";
ALTER TABLE "new_Setting" RENAME TO "Setting";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
