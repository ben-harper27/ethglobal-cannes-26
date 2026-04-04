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
    await client.ensureRegistered()
    const unlinkAddress = await client.getAddress()

    return NextResponse.json({ unlinkAddress })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Registration failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
