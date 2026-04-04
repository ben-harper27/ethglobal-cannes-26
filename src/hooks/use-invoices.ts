import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { Invoice } from "@/lib/types"

const fetcher = (url: string): Promise<Invoice[]> =>
  fetch(url).then((res) => res.json())

export function useInvoices(walletAddress?: string | null) {
  const queryClient = useQueryClient()

  const { data, error, isLoading } = useQuery({
    queryKey: ["invoices", walletAddress],
    queryFn: () =>
      fetcher(
        walletAddress
          ? `/api/invoices?wallet=${walletAddress}`
          : "/api/invoices"
      ),
    enabled: !!walletAddress,
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["invoices"] })

  return { invoices: data ?? [], error, isLoading, invalidate }
}
