import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/query-keys";

export function invalidateClients(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
}

export function invalidateProjects(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
}

export function invalidateVendors(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.vendors.all });
}
