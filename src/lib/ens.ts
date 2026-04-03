import { createPublicClient, http } from "viem"
import { sepolia } from "viem/chains"
import { normalize } from "viem/ens"

const ensClient = createPublicClient({
  chain: sepolia,
  transport: http(process.env.ETH_SEPOLIA_RPC_URL),
})

export async function resolveEns(name: string): Promise<string | null> {
  const address = await ensClient.getEnsAddress({
    name: normalize(name),
  })
  return address
}

export async function reverseEns(
  address: `0x${string}`
): Promise<string | null> {
  const name = await ensClient.getEnsName({ address })
  return name
}
