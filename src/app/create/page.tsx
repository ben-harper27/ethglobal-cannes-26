"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EnsBadge } from "@/components/ens-badge"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useDeferredValue } from "react"
import { useQuery } from "@tanstack/react-query"

const fetchEns = async (name: string) => {
  const res = await fetch(`/api/resolve-ens?name=${name}`)
  if (!res.ok) throw new Error("Could not resolve ENS name")
  return res.json()
}

export default function CreateInvoicePage() {
  const router = useRouter()
  const [ensName, setEnsName] = useState("")
  const [amount, setAmount] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const deferredEns = useDeferredValue(ensName)
  const ensQuery = deferredEns.endsWith(".eth") ? deferredEns : null

  const { data: ensData, isLoading: ensLoading, isError: ensError } = useQuery({
    queryKey: ["resolve-ens", ensQuery],
    queryFn: () => fetchEns(ensQuery!),
    enabled: !!ensQuery,
    retry: false,
  })

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (!ensData?.address) {
        toast.error("Please enter a valid ENS name")
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
            freelancerEns: ensName,
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
    [ensData, ensName, amount, router]
  )

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Create Invoice</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium" htmlFor="ens">
                Your ENS Name
              </label>
              <div className="flex items-center gap-2">
                <Input
                  id="ens"
                  placeholder="yourname.eth"
                  value={ensName}
                  onChange={(e) => setEnsName(e.target.value)}
                />
                <EnsBadge
                  address={ensData?.address ?? null}
                  isLoading={ensLoading}
                  isError={ensError}
                />
              </div>
            </div>

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

            <Button type="submit" disabled={isSubmitting || !ensData?.address}>
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
