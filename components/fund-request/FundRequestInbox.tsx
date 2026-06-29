"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/useProfile";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
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
import type { FundRequestRow } from "@/types/fund-request";
import { formatFundRequestPercentage, isSubcontractorPaymentPurpose } from "@/types/fund-request";
import { getFundRequestListProjectLabel } from "@/lib/fund-request-project-details";
import { isOfficeRelatedFundRequest } from "@/types/fund-request";
import { cn } from "@/lib/utils";
import {
  resolveFundRequestRequesterMap,
  type FundRequestRequesterInfo,
} from "@/lib/fund-request-requester";
import {
  canReturnFundRequestToPurchasing,
  buildFundRequestUpperManagementReturnUpdates,
  buildFundRequestRejectUpdates,
  buildFundRequestRejectionUndoSnapshot,
  getFundRequestStatusBadgeClass,
  getFundRequestStatusBadgeVariant,
  getActionableFundRequestStatuses,
} from "@/lib/fund-request-approval";
import { normalizeUserRole } from "@/lib/user-roles";
import { FUND_REQUEST_STATUS_LABELS } from "@/types/fund-request";
import { FundRequestClientGroupedInbox } from "@/components/fund-request/FundRequestClientGroupedInbox";
import {
  getFundRequestPayeeAccountName,
  type FundRequestInboxRow,
} from "@/lib/fund-request-inbox-grouping";
import { fetchManagedEmployeeIdsForApprover } from "@/lib/manager-approval-queue";
import { fundRequestInOperationsManagerQueue } from "@/lib/fund-request-routing";

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

function getApproveLabel(status: FundRequestRow["status"]): string {
  if (status === "pending") return "Approve (Operations Manager)";
  if (status === "project_manager_approved") return "Approve (Purchasing Officer)";
  if (status === "purchasing_officer_approved") return "Approve (Upper Management)";
  return "Approve";
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

export function FundRequestInbox({
  detailHrefBase = "/fund-request",
}: {
  detailHrefBase?: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const { profile, loading: profileLoading } = useProfile();
  const [rows, setRows] = useState<FundRequestInboxRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [requesterInfoById, setRequesterInfoById] = useState<
    Record<string, FundRequestRequesterInfo>
  >({});
  const [managedRequesterIds, setManagedRequesterIds] = useState<Set<string>>(
    new Set()
  );

  const getActionableStatuses = (): FundRequestRow["status"][] =>
    getActionableFundRequestStatuses(profile?.role);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const statuses = getActionableStatuses();
      const normalizedRole = normalizeUserRole(profile?.role);
      const currentUserId = profile?.id ?? null;
      const managedIds =
        normalizedRole === "operations_manager" && currentUserId
          ? new Set(await fetchManagedEmployeeIdsForApprover(supabase, currentUserId))
          : new Set<string>();
      setManagedRequesterIds(managedIds);
      const [actionableRes, allRes] = await Promise.all([
        statuses.length > 0
          ? supabase
              .from("fund_requests")
              .select(
                `*, employees ( employee_id, first_name, last_name, full_name, profile_picture_url, user_id ), vendors ( name ), projects ( name, code, clients: client_id ( name ) )`
              )
              .in("status", statuses)
              .order("created_at", { ascending: false })
          : { data: [], error: null },
        supabase.from("fund_requests").select("id, status"),
      ]);
      if (actionableRes.error) {
        toast.error("Failed to load fund requests");
      } else {
        const actionableRows =
          (actionableRes.data as FundRequestInboxRow[] | null) ?? [];
        const scopedRows =
          normalizedRole === "operations_manager"
            ? actionableRows.filter((row) =>
                fundRequestInOperationsManagerQueue(row, managedIds)
              )
            : actionableRows;
        setRows(scopedRows);
      }
      if (!allRes.error && allRes.data) {
        const c: Record<string, number> = {};
        allRes.data.forEach((r: { status: string }) => {
          c[r.status] = (c[r.status] || 0) + 1;
        });
        setCounts(c);
      }
      const actionableRows =
        normalizedRole === "operations_manager"
          ? ((actionableRes.data as FundRequestInboxRow[] | null) ?? []).filter(
              (row) => fundRequestInOperationsManagerQueue(row, managedIds)
            )
          : (actionableRes.data as FundRequestInboxRow[] | null) ?? [];
      const requestedByIds = new Set<string>();

      actionableRows.forEach((r: FundRequestRow) => {
        requestedByIds.add(r.requested_by);
      });
      const requesterMap = await resolveFundRequestRequesterMap(
        supabase,
        [...requestedByIds]
      );
      setRequesterInfoById(requesterMap);
      setLoading(false);
    };
    fetchData();
  }, [supabase, profile?.role, profile?.id]);

  const currentUserId = profile?.id ?? null;

  const refreshCounts = async () => {
    const { data: all } = await supabase.from("fund_requests").select("id, status");
    if (all) {
      const c: Record<string, number> = {};
      all.forEach((r: { status: string }) => {
        c[r.status] = (c[r.status] || 0) + 1;
      });
      setCounts(c);
    }
  };

  const handleApprove = async (
    id: string,
    currentStatus: FundRequestRow["status"]
  ) => {
    const nextStatus = NEXT_STATUS[currentStatus];
    if (!nextStatus || !currentUserId) return;

    setActingId(id);
    const updates: Record<string, unknown> = {
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
    const { error } = await supabase
      .from("fund_requests")
      .update(updates as never)
      .eq("id", id);
    setActingId(null);
    if (error) {
      toast.error("Failed to approve");
    } else {
      toast.success(
        nextStatus === "management_approved"
          ? "Fund request fully approved."
          : "Approved. Moved to next step."
      );
      setRows((prev) => prev.filter((r) => r.id !== id));
      await refreshCounts();
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
    setRows((prev) => prev.filter((row) => !approvedIds.has(row.id)));
    await refreshCounts();

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

  const handleReject = async (id: string, currentStatus: FundRequestRow["status"]) => {
    const returningToPurchasing = canReturnFundRequestToPurchasing(
      profile?.role,
      currentStatus
    );
    if (!returningToPurchasing && !rejectReason.trim()) {
      toast.error("Please enter a reason.");
      return;
    }
    if (!currentUserId) return;
    const row = rows.find((item) => item.id === id);
    const updates = returningToPurchasing
      ? buildFundRequestUpperManagementReturnUpdates(
          currentUserId,
          rejectReason,
          buildFundRequestRejectionUndoSnapshot(
            row ?? ({ status: currentStatus } as FundRequestInboxRow)
          )
        )
      : buildFundRequestRejectUpdates(
          currentUserId,
          rejectReason,
          row ?? ({ status: currentStatus } as FundRequestInboxRow)
        );

    setActingId(id);
    const { error } = await supabase
      .from("fund_requests")
      .update(updates as never)
      .eq("id", id);
    setActingId(null);
    setRejectId(null);
    setRejectReason("");
    if (error) {
      toast.error(
        returningToPurchasing
          ? "Failed to return request to purchasing"
          : "Failed to reject"
      );
    } else {
      toast.success(
        returningToPurchasing
          ? "Returned to purchasing officer for review."
          : "Fund request rejected."
      );
      setRows((prev) => prev.filter((r) => r.id !== id));
      await refreshCounts();
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

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const pendingPm = counts.pending ?? 0;
  const pendingPo = counts.project_manager_approved ?? 0;
  const pendingMgmt = counts.purchasing_officer_approved ?? 0;
  const rejected = counts.rejected ?? 0;
  const approvedForPayment = counts.purchasing_officer_approved ?? 0;
  const approved = counts.management_approved ?? 0;
  const actionableStatuses = getActionableStatuses();
  const isUpperManagement =
    normalizeUserRole(profile?.role) === "upper_management";
  const useClientGroupedView =
    isUpperManagement || normalizeUserRole(profile?.role) === "admin";

  const filteredRows = searchTerm
    ? rows.filter((r) => {
        const requesterInfo = requesterInfoById[r.requested_by];
        const name = getRequesterDisplayName(r, requesterInfo).toLowerCase();
        const purpose = (r.purpose || "").toLowerCase();
        const projectTitle = (r.project_title || "").toLowerCase();
        const projectLocation = (r.project_location || "").toLowerCase();
        const clientName = (r.projects?.clients?.name || "").toLowerCase();
        const payeeAccountName = (
          getFundRequestPayeeAccountName(r) || ""
        ).toLowerCase();
        const term = searchTerm.toLowerCase();
        return (
          name.includes(term) ||
          purpose.includes(term) ||
          projectTitle.includes(term) ||
          projectLocation.includes(term) ||
          clientName.includes(term) ||
          payeeAccountName.includes(term)
        );
      })
    : rows;

  const detailHref = (id: string) =>
    `${detailHrefBase}/${id}${detailHrefBase === "/fund-request" ? "?tab=inbox" : ""}`;

  const openDetail = (id: string) => {
    router.push(detailHref(id));
  };

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "grid w-full items-stretch gap-2.5 sm:gap-4",
          isUpperManagement
            ? "grid-cols-1 max-w-xs"
            : "grid-cols-2 sm:grid-cols-3 xl:grid-cols-6"
        )}
      >
        {isUpperManagement ? (
          <MetricCard label="Pending final approval" value={approvedForPayment} />
        ) : (
          <>
            <MetricCard label="Total" value={total} />
            <MetricCard label="Pending (Operations)" value={pendingPm} />
            <MetricCard label="Pending (Purchasing)" value={pendingPo} />
            <MetricCard label="Pending (U.M.)" value={pendingMgmt} />
            <MetricCard label="Approved" value={approved} />
            <MetricCard label="Rejected" value={rejected} />
          </>
        )}
      </div>

      <Card className="w-full">
        <CardContent className="w-full p-4 sm:p-6">
          <div className="relative w-full max-w-md">
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
            />
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
                  ? "No requests match your search."
                  : isUpperManagement
                    ? "No requests pending payment review."
                    : "No requests waiting for your approval."}
              </BodySmall>
            </VStack>
          </CardContent>
        </Card>
      ) : useClientGroupedView ? (
        <FundRequestClientGroupedInbox
          rows={filteredRows}
          detailHref={detailHref}
          getRequesterName={(row) =>
            getRequesterDisplayName(row, requesterInfoById[row.requested_by])
          }
          canReturnOn={(row) =>
            canReturnFundRequestToPurchasing(profile?.role, row.status)
          }
          actingId={actingId}
          rejectId={rejectId}
          rejectReason={rejectReason}
          onRejectReasonChange={setRejectReason}
          onStartReject={setRejectId}
          onCancelReject={() => {
            setRejectId(null);
            setRejectReason("");
          }}
          onReject={handleReject}
          bulkApproving={bulkApproving}
          onApproveAll={() => handleApproveAll(filteredRows)}
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
            const canAct = canQuickApproveFromInbox(
              r.status,
              profile?.role,
              actionableStatuses
            );
            const showPurchasingDetailOnly =
              r.status === "project_manager_approved" &&
              normalizeUserRole(profile?.role) === "purchasing_officer" &&
              actionableStatuses.includes(r.status);

            return (
              <Card
                key={r.id}
                className="h-full min-h-[220px] cursor-pointer border-muted/60 transition-shadow hover:shadow-hover"
                role="button"
                tabIndex={0}
                onClick={() => openDetail(r.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openDetail(r.id);
                  }
                }}
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
                      <span className="text-lg font-bold">{name}</span>
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
                  </div>

                  {(canAct || showPurchasingDetailOnly) && (
                    <HStack
                      gap="2"
                      align="center"
                      className="mt-auto flex-wrap border-t pt-2"
                    >
                      {rejectId === r.id ? (
                        <div
                          className="w-full space-y-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Label className="text-xs">Rejection reason</Label>
                          <Input
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Reason"
                          />
                          <HStack gap="2">
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={actingId === r.id}
                              onClick={() => handleReject(r.id, r.status)}
                            >
                              {actingId === r.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Confirm reject"
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setRejectId(null);
                                setRejectReason("");
                              }}
                            >
                              Cancel
                            </Button>
                          </HStack>
                        </div>
                      ) : (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            asChild
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Link href={detailHref(r.id)}>View details</Link>
                          </Button>
                          {canAct ? (
                            <>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRejectId(r.id);
                                  setRejectReason("");
                                }}
                              >
                                <Icon name="X" size={IconSizes.sm} />
                                Reject
                              </Button>
                              <Button
                                size="sm"
                                disabled={actingId === r.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleApprove(r.id, r.status);
                                }}
                              >
                                {actingId === r.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Icon name="Check" size={IconSizes.sm} />
                                )}
                                {getApproveLabel(r.status)}
                              </Button>
                            </>
                          ) : showPurchasingDetailOnly ? (
                            <Caption className="text-muted-foreground">
                              Open to review details and approve.
                            </Caption>
                          ) : null}
                        </>
                      )}
                    </HStack>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
