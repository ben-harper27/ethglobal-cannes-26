"use client"

import { use, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/status-badge"
import { useInvoice } from "@/hooks/use-invoice"
import { useDynamicContext } from "@dynamic-labs/sdk-react-core"
import {
  CheckCircle,
  Copy,
  EyeOff,
  Loader2,
  ArrowDownToLine,
  ShieldCheck,
  Wallet,
} from "lucide-react"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import {
  createPublicClient,
  http,
  encodeFunctionData,
  erc20Abi,
  maxUint256,
} from "viem"
import { baseSepolia } from "viem/chains"

type PaymentStep = "idle" | "approving" | "signing" | "confirming" | "done"

const steps: { key: PaymentStep; label: string }[] = [
  { key: "approving", label: "Approving token for Permit2..." },
  { key: "signing", label: "Signing deposit..." },
  { key: "confirming", label: "Confirming on-chain..." },
  { key: "done", label: "Payment complete!" },
]

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
})

export default function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { invoice, isLoading, invalidate } = useInvoice(id)
  const { primaryWallet } = useDynamicContext()
  const [paymentStep, setPaymentStep] = useState<PaymentStep>("idle")
  const [txHash, setTxHash] = useState<string | null>(null)

  const isConnected = !!primaryWallet

  const handlePay = async () => {
    if (!invoice || !primaryWallet) return

    const payerAddress = primaryWallet.address
    if (!payerAddress) return

    try {
      setPaymentStep("approving")

      // WHY: ensure payer is on Base Sepolia before any transactions
      const currentChainId = await primaryWallet.getNetwork()
      if (Number(currentChainId) !== baseSepolia.id) {
        await primaryWallet.switchNetwork(baseSepolia.id)
      }

      // WHY: Dynamic's type system doesn't expose getWalletClient on the base Wallet type
      // but EOA connectors (MetaMask etc.) implement it
      const connector = primaryWallet.connector as unknown as {
        getWalletClient(): { signTypedData: (args: unknown) => Promise<string>; sendTransaction: (args: unknown) => Promise<string> }
      }
      const walletClient = connector.getWalletClient()

      // Step 1: Prepare the deposit — get typed data from server
      const prepareRes = await fetch("/api/pay/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: invoice.id, payerAddress }),
      })

      if (!prepareRes.ok) {
        const data = await prepareRes.json()
        throw new Error(data.error || "Failed to prepare payment")
      }

      const { txId, typedData, nonce, deadline, permit2Address } =
        await prepareRes.json()

      // Step 2: Approve ERC-20 for Permit2 (if needed)
      const allowance = await publicClient.readContract({
        address: invoice.tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: "allowance",
        args: [payerAddress as `0x${string}`, permit2Address as `0x${string}`],
      })

      if (allowance < BigInt(invoice.amountWei)) {
        const approveTx = await walletClient.sendTransaction({
          to: invoice.tokenAddress as `0x${string}`,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: "approve",
            args: [permit2Address as `0x${string}`, maxUint256],
          }),
        })
        await publicClient.waitForTransactionReceipt({ hash: approveTx as `0x${string}` })
      }

      setPaymentStep("signing")

      // Step 3: Sign the Permit2 witness typed data
      const signature = await walletClient.signTypedData({
        domain: typedData.domain,
        types: typedData.types,
        primaryType: typedData.primaryType,
        message: typedData.message,
      })

      setPaymentStep("confirming")

      // Step 4: Submit signature to server
      const submitRes = await fetch("/api/pay/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: invoice.id,
          txId,
          signature,
          nonce,
          deadline,
        }),
      })

      if (!submitRes.ok) {
        const data = await submitRes.json()
        throw new Error(data.error || "Payment failed")
      }

      const submitData = await submitRes.json()
      if (submitData.txHash) {
        setTxHash(submitData.txHash)
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
              <span className="text-sm text-muted-foreground">Amount</span>
              <span className="text-2xl font-bold">
                {invoice.amount} {invoice.tokenSymbol}
              </span>
            </div>
            {isPaid && invoice.txHash && (
              <a
                href={`https://sepolia.basescan.org/tx/${invoice.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary underline"
              >
                View transaction on BaseScan
              </a>
            )}
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
                {(txHash || invoice.txHash) && (
                  <a
                    href={`https://sepolia.basescan.org/tx/${txHash || invoice.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary underline"
                  >
                    View on BaseScan
                  </a>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-2">
            {!isPaid && paymentStep === "idle" && (
              <>
                {!isConnected ? (
                  <div className="flex flex-1 flex-col items-center gap-2 rounded-lg bg-muted p-4">
                    <Wallet className="h-6 w-6 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Connect your wallet to pay
                    </p>
                  </div>
                ) : (
                  <Button className="flex-1" onClick={handlePay}>
                    <ArrowDownToLine className="mr-2 h-4 w-4" />
                    Pay Now
                  </Button>
                )}
              </>
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
