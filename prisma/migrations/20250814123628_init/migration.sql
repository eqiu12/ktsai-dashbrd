-- CreateTable
CREATE TABLE "BalanceSnapshot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usd" DECIMAL NOT NULL,
    "eur" DECIMAL NOT NULL,
    "rub" DECIMAL NOT NULL
);

-- CreateTable
CREATE TABLE "NextPayoutSnapshot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usd" DECIMAL NOT NULL,
    "eur" DECIMAL NOT NULL,
    "rub" DECIMAL NOT NULL
);

-- CreateTable
CREATE TABLE "TravelpayoutsAction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "actionId" TEXT NOT NULL,
    "campaignId" INTEGER NOT NULL,
    "actionState" TEXT NOT NULL,
    "currency" TEXT,
    "price" DECIMAL NOT NULL,
    "profit" DECIMAL NOT NULL,
    "description" TEXT,
    "bookedAt" DATETIME,
    "updatedAtRemote" DATETIME,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DailyStatistic" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "bookings" INTEGER NOT NULL DEFAULT 0,
    "earnings" DECIMAL NOT NULL
);

-- CreateIndex
CREATE INDEX "BalanceSnapshot_capturedAt_idx" ON "BalanceSnapshot"("capturedAt");

-- CreateIndex
CREATE INDEX "NextPayoutSnapshot_capturedAt_idx" ON "NextPayoutSnapshot"("capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TravelpayoutsAction_actionId_key" ON "TravelpayoutsAction"("actionId");

-- CreateIndex
CREATE INDEX "TravelpayoutsAction_actionState_idx" ON "TravelpayoutsAction"("actionState");

-- CreateIndex
CREATE INDEX "TravelpayoutsAction_capturedAt_idx" ON "TravelpayoutsAction"("capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DailyStatistic_date_key" ON "DailyStatistic"("date");
