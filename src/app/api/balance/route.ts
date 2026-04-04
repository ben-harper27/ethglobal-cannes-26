import { NextResponse } from "next/server"
import { getFreelancerClient } from "@/lib/unlink"

export async function GET() {
  try {
    const unlink = getFreelancerClient()
    const { balances } = await unlink.getBalances()
    return NextResponse.json({ balances })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get balances"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
