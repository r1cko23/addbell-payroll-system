import { useQuery } from "@tanstack/react-query";
import { fetchProjectsForPO, fetchProjectsList } from "@/lib/queries/fetchers";
import { queryKeys } from "@/lib/queries/query-keys";

export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects.list(),
    queryFn: fetchProjectsList,
  });
}

export function useProjectsForPO(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.projects.poPicker(),
    queryFn: fetchProjectsForPO,
    enabled: options?.enabled ?? true,
  });
}
