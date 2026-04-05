"use client"

import { use, useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/status-badge"
import { useInvoice } from "@/hooks/use-invoice"
import { useDynamicContext } from "@dynamic-labs/sdk-react-core"
import { USDC, WETH, ETH } from "@/lib/tokens"
import {
  CheckCircle,
  Copy,
  EyeOff,
  Loader2,
  ArrowDownToLine,
  ShieldCheck,
  Wallet,
  ArrowRightLeft,
} from "lucide-react"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import {
  createPublicClient,
  http,
  encodeFunctionData,
  erc20Abi,
  maxUint256,
  formatUnits,
} from "viem"
import { baseSepolia } from "viem/chains"

type PaymentStep = "idle" | "approving" | "signing" | "confirming" | "done"

const directSteps: { key: PaymentStep; label: string }[] = [
  { key: "approving", label: "Approving token for Permit2..." },
  { key: "signing", label: "Signing deposit..." },
  { key: "confirming", label: "Confirming on-chain..." },
  { key: "done", label: "Payment complete!" },
]

const swapSteps: { key: PaymentStep; label: string }[] = [
  { key: "approving", label: "Sending funds..." },
  { key: "signing", label: "Swapping & depositing to privacy pool..." },
  { key: "done", label: "Payment complete!" },
]

const PAYMENT_TOKENS = [USDC, WETH, ETH]

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
  const [selectedToken, setSelectedToken] = useState<string>(USDC.address)

  const [quote, setQuote] = useState<{ amountIn: string; amountInWithSlippage: string; gasBuffer: string } | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)

  const isConnected = !!primaryWallet
  const isEth = selectedToken === ETH.address
  const isCrossToken = invoice?.tokenAddress
    ? selectedToken.toLowerCase() !== invoice.tokenAddress.toLowerCase()
    : false
  const steps = isCrossToken ? swapSteps : directSteps

  const swapTokenIn = isEth ? WETH.address : selectedToken
  const swapTokenDecimals = isEth ? WETH.decimals : PAYMENT_TOKENS.find(t => t.address === selectedToken)?.decimals ?? 18

  useEffect(() => {
    if (!invoice || !isCrossToken) { setQuote(null); return }

    setQuoteLoading(true)
    fetch(`/api/quote?tokenIn=${swapTokenIn}&tokenOut=${invoice.tokenAddress}&amountOut=${invoice.amountWei}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setQuote(data) })
      .catch(() => setQuote(null))
      .finally(() => setQuoteLoading(false))
  }, [invoice, isCrossToken, swapTokenIn, invoice?.tokenAddress, invoice?.amountWei])

  const getWalletClient = () => {
    const connector = primaryWallet!.connector as unknown as {
      getWalletClient(): {
        signTypedData: (args: unknown) => Promise<string>
        sendTransaction: (args: unknown) => Promise<`0x${string}`>
      }
    }
    return connector.getWalletClient()
  }

  const ensureBaseSepolia = async () => {
    const currentChainId = await primaryWallet!.getNetwork()
    if (Number(currentChainId) !== baseSepolia.id) {
      await primaryWallet!.switchNetwork(baseSepolia.id)
    }
  }

  const handleDirectPay = async () => {
    if (!invoice || !primaryWallet) return

    const payerAddress = primaryWallet.address!

    setPaymentStep("approving")
    await ensureBaseSepolia()
    const walletClient = getWalletClient()

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
      await publicClient.waitForTransactionReceipt({ hash: approveTx })
    }

    setPaymentStep("signing")

    const signature = await walletClient.signTypedData({
      domain: typedData.domain,
      types: typedData.types,
      primaryType: typedData.primaryType,
      message: typedData.message,
    })

    setPaymentStep("confirming")

    const submitRes = await fetch("/api/pay/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId: invoice.id, txId, signature, nonce, deadline }),
    })

    if (!submitRes.ok) {
      const data = await submitRes.json()
      throw new Error(data.error || "Payment failed")
    }

    const submitData = await submitRes.json()
    if (submitData.txHash) setTxHash(submitData.txHash)
  }

  const handleSwapPay = async () => {
    if (!invoice || !primaryWallet || !quote) return

    const payerAddress = primaryWallet.address!
    const sendAmount = quote.amountInWithSlippage

    setPaymentStep("approving")
    await ensureBaseSepolia()
    const walletClient = getWalletClient()

    const createRes = await fetch("/api/pay/swap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoiceId: invoice.id,
        action: "create",
        payerAddress,
      }),
    })

    if (!createRes.ok) {
      const data = await createRes.json()
      throw new Error(data.error || "Failed to create swap agent")
    }

    const { burnerAddress } = await createRes.json()

    if (isEth) {
      const sendTx = await walletClient.sendTransaction({
        to: burnerAddress as `0x${string}`,
        value: BigInt(sendAmount),
      })
      await publicClient.waitForTransactionReceipt({ hash: sendTx })
    } else {
      const sendTx = await walletClient.sendTransaction({
        to: selectedToken as `0x${string}`,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "transfer",
          args: [burnerAddress as `0x${string}`, BigInt(sendAmount)],
        }),
      })
      await publicClient.waitForTransactionReceipt({ hash: sendTx })
    }

    setPaymentStep("signing")

    const executeRes = await fetch("/api/pay/swap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoiceId: invoice.id,
        action: "execute",
        burnerAddress,
        tokenIn: isEth ? WETH.address : selectedToken,
        amountIn: sendAmount,
        payerAddress,
      }),
    })

    if (!executeRes.ok) {
      const data = await executeRes.json()
      throw new Error(data.error || "Swap failed")
    }

    const executeData = await executeRes.json()
    if (executeData.txHash) setTxHash(executeData.txHash)
  }

  const handlePay = async () => {
    if (!invoice || !primaryWallet) return

    try {
      if (isCrossToken) {
        await handleSwapPay()
      } else {
        await handleDirectPay()
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
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <EyeOff className="h-10 w-10 text-muted-foreground" />
        <p className="text-lg font-medium text-muted-foreground">
          Invoice not found
        </p>
      </div>
    )
  }

  const isPaid = invoice.status === "paid" || invoice.status === "withdrawn"
  const isPaying = paymentStep !== "idle" && paymentStep !== "done"
  const selectedTokenInfo = PAYMENT_TOKENS.find(
    (t) => t.address === selectedToken
  )

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card>
          <CardContent className="flex flex-col gap-8 py-10">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex items-center gap-2">
                <EyeOff className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Private Invoice
                </span>
                <StatusBadge status={invoice.status} />
              </div>
              <p className="text-5xl font-bold">
                {invoice.amount}{" "}
                <span className="text-2xl text-muted-foreground">
                  {invoice.tokenSymbol}
                </span>
              </p>
              {isPaid && txHash && (
                <a
                  href={`https://sepolia.basescan.org/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-muted"
                >
                  View transaction on BaseScan
                  <ArrowDownToLine className="h-3.5 w-3.5 -rotate-90" />
                </a>
              )}
            </div>

            {!isPaid && !isPaying && paymentStep === "idle" && isConnected && (
              <div className="flex flex-col gap-3">
                <label className="text-center text-sm font-medium text-muted-foreground">
                  Pay with
                </label>
                <div className="flex justify-center gap-2">
                  {PAYMENT_TOKENS.map((token) => {
                    const isSelected = selectedToken === token.address
                    const isSwap =
                      token.address.toLowerCase() !==
                        (invoice.tokenAddress?.toLowerCase() ?? "") ||
                      token.address === ETH.address
                    return (
                      <Button
                        key={token.address}
                        variant={isSelected ? "default" : "outline"}
                        onClick={() => setSelectedToken(token.address)}
                        className="min-w-[80px] gap-1.5"
                      >
                        {token.symbol}
                        {isSwap && (
                          <ArrowRightLeft className="h-3 w-3 opacity-50" />
                        )}
                      </Button>
                    )
                  })}
                </div>
                {isCrossToken && (
                  <div className="rounded-xl bg-muted p-4 text-center">
                    {quoteLoading ? (
                      <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Getting quote...
                      </p>
                    ) : quote ? (
                      <div>
                        <p className="text-lg font-semibold">
                          ≈{" "}
                          {Number(
                            formatUnits(
                              BigInt(quote.amountInWithSlippage),
                              swapTokenDecimals
                            )
                          ).toFixed(6)}{" "}
                          {isEth
                            ? "ETH"
                            : selectedTokenInfo?.symbol}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Includes slippage
                          {quote.gasBuffer !== "0" ? " + gas" : ""} — excess
                          refunded
                        </p>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )}

            <AnimatePresence mode="wait">
              {isPaying && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex flex-col gap-3 rounded-xl bg-muted p-5"
                >
                  {steps.map((step) => {
                    const stepIndex = steps.findIndex(
                      (s) => s.key === paymentStep
                    )
                    const thisIndex = steps.findIndex(
                      (s) => s.key === step.key
                    )
                    const isActive = step.key === paymentStep
                    const isDone = thisIndex < stepIndex

                    return (
                      <div
                        key={step.key}
                        className="flex items-center gap-3 text-sm"
                      >
                        {isDone ? (
                          <CheckCircle className="h-5 w-5 shrink-0 text-green-500" />
                        ) : isActive ? (
                          <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
                        ) : (
                          <div className="h-5 w-5 shrink-0 rounded-full border-2 border-border" />
                        )}
                        <span
                          className={
                            isActive
                              ? "font-medium"
                              : isDone
                                ? "text-muted-foreground"
                                : "text-muted-foreground/40"
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
                  className="flex flex-col items-center gap-3 rounded-xl bg-green-50 p-8 dark:bg-green-950/20"
                >
                  <ShieldCheck className="h-12 w-12 text-green-500" />
                  <div className="text-center">
                    <p className="text-lg font-semibold text-green-700 dark:text-green-400">
                      Paid privately
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      No on-chain link between payer and payee
                    </p>
                  </div>
                  {txHash && (
                    <a
                      href={`https://sepolia.basescan.org/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary underline"
                    >
                      View on BaseScan
                    </a>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex flex-col gap-3">
              {!isPaid && paymentStep === "idle" && (
                <>
                  {!isConnected ? (
                    <div className="flex flex-col items-center gap-3 rounded-xl bg-muted p-6">
                      <Wallet className="h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Connect your wallet to pay this invoice
                      </p>
                    </div>
                  ) : (
                    <Button
                      size="lg"
                      className="w-full"
                      onClick={handlePay}
                      disabled={isCrossToken && (!quote || quoteLoading)}
                    >
                      <ArrowDownToLine className="mr-2 h-4 w-4" />
                      {isCrossToken ? "Swap & Pay" : "Pay Now"}
                    </Button>
                  )}
                </>
              )}
              {!isPaid && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={copyPaymentLink}
                >
                  <Copy className="mr-2 h-3.5 w-3.5" />
                  Copy payment link
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Powered by Unlink&apos;s zero-knowledge privacy pool
        </p>
      </motion.div>
    </div>
  )
}
