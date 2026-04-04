import { NextResponse } from "next/server"
import { createClientFromSeed } from "@/lib/unlink"

export async function POST(request: Request) {
  const { seed } = await request.json()

  if (!seed) {
    return NextResponse.json(
      { error: "seed is required" },
      { status: 400 }
    )
  }

  try {
    const client = createClientFromSeed(seed)
    const { balances } = await client.getBalances()
    return NextResponse.json({ balances })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get balances"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
