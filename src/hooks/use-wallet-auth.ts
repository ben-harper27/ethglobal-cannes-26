"use client"

import { useState, useEffect, useCallback } from "react"
import { useDynamicContext } from "@dynamic-labs/sdk-react-core"
import { SIGN_MESSAGE } from "@/lib/auth"

export function useWalletAuth() {
  const { primaryWallet } = useDynamicContext()
  const [unlinkAddress, setUnlinkAddress] = useState<string | null>(null)
  const [isDeriving, setIsDeriving] = useState(false)
  const [checked, setChecked] = useState(false)

  const walletAddress = primaryWallet?.address ?? null
  const isConnected = !!primaryWallet

  const checkExisting = useCallback(async () => {
    if (!walletAddress) return

    try {
      const res = await fetch(`/api/auth/check?wallet=${walletAddress}`)
      const data = await res.json()
      if (data.registered) {
        setUnlinkAddress(data.unlinkAddress)
      }
    } catch {
      // ignore — will fall through to derive
    } finally {
      setChecked(true)
    }
  }, [walletAddress])

  const deriveAccount = useCallback(async () => {
    if (!primaryWallet) return

    setIsDeriving(true)
    try {
      const signature = await primaryWallet.signMessage(SIGN_MESSAGE)

      const res = await fetch("/api/auth/derive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signature,
          walletAddress: primaryWallet.address,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to derive account")
      }

      const { unlinkAddress: addr } = await res.json()
      setUnlinkAddress(addr)
    } catch (error) {
      console.error("Account derivation failed:", error)
    } finally {
      setIsDeriving(false)
    }
  }, [primaryWallet])

  // WHY: check server first to avoid re-signing on every page navigation
  useEffect(() => {
    if (isConnected && !checked) {
      checkExisting()
    }
  }, [isConnected, checked, checkExisting])

  // Only derive if check came back unregistered
  useEffect(() => {
    if (isConnected && checked && !unlinkAddress && !isDeriving) {
      deriveAccount()
    }
  }, [isConnected, checked, unlinkAddress, isDeriving, deriveAccount])

  useEffect(() => {
    if (!isConnected) {
      setUnlinkAddress(null)
      setChecked(false)
    }
  }, [isConnected])

  return {
    walletAddress,
    unlinkAddress,
    isConnected,
    isDeriving,
    deriveAccount,
  }
}
