import { useQuery } from "@tanstack/react-query";
import {
  fetchActiveSubcontractorOptions,
  fetchActiveSuppliersForPO,
  fetchVendorsByType,
} from "@/lib/queries/fetchers";
import { queryKeys } from "@/lib/queries/query-keys";
import type { VendorType } from "@/types/vendor";

export function useVendors(type: VendorType) {
  return useQuery({
    queryKey: queryKeys.vendors.byType(type),
    queryFn: () => fetchVendorsByType(type),
  });
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
