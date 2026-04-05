import { Badge } from "@/components/ui/badge"
import type { InvoiceStatus } from "@/lib/types"

const statusConfig: Record<InvoiceStatus, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pending: { label: "Pending", variant: "secondary" },
  paying: { label: "Processing", variant: "outline" },
  paid: { label: "Paid", variant: "default" },
  withdrawn: { label: "Withdrawn", variant: "default" },
}

interface StatusBadgeProps {
  status: InvoiceStatus
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] ?? { label: status, variant: "secondary" as const }
  return <Badge variant={config.variant}>{config.label}</Badge>
}
