import { type InValue } from "@libsql/client"
import { getDb, initDb } from "./db"
import type { Invoice, User } from "./types"

async function ensureInit() {
  await initDb()
}

function rowToInvoice(row: Record<string, unknown>): Invoice {
  return {
    id: row.id as string,
    recipientUnlinkAddress: row.recipient_unlink_address as string,
    tokenAddress: row.token_address as string,
    tokenSymbol: row.token_symbol as string,
    amount: row.amount as string,
    amountWei: row.amount_wei as string,
    status: row.status as Invoice["status"],
    txId: (row.tx_id as string) || undefined,
    createdAt: row.created_at as number,
    paidAt: (row.paid_at as number) || undefined,
  }
}

function rowToUser(row: Record<string, unknown>): User {
  return {
    unlinkAddress: row.unlink_address as string,
    seed: row.seed as string,
  }
}

export const store = {
  async create(invoice: Invoice): Promise<void> {
    await ensureInit()
    await getDb().execute({
      sql: `INSERT INTO invoices (id, recipient_unlink_address, token_address, token_symbol, amount, amount_wei, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        invoice.id,
        invoice.recipientUnlinkAddress,
        invoice.tokenAddress,
        invoice.tokenSymbol,
        invoice.amount,
        invoice.amountWei,
        invoice.status,
        invoice.createdAt,
      ],
    })
  },

  async get(id: string): Promise<Invoice | undefined> {
    await ensureInit()
    const result = await getDb().execute({ sql: "SELECT * FROM invoices WHERE id = ?", args: [id] })
    if (result.rows.length === 0) return undefined
    return rowToInvoice(result.rows[0] as unknown as Record<string, unknown>)
  },

  async listByUnlinkAddress(unlinkAddress: string): Promise<Invoice[]> {
    await ensureInit()
    const result = await getDb().execute({
      sql: "SELECT * FROM invoices WHERE recipient_unlink_address = ? ORDER BY created_at DESC",
      args: [unlinkAddress],
    })
    return result.rows.map((row) => rowToInvoice(row as unknown as Record<string, unknown>))
  },

  async update(id: string, patch: Partial<Invoice>): Promise<void> {
    await ensureInit()
    const sets: string[] = []
    const args: InValue[] = []

    if (patch.status !== undefined) { sets.push("status = ?"); args.push(patch.status) }
    if (patch.txId !== undefined) { sets.push("tx_id = ?"); args.push(patch.txId) }
    if (patch.paidAt !== undefined) { sets.push("paid_at = ?"); args.push(patch.paidAt) }

    if (sets.length === 0) return

    args.push(id)
    await getDb().execute({ sql: `UPDATE invoices SET ${sets.join(", ")} WHERE id = ?`, args })
  },

  async getUser(unlinkAddress: string): Promise<User | undefined> {
    await ensureInit()
    const result = await getDb().execute({
      sql: "SELECT * FROM users WHERE unlink_address = ?",
      args: [unlinkAddress],
    })
    if (result.rows.length === 0) return undefined
    return rowToUser(result.rows[0] as unknown as Record<string, unknown>)
  },

  async setUser(user: User): Promise<void> {
    await ensureInit()
    await getDb().execute({
      sql: `INSERT OR REPLACE INTO users (unlink_address, seed) VALUES (?, ?)`,
      args: [user.unlinkAddress, user.seed],
    })
  },
}
