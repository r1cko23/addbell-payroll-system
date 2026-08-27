import { getActiveFundRequestCutoffIndex } from "@/lib/fund-request-cutoff";
import type { WeeklyCutoffPeriod } from "@/utils/weekly";

export type FundRequestListReturnState = {
  tab?: string | null;
  q?: string | null;
  status?: string | null;
  cutoff?: string | null;
  /** Filter My Requests to client POs missing from Projects masterlist. */
  clientPo?: string | null;
};

const LIST_KEYS = ["tab", "q", "status", "cutoff", "clientPo"] as const;

export function parseFundRequestListReturnState(
  searchParams: Pick<URLSearchParams, "get">
): FundRequestListReturnState {
  return {
    tab: searchParams.get("tab"),
    q: searchParams.get("q"),
    status: searchParams.get("status"),
    cutoff: searchParams.get("cutoff"),
    clientPo: searchParams.get("clientPo"),
  };
}

export function buildFundRequestListQuery(
  state: FundRequestListReturnState,
  options?: { defaultStatus?: string }
): string {
  const params = new URLSearchParams();
  const tab = state.tab?.trim();
  if (tab) params.set("tab", tab);
  const cutoff = state.cutoff?.trim();
  if (cutoff) params.set("cutoff", cutoff);
  const q = state.q?.trim();
  if (q) params.set("q", q);
  const status = state.status?.trim();
  const defaultStatus = options?.defaultStatus ?? "all";
  if (status && status !== defaultStatus) {
    params.set("status", status);
  }
  const clientPo = state.clientPo?.trim();
  if (clientPo === "needs_update") {
    params.set("clientPo", "needs_update");
  }
  return params.toString();
}

export function buildFundRequestListHref(
  base: string,
  state: FundRequestListReturnState,
  options?: { defaultStatus?: string }
): string {
  const query = buildFundRequestListQuery(state, options);
  return query ? `${base}?${query}` : base;
}

export function buildFundRequestDetailHref(
  base: string,
  id: string,
  state: FundRequestListReturnState,
  options?: { defaultStatus?: string }
): string {
  const query = buildFundRequestListQuery(state, options);
  return query ? `${base}/${id}?${query}` : `${base}/${id}`;
}

export function fundRequestListBackLabel(state: FundRequestListReturnState): string {
  if (state.tab === "inbox") return "← Back to For Approval";
  if (state.tab === "history") return "← Back to History";
  if (state.tab === "all-requests") return "← Back to All Requests";
  if (state.tab === "my-requests") return "← Back to My Requests";
  return "← Back to Fund Requests";
}

export function replaceFundRequestListSearchParams(
  searchParams: URLSearchParams,
  patch: Partial<FundRequestListReturnState>,
  options?: { defaultStatus?: string }
): URLSearchParams {
  const params = new URLSearchParams(searchParams.toString());
  const next: FundRequestListReturnState = {
    ...parseFundRequestListReturnState(params),
    ...patch,
  };
  for (const key of LIST_KEYS) {
    params.delete(key);
  }
  const query = buildFundRequestListQuery(next, options);
  const rebuilt = new URLSearchParams(query);
  rebuilt.forEach((value, key) => {
    params.set(key, value);
  });
  return params;
}

export function resolveFundRequestListCutoffIndex(
  cutoffs: readonly WeeklyCutoffPeriod[],
  cutoffStartYmd: string | null | undefined
): number {
  if (cutoffs.length === 0) return 0;
  if (cutoffStartYmd) {
    const index = cutoffs.findIndex((cutoff) => cutoff.start_ymd === cutoffStartYmd);
    if (index >= 0) return index;
  }
  return getActiveFundRequestCutoffIndex(cutoffs);
}
