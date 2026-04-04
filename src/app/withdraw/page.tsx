"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useBalance } from "@/hooks/use-balance"
import { Loader2, ArrowUpFromLine, CheckCircle, Wallet } from "lucide-react"
import { toast } from "sonner"
import { formatUnits, parseUnits } from "viem"
import { motion, AnimatePresence } from "framer-motion"
import { useWalletAuth } from "@/hooks/use-wallet-auth"

export default function WithdrawPage() {
  const { seed, isConnected, isDeriving } = useWalletAuth()
  const { balances, isLoading: balancesLoading, invalidate } = useBalance(seed)
  const [recipientAddress, setRecipientAddress] = useState("")
  const [amount, setAmount] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDone, setIsDone] = useState(false)
  const [txId, setTxId] = useState<string | null>(null)

  const currentBalance = balances.length > 0
    ? formatUnits(BigInt(balances[0].amount), 6)
    : "0"

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!recipientAddress.startsWith("0x") || recipientAddress.length !== 42) {
      toast.error("Please enter a valid EVM address")
      return
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount")
      return
    }

    setIsSubmitting(true)

    try {
      const amountWei = parseUnits(amount, 6).toString()

      const res = await fetch("/api/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seed,
          recipientAddress,
          amount: amountWei,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Withdrawal failed")
      }

      const data = await res.json()
      setTxId(data.txId)
      setIsDone(true)
      await invalidate()
      toast.success("Withdrawal complete!")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Withdrawal failed"
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isConnected) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Wallet className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">
              Connect your wallet to withdraw funds
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
          <CardTitle>Withdraw Funds</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="rounded-lg bg-muted p-4">
            <p className="text-sm text-muted-foreground">Private Balance</p>
            {balancesLoading ? (
              <Loader2 className="mt-1 h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <p className="text-2xl font-bold">{currentBalance} USDC</p>
            )}
          </div>

          <AnimatePresence mode="wait">
            {isDone ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-2 rounded-lg bg-green-50 p-6 dark:bg-green-950/20"
              >
                <CheckCircle className="h-10 w-10 text-green-500" />
                <p className="font-semibold text-green-700 dark:text-green-400">
                  Withdrawal complete
                </p>
                <p className="text-center text-xs text-muted-foreground">
                  Funds sent to {recipientAddress.slice(0, 10)}...
                  {recipientAddress.slice(-8)}
                </p>
                {txId && (
                  <p className="font-mono text-xs text-muted-foreground">
                    TX: {txId.slice(0, 16)}...
                  </p>
                )}
                <Button
                  variant="outline"
                  className="mt-2"
                  onClick={() => {
                    setIsDone(false)
                    setRecipientAddress("")
                    setAmount("")
                    setTxId(null)
                  }}
                >
                  Withdraw again
                </Button>
              </motion.div>
            ) : (
              <motion.form
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onSubmit={handleWithdraw}
                className="flex flex-col gap-4"
              >
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium" htmlFor="address">
                    Destination Address
                  </label>
                  <Input
                    id="address"
                    placeholder="0x..."
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Any EVM wallet address on Base Sepolia
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium" htmlFor="amount">
                    Amount
                  </label>
                  <div className="flex gap-2">
                    <Input
                      id="amount"
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setAmount(currentBalance)}
                    >
                      Max
                    </Button>
                  </div>
                </div>

                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUpFromLine className="mr-2 h-4 w-4" />
                  )}
                  {isSubmitting ? "Withdrawing..." : "Withdraw"}
                </Button>
              </motion.form>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  )
}
