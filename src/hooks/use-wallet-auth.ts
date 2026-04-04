"use client"

import { useState, useEffect, useCallback } from "react"
import { useDynamicContext } from "@dynamic-labs/sdk-react-core"
import { SIGN_MESSAGE, deriveSeed } from "@/lib/auth"
import { toHex } from "viem"

function storageKey(walletAddress: string): string {
  return `cloak_${walletAddress.toLowerCase()}`
}

interface StoredAccount {
  seed: string
  unlinkAddress: string
}

export function useWalletAuth() {
  const { primaryWallet } = useDynamicContext()
  const [account, setAccount] = useState<StoredAccount | null>(null)
  const [isDeriving, setIsDeriving] = useState(false)

  const walletAddress = primaryWallet?.address ?? null
  const isConnected = !!primaryWallet
  const unlinkAddress = account?.unlinkAddress ?? null
  const seed = account?.seed ?? null

  const loadFromStorage = useCallback(() => {
    if (!walletAddress) return
    const raw = localStorage.getItem(storageKey(walletAddress))
    if (raw) {
      try {
        setAccount(JSON.parse(raw))
      } catch {
        localStorage.removeItem(storageKey(walletAddress))
      }
    }
  }, [walletAddress])

  const deriveAccount = useCallback(async () => {
    if (!primaryWallet || !walletAddress) return

    setIsDeriving(true)
    try {
      const signature = await primaryWallet.signMessage(SIGN_MESSAGE)
      if (!signature) throw new Error("Signature rejected")
      const seedBytes = deriveSeed(signature as string)
      const seedHex = toHex(seedBytes)

      const res = await fetch("/api/auth/derive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed: seedHex }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to register account")
      }

      const { unlinkAddress: addr } = await res.json()
      const stored: StoredAccount = { seed: seedHex, unlinkAddress: addr }
      localStorage.setItem(storageKey(walletAddress), JSON.stringify(stored))
      setAccount(stored)
    } catch (error) {
      console.error("Account derivation failed:", error)
    } finally {
      setIsDeriving(false)
    }
  }, [primaryWallet, walletAddress])

  // WHY: reset when wallet changes
  useEffect(() => {
    setAccount(null)
  }, [walletAddress])

  // WHY: try loading from localStorage before prompting signature
  useEffect(() => {
    if (isConnected && !account) {
      loadFromStorage()
    }
  }, [isConnected, account, loadFromStorage])

  // WHY: only derive if nothing in localStorage
  useEffect(() => {
    if (isConnected && !account && !isDeriving && walletAddress) {
      const raw = localStorage.getItem(storageKey(walletAddress))
      if (!raw) {
        deriveAccount()
      }
    }
  }, [isConnected, account, isDeriving, walletAddress, deriveAccount])

  return {
    unlinkAddress,
    seed,
    isConnected,
    isDeriving,
    deriveAccount,
  }
}
