"use client"

import { Badge } from "@/components/ui/badge"
import { CheckCircle, Loader2, XCircle } from "lucide-react"

interface EnsBadgeProps {
  address: string | null
  isLoading: boolean
  isError?: boolean
}

export function EnsBadge({ address, isLoading, isError }: EnsBadgeProps) {
  if (isLoading) {
    return (
      <Badge variant="secondary" className="gap-1.5">
        <Loader2 className="h-3 w-3 animate-spin" />
        Resolving...
      </Badge>
    )
  }

  if (isError) {
    return (
      <Badge variant="destructive" className="gap-1.5">
        <XCircle className="h-3 w-3" />
        Not found
      </Badge>
    )
  }

  if (!address) {
    return null
  }

  return (
    <Badge variant="outline" className="gap-1.5">
      <CheckCircle className="h-3 w-3 text-green-500" />
      {address.slice(0, 6)}...{address.slice(-4)}
    </Badge>
  )
}
