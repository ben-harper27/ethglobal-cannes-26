import { NextResponse } from "next/server"
import { getFreelancerClient } from "@/lib/unlink"

export async function POST(request: Request) {
  const { recipientAddress, amount } = await request.json()

  if (!recipientAddress || !amount) {
    return NextResponse.json(
      { error: "recipientAddress and amount are required" },
      { status: 400 }
    )
  }

  try {
    const unlink = getFreelancerClient()
    const tokenAddress = process.env.TEST_TOKEN_ADDRESS!

    const result = await unlink.withdraw({
      recipientEvmAddress: recipientAddress,
      token: tokenAddress,
      amount,
    })

    await unlink.pollTransactionStatus(result.txId)

    return NextResponse.json({ status: "withdrawn", txId: result.txId })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Withdrawal failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
