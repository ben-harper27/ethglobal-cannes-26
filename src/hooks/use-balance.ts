import { useQuery, useQueryClient } from "@tanstack/react-query"

interface BalanceResponse {
  balances: Array<{
    token: string
    amount: string
  }>
}

async function fetchBalance(seed: string): Promise<BalanceResponse> {
  const res = await fetch("/api/balance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seed }),
  })
  return res.json()
}

export function useBalance(seed?: string | null) {
  const queryClient = useQueryClient()

  const { data, error, isLoading } = useQuery({
    queryKey: ["balance", seed],
    queryFn: () => fetchBalance(seed!),
    enabled: !!seed,
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["balance"] })

  return { balances: data?.balances ?? [], error, isLoading, invalidate }
}
