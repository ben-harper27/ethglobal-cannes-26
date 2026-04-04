export interface Token {
  address: string
  symbol: string
  decimals: number
}

export const USDC: Token = {
  address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  symbol: "USDC",
  decimals: 6,
}

export const WETH: Token = {
  address: "0x4200000000000000000000000000000000000006",
  symbol: "WETH",
  decimals: 18,
}

export const ETH: Token = {
  address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
  symbol: "ETH",
  decimals: 18,
}

export const INVOICE_TOKEN = USDC

export const SWAP_ROUTER = "0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4"
export const POOL_FEE = 3000
