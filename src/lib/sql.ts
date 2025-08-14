let _client: any = null;
let _roClient: any = null;

export function getLibsql() {
  if (_client) return _client;
  const url = process.env.DATABASE_URL;
  if (!url || !url.startsWith("libsql://")) {
    throw new Error("DATABASE_URL must be a libsql:// URL for Turso");
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createClient } = require("@libsql/client");
  _client = createClient({ url });
  return _client;
}

export async function queryAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const client = getLibsql();
  const res = await client.execute({ sql, args: params });
  return res.rows as T[];
}

export async function execute(sql: string, params: any[] = []): Promise<void> {
  const client = getLibsql();
  await client.execute({ sql, args: params });
}

export function getReadonlyClient() {
  if (_roClient) return _roClient;
  // Build URL with auth token for read-only remote db
  const base = process.env.REMOTE_TURSO_URL || "libsql://travelpayouts-rotator-eqiu12.aws-eu-west-1.turso.io";
  const token = process.env.REMOTE_TURSO_TOKEN || "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicm8iLCJpYXQiOjE3NTUxODMxMDIsImlkIjoiOGQ4NTMyZDYtMTBkNy00ZjQyLTliMjktODYxNmE1ZGU3ZDM3IiwicmlkIjoiMGMwNmJkZjItNDYwMy00ZGFkLWEzN2YtNjEwNDE0Zjc3YjZhIn0.FWVeEVM_sZLcXhBQ9QK8lvdnKBHV9TSogv4ZuqaWzklfvI19_HDcVfUMuUY54dPrCDehJr4WkluYfilhjqcECg";
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createClient } = require("@libsql/client");
  _roClient = createClient({ url: `${base}?authToken=${token}` });
  return _roClient;
}

export async function roQueryAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const client = getReadonlyClient();
  const res = await client.execute({ sql, args: params });
  return res.rows as T[];
}


