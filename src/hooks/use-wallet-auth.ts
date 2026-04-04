"use client"

import { useState, useEffect, useCallback } from "react"
import { useDynamicContext } from "@dynamic-labs/sdk-react-core"
import { SIGN_MESSAGE } from "@/lib/auth"

export function useWalletAuth() {
  const { primaryWallet } = useDynamicContext()
  const [unlinkAddress, setUnlinkAddress] = useState<string | null>(null)
  const [isDeriving, setIsDeriving] = useState(false)
  const [checked, setChecked] = useState(false)

  const isConnected = !!primaryWallet

  const checkExisting = useCallback(async () => {
    const stored = localStorage.getItem("cloak_unlink_address")
    if (stored) {
      const res = await fetch(`/api/auth/check?unlink=${stored}`)
      const data = await res.json()
      if (data.registered) {
        setUnlinkAddress(stored)
        setChecked(true)
        return
      }
    }
    setChecked(true)
  }, [])

  const deriveAccount = useCallback(async () => {
    if (!primaryWallet) return

    setIsDeriving(true)
    try {
      const signature = await primaryWallet.signMessage(SIGN_MESSAGE)

      const res = await fetch("/api/auth/derive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to derive account")
      }

      const { unlinkAddress: addr } = await res.json()
      localStorage.setItem("cloak_unlink_address", addr)
      setUnlinkAddress(addr)
    } catch (error) {
      console.error("Account derivation failed:", error)
    } finally {
      setIsDeriving(false)
    }
  }, [primaryWallet])

  useEffect(() => {
    if (isConnected && !checked) {
      checkExisting()
    }
  }, [isConnected, checked, checkExisting])

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
    unlinkAddress,
    isConnected,
    isDeriving,
    deriveAccount,
  }
}
