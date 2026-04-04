import { createUnlink, unlinkAccount, unlinkEvm } from "@unlink-xyz/sdk"
import { createPublicClient, createWalletClient, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { baseSepolia } from "viem/chains"
import type { User } from "./types"

type UnlinkClient = ReturnType<typeof createUnlink>

const clientCache = new Map<string, UnlinkClient>()
let _payerClient: UnlinkClient | null = null

function getServerEvmProvider() {
  const evmAccount = privateKeyToAccount(
    process.env.SERVER_EVM_PRIVATE_KEY as `0x${string}`
  )

  const walletClient = createWalletClient({
    account: evmAccount,
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC_URL),
  })

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC_URL),
  })

  return unlinkEvm.fromViem({ walletClient, publicClient })
}

export function getClientForUser(user: User): UnlinkClient {
  const cached = clientCache.get(user.walletAddress.toLowerCase())
  if (cached) return cached

  const seedBytes = new Uint8Array(
    Buffer.from(user.seed.startsWith("0x") ? user.seed.slice(2) : user.seed, "hex")
  )

  const client = createUnlink({
    engineUrl: "https://staging-api.unlink.xyz",
    apiKey: process.env.UNLINK_API_KEY!,
    account: unlinkAccount.fromSeed({ seed: seedBytes }),
    evm: getServerEvmProvider(),
  })

  clientCache.set(user.walletAddress.toLowerCase(), client)
  return client
}

export function getPayerClient(): UnlinkClient {
  if (!_payerClient) {
    const evmAccount = privateKeyToAccount(
      process.env.CLIENT_EVM_PRIVATE_KEY as `0x${string}`
    )

    const walletClient = createWalletClient({
      account: evmAccount,
      chain: baseSepolia,
      transport: http(process.env.BASE_SEPOLIA_RPC_URL),
    })

    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(process.env.BASE_SEPOLIA_RPC_URL),
    })

    _payerClient = createUnlink({
      engineUrl: "https://staging-api.unlink.xyz",
      apiKey: process.env.UNLINK_API_KEY!,
      account: unlinkAccount.fromMnemonic({
        mnemonic: process.env.CLIENT_UNLINK_MNEMONIC!,
      }),
      evm: unlinkEvm.fromViem({ walletClient, publicClient }),
    })
  }
  return _payerClient
}
