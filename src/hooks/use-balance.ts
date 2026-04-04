import { useQuery, useQueryClient } from "@tanstack/react-query"

interface BalanceResponse {
  balances: Array<{
    token: string
    amount: string
  }>
}

const fetcher = (url: string): Promise<BalanceResponse> =>
  fetch(url).then((res) => res.json())

export function useBalance() {
  const queryClient = useQueryClient()

  const { data, error, isLoading } = useQuery({
    queryKey: ["balance"],
    queryFn: () => fetcher("/api/balance"),
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["balance"] })

  return { balances: data?.balances ?? [], error, isLoading, invalidate }
}
