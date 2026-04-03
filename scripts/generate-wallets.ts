import { english, generateMnemonic } from "viem/accounts"
import { mnemonicToAccount } from "viem/accounts"

function createWallet() {
  const mnemonic = generateMnemonic(english)
  const account = mnemonicToAccount(mnemonic)
  const hdKey = account.getHdKey()
  const privateKey = hdKey.privateKey
    ? "0x" + Buffer.from(hdKey.privateKey).toString("hex")
    : ""
  return { mnemonic, address: account.address, privateKey }
}

const freelancer = createWallet()
const client = createWallet()

console.log("=== Freelancer Wallet ===")
console.log(`Mnemonic:    ${freelancer.mnemonic}`)
console.log(`Address:     ${freelancer.address}`)
console.log(`Private Key: ${freelancer.privateKey}`)
console.log()
console.log("=== Client Wallet ===")
console.log(`Mnemonic:    ${client.mnemonic}`)
console.log(`Address:     ${client.address}`)
console.log(`Private Key: ${client.privateKey}`)
console.log()
console.log("=== Paste into .env.local ===")
console.log(`UNLINK_MNEMONIC="${freelancer.mnemonic}"`)
console.log(`EVM_PRIVATE_KEY=${freelancer.privateKey}`)
console.log(`CLIENT_UNLINK_MNEMONIC="${client.mnemonic}"`)
console.log(`CLIENT_EVM_PRIVATE_KEY=${client.privateKey}`)
