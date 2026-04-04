import { NextResponse } from "next/server"
import { store } from "@/lib/store"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const wallet = searchParams.get("wallet")

  if (!wallet) {
    return NextResponse.json({ registered: false })
  }

  const user = store.getUser(wallet)
  if (!user) {
    return NextResponse.json({ registered: false })
  }

  return NextResponse.json({
    registered: true,
    unlinkAddress: user.unlinkAddress,
  })
}
