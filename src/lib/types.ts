export type InvoiceStatus = "pending" | "paying" | "paid" | "withdrawn"

export interface Invoice {
  id: string
  recipientUnlinkAddress: string
  tokenAddress: string
  tokenSymbol: string
  amount: string
  amountWei: string
  status: InvoiceStatus
  txId?: string
  txHash?: string
  createdAt: number
  paidAt?: number
}
