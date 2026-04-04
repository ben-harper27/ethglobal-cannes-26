import { NextResponse } from "next/server"
import { nanoid } from "nanoid"
import { store } from "@/lib/store"
import { getFreelancerClient } from "@/lib/unlink"
import { resolveEns } from "@/lib/ens"
import type { Invoice } from "@/lib/types"
import { parseUnits } from "viem"

export async function GET() {
  return NextResponse.json(store.list())
}

export async function POST(request: Request) {
  const body = await request.json()
  const { freelancerEns, amount, tokenSymbol, autoSwap } = body

  const tokenAddress = process.env.TEST_TOKEN_ADDRESS!

  const freelancerAddress = await resolveEns(freelancerEns)
  if (!freelancerAddress) {
    return NextResponse.json(
      { error: `Could not resolve ENS name: ${freelancerEns}` },
      { status: 400 }
    )
  }

  const unlink = getFreelancerClient()
  const recipientUnlinkAddress = await unlink.getAddress()

  const amountWei = parseUnits(amount, 18).toString()

  const invoice: Invoice = {
    id: nanoid(12),
    freelancerEns,
    freelancerAddress,
    tokenAddress,
    tokenSymbol: tokenSymbol || "TEST",
    amount,
    amountWei,
    recipientUnlinkAddress,
    status: "pending",
    autoSwap: autoSwap || undefined,
    createdAt: Date.now(),
  }

  store.create(invoice)

  return NextResponse.json(invoice, { status: 201 })
}
