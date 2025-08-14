#!/usr/bin/env node
const { createClient } = require("@libsql/client");

async function main() {
  const base = process.env.FINMODEL_DB_URL || process.env.AUTH_DB_URL || process.env.DATABASE_URL;
  const token = process.env.FINMODEL_DB_TOKEN || process.env.AUTH_DB_TOKEN;
  if (!base || !base.startsWith("libsql://")) throw new Error("Set FINMODEL_DB_URL to libsql://...");
  const url = base.includes("authToken=") || !token ? base : `${base}?authToken=${token}`;
  const db = createClient({ url });

  await db.execute(`CREATE TABLE IF NOT EXISTS finmodel_datapoint (
    key TEXT PRIMARY KEY,
    value REAL NOT NULL,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`);
  await db.execute(`CREATE TABLE IF NOT EXISTS finmodel_month_override (
    month_key TEXT NOT NULL,
    metric TEXT NOT NULL,
    value REAL NOT NULL,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (month_key, metric)
  );`);

  const datapoints = [
    ["commissionPerBookingRub", 580],
    ["targetConversionPct", 3],
    ["retentionPct", 30],
    ["cpaStartRub", 60],
    ["cpaMonthlyGrowthPct", 1.5],
    ["marketingShareTopPct", 85],
    ["paidSubsPct", 1.5],
    ["subsRevenueRub", 269],
  ];
  for (const [k, v] of datapoints) {
    await db.execute({
      sql: `INSERT INTO finmodel_datapoint (key, value, updatedAt) VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP`,
      args: [k, v],
    });
  }

  // July 2025 overrides as provided
  const july = "2025-07";
  const overrides = [
    ["endUsers", 31719],
    ["retention2", 5646],
    ["mau", 11354],
    ["bookings", null], // fetched from API at runtime; leave null
    ["paidSubsCount", 0],
    ["revenueSubs", 0],
    ["marketingSpend", 18000],
    ["newPaidUsers", 170],
    ["newOrganic", 5538],
  ];
  for (const [metric, value] of overrides) {
    if (value == null) continue;
    await db.execute({
      sql: `INSERT INTO finmodel_month_override (month_key, metric, value, updatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(month_key, metric) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP`,
      args: [july, metric, value],
    });
  }

  console.log("Seeded finmodel datapoints and July overrides");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


