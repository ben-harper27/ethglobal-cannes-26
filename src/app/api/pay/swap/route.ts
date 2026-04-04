import { NextResponse } from "next/server"
import { store } from "@/lib/store"
import {
  createUnlinkClient,
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
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts"
import { baseSepolia } from "viem/chains"
import { SWAP_ROUTER, POOL_FEE, WETH } from "@/lib/tokens"

const ENGINE_URL = "https://staging-api.unlink.xyz"

const swapRouterAbi = parseAbi([
  "function exactOutputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountOut, uint256 amountInMaximum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountIn)",
])

const wethAbi = parseAbi(["function deposit() external payable"])

// WHY: in-memory store for burner private keys — short-lived, cleaned up after use
const burnerKeys = new Map<string, `0x${string}`>()

export async function POST(request: Request) {
  const body = await request.json()
  const { action } = body

  if (action === "create") {
    return handleCreate(body)
  } else if (action === "execute") {
    return handleExecute(body)
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 })
}

async function handleCreate(body: { invoiceId: string; tokenIn: string; amountIn: string }) {
  const { invoiceId } = body

  const invoice = await store.get(invoiceId)
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  }

  const privateKey = generatePrivateKey()
  const account = privateKeyToAccount(privateKey)

  burnerKeys.set(account.address.toLowerCase(), privateKey)

  return NextResponse.json({ burnerAddress: account.address })
}

async function handleExecute(body: {
  invoiceId: string
  burnerAddress: string
  tokenIn: string
  amountIn: string
  payerAddress: string
}) {
  const { invoiceId, burnerAddress, tokenIn } = body

  const invoice = await store.get(invoiceId)
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  }

  const privateKey = burnerKeys.get(burnerAddress.toLowerCase())
  if (!privateKey) {
    return NextResponse.json({ error: "Burner not found" }, { status: 400 })
  }

  await store.update(invoiceId, { status: "paying" })

  try {
    const burnerAccount = privateKeyToAccount(privateKey)
    const burnerWalletClient = createWalletClient({
      account: burnerAccount,
      chain: baseSepolia,
      transport: http(process.env.BASE_SEPOLIA_RPC_URL),
    })
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(process.env.BASE_SEPOLIA_RPC_URL),
    })

    const isEthInput = tokenIn.toLowerCase() === WETH.address.toLowerCase()

    // Step 1: If input is WETH (from ETH send), wrap ETH keeping gas reserve
    if (isEthInput) {
      const ethBalance = await publicClient.getBalance({ address: burnerAccount.address })
      // WHY: reserve enough for ~5 txs (wrap, approve router, swap, approve permit2, deposit)
      const GAS_RESERVE = BigInt("5000000000000000") // 0.005 ETH
      const wrapAmount = ethBalance - GAS_RESERVE
      if (wrapAmount <= BigInt(0)) {
        throw new Error("Insufficient ETH sent — not enough to cover gas")
      }
      const wrapTx = await burnerWalletClient.sendTransaction({
        to: WETH.address as `0x${string}`,
        data: encodeFunctionData({ abi: wethAbi, functionName: "deposit" }),
        value: wrapAmount,
      })
      await publicClient.waitForTransactionReceipt({ hash: wrapTx })
      console.log(`[swap] wrapped ${wrapAmount} wei ETH to WETH, reserved ${GAS_RESERVE} wei for gas`)
    }

    // Step 2: Approve token for Uniswap router
    const approveTx = await burnerWalletClient.sendTransaction({
      to: tokenIn as `0x${string}`,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [SWAP_ROUTER as `0x${string}`, maxUint256],
      }),
    })
    await publicClient.waitForTransactionReceipt({ hash: approveTx })
    console.log(`[swap] approved token for router`)

    // Step 3: Get max input amount available
    const tokenBalance = await publicClient.readContract({
      address: tokenIn as `0x${string}`,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [burnerAccount.address],
    })
    console.log(`[swap] token balance available: ${tokenBalance}`)

    // Step 4: Swap exact output — freelancer gets the full invoice amount
    const swapTx = await burnerWalletClient.sendTransaction({
      to: SWAP_ROUTER as `0x${string}`,
      data: encodeFunctionData({
        abi: swapRouterAbi,
        functionName: "exactOutputSingle",
        args: [
          {
            tokenIn: tokenIn as `0x${string}`,
            tokenOut: invoice.tokenAddress as `0x${string}`,
            fee: POOL_FEE,
            recipient: burnerAccount.address,
            amountOut: BigInt(invoice.amountWei),
            amountInMaximum: tokenBalance,
            sqrtPriceLimitX96: BigInt(0),
          },
        ],
      }),
    })
    const swapReceipt = await publicClient.waitForTransactionReceipt({ hash: swapTx })
    console.log(`[swap] swap executed: ${swapReceipt.transactionHash}`)

    // Step 5: Check output balance
    const outputBalance = await publicClient.readContract({
      address: invoice.tokenAddress as `0x${string}`,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [burnerAccount.address],
    })
    console.log(`[swap] output balance: ${outputBalance}`)

    // Step 6: Deposit output to freelancer's Unlink address via Permit2
    const unlinkClient = createUnlinkClient(ENGINE_URL, process.env.UNLINK_API_KEY!)
    const env = await getEnvironment(unlinkClient)

    // Approve for Permit2
    const approvePermit2Tx = await burnerWalletClient.sendTransaction({
      to: invoice.tokenAddress as `0x${string}`,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [env.permit2_address as `0x${string}`, maxUint256],
      }),
    })
    await publicClient.waitForTransactionReceipt({ hash: approvePermit2Tx })

    const nonce = await getPermit2Nonce(unlinkClient, burnerAccount.address)

    const prepareRes = await unlinkClient.POST("/transactions/deposit/prepare", {
      body: {
        unlink_address: invoice.recipientUnlinkAddress,
        token: invoice.tokenAddress,
        amount: outputBalance.toString(),
        environment: env.name,
        evm_address: burnerAccount.address,
      },
    })

    if (prepareRes.error) {
      throw new Error(`Deposit prepare failed: ${JSON.stringify(prepareRes.error)}`)
    }

    const { tx_id, notes_hash } = prepareRes.data!.data
    const deadline = Math.floor(Date.now() / 1000) + 3600

    // Build and sign Permit2 witness typed data with burner key
    const typedData = {
      domain: {
        name: "Permit2" as const,
        chainId: env.chain_id,
        verifyingContract: env.permit2_address as `0x${string}`,
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
        DepositWitness: [{ name: "notesHash", type: "bytes32" }],
      },
      primaryType: "PermitWitnessTransferFrom" as const,
      message: {
        permitted: {
          token: invoice.tokenAddress as `0x${string}`,
          amount: outputBalance.toString(),
        },
        spender: env.pool_address as `0x${string}`,
        nonce: BigInt(nonce),
        deadline: BigInt(deadline),
        witness: { notesHash: notes_hash as `0x${string}` },
      },
    }

    const signature = await burnerWalletClient.signTypedData(typedData)

    const submitRes = await unlinkClient.POST("/transactions/deposit/{tx_id}/submit", {
      params: { path: { tx_id } },
      body: {
        permit2_signature: signature,
        permit2_nonce: nonce,
        permit2_deadline: deadline,
      },
    })

    if (submitRes.error) {
      throw new Error(`Deposit submit failed: ${JSON.stringify(submitRes.error)}`)
    }

    // Poll until terminal
    const TERMINAL = new Set(["relayed", "processed", "failed"])
    let status = submitRes.data!.data.status
    while (!TERMINAL.has(status)) {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      const txRes = await unlinkClient.GET("/transactions/{tx_id}", {
        params: { path: { tx_id } },
      })
      status = txRes.data?.data.status ?? "failed"
    }

    if (status === "failed") {
      throw new Error("Deposit to privacy pool failed")
    }

    // Clean up burner
    burnerKeys.delete(burnerAddress.toLowerCase())

    await store.update(invoiceId, {
      status: "paid",
      txId: tx_id,
      txHash: swapReceipt.transactionHash,
      paidAt: Date.now(),
    })

    return NextResponse.json({
      status: "paid",
      txId: tx_id,
      txHash: swapReceipt.transactionHash,
    })
  } catch (error) {
    burnerKeys.delete(burnerAddress.toLowerCase())
    await store.update(invoiceId, { status: "pending" })
    console.error("Swap payment error:", error)
    const message = error instanceof Error ? error.message : "Swap payment failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
