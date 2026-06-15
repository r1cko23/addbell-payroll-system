import { useQuery } from "@tanstack/react-query";
import { fetchActiveClientOptions, fetchClientsList } from "@/lib/queries/fetchers";
import { queryKeys } from "@/lib/queries/query-keys";

export function useClients() {
  return useQuery({
    queryKey: queryKeys.clients.list(),
    queryFn: fetchClientsList,
  });
}

export function useActiveClients() {
  return useQuery({
    queryKey: queryKeys.clients.activeOptions(),
    queryFn: fetchActiveClientOptions,
  });
}
