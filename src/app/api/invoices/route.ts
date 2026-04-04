import { NextResponse } from "next/server"
import { nanoid } from "nanoid"
import { store } from "@/lib/store"
import { getClientForUser } from "@/lib/unlink"
import { resolveEns } from "@/lib/ens"
import type { Invoice } from "@/lib/types"
import { parseUnits } from "viem"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const wallet = searchParams.get("wallet")

  if (wallet) {
    return NextResponse.json(store.listByWallet(wallet))
  }

  return NextResponse.json(store.list())
}

export async function POST(request: Request) {
  const body = await request.json()
  const { walletAddress, freelancerEns, amount, tokenSymbol, autoSwap } = body

  if (!walletAddress) {
    return NextResponse.json(
      { error: "walletAddress is required" },
      { status: 400 }
    )
  }

  const user = store.getUser(walletAddress)
  if (!user) {
    return NextResponse.json(
      { error: "Wallet not registered. Please connect and derive your account first." },
      { status: 400 }
    )
  }

  const tokenAddress = process.env.TEST_TOKEN_ADDRESS!

  const freelancerAddress = await resolveEns(freelancerEns)
  if (!freelancerAddress) {
    return NextResponse.json(
      { error: `Could not resolve ENS name: ${freelancerEns}` },
      { status: 400 }
    )
  }

  const client = getClientForUser(user)
  const recipientUnlinkAddress = await client.getAddress()

  const amountWei = parseUnits(amount, 18).toString()

  const invoice: Invoice = {
    id: nanoid(12),
    freelancerWallet: walletAddress.toLowerCase(),
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
