#!/usr/bin/env node
const { createClient } = require("@libsql/client");
const crypto = require("node:crypto");

async function main() {
  const baseUrl = process.env.AUTH_DB_URL;
  const token = process.env.AUTH_DB_TOKEN;
  const codephrase = process.env.CODEPHRASE;
  if (!baseUrl) throw new Error("AUTH_DB_URL is required");
  if (!token) throw new Error("AUTH_DB_TOKEN is required");
  if (!codephrase) throw new Error("CODEPHRASE is required");

  const url = `${baseUrl}?authToken=${token}`;
  const db = createClient({ url });

  const hash = crypto.createHash("sha256").update(Buffer.from(codephrase, "utf8")).digest("hex");

  await db.execute(`CREATE TABLE IF NOT EXISTS "CodephraseAuth" (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    codephraseHash TEXT NOT NULL,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`);

  await db.execute({
    sql: `INSERT INTO "CodephraseAuth" (id, codephraseHash, updatedAt)
          VALUES (1, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(id) DO UPDATE SET codephraseHash = excluded.codephraseHash, updatedAt = CURRENT_TIMESTAMP;`,
    args: [hash],
  });

  console.log("Seeded codephrase hash:", hash);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


