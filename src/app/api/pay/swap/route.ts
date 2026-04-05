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
const GAS_RESERVE = BigInt("3000000000000000") // 0.003 ETH

const swapRouterAbi = parseAbi([
  "function exactOutputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountOut, uint256 amountInMaximum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountIn)",
])

const wethAbi = parseAbi([
  "function deposit() external payable",
  "function withdraw(uint256 amount) external",
])

interface BurnerInfo {
  privateKey: `0x${string}`
  payerAddress: string
}

const burnerStore = new Map<string, BurnerInfo>()

async function refundBurner(
  burnerInfo: BurnerInfo,
  tokenIn: string,
  invoiceToken: string
) {
  try {
    const burnerAccount = privateKeyToAccount(burnerInfo.privateKey)
    const burnerWalletClient = createWalletClient({
      account: burnerAccount,
      chain: baseSepolia,
      transport: http(process.env.BASE_SEPOLIA_RPC_URL),
    })
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(process.env.BASE_SEPOLIA_RPC_URL),
    })

    const payerAddr = burnerInfo.payerAddress as `0x${string}`

    // Refund any remaining input token (WETH)
    const inputBalance = await publicClient.readContract({
      address: tokenIn as `0x${string}`,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [burnerAccount.address],
    })
    if (inputBalance > BigInt(0)) {
      // WHY: unwrap WETH back to ETH so payer gets native ETH
      if (tokenIn.toLowerCase() === WETH.address.toLowerCase()) {
        const unwrapTx = await burnerWalletClient.sendTransaction({
          to: WETH.address as `0x${string}`,
          data: encodeFunctionData({
            abi: wethAbi,
            functionName: "withdraw",
            args: [inputBalance],
          }),
        })
        await publicClient.waitForTransactionReceipt({ hash: unwrapTx })
        console.log(`[refund] unwrapped ${inputBalance} WETH`)
      } else {
        const refundTx = await burnerWalletClient.sendTransaction({
          to: tokenIn as `0x${string}`,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: "transfer",
            args: [payerAddr, inputBalance],
          }),
        })
        await publicClient.waitForTransactionReceipt({ hash: refundTx })
        console.log(`[refund] sent ${inputBalance} of ${tokenIn} back to payer`)
      }
    }

    // Refund any output token (e.g. USDC if swap happened but deposit failed)
    if (invoiceToken.toLowerCase() !== tokenIn.toLowerCase()) {
      const outputBalance = await publicClient.readContract({
        address: invoiceToken as `0x${string}`,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [burnerAccount.address],
      })
      if (outputBalance > BigInt(0)) {
        const refundTx = await burnerWalletClient.sendTransaction({
          to: invoiceToken as `0x${string}`,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: "transfer",
            args: [payerAddr, outputBalance],
          }),
        })
        await publicClient.waitForTransactionReceipt({ hash: refundTx })
        console.log(`[refund] sent ${outputBalance} of ${invoiceToken} back to payer`)
      }
    }

    // Refund remaining ETH
    const ethBalance = await publicClient.getBalance({ address: burnerAccount.address })
    // WHY: keep tiny amount for this last tx's gas
    const gasForRefund = BigInt("100000000000000") // 0.0001 ETH
    if (ethBalance > gasForRefund) {
      const refundTx = await burnerWalletClient.sendTransaction({
        to: payerAddr,
        value: ethBalance - gasForRefund,
      })
      await publicClient.waitForTransactionReceipt({ hash: refundTx })
      console.log(`[refund] sent ${ethBalance - gasForRefund} wei ETH back to payer`)
    }
  } catch (refundError) {
    console.error("[refund] failed:", refundError)
  }
}

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

async function handleCreate(body: { invoiceId: string; payerAddress: string }) {
  const { invoiceId, payerAddress } = body

  const invoice = await store.get(invoiceId)
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  }

  const privateKey = generatePrivateKey()
  const account = privateKeyToAccount(privateKey)

  burnerStore.set(account.address.toLowerCase(), { privateKey, payerAddress })

  return NextResponse.json({ burnerAddress: account.address })
}

async function handleExecute(body: {
  invoiceId: string
  burnerAddress: string
  tokenIn: string
  payerAddress: string
}) {
  const { invoiceId, burnerAddress, tokenIn } = body

  const invoice = await store.get(invoiceId)
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  }

  const burnerInfo = burnerStore.get(burnerAddress.toLowerCase())
  if (!burnerInfo) {
    return NextResponse.json({ error: "Burner not found" }, { status: 400 })
  }

  await store.update(invoiceId, { status: "paying" })

  try {
    const burnerAccount = privateKeyToAccount(burnerInfo.privateKey)
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

    // Step 1: Wrap ETH keeping gas reserve
    if (isEthInput) {
      const ethBalance = await publicClient.getBalance({ address: burnerAccount.address })
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
      console.log(`[swap] wrapped ${wrapAmount} wei ETH to WETH`)
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

    // Step 3: Get max input available
    const tokenBalance = await publicClient.readContract({
      address: tokenIn as `0x${string}`,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [burnerAccount.address],
    })

    // Step 4: Swap exact output — freelancer gets full invoice amount
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

    // Step 5: Deposit exact invoice amount to freelancer's Unlink address
    const unlinkClient = createUnlinkClient(ENGINE_URL, process.env.UNLINK_API_KEY!)
    const env = await getEnvironment(unlinkClient)

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
        amount: invoice.amountWei,
        environment: env.name,
        evm_address: burnerAccount.address,
      },
    })

    if (prepareRes.error) {
      throw new Error(`Deposit prepare failed: ${JSON.stringify(prepareRes.error)}`)
    }

    const { tx_id, notes_hash } = prepareRes.data!.data
    const deadline = Math.floor(Date.now() / 1000) + 3600

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
          amount: invoice.amountWei,
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

    await store.update(invoiceId, {
      status: "paid",
      txId: tx_id,
      paidAt: Date.now(),
    })

    // WHY: refund leftover WETH/ETH to payer after successful payment
    await refundBurner(burnerInfo, tokenIn, invoice.tokenAddress)
    burnerStore.delete(burnerAddress.toLowerCase())

    return NextResponse.json({
      status: "paid",
      txId: tx_id,
      txHash: swapReceipt.transactionHash,
    })
  } catch (error) {
    // WHY: refund everything on failure — don't trap payer's funds
    await refundBurner(burnerInfo, tokenIn, invoice.tokenAddress)
    burnerStore.delete(burnerAddress.toLowerCase())

    await store.update(invoiceId, { status: "pending" })
    console.error("Swap payment error:", error)
    const message = error instanceof Error ? error.message : "Swap payment failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
