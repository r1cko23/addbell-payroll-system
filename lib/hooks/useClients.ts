import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchActiveClientOptions, fetchClientsList } from "@/lib/queries/fetchers";
import { queryKeys } from "@/lib/queries/query-keys";
import { useSessionLoader } from "@/lib/hooks/useSessionLoader";
import { useProfile } from "@/lib/hooks/useProfile";

export function useClients() {
  const { profile, loading: profileLoading } = useProfile();
  const userId = profile?.id ?? null;
  const cacheKey = userId ? `clients:${userId}:catalog-v1` : null;
  const loader = useCallback(async () => {
    const clients = await fetchClientsList();
    return { clients };
  }, []);
  const { data, loading, error, refresh } = useSessionLoader(
    cacheKey,
    loader,
    { enabled: !!cacheKey }
  );

  return {
    data: data?.clients ?? [],
    isLoading: profileLoading || loading,
    isError: !!error,
    error,
    refetch: () => refresh({ force: true }),
    refresh,
  };
}

export function useActiveClients() {
  return useQuery({
    queryKey: queryKeys.clients.activeOptions(),
    queryFn: fetchActiveClientOptions,
  });
}
