import { getLibsql } from "@/lib/sql";

export async function ensureSchema() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (!url.startsWith("libsql://")) return; // using local sqlite via Prisma

  const client = getLibsql();

  const statements = [
    `CREATE TABLE IF NOT EXISTS "BalanceSnapshot" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "usd" DECIMAL NOT NULL,
      "eur" DECIMAL NOT NULL,
      "rub" DECIMAL NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS "BalanceSnapshot_capturedAt_idx" ON "BalanceSnapshot" ("capturedAt");`,
    `CREATE TABLE IF NOT EXISTS "NextPayoutSnapshot" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "usd" DECIMAL NOT NULL,
      "eur" DECIMAL NOT NULL,
      "rub" DECIMAL NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS "NextPayoutSnapshot_capturedAt_idx" ON "NextPayoutSnapshot" ("capturedAt");`,
    `CREATE TABLE IF NOT EXISTS "TravelpayoutsAction" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "actionId" TEXT NOT NULL UNIQUE,
      "campaignId" INTEGER NOT NULL,
      "actionState" TEXT NOT NULL,
      "currency" TEXT,
      "price" DECIMAL NOT NULL,
      "profit" DECIMAL NOT NULL,
      "paidProfit" DECIMAL,
      "processingProfit" DECIMAL,
      "description" TEXT NOT NULL,
      "bookedAt" DATETIME,
      "updatedAt" DATETIME,
      "updatedAtRemote" DATETIME,
      "syncDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "TravelpayoutsAction_actionId_key" ON "TravelpayoutsAction" ("actionId");`,
    `CREATE INDEX IF NOT EXISTS "TravelpayoutsAction_actionState_idx" ON "TravelpayoutsAction" ("actionState");`,
    `CREATE INDEX IF NOT EXISTS "TravelpayoutsAction_capturedAt_idx" ON "TravelpayoutsAction" ("capturedAt");`,
    `CREATE TABLE IF NOT EXISTS "DailyStatistic" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "date" DATETIME NOT NULL UNIQUE,
      "clicks" INTEGER NOT NULL DEFAULT 0,
      "bookings" INTEGER NOT NULL DEFAULT 0,
      "earnings" DECIMAL NOT NULL
    );`
    ,
    `CREATE TABLE IF NOT EXISTS "UserPayment" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "paymentUuid" TEXT NOT NULL UNIQUE,
      "paidAt" DATETIME NOT NULL,
      "amount" DECIMAL NOT NULL,
      "currency" TEXT NOT NULL,
      "paymentInfoId" INTEGER,
      "comment" TEXT
    );`
  ];

  for (const sql of statements) {
    await client.execute(sql);
  }

  // Try to evolve existing schema (ignore errors if columns already exist)
  const alters = [
    `ALTER TABLE "TravelpayoutsAction" ADD COLUMN paidProfit DECIMAL`,
    `ALTER TABLE "TravelpayoutsAction" ADD COLUMN processingProfit DECIMAL`,
    `ALTER TABLE "TravelpayoutsAction" ADD COLUMN description TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE "TravelpayoutsAction" ADD COLUMN syncDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE "TravelpayoutsAction" ADD COLUMN updatedAt DATETIME`
  ];
  for (const alter of alters) {
    try { await client.execute(alter); } catch { /* no-op if exists */ }
  }
}


