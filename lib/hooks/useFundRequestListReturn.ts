"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  buildFundRequestDetailHref,
  buildFundRequestListQuery,
  parseFundRequestListReturnState,
  replaceFundRequestListSearchParams,
  type FundRequestListReturnState,
} from "@/lib/fund-request-list-return";

export function useFundRequestListReturn(options?: { defaultStatus?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const defaultStatus = options?.defaultStatus ?? "all";
  const parsed = useMemo(
    () => parseFundRequestListReturnState(searchParams),
    [searchParams]
  );

  const q = parsed.q ?? "";
  const status = parsed.status ?? defaultStatus;
  const cutoff = parsed.cutoff ?? null;
  const clientPo = parsed.clientPo === "needs_update" ? "needs_update" : null;

  const state: FundRequestListReturnState = {
    tab: parsed.tab,
    q: q || null,
    status,
    cutoff,
    clientPo,
  };

  const patch = useCallback(
    (next: Partial<FundRequestListReturnState>) => {
      const params = replaceFundRequestListSearchParams(searchParams, next, {
        defaultStatus,
      });
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [defaultStatus, pathname, router, searchParams]
  );

  const setQ = useCallback((value: string) => patch({ q: value || null }), [patch]);
  const setStatus = useCallback((value: string) => patch({ status: value }), [patch]);
  const setCutoff = useCallback(
    (value: string | null) => patch({ cutoff: value }),
    [patch]
  );
  const setClientPo = useCallback(
    (value: "needs_update" | null) => patch({ clientPo: value }),
    [patch]
  );

  const listQuery = buildFundRequestListQuery(state, { defaultStatus });

  const listQueryFor = useCallback(
    (cutoffYmd?: string | null) =>
      buildFundRequestListQuery(
        { ...state, cutoff: cutoffYmd ?? cutoff },
        { defaultStatus }
      ),
    [cutoff, defaultStatus, state]
  );

  const detailHrefFor = useCallback(
    (base: string, id: string, extra?: Partial<FundRequestListReturnState>) =>
      buildFundRequestDetailHref(base, id, { ...state, ...extra }, { defaultStatus }),
    [defaultStatus, state]
  );

  return {
    q,
    status,
    cutoff,
    clientPo,
    setQ,
    setStatus,
    setCutoff,
    setClientPo,
    listQuery,
    listQueryFor,
    detailHrefFor,
    state,
  };
}
