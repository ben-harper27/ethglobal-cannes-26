import { NextResponse } from "next/server"
import { store } from "@/lib/store"
import { getClientForUser } from "@/lib/unlink"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const unlinkAddress = searchParams.get("unlink")

  if (!unlinkAddress) {
    return NextResponse.json(
      { error: "unlink query parameter is required" },
      { status: 400 }
    )
  }

  const user = await store.getUser(unlinkAddress)
  if (!user) {
    return NextResponse.json({ balances: [] })
  }

  try {
    const client = getClientForUser(user)
    const { balances } = await client.getBalances()
    return NextResponse.json({ balances })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get balances"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
