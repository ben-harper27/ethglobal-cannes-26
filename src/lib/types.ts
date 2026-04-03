export type InvoiceStatus = "pending" | "paying" | "paid" | "withdrawn"

export interface Invoice {
  id: string
  freelancerEns: string
  freelancerAddress: string
  tokenAddress: string
  tokenSymbol: string
  amount: string
  amountWei: string
  recipientUnlinkAddress: string
  status: InvoiceStatus
  txId?: string
  autoSwap?: {
    targetToken: string
    targetSymbol: string
  }
  createdAt: number
  paidAt?: number
}
