import { NextResponse } from "next/server"
import { store } from "@/lib/store"
import { getClientForUser } from "@/lib/unlink"

export async function POST(request: Request) {
  const { walletAddress, recipientAddress, amount } = await request.json()

  if (!walletAddress || !recipientAddress || !amount) {
    return NextResponse.json(
      { error: "walletAddress, recipientAddress, and amount are required" },
      { status: 400 }
    )
  }

  const user = store.getUser(walletAddress)
  if (!user) {
    return NextResponse.json(
      { error: "Wallet not registered" },
      { status: 400 }
    )
  }

  try {
    const client = getClientForUser(user)
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
