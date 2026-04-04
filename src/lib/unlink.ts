import { createUnlink, unlinkAccount, unlinkEvm } from "@unlink-xyz/sdk"
import { createPublicClient, createWalletClient, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { baseSepolia } from "viem/chains"

type UnlinkClient = ReturnType<typeof createUnlink>

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

export function createClientFromSeed(seedHex: string): UnlinkClient {
  const seedBytes = new Uint8Array(
    Buffer.from(seedHex.startsWith("0x") ? seedHex.slice(2) : seedHex, "hex")
  )

  return createUnlink({
    engineUrl: "https://staging-api.unlink.xyz",
    apiKey: process.env.UNLINK_API_KEY!,
    account: unlinkAccount.fromSeed({ seed: seedBytes }),
    evm: getServerEvmProvider(),
  })
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
