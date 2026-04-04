import { NextResponse } from "next/server"
import { deriveSeed } from "@/lib/auth"
import { store } from "@/lib/store"
import { getClientForUser } from "@/lib/unlink"
import { toHex } from "viem"

export async function POST(request: Request) {
  const { signature, walletAddress } = await request.json()

  if (!signature || !walletAddress) {
    return NextResponse.json(
      { error: "signature and walletAddress are required" },
      { status: 400 }
    )
  }

  const existing = store.getUser(walletAddress)
  if (existing) {
    return NextResponse.json({ unlinkAddress: existing.unlinkAddress })
  }

  try {
    const seed = deriveSeed(signature)
    const seedHex = toHex(seed)

    const user = {
      walletAddress: walletAddress.toLowerCase(),
      unlinkAddress: "",
      seed: seedHex,
    }

    const client = getClientForUser(user)
    await client.ensureRegistered()
    const unlinkAddress = await client.getAddress()

    user.unlinkAddress = unlinkAddress
    store.setUser(user)

    return NextResponse.json({ unlinkAddress })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Derivation failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
