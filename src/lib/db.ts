import { createClient, type Client } from "@libsql/client"

let _client: Client | null = null

export function getDb(): Client {
  if (!_client) {
    _client = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
  }
  return _client
}

let _initialized = false

export async function initDb() {
  if (_initialized) return
  const db = getDb()
  await db.batch([
    `CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      recipient_unlink_address TEXT NOT NULL,
      token_address TEXT NOT NULL,
      token_symbol TEXT NOT NULL DEFAULT 'TEST',
      amount TEXT NOT NULL,
      amount_wei TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      tx_id TEXT,
      created_at INTEGER NOT NULL,
      paid_at INTEGER
    )`,
  ])
  _initialized = true
}
