import { NextResponse } from "next/server"
import { store } from "@/lib/store"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const unlinkAddress = searchParams.get("unlink")

  if (!unlinkAddress) {
    return NextResponse.json({ registered: false })
  }

  const user = await store.getUser(unlinkAddress)
  if (!user) {
    return NextResponse.json({ registered: false })
  }

  return NextResponse.json({ registered: true, unlinkAddress: user.unlinkAddress })
}
