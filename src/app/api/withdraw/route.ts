import { NextResponse } from "next/server"
import { createClientFromSeed } from "@/lib/unlink"
import { INVOICE_TOKEN } from "@/lib/tokens"

export async function POST(request: Request) {
  const { seed, recipientAddress, amount } = await request.json()

  if (!seed || !recipientAddress || !amount) {
    return NextResponse.json(
      { error: "seed, recipientAddress, and amount are required" },
      { status: 400 }
    )
  }

  try {
    const client = createClientFromSeed(seed)

    const result = await client.withdraw({
      recipientEvmAddress: recipientAddress,
      token: INVOICE_TOKEN.address,
      amount,
    })

    await client.pollTransactionStatus(result.txId)

    return NextResponse.json({ status: "withdrawn", txId: result.txId })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Withdrawal failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
