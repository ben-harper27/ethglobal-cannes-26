import { NextResponse } from "next/server"
import { getFreelancerClient, getPayerClient } from "@/lib/unlink"

export async function POST(request: Request) {
  const { wallet } = await request.json()

  try {
    const client = wallet === "payer" ? getPayerClient() : getFreelancerClient()

    const result = await client.faucet.requestTestTokens({
      token: process.env.TEST_TOKEN_ADDRESS!,
    })

    return NextResponse.json({ success: true, txHash: result.tx_hash })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Faucet request failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
