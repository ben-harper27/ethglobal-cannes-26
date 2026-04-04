"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { StatusBadge } from "@/components/status-badge"
import { useInvoices } from "@/hooks/use-invoices"
import { useBalance } from "@/hooks/use-balance"
import { useWalletAuth } from "@/hooks/use-wallet-auth"
import { Loader2, Plus, ExternalLink, Wallet } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatUnits } from "viem"

export default function DashboardPage() {
  const { unlinkAddress, seed, isConnected, isDeriving } = useWalletAuth()
  const { invoices, isLoading: invoicesLoading } = useInvoices(unlinkAddress)
  const { balances, isLoading: balancesLoading } = useBalance(seed)

  if (!isConnected) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Wallet className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">
              Connect your wallet to view your dashboard
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isDeriving) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
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
    <div className="mx-auto max-w-3xl px-4 py-16">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link href="/create" className={cn(buttonVariants(), "gap-2")}>
          <Plus className="h-4 w-4" />
          New Invoice
        </Link>
      </div>

      <div className="mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Private Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {balancesLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : balances.length === 0 ? (
              <p className="text-2xl font-bold">0.00</p>
            ) : (
              <div className="flex flex-col gap-1">
                {balances.map((b) => (
                  <p key={b.token} className="text-2xl font-bold">
                    {formatUnits(BigInt(b.amount), 18)} TEST
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Invoices</h2>

        {invoicesLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : invoices.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No invoices yet. Create your first one!
            </CardContent>
          </Card>
        ) : (
          invoices.map((invoice) => (
            <Link key={invoice.id} href={`/invoice/${invoice.id}`}>
              <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {invoice.amount} {invoice.tokenSymbol}
                    </span>
                    <StatusBadge status={invoice.status} />
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
