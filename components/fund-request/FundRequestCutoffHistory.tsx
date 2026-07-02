"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format, parse, addDays } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MetricCard } from "@/components/ui/metric-card";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { cn } from "@/lib/utils";
import type { FundRequestRow } from "@/types/fund-request";
import { getFundRequestListProjectLabel } from "@/lib/fund-request-project-details";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useProfile } from "@/lib/hooks/useProfile";
import { parseTimestampInManila } from "@/utils/business-hours";
import {
  buildFundRequestUndoManagementApprovalUpdates,
  buildFundRequestUndoRejectionUpdates,
  canUndoFundRequestManagementApproval,
  canUndoFundRequestRejection,
} from "@/lib/fund-request-approval";
import {
  FUND_REQUEST_HISTORY_FETCH_OR,
  fundRequestBelongsToHistoryCutoff,
  formatFundRequestCutoffPeriod,
  getFundRequestFinalDecisionDateYmd,
  getFundRequestHistoryCutoffs,
  getFundRequestHistoryOutcome,
  isFundRequestFinalDecisionHistoryEntry,
  type FundRequestHistoryOutcome,
} from "@/lib/fund-request-cutoff";
import { normalizeUserRole } from "@/lib/user-roles";
import type { WeeklyCutoffPeriod } from "@/utils/weekly";

type FundRequestHistoryRow = FundRequestRow & {
  projects?: { name: string | null; code: string | null } | null;
};

const OUTCOME_LABELS: Record<FundRequestHistoryOutcome, string> = {
  approved: "Approved",
  rejected: "Rejected",
};

function outcomeBadgeClass(outcome: FundRequestHistoryOutcome): string {
  if (outcome === "approved") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  return "bg-red-100 text-red-800 border-red-200";
}

function sumAmount(rows: FundRequestHistoryRow[]): number {
  return rows.reduce((total, row) => total + Number(row.total_requested_amount ?? 0), 0);
}

function formatFundRequestDecisionAtCompact(request: FundRequestHistoryRow): string {
  const iso =
    request.status === "management_approved"
      ? request.management_approved_at
      : request.rejected_at;
  if (!iso) return "—";
  const date = parseTimestampInManila(iso);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

type FundRequestCutoffHistoryProps = {
  detailHrefBase: string;
};

export function FundRequestCutoffHistory({ detailHrefBase }: FundRequestCutoffHistoryProps) {
  const { profile } = useProfile();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<FundRequestHistoryRow[]>([]);
  const [historyCutoffs, setHistoryCutoffs] = useState<WeeklyCutoffPeriod[]>([]);
  const [selectedCutoffIndex, setSelectedCutoffIndex] = useState(0);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [pendingUndo, setPendingUndo] = useState<{
    row: FundRequestHistoryRow;
    kind: "approval" | "rejection";
  } | null>(null);
  const canUndoApproved =
    normalizeUserRole(profile?.role) === "upper_management" ||
    normalizeUserRole(profile?.role) === "admin";

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      const todayYmd = format(new Date(), "yyyy-MM-dd");
      const history = getFundRequestHistoryCutoffs(todayYmd);
      const cutoffs = history?.cutoffs ?? [];
      if (active) {
        setHistoryCutoffs(cutoffs);
        setSelectedCutoffIndex(0);
      }

      let query = supabase
        .from("fund_requests")
        .select("*, projects ( name, code )")
        .or(FUND_REQUEST_HISTORY_FETCH_OR)
        .order("created_at", { ascending: false });

      if (history) {
        const fetchToExtended = format(
          addDays(parse(history.fetch_to, "yyyy-MM-dd", new Date()), 7),
          "yyyy-MM-dd"
        );
        query = query
          .gte("created_at", `${history.fetch_from}T00:00:00+08:00`)
          .lte("created_at", `${fetchToExtended}T23:59:59+08:00`);
      }

      const { data, error } = await query;

      if (!active) return;

      if (error) {
        console.error("Failed to load fund request history", error);
        setRows([]);
        setLoading(false);
        return;
      }

      const filtered = ((data as FundRequestHistoryRow[]) ?? []).filter((row) => {
        if (!isFundRequestFinalDecisionHistoryEntry(row)) return false;
        if (!history) return true;
        const decisionYmd = getFundRequestFinalDecisionDateYmd(row);
        if (!decisionYmd) return false;
        return decisionYmd >= history.fetch_from && decisionYmd <= history.fetch_to;
      });

      setRows(filtered);
      setLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, [supabase]);

  const selectedCutoff = historyCutoffs[selectedCutoffIndex] ?? null;

  const cutoffNavLabel = useMemo(() => {
    if (!selectedCutoff) return "";
    const start = parse(selectedCutoff.start_ymd, "yyyy-MM-dd", new Date());
    const end = parse(selectedCutoff.end_ymd, "yyyy-MM-dd", new Date());
    return formatFundRequestCutoffPeriod(start, end);
  }, [selectedCutoff]);

  const cutoffRows = useMemo(() => {
    if (!selectedCutoff) return [];
    return rows.filter((row) => fundRequestBelongsToHistoryCutoff(row, selectedCutoff));
  }, [rows, selectedCutoff]);

  const approvedRows = useMemo(
    () => cutoffRows.filter((row) => getFundRequestHistoryOutcome(row) === "approved"),
    [cutoffRows]
  );

  const rejectedRows = useMemo(
    () => cutoffRows.filter((row) => getFundRequestHistoryOutcome(row) === "rejected"),
    [cutoffRows]
  );

  const canGoToOlderCutoff = selectedCutoffIndex < historyCutoffs.length - 1;
  const canGoToNewerCutoff = selectedCutoffIndex > 0;

  const handleUndoApproval = async (row: FundRequestHistoryRow) => {
    if (!profile?.id || !canUndoFundRequestManagementApproval(profile.role, profile.id, row)) {
      return;
    }

    const updates = buildFundRequestUndoManagementApprovalUpdates(row);
    if (!updates) {
      toast.error("This request cannot be restored.");
      return;
    }

    setUndoingId(row.id);
    const { error } = await supabase
      .from("fund_requests")
      .update(updates as never)
      .eq("id", row.id);
    setUndoingId(null);

    if (error) {
      toast.error("Failed to undo approval.");
      return;
    }

    toast.success("Approval undone. Request returned to pending final approval.");
    setRows((current) => current.filter((item) => item.id !== row.id));
  };

  const handleUndoRejection = async (row: FundRequestHistoryRow) => {
    if (!profile?.id || !canUndoFundRequestRejection(profile.role, profile.id, row)) {
      return;
    }

    const updates = buildFundRequestUndoRejectionUpdates(row, profile.id);
    if (!updates) {
      toast.error("This request cannot be restored.");
      return;
    }

    setUndoingId(row.id);
    const { error } = await supabase
      .from("fund_requests")
      .update(updates as never)
      .eq("id", row.id);
    setUndoingId(null);

    if (error) {
      toast.error("Failed to undo rejection.");
      return;
    }

    toast.success("Rejection undone. Request restored to pending final approval.");
    setRows((current) => current.filter((item) => item.id !== row.id));
  };

  const getRowUndoKind = (
    row: FundRequestHistoryRow,
    options?: { showUndoApproval?: boolean; showUndoRejection?: boolean }
  ): "approval" | "rejection" | null => {
    if (!profile?.id) return null;
    if (
      options?.showUndoApproval &&
      canUndoApproved &&
      canUndoFundRequestManagementApproval(profile.role, profile.id, row)
    ) {
      return "approval";
    }
    if (
      options?.showUndoRejection &&
      canUndoFundRequestRejection(profile.role, profile.id, row)
    ) {
      return "rejection";
    }
    return null;
  };

  const handleRowUndo = (
    row: FundRequestHistoryRow,
    kind: "approval" | "rejection"
  ) => {
    setPendingUndo({ row, kind });
  };

  const confirmPendingUndo = async () => {
    if (!pendingUndo) return;
    const { row, kind } = pendingUndo;
    setPendingUndo(null);
    if (kind === "approval") {
      await handleUndoApproval(row);
      return;
    }
    await handleUndoRejection(row);
  };

  const renderTable = (
    sectionRows: FundRequestHistoryRow[],
    emptyLabel: string,
    options?: { showUndoApproval?: boolean; showUndoRejection?: boolean }
  ) => {
    if (sectionRows.length === 0) {
      return (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>
      );
    }

    return (
      <>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-3 font-medium">Decided</th>
                <th className="px-4 py-3 font-medium">Project</th>
                <th className="px-4 py-3 font-medium">Purpose</th>
                <th className="px-4 py-3 font-medium text-right">Total (PHP)</th>
                <th className="px-4 py-3 font-medium">Outcome</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {sectionRows.map((row) => {
                const outcome = getFundRequestHistoryOutcome(row);
                if (!outcome) return null;
                const undoKind = getRowUndoKind(row, options);
                return (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-primary/5">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatFundRequestDecisionAtCompact(row)}
                    </td>
                    <td className="px-4 py-3 max-w-[180px] truncate">
                      {getFundRequestListProjectLabel(row)}
                    </td>
                    <td className="px-4 py-3 max-w-[200px] truncate">{row.purpose}</td>
                    <td className="px-4 py-3 font-medium text-right tabular-nums">
                      ₱{Number(row.total_requested_amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={cn("whitespace-nowrap text-xs", outcomeBadgeClass(outcome))}
                      >
                        {OUTCOME_LABELS[outcome]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Link
                          href={`${detailHrefBase}/${row.id}`}
                          className="text-primary font-medium hover:underline text-sm"
                        >
                          View
                        </Link>
                        {undoKind ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={undoingId === row.id}
                            onClick={() => handleRowUndo(row, undoKind)}
                          >
                            {undoingId === row.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              "Undo"
                            )}
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="md:hidden space-y-3 p-4">
          {sectionRows.map((row) => {
            const outcome = getFundRequestHistoryOutcome(row);
            if (!outcome) return null;
            const undoKind = getRowUndoKind(row, options);
            return (
              <Card key={row.id} className="border-border/80">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">
                        {formatFundRequestDecisionAtCompact(row)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 truncate">
                        {getFundRequestListProjectLabel(row)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 truncate">
                        {row.purpose}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn("shrink-0 text-xs", outcomeBadgeClass(outcome))}
                    >
                      {OUTCOME_LABELS[outcome]}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <span className="text-sm font-medium tabular-nums">
                      ₱{Number(row.total_requested_amount).toLocaleString()}
                    </span>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`${detailHrefBase}/${row.id}`}
                        className="text-primary text-sm font-medium hover:underline"
                      >
                        View
                      </Link>
                      {undoKind ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={undoingId === row.id}
                          onClick={() => handleRowUndo(row, undoKind)}
                        >
                          {undoingId === row.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            "Undo"
                          )}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </>
    );
  };

  return (
    <>
    <div className="space-y-4">
      {historyCutoffs.length > 0 ? (
        <div className="flex items-center gap-2 rounded-lg border bg-card px-2 py-2 sm:px-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-9 w-9 shrink-0 p-0"
            disabled={!canGoToOlderCutoff || loading}
            onClick={() =>
              setSelectedCutoffIndex((index) => Math.min(index + 1, historyCutoffs.length - 1))
            }
            aria-label="Previous cutoff"
          >
            <Icon name="CaretLeft" size={IconSizes.sm} />
          </Button>
          <p className="min-w-0 flex-1 text-center text-xs font-medium leading-tight text-foreground sm:text-sm">
            {cutoffNavLabel}
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-9 w-9 shrink-0 p-0"
            disabled={!canGoToNewerCutoff || loading}
            onClick={() => setSelectedCutoffIndex((index) => Math.max(index - 1, 0))}
            aria-label="Next cutoff"
          >
            <Icon name="CaretRight" size={IconSizes.sm} />
          </Button>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <MetricCard
          label="Approved"
          value={loading ? "—" : String(approvedRows.length)}
          meta={
            loading ? "Loading..." : `₱${sumAmount(approvedRows).toLocaleString()} total`
          }
        />
        <MetricCard
          label="Rejected"
          value={loading ? "—" : String(rejectedRows.length)}
          meta={
            loading ? "Loading..." : `₱${sumAmount(rejectedRows).toLocaleString()} total`
          }
        />
      </div>

      <Card className="border-border/80 bg-card/95">
        <CardHeader className="border-b py-4">
          <CardTitle className="text-base">Approved requests</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Loading...</p>
          ) : (
            renderTable(approvedRows, "No approved requests for this cutoff.", {
              showUndoApproval: true,
            })
          )}
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card/95">
        <CardHeader className="border-b py-4">
          <CardTitle className="text-base">Rejected requests</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Loading...</p>
          ) : (
            renderTable(rejectedRows, "No rejected requests for this cutoff.", {
              showUndoRejection: true,
            })
          )}
        </CardContent>
      </Card>
    </div>
    <AlertDialog open={Boolean(pendingUndo)} onOpenChange={(open) => !open && setPendingUndo(null)}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {pendingUndo?.kind === "approval" ? "Undo approval?" : "Undo rejection?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {pendingUndo?.kind === "approval"
              ? "This will move the request back to pending final approval."
              : "Are you sure you want to undo this rejection? The request will return to the previous approval step."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => void confirmPendingUndo()}>
            Undo
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
