"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/useProfile";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { toast } from "sonner";
import { addDays, format, parse } from "date-fns";
import { formatFundRequestFiledAtCompact } from "@/lib/fund-request-history";
import { Loader2 } from "lucide-react";
import { MetricCard } from "@/components/ui/metric-card";
import { BodySmall, Caption } from "@/components/ui/typography";
import { EmployeeAvatar } from "@/components/EmployeeAvatar";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import {
  approvalQueueCardHeaderMeta,
  approvalQueueCardHeaderRow,
  approvalQueueStatusBadge,
} from "@/lib/approval-queue-card-ui";
import { dbHeaderButton, dbKpiGrid } from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";
import {
  resolveFundRequestRequesterMap,
  type FundRequestRequesterInfo,
} from "@/lib/fund-request-requester";
import {
  buildFundRequestRejectUpdates,
  buildFundRequestUpperManagementReturnUpdates,
  buildFundRequestRejectionUndoSnapshot,
  canReturnFundRequestToPurchasing,
  type FundRequestDisposalAction,
  getFundRequestDisposalReasonLabel,
  getFundRequestDisposalReasonPlaceholder,
  getFundRequestStatusBadgeClass,
  getFundRequestStatusBadgeVariant,
  getActionableFundRequestStatuses,
  isFundRequestReturnedToPurchasing,
  isPurchasingOfficerOwnFundRequest,
  validateFundRequestDisposalReason,
} from "@/lib/fund-request-approval";
import { normalizeUserRole } from "@/lib/user-roles";
import type { FundRequestRow, FundRequestDocumentSummary } from "@/types/fund-request";
import {
  FUND_REQUEST_STATUS_LABELS,
  formatFundRequestPercentage,
  isOfficeRelatedFundRequest,
  isSubcontractorPaymentPurpose,
} from "@/types/fund-request";
import { getFundRequestListProjectLabel } from "@/lib/fund-request-project-details";
import { FundRequestClientGroupedInbox } from "@/components/fund-request/FundRequestClientGroupedInbox";
import { canUploadFundRequestPaymentCheck } from "@/lib/fund-request-payment-check";
import { FundRequestCutoffNav } from "@/components/fund-request/FundRequestCutoffNav";
import {
  fundRequestBelongsToApproverCutoff,
  formatFundRequestCutoffPeriod,
  getActiveFundRequestCutoffIndex,
  getFundRequestHistoryCutoffs,
} from "@/lib/fund-request-cutoff";
import { FundRequestApprovedExportDialog } from "@/components/fund-request/FundRequestApprovedExportDialog";
import {
  getFundRequestRoleCutoffFilterOptions,
  getFundRequestRoleCutoffMetricLabels,
  matchesFundRequestRoleCutoffFilter,
  summarizeFundRequestsForRoleCutoff,
  type FundRequestRoleCutoffOutcomeFilter,
} from "@/lib/fund-request-inbox-cutoff-summary";
import type { WeeklyCutoffPeriod } from "@/utils/weekly";
import {
  getFundRequestPayeeAccountName,
  type FundRequestInboxRow,
} from "@/lib/fund-request-inbox-grouping";
import { fetchManagedEmployeeIdsForApprover } from "@/lib/manager-approval-queue";
import {
  fundRequestInOperationsManagerQueue,
  fundRequestSkippedOperationsManagerApproval,
  resolveFundRequestRequesterRoutingMap,
  shouldReturnFundRequestToOperationsManager,
  type FundRequestRequesterRouting,
} from "@/lib/fund-request-routing";

const NEXT_STATUS: Record<string, FundRequestRow["status"]> = {
  pending: "project_manager_approved",
  project_manager_approved: "purchasing_officer_approved",
  purchasing_officer_approved: "management_approved",
};

function formatEmployeeIdDisplay(
  employeeId: string | null | undefined
): string | null {
  const trimmed = employeeId?.trim();
  if (!trimmed || trimmed === "-" || trimmed === "—") return null;
  return trimmed;
}

function getRequesterDisplayName(
  row: FundRequestInboxRow,
  requesterInfo?: FundRequestRequesterInfo
): string {
  if (requesterInfo?.name) return requesterInfo.name;
  const emp = row.employees;
  if (!emp) return "Unknown";
  return (
    emp.full_name ||
    [emp.first_name, emp.last_name].filter(Boolean).join(" ") ||
    emp.employee_id ||
    "Unknown"
  );
}

function canQuickApproveFromInbox(
  status: FundRequestRow["status"],
  role: string | null | undefined,
  actionableStatuses: FundRequestRow["status"][]
): boolean {
  if (!actionableStatuses.includes(status)) return false;
  if (canReturnFundRequestToPurchasing(role, status)) return false;
  if (
    status === "project_manager_approved" &&
    normalizeUserRole(role) === "purchasing_officer"
  ) {
    return false;
  }
  return true;
}

function isFundRequestInApproverInboxQueue(
  row: FundRequestInboxRow,
  role: string | null | undefined,
  managedRequesterIds: ReadonlySet<string>,
  requesterRoutingById: Record<string, FundRequestRequesterRouting>,
  options?: {
    approverUserId?: string | null;
    requesterUserIdByEmployeeId?: Record<string, string | null | undefined>;
  }
): boolean {
  const normalizedRole = normalizeUserRole(role);
  const actionableStatuses = getActionableFundRequestStatuses(role);
  if (!actionableStatuses.includes(row.status)) return false;

  if (normalizedRole === "operations_manager") {
    return fundRequestInOperationsManagerQueue(row, managedRequesterIds);
  }

  if (normalizedRole === "purchasing_officer") {
    if (
      isPurchasingOfficerOwnFundRequest(row, {
        approverUserId: options?.approverUserId,
        requesterUserIdByEmployeeId: options?.requesterUserIdByEmployeeId,
      })
    ) {
      return false;
    }
    const routing = requesterRoutingById[row.requested_by];
    if (
      routing &&
      fundRequestSkippedOperationsManagerApproval(
        row,
        routing.requiresOperationsManagerApproval
      )
    ) {
      return false;
    }
    return row.status === "project_manager_approved";
  }

  if (normalizedRole === "upper_management") {
    return row.status === "purchasing_officer_approved";
  }

  if (normalizedRole === "admin") {
    return actionableStatuses.includes(row.status);
  }

  return false;
}

function matchesFundRequestInboxSearch(
  row: FundRequestInboxRow,
  searchTerm: string,
  requesterInfoById: Record<string, FundRequestRequesterInfo>
): boolean {
  const term = searchTerm.toLowerCase();
  const requesterInfo = requesterInfoById[row.requested_by];
  const name = getRequesterDisplayName(row, requesterInfo).toLowerCase();
  const purpose = (row.purpose || "").toLowerCase();
  const projectTitle = (row.project_title || "").toLowerCase();
  const projectLocation = (row.project_location || "").toLowerCase();
  const clientName = (row.projects?.clients?.name || "").toLowerCase();
  const payeeAccountName = (getFundRequestPayeeAccountName(row) || "").toLowerCase();

  return (
    name.includes(term) ||
    purpose.includes(term) ||
    projectTitle.includes(term) ||
    projectLocation.includes(term) ||
    clientName.includes(term) ||
    payeeAccountName.includes(term)
  );
}

const INBOX_ROW_SELECT =
  `*, employees ( employee_id, first_name, last_name, full_name, profile_picture_url, user_id ), vendors ( name ), projects ( name, code, clients: client_id ( name ) )`;

function formatCutoffMetricAmount(amount: number): string {
  return `₱${amount.toLocaleString()} total`;
}

const FUND_REQUEST_INBOX_FORWARD_WEEKS = 1;

function getInitialFundRequestCutoffs(): WeeklyCutoffPeriod[] {
  const history = getFundRequestHistoryCutoffs(format(new Date(), "yyyy-MM-dd"), {
    forwardWeeks: FUND_REQUEST_INBOX_FORWARD_WEEKS,
  });
  return history?.cutoffs ?? [];
}

function getInitialFundRequestCutoffIndex(cutoffs: WeeklyCutoffPeriod[]): number {
  return getActiveFundRequestCutoffIndex(cutoffs);
}

export function FundRequestInbox({
  detailHrefBase = "/fund-request",
}: {
  detailHrefBase?: string;
}) {
  const supabase = createClient();
  const { profile, loading: profileLoading } = useProfile();
  const [allRows, setAllRows] = useState<FundRequestInboxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [pendingDisposal, setPendingDisposal] = useState<{
    id: string;
    action: FundRequestDisposalAction;
  } | null>(null);
  const [pendingApprove, setPendingApprove] = useState<
    | { kind: "single"; id: string; status: FundRequestRow["status"] }
    | { kind: "all"; requests: FundRequestInboxRow[] }
    | null
  >(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [outcomeFilter, setOutcomeFilter] =
    useState<FundRequestRoleCutoffOutcomeFilter>("pending");
  const [requesterInfoById, setRequesterInfoById] = useState<
    Record<string, FundRequestRequesterInfo>
  >({});
  const [requesterRoutingById, setRequesterRoutingById] = useState<
    Record<string, FundRequestRequesterRouting>
  >({});
  const [managedRequesterIds, setManagedRequesterIds] = useState<Set<string>>(
    new Set()
  );
  const [historyCutoffs, setHistoryCutoffs] = useState<WeeklyCutoffPeriod[]>(
    getInitialFundRequestCutoffs
  );
  const [selectedCutoffIndex, setSelectedCutoffIndex] = useState(() =>
    getInitialFundRequestCutoffIndex(getInitialFundRequestCutoffs())
  );
  const [paymentCheckDocumentsByRequestId, setPaymentCheckDocumentsByRequestId] =
    useState<Record<string, FundRequestDocumentSummary[]>>({});
  const [approvedExportOpen, setApprovedExportOpen] = useState(false);

  const selectedCutoff = historyCutoffs[selectedCutoffIndex] ?? null;
  const requesterUserIdByEmployeeId = useMemo(() => {
    const map: Record<string, string | null | undefined> = {};
    for (const [employeeId, info] of Object.entries(requesterInfoById)) {
      map[employeeId] = info.userId;
    }
    for (const row of allRows) {
      if (row.employees?.user_id) {
        map[row.requested_by] = row.employees.user_id;
      }
    }
    return map;
  }, [allRows, requesterInfoById]);

  const inboxQueueOptions = useMemo(
    () => ({
      approverUserId: profile?.id ?? null,
      requesterUserIdByEmployeeId,
    }),
    [profile?.id, requesterUserIdByEmployeeId]
  );

  const summaryContext = useMemo(
    () => ({
      managedRequesterIds,
      requesterRoutingById,
      approverUserId: profile?.id ?? null,
      requesterUserIdByEmployeeId,
    }),
    [managedRequesterIds, requesterRoutingById, profile?.id, requesterUserIdByEmployeeId]
  );

  const cutoffScopedRows = useMemo(() => {
    if (!selectedCutoff) return [];
    return allRows.filter(
      (row) =>
        fundRequestBelongsToApproverCutoff(row, selectedCutoff, "upper_management") &&
        matchesFundRequestRoleCutoffFilter(row, "all", profile?.role, summaryContext)
    );
  }, [allRows, selectedCutoff, profile?.role, summaryContext]);

  const filteredRows = useMemo(() => {
    let list = cutoffScopedRows.filter((row) =>
      matchesFundRequestRoleCutoffFilter(
        row,
        outcomeFilter,
        profile?.role,
        summaryContext
      )
    );

    if (searchTerm) {
      list = list.filter((row) =>
        matchesFundRequestInboxSearch(row, searchTerm, requesterInfoById)
      );
    }

    return list;
  }, [
    cutoffScopedRows,
    outcomeFilter,
    profile?.role,
    summaryContext,
    searchTerm,
    requesterInfoById,
  ]);

  const cutoffSummary = useMemo(() => {
    if (!selectedCutoff) {
      return {
        total: 0,
        approved: 0,
        rejected: 0,
        pending: 0,
        amounts: { total: 0, approved: 0, rejected: 0, pending: 0 },
      };
    }
    return summarizeFundRequestsForRoleCutoff(
      cutoffScopedRows,
      selectedCutoff,
      profile?.role,
      summaryContext
    );
  }, [cutoffScopedRows, selectedCutoff, profile?.role, summaryContext]);

  const approvedExportRows = useMemo(
    () =>
      cutoffScopedRows.filter((row) =>
        matchesFundRequestRoleCutoffFilter(
          row,
          "approved",
          profile?.role,
          summaryContext
        )
      ),
    [cutoffScopedRows, profile?.role, summaryContext]
  );

  const cutoffExportLabel = useMemo(() => {
    if (!selectedCutoff) return "";
    const start = parse(selectedCutoff.start_ymd, "yyyy-MM-dd", new Date());
    const end = parse(selectedCutoff.end_ymd, "yyyy-MM-dd", new Date());
    return formatFundRequestCutoffPeriod(start, end);
  }, [selectedCutoff]);

  const getActionableStatuses = (): FundRequestRow["status"][] =>
    getActionableFundRequestStatuses(profile?.role);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const normalizedRole = normalizeUserRole(profile?.role);
      const currentUserId = profile?.id ?? null;
      const managedIds =
        normalizedRole === "operations_manager" && currentUserId
          ? new Set(await fetchManagedEmployeeIdsForApprover(supabase, currentUserId))
          : new Set<string>();
      setManagedRequesterIds(managedIds);
      const todayYmd = format(new Date(), "yyyy-MM-dd");
      const history = getFundRequestHistoryCutoffs(todayYmd, {
        forwardWeeks: FUND_REQUEST_INBOX_FORWARD_WEEKS,
      });
      if (history?.cutoffs.length) {
        setHistoryCutoffs(history.cutoffs);
        setSelectedCutoffIndex((current) => {
          if (current >= history.cutoffs.length) {
            return getActiveFundRequestCutoffIndex(history.cutoffs);
          }
          return current;
        });
      }

      let query = supabase
        .from("fund_requests")
        .select(INBOX_ROW_SELECT)
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

      if (error) {
        toast.error("Failed to load fund requests");
        setAllRows([]);
        setLoading(false);
        return;
      }

      const loadedRows = ((data as FundRequestInboxRow[] | null) ?? []).filter(
        (row) =>
          !history?.cutoffs.length ||
          history.cutoffs.some((cutoff) =>
            fundRequestBelongsToApproverCutoff(row, cutoff, "upper_management")
          )
      );

      const requestedByIds = new Set<string>();
      loadedRows.forEach((row) => requestedByIds.add(row.requested_by));
      const routingMap = await resolveFundRequestRequesterRoutingMap(
        supabase,
        [...requestedByIds]
      );
      setRequesterRoutingById(Object.fromEntries(routingMap));

      const requesterMap = await resolveFundRequestRequesterMap(
        supabase,
        [...requestedByIds]
      );
      setRequesterInfoById(requesterMap);
      setAllRows(loadedRows);
      setLoading(false);
    };
    fetchData();
  }, [supabase, profile?.role, profile?.id]);

  const isUpperManagementRole =
    normalizeUserRole(profile?.role) === "upper_management";

  useEffect(() => {
    if (!isUpperManagementRole || allRows.length === 0) {
      setPaymentCheckDocumentsByRequestId({});
      return;
    }

    const requestIds = allRows.map((row) => row.id);
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("fund_request_documents")
        .select(
          "id, fund_request_id, employee_id, file_name, file_type, file_size, created_at, document_type, uploaded_by, storage_path"
        )
        .in("fund_request_id", requestIds)
        .eq("document_type", "payment_check")
        .order("created_at", { ascending: true });

      if (cancelled) return;

      if (error) {
        setPaymentCheckDocumentsByRequestId({});
        return;
      }

      const grouped: Record<string, FundRequestDocumentSummary[]> = {};
      for (const row of (data as FundRequestDocumentSummary[]) ?? []) {
        const bucket = grouped[row.fund_request_id] ?? [];
        bucket.push(row);
        grouped[row.fund_request_id] = bucket;
      }
      setPaymentCheckDocumentsByRequestId(grouped);
    })();

    return () => {
      cancelled = true;
    };
  }, [allRows, isUpperManagementRole, supabase]);

  const currentUserId = profile?.id ?? null;

  const handleApprove = async (
    id: string,
    currentStatus: FundRequestRow["status"]
  ) => {
    if (!currentUserId) return;
    const row = allRows.find((item) => item.id === id);
    const normalizedRole = normalizeUserRole(profile?.role);

    let updates: Record<string, unknown>;
    let successMessage = "Approved. Moved to next step.";

    if (
      normalizedRole === "operations_manager" &&
      row &&
      !row.project_manager_approved_by &&
      (currentStatus === "project_manager_approved" ||
        currentStatus === "purchasing_officer_approved")
    ) {
      updates = {
        project_manager_approved_by: currentUserId,
        project_manager_approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      successMessage =
        currentStatus === "purchasing_officer_approved"
          ? "Operations Manager approval recorded."
          : "Approved. Sent to Purchasing Officer.";
    } else {
      const nextStatus = NEXT_STATUS[currentStatus];
      if (!nextStatus) return;

      updates = {
        status: nextStatus,
        updated_at: new Date().toISOString(),
      };
      if (currentStatus === "pending") {
        updates.project_manager_approved_by = currentUserId;
        updates.project_manager_approved_at = new Date().toISOString();
      } else if (currentStatus === "project_manager_approved") {
        updates.purchasing_officer_approved_by = currentUserId;
        updates.purchasing_officer_approved_at = new Date().toISOString();
      } else if (currentStatus === "purchasing_officer_approved") {
        updates.management_approved_by = currentUserId;
        updates.management_approved_at = new Date().toISOString();
      }
      if (nextStatus === "management_approved") {
        successMessage = "Fund request fully approved.";
      }
    }

    setActingId(id);
    const { error } = await supabase
      .from("fund_requests")
      .update(updates as never)
      .eq("id", id);
    setActingId(null);
    if (error) {
      toast.error("Failed to approve");
    } else {
      toast.success(successMessage);
      setAllRows((prev) =>
        prev.map((metricRow) =>
          metricRow.id === id
            ? ({ ...metricRow, ...(updates as Partial<FundRequestRow>) } as FundRequestInboxRow)
            : metricRow
        )
      );
    }
  };

  const handleApproveAll = async (requests: FundRequestInboxRow[]) => {
    if (!currentUserId || requests.length === 0) return;

    setBulkApproving(true);
    const timestamp = new Date().toISOString();
    const results = await Promise.all(
      requests.map((request) =>
        supabase
          .from("fund_requests")
          .update({
            status: "management_approved",
            management_approved_by: currentUserId,
            management_approved_at: timestamp,
            updated_at: timestamp,
          } as never)
          .eq("id", request.id)
      )
    );

    const failed = results.filter((result) => result.error).length;
    setBulkApproving(false);

    if (failed === requests.length) {
      toast.error("Failed to approve requests.");
      return;
    }

    const approvedIds = new Set(
      requests
        .filter((_, index) => !results[index]?.error)
        .map((request) => request.id)
    );
    setAllRows((prev) =>
      prev.map((row) =>
        approvedIds.has(row.id)
          ? {
              ...row,
              status: "management_approved",
              management_approved_by: currentUserId,
              management_approved_at: timestamp,
            }
          : row
      )
    );

    if (failed > 0) {
      toast.warning(
        `Approved ${requests.length - failed} of ${requests.length} requests.`
      );
      return;
    }

    toast.success(
      `Approved ${requests.length} fund request${requests.length === 1 ? "" : "s"}.`
    );
  };

  const handleDisposal = async (
    id: string,
    currentStatus: FundRequestRow["status"],
    action: FundRequestDisposalAction
  ) => {
    const validation = validateFundRequestDisposalReason(
      currentStatus,
      action,
      rejectReason
    );
    if (!validation.ok) {
      toast.error(validation.message);
      return;
    }
    if (!currentUserId) return;
    const row = allRows.find((item) => item.id === id);
    const requestRow =
      row ?? ({ status: currentStatus } as FundRequestInboxRow);
    const undoSnapshot = buildFundRequestRejectionUndoSnapshot(requestRow);
    const routing = requesterRoutingById[requestRow.requested_by];
    const returnToOperationsManager = Boolean(
      routing &&
        shouldReturnFundRequestToOperationsManager(
          requestRow,
          routing.requiresOperationsManagerApproval
        )
    );
    const updates =
      action === "return"
        ? buildFundRequestUpperManagementReturnUpdates(
            currentUserId,
            rejectReason,
            undoSnapshot,
            requestRow,
            { returnToOperationsManager }
          )
        : buildFundRequestRejectUpdates(
            currentUserId,
            rejectReason,
            requestRow
          );

    setActingId(id);
    const { error } = await supabase
      .from("fund_requests")
      .update(updates as never)
      .eq("id", id);
    setActingId(null);
    setPendingDisposal(null);
    setRejectReason("");
    if (error) {
      toast.error(
        action === "return"
          ? "Failed to return request to purchasing"
          : "Failed to reject"
      );
    } else {
      toast.success(
        action === "return"
          ? returnToOperationsManager
            ? "Returned to operations manager for approval."
            : "Returned to purchasing officer for review."
          : "Fund request rejected."
      );
      setAllRows((prev) =>
        prev.map((metricRow) =>
          metricRow.id === id
            ? ({ ...metricRow, ...(updates as Partial<FundRequestRow>) } as FundRequestInboxRow)
            : metricRow
        )
      );
    }
  };

  if (profileLoading) {
    return <div className="p-6 text-muted-foreground text-sm">Loading…</div>;
  }

  if (getActionableStatuses().length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        You do not have permission to manage fund request approvals.
      </div>
    );
  }

  const actionableStatuses = getActionableStatuses();
  const isUpperManagement =
    normalizeUserRole(profile?.role) === "upper_management";
  const useClientGroupedView = isUpperManagement;
  const summaryLoadingLabel = loading ? "Loading..." : undefined;
  const metricLabels = getFundRequestRoleCutoffMetricLabels(profile?.role);
  const filterOptions = getFundRequestRoleCutoffFilterOptions(profile?.role);
  const selectedFilterLabel =
    filterOptions.find((option) => option.value === outcomeFilter)?.label ?? "All";

  const detailHref = (id: string) =>
    `${detailHrefBase}/${id}${detailHrefBase === "/fund-request" ? "?tab=inbox" : ""}`;

  return (
    <div className="space-y-4">
      <FundRequestCutoffNav
        cutoffs={historyCutoffs}
        selectedIndex={selectedCutoffIndex}
        onSelectedIndexChange={setSelectedCutoffIndex}
        loading={loading}
      />

      <div className={cn("w-full", dbKpiGrid)}>
        <MetricCard
          label={metricLabels.total}
          value={loading ? "—" : String(cutoffSummary.total)}
          meta={
            summaryLoadingLabel ??
            formatCutoffMetricAmount(cutoffSummary.amounts.total)
          }
          onClick={() => setOutcomeFilter("all")}
          active={outcomeFilter === "all"}
        />
        <MetricCard
          label={metricLabels.approved}
          value={loading ? "—" : String(cutoffSummary.approved)}
          meta={
            summaryLoadingLabel ??
            formatCutoffMetricAmount(cutoffSummary.amounts.approved)
          }
          onClick={() => setOutcomeFilter("approved")}
          active={outcomeFilter === "approved"}
        />
        <MetricCard
          label={metricLabels.rejected}
          value={loading ? "—" : String(cutoffSummary.rejected)}
          meta={
            summaryLoadingLabel ??
            formatCutoffMetricAmount(cutoffSummary.amounts.rejected)
          }
          onClick={() => setOutcomeFilter("rejected")}
          active={outcomeFilter === "rejected"}
        />
        <MetricCard
          label={metricLabels.pending}
          value={loading ? "—" : String(cutoffSummary.pending)}
          meta={
            summaryLoadingLabel ??
            formatCutoffMetricAmount(cutoffSummary.amounts.pending)
          }
          onClick={() => setOutcomeFilter("pending")}
          active={outcomeFilter === "pending"}
        />
      </div>

      <Card className="w-full">
        <CardContent className="flex w-full flex-col gap-4 p-4 sm:flex-row sm:p-6">
          <div className="relative w-full flex-1">
            <Icon
              name="MagnifyingGlass"
              size={IconSizes.sm}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              placeholder="Search by name, account name, purpose, or project..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              aria-label="Search fund requests for approval"
            />
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Select
              value={outcomeFilter}
              onValueChange={(value) =>
                setOutcomeFilter(value as FundRequestRoleCutoffOutcomeFilter)
              }
            >
              <SelectTrigger
                className="min-h-11 w-full sm:min-h-9 sm:w-[280px]"
                aria-label="Filter fund requests by outcome"
              >
                <SelectValue placeholder="Filter by outcome" />
              </SelectTrigger>
              <SelectContent>
                {filterOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isUpperManagement && approvedExportRows.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                className={cn(dbHeaderButton, "w-full shrink-0 sm:w-auto")}
                onClick={() => setApprovedExportOpen(true)}
              >
                <Icon name="Download" size={IconSizes.sm} className="mr-2" />
                Export approved summary
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="p-6 text-muted-foreground text-sm">Loading…</div>
      ) : filteredRows.length === 0 ? (
        <Card>
          <CardContent className="p-8">
            <VStack gap="2" align="center">
              <Icon
                name="CurrencyCircleDollar"
                size={IconSizes.xl}
                className="text-muted-foreground"
              />
              <BodySmall>
                {searchTerm
                  ? `No requests match your search for ${selectedFilterLabel.toLowerCase()} in this cutoff.`
                  : `No ${selectedFilterLabel.toLowerCase()} requests in this cutoff.`}
              </BodySmall>
            </VStack>
          </CardContent>
        </Card>
      ) : useClientGroupedView ? (
        <FundRequestClientGroupedInbox
          rows={filteredRows}
          detailHref={detailHref}
          canUploadPaymentCheck={(row) =>
            canUploadFundRequestPaymentCheck(profile?.role, row.status)
          }
          paymentCheckDocumentsByRequestId={paymentCheckDocumentsByRequestId}
          onPaymentCheckDocumentsChangeForGroup={(requestIds, documents) => {
            setPaymentCheckDocumentsByRequestId((current) => {
              const next = { ...current };
              for (const requestId of requestIds) {
                next[requestId] = documents.filter(
                  (doc) => doc.fund_request_id === requestId
                );
              }
              return next;
            });
          }}
          getRequesterName={(row) =>
            getRequesterDisplayName(row, requesterInfoById[row.requested_by])
          }
          canReturnOn={(row) =>
            canReturnFundRequestToPurchasing(profile?.role, row.status)
          }
          actingId={actingId}
          pendingDisposal={pendingDisposal}
          rejectReason={rejectReason}
          onRejectReasonChange={setRejectReason}
          onStartReturn={(id) => setPendingDisposal({ id, action: "return" })}
          onStartReject={(id) => setPendingDisposal({ id, action: "reject" })}
          onCancelDisposal={() => {
            setPendingDisposal(null);
            setRejectReason("");
          }}
          onConfirmDisposal={handleDisposal}
          bulkApproving={bulkApproving}
          onApproveAll={() =>
            setPendingApprove({
              kind: "all",
              requests: filteredRows.filter((row) =>
                isFundRequestInApproverInboxQueue(
                  row,
                  profile?.role,
                  managedRequesterIds,
                  requesterRoutingById,
                  inboxQueueOptions
                )
              ),
            })
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredRows.map((r) => {
            const requesterInfo = requesterInfoById[r.requested_by];
            const name = getRequesterDisplayName(r, requesterInfo);
            const emp = r.employees;
            const employeeIdLabel = formatEmployeeIdDisplay(emp?.employee_id);
            const projectTitle = getFundRequestListProjectLabel(r);
            const isOfficeRelated = isOfficeRelatedFundRequest(r.reference_mode);
            const purpose = (r.purpose || "").trim() || "—";
            const showSubcontractorFields = isSubcontractorPaymentPurpose(r.purpose);
            const canAct =
              isFundRequestInApproverInboxQueue(
                r,
                profile?.role,
                managedRequesterIds,
                requesterRoutingById,
                inboxQueueOptions
              ) &&
              canQuickApproveFromInbox(
                r.status,
                profile?.role,
                actionableStatuses
              );
            const showPurchasingDetailOnly =
              r.status === "project_manager_approved" &&
              normalizeUserRole(profile?.role) === "purchasing_officer" &&
              actionableStatuses.includes(r.status);
            const purchasingSubcontractorDetailOnly =
              showPurchasingDetailOnly && showSubcontractorFields;

            const returnedToPurchasing = isFundRequestReturnedToPurchasing(r);

            return (
              <Card
                key={r.id}
                className="h-full min-h-[220px] border-muted/60 transition-shadow hover:shadow-hover"
              >
                <CardContent className="flex h-full flex-col gap-3 p-4">
                  <div className={approvalQueueCardHeaderRow}>
                    <HStack
                      gap="3"
                      align="center"
                      className={approvalQueueCardHeaderMeta}
                    >
                      <EmployeeAvatar
                        profilePictureUrl={emp?.profile_picture_url}
                        fullName={name}
                        size="sm"
                      />
                      <span className="text-base font-bold sm:text-lg">{name}</span>
                      {employeeIdLabel ? (
                        <Caption>({employeeIdLabel})</Caption>
                      ) : null}
                      <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
                        {purpose}
                      </Badge>
                    </HStack>
                    <Badge
                      variant={getFundRequestStatusBadgeVariant(r.status)}
                      className={cn(
                        approvalQueueStatusBadge,
                        getFundRequestStatusBadgeClass(r.status)
                      )}
                    >
                      {FUND_REQUEST_STATUS_LABELS[r.status] ?? r.status}
                    </Badge>
                  </div>

                  <div className="flex-1">
                    <HStack
                      gap="4"
                      align="center"
                      className="mb-2 flex-wrap text-sm text-muted-foreground"
                    >
                      <HStack gap="1" align="center">
                        <Icon name="CalendarBlank" size={IconSizes.sm} />
                        {formatFundRequestFiledAtCompact(r)}
                      </HStack>
                      <span className="font-semibold text-primary">
                        ₱
                        {Number(r.total_requested_amount).toLocaleString(
                          "en-PH",
                          { minimumFractionDigits: 2 }
                        )}
                      </span>
                    </HStack>
                    <BodySmall className="line-clamp-2">
                      {isOfficeRelated ? (
                        projectTitle
                      ) : (
                        <>
                          <strong>Project:</strong> {projectTitle}
                        </>
                      )}
                    </BodySmall>
                    {!isOfficeRelated && r.project_location ? (
                      <BodySmall className="mt-1 line-clamp-1 text-muted-foreground">
                        <strong>Location:</strong>{" "}
                        <span className="uppercase">{r.project_location}</span>
                      </BodySmall>
                    ) : null}
                    {showSubcontractorFields && r.vendors?.name ? (
                      <BodySmall className="mt-1 line-clamp-1 text-muted-foreground">
                        <strong>Subcontractor:</strong> {r.vendors.name}
                      </BodySmall>
                    ) : null}
                    {(showSubcontractorFields &&
                      r.subcontractor_progress_completion_percentage != null) ||
                    r.current_project_percentage != null ? (
                      <Caption className="mt-1 block text-muted-foreground">
                        {showSubcontractorFields &&
                        r.subcontractor_progress_completion_percentage != null
                          ? `Subcontractor Progress: ${formatFundRequestPercentage(r.subcontractor_progress_completion_percentage)}`
                          : null}
                        {showSubcontractorFields &&
                        r.subcontractor_progress_completion_percentage != null &&
                        r.current_project_percentage != null
                          ? " · "
                          : null}
                        {r.current_project_percentage != null
                          ? `Project Completion: ${formatFundRequestPercentage(r.current_project_percentage)}`
                          : null}
                      </Caption>
                    ) : null}
                    {returnedToPurchasing ? (
                      <Caption className="text-amber-900">
                        Returned to purchasing officer for review again
                        {r.return_reason || r.rejection_reason
                          ? `: ${r.return_reason || r.rejection_reason}`
                          : ""}
                      </Caption>
                    ) : null}
                  </div>

                  <div className="mt-auto space-y-2 border-t pt-2">
                    {pendingDisposal?.id === r.id ? (
                      <div className="w-full space-y-2">
                        <Label className="text-xs">
                          {getFundRequestDisposalReasonLabel(
                            r.status,
                            pendingDisposal.action
                          )}
                        </Label>
                        <Input
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder={getFundRequestDisposalReasonPlaceholder(
                            r.status,
                            pendingDisposal.action
                          )}
                        />
                        <div className="flex flex-row flex-wrap items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant={
                              pendingDisposal.action === "return"
                                ? "default"
                                : "destructive"
                            }
                            className={dbHeaderButton}
                            disabled={actingId === r.id}
                            onClick={() =>
                              handleDisposal(r.id, r.status, pendingDisposal.action)
                            }
                          >
                            {actingId === r.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : pendingDisposal.action === "return" ? (
                              "Confirm return"
                            ) : (
                              "Confirm reject"
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className={dbHeaderButton}
                            onClick={() => {
                              setPendingDisposal(null);
                              setRejectReason("");
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-row flex-wrap items-center justify-end gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            className={cn(dbHeaderButton, "shrink-0")}
                            asChild
                          >
                            <Link href={detailHref(r.id)}>View details</Link>
                          </Button>
                          {canAct ? (
                            <>
                              <Button
                                variant="destructive"
                                size="sm"
                                className={dbHeaderButton}
                                onClick={() => {
                                  setPendingDisposal({ id: r.id, action: "reject" });
                                  setRejectReason("");
                                }}
                              >
                                <Icon name="X" size={IconSizes.sm} />
                                Reject
                              </Button>
                              <Button
                                size="sm"
                                className={dbHeaderButton}
                                disabled={actingId === r.id}
                                onClick={() =>
                                  setPendingApprove({
                                    kind: "single",
                                    id: r.id,
                                    status: r.status,
                                  })
                                }
                              >
                                {actingId === r.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Icon name="Check" size={IconSizes.sm} />
                                )}
                                Approve
                              </Button>
                            </>
                          ) : null}
                        </div>
                        {purchasingSubcontractorDetailOnly ? (
                          <Caption className="text-right text-muted-foreground">
                            Open to enter Subcontractor P.O. Amount and approve.
                          </Caption>
                        ) : showPurchasingDetailOnly ? (
                          <Caption className="text-right text-muted-foreground">
                            Open to review details and approve.
                          </Caption>
                        ) : null}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <AlertDialog
        open={Boolean(pendingApprove)}
        onOpenChange={(open) => !open && setPendingApprove(null)}
      >
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingApprove?.kind === "all" ? "Approve all requests?" : "Approve request?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingApprove?.kind === "all"
                ? `This will approve ${pendingApprove.requests.length} fund request${
                    pendingApprove.requests.length === 1 ? "" : "s"
                  } and move each to the next step.`
                : "This will approve the fund request and move it to the next step."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const pending = pendingApprove;
                setPendingApprove(null);
                if (!pending) return;
                if (pending.kind === "all") {
                  void handleApproveAll(pending.requests);
                  return;
                }
                void handleApprove(pending.id, pending.status);
              }}
            >
              Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <FundRequestApprovedExportDialog
        open={approvedExportOpen}
        onOpenChange={setApprovedExportOpen}
        rows={approvedExportRows}
        cutoffLabel={cutoffExportLabel}
        getRequesterName={(row) =>
          getRequesterDisplayName(row, requesterInfoById[row.requested_by])
        }
      />
    </div>
  );
}
