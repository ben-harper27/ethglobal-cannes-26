"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Wallet } from "lucide-react"
import { toast } from "sonner"
import { useWalletAuth } from "@/hooks/use-wallet-auth"

export default function CreateInvoicePage() {
  const router = useRouter()
  const { unlinkAddress, isConnected, isDeriving } = useWalletAuth()
  const [amount, setAmount] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (!unlinkAddress) {
        toast.error("Please connect your wallet first")
        return
      }

      if (!amount || parseFloat(amount) <= 0) {
        toast.error("Please enter a valid amount")
        return
      }

      setIsSubmitting(true)

      try {
        const res = await fetch("/api/invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            unlinkAddress,
            amount,
            tokenSymbol: "TEST",
          }),
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || "Failed to create invoice")
        }

        const invoice = await res.json()
        toast.success("Invoice created!")
        router.push(`/invoice/${invoice.id}`)
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to create invoice"
        toast.error(message)
      } finally {
        setIsSubmitting(false)
      }
    },
    [unlinkAddress, amount, router]
  )

  if (!isConnected) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Wallet className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">
              Connect your wallet to create invoices
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isDeriving) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">
              Setting up your privacy account...
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Create Invoice</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium" htmlFor="amount">
                Amount
              </label>
              <Input
                id="amount"
                type="number"
                step="any"
                min="0"
                placeholder="500"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Token: TEST (Base Sepolia testnet)
              </p>
            </div>

            <Button type="submit" disabled={isSubmitting || !amount}>
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Invoice
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
