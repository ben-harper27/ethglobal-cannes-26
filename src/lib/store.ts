import type { Invoice, User } from "./types"

const invoices = new Map<string, Invoice>()
const users = new Map<string, User>()

export const store = {
  create(invoice: Invoice): void {
    invoices.set(invoice.id, invoice)
  },

  get(id: string): Invoice | undefined {
    return invoices.get(id)
  },

  list(): Invoice[] {
    return Array.from(invoices.values()).sort(
      (a, b) => b.createdAt - a.createdAt
    )
  },

  listByWallet(walletAddress: string): Invoice[] {
    const wallet = walletAddress.toLowerCase()
    return this.list().filter((inv) => inv.freelancerWallet === wallet)
  },

  update(id: string, patch: Partial<Invoice>): void {
    const invoice = invoices.get(id)
    if (invoice) {
      invoices.set(id, { ...invoice, ...patch })
    }
  },

  getUser(walletAddress: string): User | undefined {
    return users.get(walletAddress.toLowerCase())
  },

  setUser(user: User): void {
    users.set(user.walletAddress.toLowerCase(), user)
  },
}
