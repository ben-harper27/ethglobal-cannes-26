import { NextResponse } from "next/server"
import { store } from "@/lib/store"
import { createUnlinkClient } from "@unlink-xyz/sdk"

const ENGINE_URL = "https://staging-api.unlink.xyz"
const TERMINAL_STATUSES = new Set(["relayed", "processed", "failed"])

export async function POST(request: Request) {
  const { invoiceId, txId, signature, nonce, deadline } = await request.json()

  const invoice = await store.get(invoiceId)
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  }

  await store.update(invoiceId, { status: "paying" })

  try {
    const client = createUnlinkClient(ENGINE_URL, process.env.UNLINK_API_KEY!)

    const submitRes = await client.POST(
      "/transactions/deposit/{tx_id}/submit",
      {
        params: { path: { tx_id: txId } },
        body: {
          permit2_signature: signature,
          permit2_nonce: nonce,
          permit2_deadline: deadline,
        },
      }
    )

    if (submitRes.error) {
      await store.update(invoiceId, { status: "pending" })
      return NextResponse.json({ error: submitRes.error }, { status: 400 })
    }

    let status = submitRes.data!.data.status
    let txHash: string | undefined
    const maxPolls = 30
    let polls = 0
    while (!TERMINAL_STATUSES.has(status) && polls < maxPolls) {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      const txRes = await client.GET("/transactions/{tx_id}", {
        params: { path: { tx_id: txId } },
      })
      status = txRes.data?.data.status ?? "failed"
      txHash = (txRes.data?.data as Record<string, unknown>)?.tx_hash as string | undefined
      polls++
    }

    if (status === "failed") {
      await store.update(invoiceId, { status: "pending" })
      return NextResponse.json({ error: "Deposit failed" }, { status: 500 })
    }

    if (polls >= maxPolls) {
      await store.update(invoiceId, { status: "pending" })
      return NextResponse.json({ error: "Deposit timed out" }, { status: 504 })
    }

    await store.update(invoiceId, {
      status: "paid",
      paidAt: Date.now(),
    })

    return NextResponse.json({ status: "paid", txId, txHash })
  } catch (error) {
    await store.update(invoiceId, { status: "pending" })
    const message = error instanceof Error ? error.message : "Payment failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
