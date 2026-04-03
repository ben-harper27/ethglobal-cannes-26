import { createUnlink, unlinkAccount, unlinkEvm } from "@unlink-xyz/sdk"
import { createPublicClient, createWalletClient, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { baseSepolia } from "viem/chains"

type UnlinkClient = ReturnType<typeof createUnlink>

let _freelancerClient: UnlinkClient | null = null
let _payerClient: UnlinkClient | null = null

function buildClient(
  mnemonic: string,
  evmPrivateKey: `0x${string}`
): UnlinkClient {
  const evmAccount = privateKeyToAccount(evmPrivateKey)

  const walletClient = createWalletClient({
    account: evmAccount,
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC_URL),
  })

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC_URL),
  })

  return createUnlink({
    engineUrl: "https://staging-api.unlink.xyz",
    apiKey: process.env.UNLINK_API_KEY!,
    account: unlinkAccount.fromMnemonic({ mnemonic }),
    evm: unlinkEvm.fromViem({ walletClient, publicClient }),
  })
}

export function getFreelancerClient(): UnlinkClient {
  if (!_freelancerClient) {
    _freelancerClient = buildClient(
      process.env.UNLINK_MNEMONIC!,
      process.env.EVM_PRIVATE_KEY as `0x${string}`
    )
  }
  return _freelancerClient
}

export function getPayerClient(): UnlinkClient {
  if (!_payerClient) {
    _payerClient = buildClient(
      process.env.CLIENT_UNLINK_MNEMONIC!,
      process.env.CLIENT_EVM_PRIVATE_KEY as `0x${string}`
    )
  }
  return _payerClient
}
