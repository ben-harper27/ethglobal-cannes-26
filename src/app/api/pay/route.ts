import { NextResponse } from "next/server"
import { store } from "@/lib/store"
import { getPayerClient } from "@/lib/unlink"

export async function POST(request: Request) {
  const { invoiceId } = await request.json()

  const invoice = store.get(invoiceId)
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  }

  if (invoice.status !== "pending") {
    return NextResponse.json(
      { error: `Invoice is already ${invoice.status}` },
      { status: 400 }
    )
  }

  store.update(invoiceId, { status: "paying" })

  try {
    const payer = getPayerClient()

    const approval = await payer.ensureErc20Approval({
      token: invoice.tokenAddress,
      amount: invoice.amountWei,
    })

    if (approval.status === "submitted") {
      // WHY: wait for on-chain approval before depositing
      await new Promise((resolve) => setTimeout(resolve, 5000))
    }

    const deposit = await payer.deposit({
      token: invoice.tokenAddress,
      amount: invoice.amountWei,
    })

    await payer.pollTransactionStatus(deposit.txId)

    const transfer = await payer.transfer({
      recipientAddress: invoice.recipientUnlinkAddress,
      token: invoice.tokenAddress,
      amount: invoice.amountWei,
    })

    await payer.pollTransactionStatus(transfer.txId)

    store.update(invoiceId, {
      status: "paid",
      txId: transfer.txId,
      paidAt: Date.now(),
    })

    return NextResponse.json({ status: "paid", txId: transfer.txId })
  } catch (error) {
    store.update(invoiceId, { status: "pending" })
    const message = error instanceof Error ? error.message : "Payment failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
