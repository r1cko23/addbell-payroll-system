import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchActiveSubcontractorOptions,
  fetchActiveSuppliersForPO,
  fetchVendorsByType,
} from "@/lib/queries/fetchers";
import { queryKeys } from "@/lib/queries/query-keys";
import type { VendorType } from "@/types/vendor";
import { useSessionLoader } from "@/lib/hooks/useSessionLoader";
import { useProfile } from "@/lib/hooks/useProfile";

export function useVendors(type: VendorType) {
  const { profile, loading: profileLoading } = useProfile();
  const userId = profile?.id ?? null;
  const cacheKey = userId ? `vendors:${userId}:${type}` : null;
  const loader = useCallback(async () => {
    const vendors = await fetchVendorsByType(type);
    return { vendors };
  }, [type]);
  const { data, loading, error, refresh } = useSessionLoader(
    cacheKey,
    loader,
    { enabled: !!cacheKey }
  );

  return {
    data: data?.vendors ?? [],
    isLoading: profileLoading || loading,
    isError: !!error,
    error,
    refetch: () => refresh({ force: true }),
    refresh,
  };
}

export function useSuppliersForPO(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.vendors.activeSuppliersForPO(),
    queryFn: fetchActiveSuppliersForPO,
    enabled: options?.enabled ?? true,
  });
}

export function useSubcontractorOptions(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.vendors.activeSubcontractorOptions(),
    queryFn: fetchActiveSubcontractorOptions,
    enabled: options?.enabled ?? true,
  });
}
