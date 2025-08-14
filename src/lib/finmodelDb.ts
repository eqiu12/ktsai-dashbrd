import { createClient, Client } from "@libsql/client";

let cachedClient: Client | null = null;

function getFinmodelDbUrl(): string {
  const base = process.env.FINMODEL_DB_URL || process.env.AUTH_DB_URL || process.env.DATABASE_URL;
  const token = process.env.FINMODEL_DB_TOKEN || process.env.AUTH_DB_TOKEN;
  if (!base) throw new Error("FINMODEL_DB_URL (or AUTH_DB_URL/DATABASE_URL) is not set");
  if (!base.startsWith("libsql://")) throw new Error("FINMODEL_DB_URL must start with libsql://");
  if (base.includes("authToken=") || !token) return base; // token already embedded or not provided
  return `${base}?authToken=${token}`;
}

export function getFinmodelDb(): Client {
  if (cachedClient) return cachedClient;
  cachedClient = createClient({ url: getFinmodelDbUrl() });
  return cachedClient;
}

export async function ensureFinmodelSchema(): Promise<void> {
  const db = getFinmodelDb();
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
}

export async function upsertDatapoint(key: string, value: number): Promise<void> {
  const db = getFinmodelDb();
  await ensureFinmodelSchema();
  await db.execute({
    sql: `INSERT INTO finmodel_datapoint (key, value, updatedAt) VALUES (?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP`,
    args: [key, value],
  });
}

export async function upsertOverride(monthKey: string, metric: string, value: number): Promise<void> {
  const db = getFinmodelDb();
  await ensureFinmodelSchema();
  await db.execute({
    sql: `INSERT INTO finmodel_month_override (month_key, metric, value, updatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(month_key, metric) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP`,
    args: [monthKey, metric, value],
  });
}


