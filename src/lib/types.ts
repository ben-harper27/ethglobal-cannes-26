export type InvoiceStatus = "pending" | "paying" | "paid" | "withdrawn"

export interface Invoice {
  id: string
  recipientUnlinkAddress: string
  tokenAddress: string
  tokenSymbol: string
  amount: string
  amountWei: string
  status: InvoiceStatus
  createdAt: number
  paidAt?: number
}
