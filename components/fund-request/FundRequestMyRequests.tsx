"use client";

import { useEffect, useMemo, useState } from "react";
import { format, parse, addDays } from "date-fns";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { epPeriodNavButton } from "@/lib/employee-portal-ui";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import type { FundRequestRow } from "@/types/fund-request";
import {
  formatFundRequestCutoffPeriod,
  fundRequestBelongsToApproverCutoff,
  getFundRequestHistoryCutoffs,
  isFundRequestCutoffDeadlineRollForwardActive,
} from "@/lib/fund-request-cutoff";
import type { WeeklyCutoffPeriod } from "@/utils/weekly";
import { FundRequestAllList } from "@/components/fund-request/FundRequestAllList";

type FundRequestMyRequestRow = FundRequestRow & {
  projects: { name: string; code: string } | null;
};

type FundRequestMyRequestsProps = {
  detailHrefBase: string;
  requesterEmployeeId: string | null;
  requesterUserId?: string | null;
  requesterIsOperationsManager?: boolean;
};

function sumAmount(rows: FundRequestMyRequestRow[]): number {
  return rows.reduce((total, row) => total + Number(row.total_requested_amount ?? 0), 0);
}

export function FundRequestMyRequests({
  detailHrefBase,
  requesterEmployeeId,
  requesterUserId,
  requesterIsOperationsManager = false,
}: FundRequestMyRequestsProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<FundRequestMyRequestRow[]>([]);
  const [historyCutoffs, setHistoryCutoffs] = useState<WeeklyCutoffPeriod[]>([]);
  const [selectedCutoffIndex, setSelectedCutoffIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (!requesterEmployeeId) {
      setRows([]);
      setHistoryCutoffs([]);
      setLoading(false);
      return;
    }

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
        .eq("requested_by", requesterEmployeeId)
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
        console.error("Failed to load my fund requests", error);
        setRows([]);
      } else {
        const loaded = (data as FundRequestMyRequestRow[]) ?? [];
        const filtered =
          history && cutoffs.length > 0
            ? loaded.filter((row) =>
                cutoffs.some((cutoff) =>
                  fundRequestBelongsToApproverCutoff(row, cutoff, "upper_management")
                )
              )
            : loaded;
        setRows(filtered);
      }

      setLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, [requesterEmployeeId, supabase]);

  const selectedCutoff = historyCutoffs[selectedCutoffIndex] ?? null;

  const cutoffNavLabel = useMemo(() => {
    if (!selectedCutoff) return "";
    const start = parse(selectedCutoff.start_ymd, "yyyy-MM-dd", new Date());
    const end = parse(selectedCutoff.end_ymd, "yyyy-MM-dd", new Date());
    return formatFundRequestCutoffPeriod(start, end);
  }, [selectedCutoff]);

  const cutoffRows = useMemo(() => {
    if (!selectedCutoff) return rows;
    return rows.filter((row) =>
      fundRequestBelongsToApproverCutoff(row, selectedCutoff, "upper_management")
    );
  }, [rows, selectedCutoff]);

  const pendingCount = useMemo(
    () =>
      cutoffRows.filter(
        (row) =>
          ["pending", "project_manager_approved", "purchasing_officer_approved"].includes(
            row.status
          ) && !row.rejected_at
      ).length,
    [cutoffRows]
  );

  const canGoToOlderCutoff = selectedCutoffIndex < historyCutoffs.length - 1;
  const canGoToNewerCutoff = selectedCutoffIndex > 0;

  const handleRequestDeleted = (requestId: string) => {
    setRows((current) => current.filter((row) => row.id !== requestId));
  };

  if (!requesterEmployeeId) {
    return (
      <Card className="border-border/80 bg-card/95">
        <CardContent className="p-8 text-center text-muted-foreground">
          Link your account to an employee record to view your fund requests.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {historyCutoffs.length > 0 ? (
        <div className="space-y-1">
          <div className="flex items-center gap-2 rounded-lg border bg-card px-2 py-2 sm:px-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className={epPeriodNavButton}
              disabled={!canGoToOlderCutoff || loading}
              onClick={() =>
                setSelectedCutoffIndex((index) =>
                  Math.min(index + 1, historyCutoffs.length - 1)
                )
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
              className={epPeriodNavButton}
              disabled={!canGoToNewerCutoff || loading}
              onClick={() => setSelectedCutoffIndex((index) => Math.max(index - 1, 0))}
              aria-label="Next cutoff"
            >
              <Icon name="CaretRight" size={IconSizes.sm} />
            </Button>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Cutoff period: Friday – Thursday
            {isFundRequestCutoffDeadlineRollForwardActive()
              ? ", 10:00 AM Manila"
              : " (full week for the current cutoff)"}
          </p>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <MetricCard
          label="Requests this cutoff"
          value={loading ? "—" : String(cutoffRows.length)}
          meta={loading ? "Loading..." : `₱${sumAmount(cutoffRows).toLocaleString()} total`}
        />
        <MetricCard
          label="Pending approval"
          value={loading ? "—" : String(pendingCount)}
          meta={
            loading
              ? "Loading..."
              : pendingCount === 1
                ? "1 request in progress"
                : `${pendingCount} requests in progress`
          }
        />
      </div>

      <Card className="border-border/80 bg-card/95">
        <div className="flex flex-col gap-4 border-b px-4 py-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by purpose or project..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              aria-label="Search my fund requests"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="min-h-11 w-full sm:min-h-9 sm:w-[220px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending (Operations Manager)</SelectItem>
              <SelectItem value="project_manager_approved">
                Pending (Purchasing Officer)
              </SelectItem>
              <SelectItem value="purchasing_officer_approved">
                Pending (Upper Management)
              </SelectItem>
              <SelectItem value="management_approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <CardContent className="p-0">
          <FundRequestAllList
            rows={cutoffRows}
            loading={loading}
            searchTerm={searchTerm}
            statusFilter={statusFilter}
            base={detailHrefBase}
            requesterEmployeeId={requesterEmployeeId}
            requesterUserId={requesterUserId}
            requesterIsOperationsManager={requesterIsOperationsManager}
            onRequestDeleted={handleRequestDeleted}
            emptyLabel="No fund requests filed in this cutoff."
            filteredEmptyLabel="No fund requests match your filters for this cutoff."
          />
        </CardContent>
      </Card>
    </div>
  );
}
