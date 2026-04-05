"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { useBalance } from "@/hooks/use-balance"
import {
  Loader2,
  ArrowUpFromLine,
  CheckCircle,
  Wallet,
  EyeOff,
} from "lucide-react"
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

  const currentBalance =
    balances.length > 0 ? formatUnits(BigInt(balances[0].amount), 6) : "0.00"

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
        body: JSON.stringify({ seed, recipientAddress, amount: amountWei }),
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
      <div className="mx-auto flex max-w-lg flex-col items-center gap-6 px-4 py-24">
        <Wallet className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <h1 className="text-2xl font-bold">Withdraw</h1>
          <p className="mt-2 text-muted-foreground">
            Connect your wallet to withdraw funds
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

  return (
    <div className="mx-auto max-w-lg px-4 py-24">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">Withdraw</h1>
          <p className="mt-2 text-muted-foreground">
            Send funds from your private balance to any wallet
          </p>
        </div>

        <Card>
          <CardContent className="flex flex-col gap-6 py-8">
            <div className="flex items-center justify-between rounded-xl bg-muted p-5">
              <div>
                <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
                  <EyeOff className="h-3.5 w-3.5" />
                  Available
                </div>
                {balancesLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <p className="text-3xl font-bold">
                    {currentBalance}{" "}
                    <span className="text-lg text-muted-foreground">USDC</span>
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAmount(currentBalance)}
              >
                Max
              </Button>
            </div>

            <AnimatePresence mode="wait">
              {isDone ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center gap-3 rounded-xl bg-green-50 p-8 dark:bg-green-950/20"
                >
                  <CheckCircle className="h-12 w-12 text-green-500" />
                  <div className="text-center">
                    <p className="text-lg font-semibold text-green-700 dark:text-green-400">
                      Withdrawal complete
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Sent to{" "}
                      <span className="font-mono">
                        {recipientAddress.slice(0, 8)}...
                        {recipientAddress.slice(-6)}
                      </span>
                    </p>
                    {txId && (
                      <p className="mt-1 font-mono text-xs text-muted-foreground">
                        {txId.slice(0, 20)}...
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    className="mt-2 text-muted-foreground"
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
                  className="flex flex-col gap-5"
                >
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium" htmlFor="address">
                      Destination
                    </label>
                    <Input
                      id="address"
                      placeholder="0x..."
                      value={recipientAddress}
                      onChange={(e) => setRecipientAddress(e.target.value)}
                      className="font-mono"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium" htmlFor="amount">
                      Amount
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
                        className="pr-16"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        USDC
                      </span>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    disabled={isSubmitting || !amount || !recipientAddress}
                    className="w-full"
                  >
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
      </motion.div>
    </div>
  )
}
