import { NextResponse } from "next/server"
import { store } from "@/lib/store"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const invoice = await store.get(id)

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  }

  return NextResponse.json(invoice)
}
