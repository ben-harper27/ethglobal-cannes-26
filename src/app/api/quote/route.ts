import { NextResponse } from "next/server"
import { createPublicClient, http, parseAbi } from "viem"
import { baseSepolia } from "viem/chains"
import { POOL_FEE } from "@/lib/tokens"

const QUOTER_V2 = "0xC5290058841028F1614F3A6F0F5816cAd0df5E27"

const quoterAbi = parseAbi([
  "function quoteExactOutputSingle((address tokenIn, address tokenOut, uint256 amount, uint24 fee, uint160 sqrtPriceLimitX96)) external returns (uint256 amountIn, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
])

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.BASE_SEPOLIA_RPC_URL),
})

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tokenIn = searchParams.get("tokenIn")
  const tokenOut = searchParams.get("tokenOut")
  const amountOut = searchParams.get("amountOut")

  if (!tokenIn || !tokenOut || !amountOut) {
    return NextResponse.json(
      { error: "tokenIn, tokenOut, and amountOut are required" },
      { status: 400 }
    )
  }

  try {
    const result = await publicClient.simulateContract({
      address: QUOTER_V2 as `0x${string}`,
      abi: quoterAbi,
      functionName: "quoteExactOutputSingle",
      args: [
        {
          tokenIn: tokenIn as `0x${string}`,
          tokenOut: tokenOut as `0x${string}`,
          amount: BigInt(amountOut),
          fee: POOL_FEE,
          sqrtPriceLimitX96: BigInt(0),
        },
      ],
    })

    const [amountIn] = result.result as [bigint, bigint, number, bigint]

    const withSlippage = (amountIn * BigInt(102)) / BigInt(100)
    // WHY: for ETH payments, include gas buffer for burner's 5 on-chain txs
    const GAS_BUFFER = BigInt("3000000000000000") // 0.003 ETH
    const isEthPayment = searchParams.get("tokenIn")?.toLowerCase() === "0x4200000000000000000000000000000000000006"
    const totalRequired = isEthPayment ? withSlippage + GAS_BUFFER : withSlippage

    return NextResponse.json({
      amountIn: amountIn.toString(),
      amountInWithSlippage: totalRequired.toString(),
      gasBuffer: isEthPayment ? GAS_BUFFER.toString() : "0",
    })
  } catch (error) {
    console.error("Quote error:", error)
    const message = error instanceof Error ? error.message : "Quote failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
