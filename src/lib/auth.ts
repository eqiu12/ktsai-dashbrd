import { createClient, Client } from "@libsql/client";
import crypto from "node:crypto";

let cachedAuthClient: Client | null = null;

function getAuthDbUrl(): string {
  const baseUrl = process.env.AUTH_DB_URL;
  const token = process.env.AUTH_DB_TOKEN;
  if (!baseUrl) throw new Error("AUTH_DB_URL is not set");
  if (!baseUrl.startsWith("libsql://")) throw new Error("AUTH_DB_URL must start with libsql://");
  if (!token) throw new Error("AUTH_DB_TOKEN is not set");
  const urlWithToken = `${baseUrl}?authToken=${token}`;
  return urlWithToken;
}

export function getAuthDb(): Client {
  if (cachedAuthClient) return cachedAuthClient;
  const url = getAuthDbUrl();
  cachedAuthClient = createClient({ url });
  return cachedAuthClient;
}

export function hashCodephrase(input: string): string {
  const hash = crypto.createHash("sha256").update(Buffer.from(input, "utf8")).digest("hex");
  return hash;
}

export async function ensureAuthSchema(): Promise<void> {
  const db = getAuthDb();
  await db.execute(`CREATE TABLE IF NOT EXISTS "CodephraseAuth" (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    codephraseHash TEXT NOT NULL,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`);
}

export async function upsertCodephraseHash(hash: string): Promise<void> {
  const db = getAuthDb();
  await ensureAuthSchema();
  await db.execute({
    sql: `INSERT INTO "CodephraseAuth" (id, codephraseHash, updatedAt)
          VALUES (1, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(id) DO UPDATE SET codephraseHash = excluded.codephraseHash, updatedAt = CURRENT_TIMESTAMP;`,
    args: [hash],
  });
}

export async function isValidCodephrase(codephrase: string): Promise<boolean> {
  if (!codephrase) return false;
  const db = getAuthDb();
  await ensureAuthSchema();
  const res = await db.execute<{ codephraseHash: string }>(`SELECT codephraseHash FROM "CodephraseAuth" WHERE id = 1`);
  const row = res.rows[0];
  if (!row) return false;
  const incomingHash = hashCodephrase(codephrase);
  return row.codephraseHash === incomingHash;
}


