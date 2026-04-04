import { NextResponse } from "next/server"
import { resolveEns } from "@/lib/ens"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const name = searchParams.get("name")

  if (!name) {
    return NextResponse.json({ error: "name parameter required" }, { status: 400 })
  }

  const address = await resolveEns(name)

  if (!address) {
    return NextResponse.json({ error: `Could not resolve: ${name}` }, { status: 404 })
  }

  return NextResponse.json({ name, address })
}
