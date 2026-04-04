import { keccak256, toBytes } from "viem"

export const SIGN_MESSAGE = "Cloak: derive privacy account"

export function deriveSeed(signature: string): Uint8Array {
  const hash = keccak256(signature as `0x${string}`)
  return toBytes(hash)
}
