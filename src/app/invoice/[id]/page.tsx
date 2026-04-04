"use client"

import { use, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { StatusBadge } from "@/components/status-badge"
import { useInvoice } from "@/hooks/use-invoice"
import {
  CheckCircle,
  Copy,
  EyeOff,
  Loader2,
  ArrowDownToLine,
  ShieldCheck,
} from "lucide-react"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"

type PaymentStep = "idle" | "approving" | "depositing" | "transferring" | "done"

const steps: { key: PaymentStep; label: string }[] = [
  { key: "approving", label: "Approving token..." },
  { key: "depositing", label: "Depositing to privacy pool..." },
  { key: "transferring", label: "Transferring privately..." },
  { key: "done", label: "Payment complete!" },
]

export default function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { invoice, isLoading, invalidate } = useInvoice(id)
  const [paymentStep, setPaymentStep] = useState<PaymentStep>("idle")

  const handlePay = async () => {
    if (!invoice) return

    setPaymentStep("approving")

    try {
      setPaymentStep("depositing")

      const res = await fetch("/api/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: invoice.id }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Payment failed")
      }

      setPaymentStep("done")
      await invalidate()
      toast.success("Payment complete!")
    } catch (error) {
      setPaymentStep("idle")
      const message =
        error instanceof Error ? error.message : "Payment failed"
      toast.error(message)
    }
  }

  const copyPaymentLink = () => {
    const url = `${window.location.origin}/invoice/${id}`
    navigator.clipboard.writeText(url)
    toast.success("Payment link copied!")
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">Invoice not found</p>
      </div>
    )
  }

  const isPaid = invoice.status === "paid" || invoice.status === "withdrawn"
  const isPaying = paymentStep !== "idle" && paymentStep !== "done"

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <EyeOff className="h-5 w-5" />
            Invoice
          </CardTitle>
          <StatusBadge status={invoice.status} />
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Pay to</span>
              <Badge variant="outline" className="gap-1.5">
                {invoice.freelancerEns}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Address</span>
              <span className="font-mono text-xs text-muted-foreground">
                {invoice.freelancerAddress.slice(0, 10)}...
                {invoice.freelancerAddress.slice(-8)}
              </span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Amount</span>
              <span className="text-2xl font-bold">
                {invoice.amount} {invoice.tokenSymbol}
              </span>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {isPaying && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex flex-col gap-3 rounded-lg bg-muted p-4"
              >
                {steps.map((step) => {
                  const stepIndex = steps.findIndex(
                    (s) => s.key === paymentStep
                  )
                  const thisIndex = steps.findIndex((s) => s.key === step.key)
                  const isActive = step.key === paymentStep
                  const isDone = thisIndex < stepIndex

                  return (
                    <div
                      key={step.key}
                      className="flex items-center gap-2 text-sm"
                    >
                      {isDone ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : isActive ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border border-border" />
                      )}
                      <span
                        className={
                          isActive
                            ? "font-medium"
                            : isDone
                              ? "text-muted-foreground"
                              : "text-muted-foreground/50"
                        }
                      >
                        {step.label}
                      </span>
                    </div>
                  )
                })}
              </motion.div>
            )}

            {paymentStep === "done" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-2 rounded-lg bg-green-50 p-6 dark:bg-green-950/20"
              >
                <ShieldCheck className="h-10 w-10 text-green-500" />
                <p className="font-semibold text-green-700 dark:text-green-400">
                  Paid privately
                </p>
                <p className="text-center text-xs text-muted-foreground">
                  No on-chain link between payer and payee
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-2">
            {!isPaid && paymentStep === "idle" && (
              <Button className="flex-1" onClick={handlePay}>
                <ArrowDownToLine className="mr-2 h-4 w-4" />
                Pay Now
              </Button>
            )}
            <Button variant="outline" onClick={copyPaymentLink}>
              <Copy className="mr-2 h-4 w-4" />
              Copy Link
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
