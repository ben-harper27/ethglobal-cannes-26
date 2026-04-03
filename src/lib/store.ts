import type { Invoice } from "./types"

const invoices = new Map<string, Invoice>()

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

  update(id: string, patch: Partial<Invoice>): void {
    const invoice = invoices.get(id)
    if (invoice) {
      invoices.set(id, { ...invoice, ...patch })
    }
  },
}
