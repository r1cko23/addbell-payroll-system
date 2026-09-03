import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchProjectsForPO, fetchProjectsList } from "@/lib/queries/fetchers";
import { queryKeys } from "@/lib/queries/query-keys";
import { useSessionLoader } from "@/lib/hooks/useSessionLoader";
import { useProfile } from "@/lib/hooks/useProfile";

export function useProjects() {
  const { profile, loading: profileLoading } = useProfile();
  const userId = profile?.id ?? null;
  const cacheKey = userId ? `projects:${userId}:catalog-v1` : null;
  const loader = useCallback(async () => {
    const projects = await fetchProjectsList();
    return { projects };
  }, []);
  const { data, loading, error, refresh } = useSessionLoader(
    cacheKey,
    loader,
    { enabled: !!cacheKey }
  );

  return {
    data: data?.projects ?? [],
    isLoading: profileLoading || loading,
    isError: !!error,
    error,
    refetch: () => refresh({ force: true }),
    refresh,
  };
}

export function useProjectsForPO(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.projects.poPicker(),
    queryFn: fetchProjectsForPO,
    enabled: options?.enabled ?? true,
  });
}
