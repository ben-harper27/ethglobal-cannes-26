import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { Invoice } from "@/lib/types"

const fetcher = (url: string): Promise<Invoice> =>
  fetch(url).then((res) => res.json())

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
