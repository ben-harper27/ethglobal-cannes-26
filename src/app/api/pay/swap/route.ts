import { NextResponse } from "next/server"
import { store } from "@/lib/store"
import {
  createUnlinkClient,
  BurnerWallet,
  deriveAccountKeys,
  getEnvironment,
  getPermit2Nonce,
} from "@unlink-xyz/sdk"
import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  erc20Abi,
  parseAbi,
  maxUint256,
} from "viem"
import { baseSepolia } from "viem/chains"
import { SWAP_ROUTER, POOL_FEE } from "@/lib/tokens"

const ENGINE_URL = "https://staging-api.unlink.xyz"

const swapRouterAbi = parseAbi([
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)",
])

export async function POST(request: Request) {
  const { invoiceId, payerSeed, tokenIn, amountIn } = await request.json()

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

  await store.update(invoiceId, { status: "paying" })

  try {
    const client = createUnlinkClient(ENGINE_URL, process.env.UNLINK_API_KEY!)
    const env = await getEnvironment(client)
    const seedBytes = new Uint8Array(
      Buffer.from(payerSeed.startsWith("0x") ? payerSeed.slice(2) : payerSeed, "hex")
    )
    const senderKeys = await deriveAccountKeys(seedBytes)

    // Step 1: Create burner wallet
    const burner = await BurnerWallet.create()
    console.log(`[swap] burner created: ${burner.address}`)

    // Step 2: Fund burner from payer's pool balance
    const fundResult = await burner.fundFromPool(client, {
      senderKeys,
      token: tokenIn,
      amount: amountIn,
      environment: env.name,
    })
    console.log(`[swap] burner funded: ${fundResult.txId}`)

    // Step 3: Set up burner wallet client for on-chain txs
    const burnerAccount = burner.toViemAccount()
    const burnerWalletClient = createWalletClient({
      account: burnerAccount,
      chain: baseSepolia,
      transport: http(process.env.BASE_SEPOLIA_RPC_URL),
    })
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(process.env.BASE_SEPOLIA_RPC_URL),
    })

    // Step 4: Approve token for Uniswap router
    const approveTx = await burnerWalletClient.sendTransaction({
      to: tokenIn as `0x${string}`,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [SWAP_ROUTER as `0x${string}`, maxUint256],
      }),
    })
    await publicClient.waitForTransactionReceipt({ hash: approveTx })
    console.log(`[swap] token approved for router`)

    // Step 5: Execute Uniswap swap
    const swapTx = await burnerWalletClient.sendTransaction({
      to: SWAP_ROUTER as `0x${string}`,
      data: encodeFunctionData({
        abi: swapRouterAbi,
        functionName: "exactInputSingle",
        args: [
          {
            tokenIn: tokenIn as `0x${string}`,
            tokenOut: invoice.tokenAddress as `0x${string}`,
            fee: POOL_FEE,
            recipient: burner.address,
            amountIn: BigInt(amountIn),
            amountOutMinimum: BigInt(0),
            sqrtPriceLimitX96: BigInt(0),
          },
        ],
      }),
    })
    const swapReceipt = await publicClient.waitForTransactionReceipt({ hash: swapTx })
    console.log(`[swap] swap executed: ${swapReceipt.transactionHash}`)

    // Step 6: Check how much output we got
    const outputBalance = await publicClient.readContract({
      address: invoice.tokenAddress as `0x${string}`,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [burner.address],
    })
    console.log(`[swap] output balance: ${outputBalance}`)

    // Step 7: Approve output token for Permit2 and deposit back to freelancer
    const approvePermit2Tx = await burnerWalletClient.sendTransaction({
      to: invoice.tokenAddress as `0x${string}`,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [env.permit2_address as `0x${string}`, maxUint256],
      }),
    })
    await publicClient.waitForTransactionReceipt({ hash: approvePermit2Tx })

    const nonce = await getPermit2Nonce(client, burner.address)
    const depositResult = await burner.depositToPool(client, {
      unlinkAddress: invoice.recipientUnlinkAddress,
      token: invoice.tokenAddress,
      amount: outputBalance.toString(),
      environment: env.name,
      chainId: env.chain_id,
      permit2Address: env.permit2_address,
      poolAddress: env.pool_address,
      nonce,
      deadline: Math.floor(Date.now() / 1000) + 3600,
    })
    console.log(`[swap] deposited to freelancer: ${depositResult.txId}`)

    // Step 8: Dispose burner
    await burner.dispose(client, depositResult.txId)
    await burner.deleteKey()

    await store.update(invoiceId, {
      status: "paid",
      txId: depositResult.txId,
      txHash: swapReceipt.transactionHash,
      paidAt: Date.now(),
    })

    return NextResponse.json({
      status: "paid",
      txId: depositResult.txId,
      txHash: swapReceipt.transactionHash,
    })
  } catch (error) {
    await store.update(invoiceId, { status: "pending" })
    console.error("Swap payment error:", error)
    const message = error instanceof Error ? error.message : "Swap payment failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
