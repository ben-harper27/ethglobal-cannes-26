import { NextResponse } from "next/server"
import { deriveSeed } from "@/lib/auth"
import { store } from "@/lib/store"
import { getClientForUser } from "@/lib/unlink"
import { toHex } from "viem"

export async function POST(request: Request) {
  const { signature } = await request.json()

  if (!signature) {
    return NextResponse.json(
      { error: "signature is required" },
      { status: 400 }
    )
  }

  try {
    const seed = deriveSeed(signature)
    const seedHex = toHex(seed)

    const tempUser = { unlinkAddress: "", seed: seedHex }
    const client = getClientForUser(tempUser)
    const unlinkAddress = await client.getAddress()

    const existing = await store.getUser(unlinkAddress)
    if (existing) {
      return NextResponse.json({ unlinkAddress })
    }

    await client.ensureRegistered()

    await store.setUser({ unlinkAddress, seed: seedHex })

    return NextResponse.json({ unlinkAddress })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Derivation failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
