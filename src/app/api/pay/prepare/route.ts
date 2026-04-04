import { NextResponse } from "next/server"
import { store } from "@/lib/store"
import {
  createUnlinkClient,
  getEnvironment,
  getPermit2Nonce,
} from "@unlink-xyz/sdk"

const ENGINE_URL = "https://staging-api.unlink.xyz"

export async function POST(request: Request) {
  const { invoiceId, payerAddress } = await request.json()

  const invoice = await store.get(invoiceId)
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  }

  if (invoice.status === "paid" || invoice.status === "withdrawn") {
    return NextResponse.json(
      { error: `Invoice is already ${invoice.status}` },
      { status: 400 }
    )
  }

  // WHY: reset "paying" back to "pending" to allow retry after failed attempts
  if (invoice.status === "paying") {
    await store.update(invoiceId, { status: "pending" })
  }

  try {
    const client = createUnlinkClient(ENGINE_URL, process.env.UNLINK_API_KEY!)
    const env = await getEnvironment(client)
    const nonce = await getPermit2Nonce(client, payerAddress)
    const deadline = Math.floor(Date.now() / 1000) + 3600

    const prepareRes = await client.POST("/transactions/deposit/prepare", {
      body: {
        unlink_address: invoice.recipientUnlinkAddress,
        token: invoice.tokenAddress,
        amount: invoice.amountWei,
        environment: env.name,
        evm_address: payerAddress,
      },
    })

    if (prepareRes.error) {
      return NextResponse.json(
        { error: prepareRes.error },
        { status: 400 }
      )
    }

    const { tx_id, notes_hash } = prepareRes.data!.data

    // WHY: build the EIP-712 typed data that the payer needs to sign
    // This is Permit2 PermitWitnessTransferFrom with the deposit witness
    const typedData = {
      domain: {
        name: "Permit2",
        chainId: env.chain_id,
        verifyingContract: env.permit2_address,
      },
      types: {
        PermitWitnessTransferFrom: [
          { name: "permitted", type: "TokenPermissions" },
          { name: "spender", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
          { name: "witness", type: "DepositWitness" },
        ],
        TokenPermissions: [
          { name: "token", type: "address" },
          { name: "amount", type: "uint256" },
        ],
        DepositWitness: [
          { name: "notesHash", type: "bytes32" },
        ],
      },
      primaryType: "PermitWitnessTransferFrom" as const,
      message: {
        permitted: {
          token: invoice.tokenAddress,
          amount: invoice.amountWei,
        },
        spender: env.pool_address,
        nonce,
        deadline: String(deadline),
        witness: {
          notesHash: notes_hash,
        },
      },
    }

    return NextResponse.json({
      txId: tx_id,
      typedData,
      nonce,
      deadline,
      poolAddress: env.pool_address,
      permit2Address: env.permit2_address,
      chainId: env.chain_id,
    })
  } catch (error) {
    console.error("Pay prepare error:", error)
    const message = error instanceof Error ? error.message : "Prepare failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
