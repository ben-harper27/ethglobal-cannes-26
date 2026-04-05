"use client"

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { StatusBadge } from "@/components/status-badge"
import { useInvoices } from "@/hooks/use-invoices"
import { useBalance } from "@/hooks/use-balance"
import { useWalletAuth } from "@/hooks/use-wallet-auth"
import {
  Loader2,
  Plus,
  ArrowUpRight,
  Wallet,
  EyeOff,
  ArrowUpFromLine,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatUnits } from "viem"
import { motion } from "framer-motion"

export default function DashboardPage() {
  const { unlinkAddress, seed, isConnected, isDeriving } = useWalletAuth()
  const { invoices, isLoading: invoicesLoading } = useInvoices(unlinkAddress)
  const { balances, isLoading: balancesLoading } = useBalance(seed)

  if (!isConnected) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-24">
        <Wallet className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="mt-2 text-muted-foreground">
            Connect your wallet to view your dashboard
          </p>
        </div>
      </div>
    )
  }

  if (isDeriving) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-24">
        <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">
          Setting up your privacy account...
        </p>
      </div>
    )
  }

  const balance =
    balances.length > 0
      ? formatUnits(BigInt(balances[0].amount), 6)
      : "0.00"

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-8"
      >
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <Link href="/create" className={cn(buttonVariants(), "gap-2")}>
            <Plus className="h-4 w-4" />
            New Invoice
          </Link>
        </div>

        <Card>
          <CardContent className="flex items-center justify-between py-8">
            <div>
              <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
                <EyeOff className="h-3.5 w-3.5" />
                Private Balance
              </div>
              {balancesLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                <p className="text-4xl font-bold">{balance} <span className="text-xl text-muted-foreground">USDC</span></p>
              )}
            </div>
            <Link
              href="/withdraw"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "gap-2"
              )}
            >
              <ArrowUpFromLine className="h-4 w-4" />
              Withdraw
            </Link>
          </CardContent>
        </Card>

        <div>
          <h2 className="mb-4 text-lg font-semibold">Invoices</h2>

          {invoicesLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : invoices.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-12">
                <p className="text-muted-foreground">
                  No invoices yet
                </p>
                <Link
                  href="/create"
                  className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
                >
                  <Plus className="h-4 w-4" />
                  Create your first invoice
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {invoices.map((invoice, i) => (
                <motion.div
                  key={invoice.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link href={`/invoice/${invoice.id}`}>
                    <Card className="transition-all hover:border-foreground/20 hover:shadow-sm">
                      <CardContent className="flex items-center justify-between py-4">
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                            <span className="text-sm font-semibold">
                              {invoice.tokenSymbol.slice(0, 1)}
                            </span>
                          </div>
                          <div>
                            <p className="font-semibold">
                              {invoice.amount} {invoice.tokenSymbol}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(invoice.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <StatusBadge status={invoice.status} />
                          <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
