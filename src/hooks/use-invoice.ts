import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { Invoice } from "@/lib/types"

const fetcher = async (url: string): Promise<Invoice> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("Invoice not found")
  return res.json()
}

export function useInvoice(id: string) {
  const queryClient = useQueryClient()

  const { data, error, isLoading } = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => fetcher(`/api/invoices/${id}`),
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["invoice", id] })

  return { invoice: data, error, isLoading, invalidate }
}
