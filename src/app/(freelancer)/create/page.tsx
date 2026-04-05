"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, Wallet, ArrowRight, Copy } from "lucide-react"
import { toast } from "sonner"
import { useWalletAuth } from "@/hooks/use-wallet-auth"
import { motion } from "framer-motion"

export default function CreateInvoicePage() {
  const router = useRouter()
  const { unlinkAddress, isConnected, isDeriving } = useWalletAuth()
  const [amount, setAmount] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [createdInvoice, setCreatedInvoice] = useState<{
    id: string
    amount: string
  } | null>(null)

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
            tokenSymbol: "USDC",
          }),
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || "Failed to create invoice")
        }

        const invoice = await res.json()
        setCreatedInvoice({ id: invoice.id, amount: invoice.amount })
        toast.success("Invoice created!")
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to create invoice"
        toast.error(message)
      } finally {
        setIsSubmitting(false)
      }
    },
    [unlinkAddress, amount]
  )

  const copyLink = () => {
    if (!createdInvoice) return
    const url = `${window.location.origin}/invoice/${createdInvoice.id}`
    navigator.clipboard.writeText(url)
    toast.success("Payment link copied!")
  }

  if (!isConnected) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-6 px-4 py-24">
        <Wallet className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <h1 className="text-2xl font-bold">Create Invoice</h1>
          <p className="mt-2 text-muted-foreground">
            Connect your wallet to get started
          </p>
        </div>
      </div>
    )
  }

  if (isDeriving) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-6 px-4 py-24">
        <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">
          Setting up your privacy account...
        </p>
      </div>
    )
  }

  if (createdInvoice) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card>
            <CardContent className="flex flex-col items-center gap-6 py-10">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/30">
                <ArrowRight className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-bold">Invoice Created</h2>
                <p className="mt-1 text-3xl font-bold">
                  {createdInvoice.amount} USDC
                </p>
              </div>
              <Button className="w-full" onClick={copyLink}>
                <Copy className="mr-2 h-4 w-4" />
                Copy Payment Link
              </Button>
              <div className="flex w-full gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => router.push("/dashboard")}
                >
                  Go to Dashboard
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setCreatedInvoice(null)
                    setAmount("")
                  }}
                >
                  Create another
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-24">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">Create Invoice</h1>
          <p className="mt-2 text-muted-foreground">
            Set the amount and share the link with your client
          </p>
        </div>

        <Card>
          <CardContent className="py-8">
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <label
                  className="text-sm font-medium"
                  htmlFor="amount"
                >
                  Amount (USDC)
                </label>
                <div className="relative">
                  <Input
                    id="amount"
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pr-16 text-lg [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    USDC
                  </span>
                </div>
              </div>

              <Button
                type="submit"
                size="lg"
                disabled={isSubmitting || !amount}
                className="w-full"
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="mr-2 h-4 w-4" />
                )}
                {isSubmitting ? "Creating..." : "Create Invoice"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
