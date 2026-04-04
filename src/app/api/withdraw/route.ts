import { NextResponse } from "next/server"
import { createClientFromSeed } from "@/lib/unlink"

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
    const tokenAddress = process.env.TEST_TOKEN_ADDRESS!

    const result = await client.withdraw({
      recipientEvmAddress: recipientAddress,
      token: tokenAddress,
      amount,
    })

    await client.pollTransactionStatus(result.txId)

    return NextResponse.json({ status: "withdrawn", txId: result.txId })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Withdrawal failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
