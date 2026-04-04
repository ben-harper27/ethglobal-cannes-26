# Cloak

Private invoicing for freelancers. Get paid on-chain without exposing your income, clients, or earnings.

## The Problem

Blockchain transparency is a double-edged sword. When a freelancer shares a wallet address to receive payment, anyone can see:
- How much they earn
- Who pays them
- Every transaction they've ever made

This kills negotiating power and exposes sensitive financial data. Cloak fixes this.

## How It Works

Cloak uses [Unlink](https://unlink.xyz)'s zero-knowledge privacy pool so that on-chain, there is no link between a payer and the freelancer they're paying.

**Freelancer flow:**
1. Connect wallet via [Dynamic](https://dynamic.xyz) — signs a message to derive a deterministic privacy account
2. Create an invoice (just an amount in USDC)
3. Share the payment link with a client
4. Receive funds privately — check balance, withdraw to any wallet

**Payer flow (same token):**
1. Open the invoice link, connect wallet
2. Approve token, sign a Permit2 deposit
3. Funds go directly into the freelancer's private balance via Unlink's ZK pool

**Payer flow (cross-token via [Uniswap](https://uniswap.org)):**
1. Open the invoice link, connect wallet, select ETH or WETH
2. See a live Uniswap quote for the conversion
3. Send funds — a disposable burner wallet handles the swap on Uniswap and deposits the exact invoice amount (USDC) into the freelancer's private balance
4. Leftover funds are automatically refunded to the payer

## Privacy Model

- **No wallet addresses stored server-side.** The freelancer's privacy account is derived from their wallet signature (deterministic for EOA wallets). The seed never touches the database.
- **The database only stores:** invoice ID, anonymous Unlink address, amount, and status. An attacker with full DB access cannot link invoices to any real-world wallet.
- **On-chain:** Unlink's ZK pool ensures payers and freelancers are completely unlinkable. The deposit goes through Permit2 into a shared privacy pool — no direct transfer between payer and freelancer addresses.
- **Cross-token payments** use a disposable burner wallet as an intermediary. The burner is created, funded, used for the swap, and destroyed — it cannot be linked to either party.

## Architecture

```
Next.js 15 (App Router)
├── Frontend
│   ├── Dynamic SDK — wallet auth (EOA only)
│   ├── TanStack Query — data fetching
│   ├── shadcn/ui + Tailwind — UI
│   └── Framer Motion — animations
├── API Routes
│   ├── /api/auth/derive — register privacy account from seed
│   ├── /api/invoices — create and list invoices
│   ├── /api/pay/prepare — prepare Permit2 deposit (direct USDC)
│   ├── /api/pay/submit — submit signed deposit
│   ├── /api/pay/swap — cross-token payment via burner + Uniswap
│   ├── /api/quote — Uniswap price quote
│   ├── /api/balance — private balance via seed
│   └── /api/withdraw — withdraw from privacy pool
├── Integrations
│   ├── Unlink SDK — ZK privacy pool (deposit, transfer, withdraw)
│   ├── Uniswap V3 — SwapRouter02 on Base Sepolia (exactOutputSingle)
│   ├── Dynamic — wallet connection and message signing
│   └── Turso (libSQL) — invoice persistence (no secrets stored)
└── Chain: Base Sepolia
```

## Bounty Targets

| Sponsor | Track | Integration |
|---------|-------|-------------|
| **Unlink** | Best Private Application | Core privacy pool — Permit2 deposits, private balances, withdrawals |
| **Uniswap** | Best API Integration | Cross-token payments via exactOutputSingle on SwapRouter02, live quotes via QuoterV2 |
| **Dynamic** | Best use of JS SDK | Wallet auth, deterministic account derivation via signMessage |

## Setup

```bash
bun install
cp .env.example .env.local
# Fill in the env vars (see below)
bun run dev
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `UNLINK_API_KEY` | From [Unlink hackathon portal](https://hackaton-apikey.vercel.app/) |
| `SERVER_EVM_PRIVATE_KEY` | Server wallet for submitting on-chain txs (gas) |
| `NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID` | From [Dynamic dashboard](https://app.dynamic.xyz) |
| `TURSO_DATABASE_URL` | From [Turso](https://turso.tech) |
| `TURSO_AUTH_TOKEN` | From Turso |
| `BASE_SEPOLIA_RPC_URL` | Base Sepolia RPC (e.g. Alchemy) |

### Token Addresses (Base Sepolia)

| Token | Address |
|-------|---------|
| USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| WETH | `0x4200000000000000000000000000000000000006` |
| Uniswap SwapRouter02 | `0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4` |
| Uniswap QuoterV2 | `0xC5290058841028F1614F3A6F0F5816cAd0df5E27` |
| Unlink Pool | `0x647f9b99af97e4b79DD9Dd6de3b583236352f482` |

## Testing the Payment Flow

1. **Freelancer:** Connect an EOA wallet (MetaMask), sign the derivation message, create a USDC invoice
2. **Payer (USDC):** Open invoice link, connect wallet with USDC on Base Sepolia, click Pay Now
3. **Payer (ETH):** Open invoice link, select ETH, click Swap & Pay — sends ETH, receives a refund of unused amount
4. **Verify:** Check freelancer dashboard for balance, withdraw to any address, verify on [BaseScan](https://sepolia.basescan.org)

## Built at ETHGlobal Cannes 2026
