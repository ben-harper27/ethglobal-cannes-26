import { NextResponse } from "next/server"
import { nanoid } from "nanoid"
import { store } from "@/lib/store"
import type { Invoice } from "@/lib/types"
import { parseUnits } from "viem"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const unlinkAddress = searchParams.get("unlink")

  if (!unlinkAddress) {
    return NextResponse.json(
      { error: "unlink query parameter is required" },
      { status: 400 }
    )
  }

  return NextResponse.json(await store.listByUnlinkAddress(unlinkAddress))
}

export async function POST(request: Request) {
  const body = await request.json()
  const { unlinkAddress, amount, tokenSymbol } = body

  if (!unlinkAddress || !amount) {
    return NextResponse.json(
      { error: "unlinkAddress and amount are required" },
      { status: 400 }
    )
  }

  const user = await store.getUser(unlinkAddress)
  if (!user) {
    return NextResponse.json(
      { error: "Account not registered" },
      { status: 400 }
    )
  }

  const tokenAddress = process.env.TEST_TOKEN_ADDRESS!
  const amountWei = parseUnits(amount, 18).toString()

  const invoice: Invoice = {
    id: nanoid(12),
    recipientUnlinkAddress: unlinkAddress,
    tokenAddress,
    tokenSymbol: tokenSymbol || "TEST",
    amount,
    amountWei,
    status: "pending",
    createdAt: Date.now(),
  }

  await store.create(invoice)

  return NextResponse.json(invoice, { status: 201 })
}
