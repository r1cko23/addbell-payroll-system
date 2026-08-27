"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/query-keys";
import type { PoMasterlistJob } from "@/types/po-masterlist";
import type { PoMasterlistEditableColumn } from "@/lib/po-masterlist-column-acl";

export const PO_MASTERLIST_PAGE_SIZE = 20;
/** Default backtrack window for Projects list (current → 2022). */
export const PO_MASTERLIST_MIN_YEAR = 2022;
/** Default status filter: current / ongoing work. */
export const PO_MASTERLIST_DEFAULT_PROJECT_STATUSES = [
  "ON-GOING",
  "PENDING",
] as const;

export type PoMasterlistJobsFilterOptions = {
  clients: string[];
  years: number[];
};

export type PoMasterlistJobsListResponse = {
  jobs: PoMasterlistJob[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  filterOptions: PoMasterlistJobsFilterOptions;
  editableColumns: PoMasterlistEditableColumn[];
  canCreate: boolean;
};

export type PoMasterlistJobFilters = {
  q?: string;
  project_statuses?: string[];
  payment_statuses?: string[];
  clients?: string[];
  years?: string[];
  page?: number;
  pageSize?: number;
};

async function fetchPoMasterlistJobs(
  filters: PoMasterlistJobFilters
): Promise<PoMasterlistJobsListResponse> {
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const pageSize =
    filters.pageSize && filters.pageSize > 0
      ? filters.pageSize
      : PO_MASTERLIST_PAGE_SIZE;

  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  for (const status of filters.project_statuses ?? []) {
    if (status.trim()) params.append("project_statuses", status.trim());
  }
  for (const status of filters.payment_statuses ?? []) {
    if (status.trim()) params.append("payment_statuses", status.trim());
  }
  for (const client of filters.clients ?? []) {
    if (client.trim()) params.append("clients", client.trim());
  }
  for (const year of filters.years ?? []) {
    if (year.trim()) params.append("years", year.trim());
  }

  const res = await fetch(`/api/po-masterlist/jobs?${params.toString()}`, {
    credentials: "include",
  });
  const json = (await res.json()) as PoMasterlistJobsListResponse & {
    error?: string;
  };
  if (!res.ok) {
    throw new Error(json.error || "Failed to load masterlist jobs");
  }
  return {
    jobs: json.jobs ?? [],
    total: json.total ?? 0,
    page: json.page ?? page,
    pageSize: json.pageSize ?? pageSize,
    pageCount: json.pageCount ?? 1,
    filterOptions: {
      clients: json.filterOptions?.clients ?? [],
      years: json.filterOptions?.years ?? [],
    },
    editableColumns: json.editableColumns ?? [],
    canCreate: Boolean(json.canCreate),
  };
}

export function usePoMasterlistJobs(filters: PoMasterlistJobFilters = {}) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.poMasterlistJobs.list(filters),
    queryFn: () => fetchPoMasterlistJobs(filters),
  });

  const invalidate = useCallback(() => {
    return queryClient.invalidateQueries({
      queryKey: queryKeys.poMasterlistJobs.all,
    });
  }, [queryClient]);

  return {
    jobs: query.data?.jobs ?? [],
    total: query.data?.total ?? 0,
    page: query.data?.page ?? filters.page ?? 1,
    pageSize: query.data?.pageSize ?? filters.pageSize ?? PO_MASTERLIST_PAGE_SIZE,
    pageCount: query.data?.pageCount ?? 1,
    filterOptions: query.data?.filterOptions ?? { clients: [], years: [] },
    editableColumns: query.data?.editableColumns ?? [],
    canCreate: query.data?.canCreate ?? false,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    invalidate,
  };
}

export async function patchPoMasterlistJob(
  id: string,
  fields: Partial<Record<PoMasterlistEditableColumn, unknown>>
): Promise<PoMasterlistJob> {
  const res = await fetch(`/api/po-masterlist/jobs/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  const json = (await res.json()) as {
    job?: PoMasterlistJob;
    error?: string;
    fields?: string[];
  };
  if (!res.ok) {
    const suffix = json.fields?.length ? ` (${json.fields.join(", ")})` : "";
    throw new Error((json.error || "Failed to update job") + suffix);
  }
  if (!json.job) throw new Error("Missing job in response");
  return json.job;
}

export async function createPoMasterlistJob(
  fields: Record<string, unknown>
): Promise<PoMasterlistJob> {
  const res = await fetch(`/api/po-masterlist/jobs`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  const json = (await res.json()) as {
    job?: PoMasterlistJob;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(json.error || "Failed to create job");
  }
  if (!json.job) throw new Error("Missing job in response");
  return json.job;
}
