"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/useProfile";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  format,
  addDays,
  isWithinInterval,
  startOfDay,
  endOfDay,
} from "date-fns";
import {
  Loader2,
  Calendar,
  Search,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { SummaryStatCard } from "@/components/approval/SummaryStatCard";
import type { FundRequestRow } from "@/types/fund-request";

type RowWithRequester = FundRequestRow & {
  employees: {
    employee_id: string;
    first_name: string;
    last_name: string;
  } | null;
};

const NEXT_STATUS: Record<string, FundRequestRow["status"]> = {
  pending: "project_manager_approved",
  project_manager_approved: "purchasing_officer_approved",
  purchasing_officer_approved: "management_approved",
};

const STEP_LABEL: Record<string, string> = {
  pending: "Pending PM",
  project_manager_approved: "Pending PO",
  purchasing_officer_approved: "Pending Management",
};

const STATUS_LABEL_ALL: Record<string, string> = {
  pending: "Pending (PM)",
  project_manager_approved: "Pending (PO)",
  purchasing_officer_approved: "Pending (Management)",
  management_approved: "Approved",
  rejected: "Rejected",
};

function getInitials(firstName: string, lastName: string): string {
  const f = (firstName || "").trim()[0] || "";
  const l = (lastName || "").trim()[0] || "";
  return (f + l).toUpperCase() || "?";
}

type DetailItem = { description?: string; amount?: number };

/** Cutoff week: Saturday–Thursday. Friday belongs to the *next* week (the following Saturday–Thursday). */
function getCutoffWeekStart(date: Date): Date {
  const day = date.getDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
  if (day === 5) return startOfDay(addDays(date, 1)); // Friday → next Saturday
  const daysBack = day === 6 ? 0 : day === 0 ? 1 : day + 1; // Sat=0, Sun=1, Mon=2, ..., Thu=5
  return startOfDay(addDays(date, -daysBack));
}

/** End of cutoff week = end of Thursday = weekStart + 5 days (Sat+5 = Thu). */
function getCutoffWeekEnd(weekStart: Date): Date {
  return endOfDay(addDays(weekStart, 5));
}

export default function FundRequestApprovalPage() {
  const supabase = createClient();
  const { profile, loading: profileLoading } = useProfile();
  const [rows, setRows] = useState<RowWithRequester[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [supplierBankDetails, setSupplierBankDetails] = useState<
    Record<string, string>
  >({});
  const [viewMode, setViewMode] = useState<"pending" | "all">("pending");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "approved" | "rejected"
  >("all");
  // Week offset: -1 = all weeks, 0 = this week, 1 = last week, 2 = 2 weeks ago, ... (left/right to move)
  const [weekOffset, setWeekOffset] = useState(-1);
  const MAX_WEEKS_BACK = 12;
  const [allRows, setAllRows] = useState<RowWithRequester[]>([]);
  const [approverNames, setApproverNames] = useState<Record<string, string>>(
    {},
  );

  // Statuses this role can act on: PM sees only pending, PO only after PM approval, Management only after PO
  const getActionableStatuses = (): FundRequestRow["status"][] => {
    const role = profile?.role;
    if (role === "operations_manager") return ["pending"];
    if (role === "purchasing_officer") return ["project_manager_approved"];
    if (role === "hr" || role === "admin" || role === "upper_management")
      return ["purchasing_officer_approved"];
    return [];
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const statuses = getActionableStatuses();
      const [actionableRes, allRes, allRowsRes] = await Promise.all([
        statuses.length > 0
          ? supabase
              .from("fund_requests")
              .select(`*, employees ( employee_id, first_name, last_name )`)
              .in("status", statuses)
              .order("created_at", { ascending: false })
          : { data: [], error: null },
        supabase.from("fund_requests").select("id, status"),
        supabase
          .from("fund_requests")
          .select(`*, employees ( employee_id, first_name, last_name )`)
          .order("created_at", { ascending: false }),
      ]);
      if (actionableRes.error) {
        toast.error("Failed to load fund requests");
      } else {
        setRows((actionableRes.data as RowWithRequester[]) ?? []);
      }
      if (!allRes.error && allRes.data) {
        const c: Record<string, number> = {};
        allRes.data.forEach((r: { status: string }) => {
          c[r.status] = (c[r.status] || 0) + 1;
        });
        setCounts(c);
      }
      const allData = (allRowsRes.data as RowWithRequester[]) ?? [];
      setAllRows(allData);
      const ids = new Set<string>();
      allData.forEach((r: FundRequestRow) => {
        if (r.project_manager_approved_by)
          ids.add(r.project_manager_approved_by);
        if (r.purchasing_officer_approved_by)
          ids.add(r.purchasing_officer_approved_by);
        if (r.management_approved_by) ids.add(r.management_approved_by);
        if (r.rejected_by) ids.add(r.rejected_by);
      });
      if (ids.size > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", [...ids]);
        const names: Record<string, string> = {};
        (profiles ?? []).forEach(
          (p: { id: string; full_name: string | null }) => {
            names[p.id] = (p.full_name || p.id).trim() || "—";
          },
        );
        setApproverNames(names);
      } else {
        setApproverNames({});
      }
      setLoading(false);
    };
    fetchData();
  }, [supabase, profile?.role]);

  const currentUserId = profile?.id ?? null;

  const handleApprove = async (
    id: string,
    currentStatus: FundRequestRow["status"],
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
      updates.supplier_bank_details =
        (supplierBankDetails[id] ?? "").trim() || null;
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
          : "Approved. Moved to next step.",
      );
      setRows((prev) => prev.filter((r) => r.id !== id));
      setSupplierBankDetails((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      const [{ data: all }, { data: allRowsData }] = await Promise.all([
        supabase.from("fund_requests").select("id, status"),
        supabase
          .from("fund_requests")
          .select(`*, employees ( employee_id, first_name, last_name )`)
          .order("created_at", { ascending: false }),
      ]);
      if (all) {
        const c: Record<string, number> = {};
        all.forEach((r: { status: string }) => {
          c[r.status] = (c[r.status] || 0) + 1;
        });
        setCounts(c);
      }
      if (allRowsData) {
        setAllRows(allRowsData as RowWithRequester[]);
        const ids = new Set<string>();
        allRowsData.forEach((row: FundRequestRow) => {
          if (row.project_manager_approved_by)
            ids.add(row.project_manager_approved_by);
          if (row.purchasing_officer_approved_by)
            ids.add(row.purchasing_officer_approved_by);
          if (row.management_approved_by) ids.add(row.management_approved_by);
          if (row.rejected_by) ids.add(row.rejected_by);
        });
        if (ids.size > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", [...ids]);
          const names: Record<string, string> = {};
          (profiles ?? []).forEach(
            (p: { id: string; full_name: string | null }) => {
              names[p.id] = (p.full_name || p.id).trim() || "—";
            },
          );
          setApproverNames(names);
        }
      }
    }
  };

  const handleReject = async (id: string) => {
    if (!rejectReason.trim()) {
      toast.error("Please enter a rejection reason.");
      return;
    }
    if (!currentUserId) return;
    setActingId(id);
    const { error } = await supabase
      .from("fund_requests")
      .update({
        status: "rejected",
        rejected_by: currentUserId,
        rejected_at: new Date().toISOString(),
        rejection_reason: rejectReason.trim(),
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", id);
    setActingId(null);
    setRejectId(null);
    setRejectReason("");
    if (error) {
      toast.error("Failed to reject");
    } else {
      toast.success("Fund request rejected.");
      setRows((prev) => prev.filter((r) => r.id !== id));
      const [{ data: all }, { data: allRowsData }] = await Promise.all([
        supabase.from("fund_requests").select("id, status"),
        supabase
          .from("fund_requests")
          .select(`*, employees ( employee_id, first_name, last_name )`)
          .order("created_at", { ascending: false }),
      ]);
      if (all) {
        const c: Record<string, number> = {};
        all.forEach((r: { status: string }) => {
          c[r.status] = (c[r.status] || 0) + 1;
        });
        setCounts(c);
      }
      if (allRowsData) {
        setAllRows(allRowsData as RowWithRequester[]);
        const ids = new Set<string>();
        allRowsData.forEach((row: FundRequestRow) => {
          if (row.project_manager_approved_by)
            ids.add(row.project_manager_approved_by);
          if (row.purchasing_officer_approved_by)
            ids.add(row.purchasing_officer_approved_by);
          if (row.management_approved_by) ids.add(row.management_approved_by);
          if (row.rejected_by) ids.add(row.rejected_by);
        });
        if (ids.size > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", [...ids]);
          const names: Record<string, string> = {};
          (profiles ?? []).forEach(
            (p: { id: string; full_name: string | null }) => {
              names[p.id] = (p.full_name || p.id).trim() || "—";
            },
          );
          setApproverNames(names);
        }
      }
    }
  };

  if (profileLoading)
    return <div className="animate-pulse h-8 w-48 bg-slate-200 rounded" />;
  const canManage =
    profile?.role === "hr" ||
    profile?.role === "admin" ||
    profile?.role === "upper_management" ||
    profile?.role === "purchasing_officer" ||
    profile?.role === "operations_manager";
  if (!canManage) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">
          Fund Request Approval
        </h1>
        <p className="text-muted-foreground">
          You don’t have permission to manage fund requests.
        </p>
      </div>
    );
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const pendingPm = counts.pending ?? 0;
  const pendingPo = counts.project_manager_approved ?? 0;
  const pendingMgmt = counts.purchasing_officer_approved ?? 0;
  const rejected = counts.rejected ?? 0;
  const approved = counts.management_approved ?? 0;

  const listRows = viewMode === "all" ? allRows : rows;
  const PENDING_STATUSES: FundRequestRow["status"][] = [
    "pending",
    "project_manager_approved",
    "purchasing_officer_approved",
  ];

  // Pending (actionable): list is already all pending — status and date filters do NOT apply.
  // All requests (history): status and date filters apply.
  const statusFilteredRows =
    viewMode === "pending"
      ? listRows
      : statusFilter === "all"
        ? listRows
        : statusFilter === "pending"
          ? listRows.filter((r) => PENDING_STATUSES.includes(r.status))
          : statusFilter === "approved"
            ? listRows.filter((r) => r.status === "management_approved")
            : listRows.filter((r) => r.status === "rejected");

  // Week filter: only applies in "All requests (history)".
  const now = new Date();
  const thisWeekStart = getCutoffWeekStart(now);
  const selectedWeekStart =
    weekOffset < 0 ? null : addDays(thisWeekStart, -weekOffset * 7);
  const selectedWeekEnd = selectedWeekStart
    ? getCutoffWeekEnd(selectedWeekStart)
    : null;

  const weekFilteredRows =
    viewMode === "pending" || weekOffset < 0
      ? statusFilteredRows
      : statusFilteredRows.filter((r) => {
          const created = new Date(r.created_at ?? 0);
          return (
            selectedWeekStart &&
            selectedWeekEnd &&
            isWithinInterval(created, {
              start: selectedWeekStart,
              end: selectedWeekEnd,
            })
          );
        });

  const filteredRows = searchTerm
    ? weekFilteredRows.filter((r) => {
        const emp = r.employees;
        const name = emp
          ? [emp.first_name, emp.last_name, emp.employee_id]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
          : "";
        const purpose = (r.purpose || "").toLowerCase();
        const projectTitle = (r.project_title || "").toLowerCase();
        const projectLocation = (r.project_location || "").toLowerCase();
        const term = searchTerm.toLowerCase();
        return (
          name.includes(term) ||
          purpose.includes(term) ||
          projectTitle.includes(term) ||
          projectLocation.includes(term)
        );
      })
    : weekFilteredRows;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Fund Request Approval
        </h1>
        <p className="text-muted-foreground">
          Workflow: Requester → Project Manager → Purchasing Officer → Upper
          Management. Approve to move to the next step or reject with a reason.
        </p>
      </div>

      {/* Summary KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <SummaryStatCard label="Total Requests" value={total} />
        <SummaryStatCard
          label="Pending (PM)"
          value={pendingPm}
          highlight="pending"
        />
        <SummaryStatCard
          label="Pending (PO)"
          value={pendingPo}
          highlight="pending"
        />
        <SummaryStatCard
          label="Pending (Management)"
          value={pendingMgmt}
          highlight="pending"
        />
        <SummaryStatCard
          label="Approved"
          value={approved}
          highlight="success"
        />
        <SummaryStatCard
          label="Rejected"
          value={rejected}
          highlight="destructive"
        />
      </div>

      {/* View mode: Pending vs All requests + Status filter + Search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border p-0.5 bg-muted/30">
          <button
            type="button"
            onClick={() => setViewMode("pending")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === "pending" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Pending (actionable)
          </button>
          <button
            type="button"
            onClick={() => setViewMode("all")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === "all" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            All requests (history)
          </button>
        </div>
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(
              e.target.value as "all" | "pending" | "approved" | "rejected",
            )
          }
          disabled={viewMode === "pending"}
          title={
            viewMode === "pending"
              ? "Status filter only applies in All requests (history)"
              : undefined
          }
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <div
          className={`flex items-center gap-1 rounded-md border border-input bg-background px-1 py-1 ${viewMode === "pending" ? "opacity-60" : ""}`}
          title={
            viewMode === "pending"
              ? "Date filter only applies in All requests (history)"
              : undefined
          }
        >
          <button
            type="button"
            disabled={viewMode === "pending"}
            onClick={() =>
              setWeekOffset((o) =>
                o < 0 ? 0 : Math.min(o + 1, MAX_WEEKS_BACK),
              )
            }
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            title={weekOffset < 0 ? "Select this week" : "Older week"}
            aria-label="Older week"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            disabled={viewMode === "pending"}
            onClick={() => setWeekOffset(-1)}
            className={`min-w-[200px] rounded px-3 py-1.5 text-sm font-medium ${weekOffset < 0 ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"} disabled:cursor-not-allowed disabled:opacity-40`}
            title="Cutoff week: Sat–Thu (Friday counts as next week)"
          >
            {weekOffset < 0
              ? "All weeks"
              : selectedWeekStart && selectedWeekEnd
                ? `${format(selectedWeekStart, "EEE, MMM d")} – ${format(selectedWeekEnd, "EEE, MMM d, yyyy")}`
                : "All weeks"}
          </button>
          <button
            type="button"
            disabled={viewMode === "pending"}
            onClick={() => setWeekOffset((o) => (o <= 0 ? -1 : o - 1))}
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            title={weekOffset <= 0 ? "All weeks" : "Newer week"}
            aria-label="Newer week"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or purpose..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Request list */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-muted-foreground text-sm">Loading…</div>
          ) : filteredRows.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {searchTerm || statusFilter !== "all" || weekOffset >= 0
                ? "No requests match your filters."
                : viewMode === "all"
                  ? "No fund requests yet."
                  : "No requests in this step."}
            </div>
          ) : (
            <ul className="divide-y">
              {filteredRows.map((r) => {
                const emp = r.employees;
                const name = emp
                  ? [emp.first_name, emp.last_name].filter(Boolean).join(" ") ||
                    emp.employee_id
                  : "—";
                const initials = emp
                  ? getInitials(emp.first_name, emp.last_name)
                  : "?";
                const title = (r.project_title || "").trim() || "—";
                const location = (r.project_location || "").trim() || "—";
                const poAmt =
                  r.po_amount != null
                    ? `₱${Number(r.po_amount).toLocaleString()}`
                    : "—";
                const currentAccomplishment =
                  r.current_project_percentage != null
                    ? `${r.current_project_percentage}%`
                    : "—";
                const totalReq = `₱${Number(r.total_requested_amount).toLocaleString()}`;
                const purpose = (r.purpose || "").trim() || "—";
                const headline = [
                  title,
                  location,
                  poAmt,
                  currentAccomplishment,
                  totalReq,
                  purpose,
                ].join(" · ");
                const isExpanded = expandedId === r.id;
                const detailsList = (r.details as DetailItem[] | null) ?? [];
                return (
                  <li key={r.id} className="border-b last:border-b-0">
                    <div className="flex flex-wrap items-center justify-between gap-4 p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedId(isExpanded ? null : r.id)
                          }
                          className="shrink-0 rounded p-1 hover:bg-muted text-muted-foreground"
                          aria-expanded={isExpanded}
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">
                            {headline}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {name} ({emp?.employee_id ?? "—"}) · Requested{" "}
                            {format(new Date(r.request_date), "MMM d, yyyy")}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <Badge
                              variant={
                                r.status === "management_approved"
                                  ? "default"
                                  : r.status === "rejected"
                                    ? "destructive"
                                    : "secondary"
                              }
                              className="shrink-0 text-xs"
                            >
                              {viewMode === "all"
                                ? STATUS_LABEL_ALL[r.status]
                                : STEP_LABEL[r.status]}
                            </Badge>
                            <Link
                              href={`/fund-request-approval/${r.id}`}
                              className="text-primary text-xs font-medium hover:underline"
                            >
                              Open full page
                            </Link>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {r.status === "project_manager_approved" &&
                          getActionableStatuses().includes(r.status) && (
                            <div className="w-full min-w-[240px] max-w-sm">
                              <Label className="text-xs">
                                Bank details of supplier (optional)
                              </Label>
                              <Textarea
                                placeholder="Bank name, account name, account number, etc."
                                value={supplierBankDetails[r.id] ?? ""}
                                onChange={(e) =>
                                  setSupplierBankDetails((prev) => ({
                                    ...prev,
                                    [r.id]: e.target.value,
                                  }))
                                }
                                className="mt-1 min-h-[60px] resize-y text-sm"
                                rows={2}
                              />
                            </div>
                          )}
                        <div className="flex items-center gap-2">
                          {getActionableStatuses().includes(r.status) ? (
                            rejectId === r.id ? (
                              <div className="flex flex-col gap-2">
                                <Label className="text-xs">
                                  Rejection reason
                                </Label>
                                <Input
                                  value={rejectReason}
                                  onChange={(e) =>
                                    setRejectReason(e.target.value)
                                  }
                                  placeholder="Reason"
                                  className="w-48"
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    disabled={actingId === r.id}
                                    onClick={() => handleReject(r.id)}
                                  >
                                    {actingId === r.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      "Reject"
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
                                </div>
                              </div>
                            ) : (
                              <>
                                <Button size="sm" variant="outline" asChild>
                                  <Link href={`/fund-request-approval/${r.id}`}>
                                    View details
                                  </Link>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => setRejectId(r.id)}
                                >
                                  Reject
                                </Button>
                                <Button
                                  size="sm"
                                  disabled={actingId === r.id}
                                  onClick={() => handleApprove(r.id, r.status)}
                                >
                                  {actingId === r.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    "Approve"
                                  )}
                                </Button>
                              </>
                            )
                          ) : (
                            <Button size="sm" variant="outline" asChild>
                              <Link href={`/fund-request-approval/${r.id}`}>
                                View details
                              </Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="border-t bg-muted/20 px-4 py-4 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-xs font-medium text-muted-foreground uppercase">
                              Project Title
                            </span>
                            <p className="mt-0.5">{r.project_title ?? "—"}</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-muted-foreground uppercase">
                              Project Location
                            </span>
                            <p className="mt-0.5">
                              {r.project_location ?? "—"}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-muted-foreground uppercase">
                              P.O. Amount (PHP)
                            </span>
                            <p className="mt-0.5">
                              {r.po_amount != null
                                ? Number(r.po_amount).toLocaleString()
                                : "—"}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-muted-foreground uppercase">
                              Current Accomplishment %
                            </span>
                            <p className="mt-0.5">
                              {r.current_project_percentage != null
                                ? `${r.current_project_percentage}%`
                                : "—"}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-muted-foreground uppercase">
                              Total requested amount
                            </span>
                            <p className="mt-0.5">
                              ₱
                              {Number(r.total_requested_amount).toLocaleString(
                                "en-PH",
                                { minimumFractionDigits: 2 },
                              )}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-muted-foreground uppercase">
                              Purpose
                            </span>
                            <p className="mt-0.5">{r.purpose}</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-muted-foreground uppercase">
                              P.O. Number
                            </span>
                            <p className="mt-0.5">{r.po_number ?? "—"}</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-muted-foreground uppercase">
                              Date needed
                            </span>
                            <p className="mt-0.5">
                              {format(new Date(r.date_needed), "MMM d, yyyy")}
                            </p>
                          </div>
                          {r.urgent_reason && (
                            <div className="sm:col-span-2">
                              <span className="text-xs font-medium text-muted-foreground uppercase">
                                Urgent reason
                              </span>
                              <p className="mt-0.5">{r.urgent_reason}</p>
                            </div>
                          )}
                          {(r.supplier_bank_details ||
                            (r.status === "project_manager_approved" &&
                              (supplierBankDetails[r.id] ?? ""))) && (
                            <div className="sm:col-span-2">
                              <span className="text-xs font-medium text-muted-foreground uppercase">
                                Bank details of supplier
                              </span>
                              <p className="mt-0.5 whitespace-pre-wrap">
                                {r.supplier_bank_details ||
                                  supplierBankDetails[r.id] ||
                                  "—"}
                              </p>
                            </div>
                          )}
                        </div>
                        <div>
                          <span className="text-xs font-medium text-muted-foreground uppercase">
                            Details of request
                          </span>
                          <table className="w-full mt-1 text-sm border rounded-md">
                            <thead>
                              <tr className="border-b bg-muted/50">
                                <th className="text-left px-3 py-2">Details</th>
                                <th className="text-right px-3 py-2">
                                  Amount (PHP)
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {detailsList.length === 0 ? (
                                <tr>
                                  <td
                                    colSpan={2}
                                    className="px-3 py-2 text-muted-foreground text-center"
                                  >
                                    No line items
                                  </td>
                                </tr>
                              ) : (
                                detailsList.map((item, i) => (
                                  <tr
                                    key={i}
                                    className="border-b last:border-0"
                                  >
                                    <td className="px-3 py-2">
                                      {item.description ?? "—"}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono">
                                      {item.amount != null
                                        ? Number(item.amount).toLocaleString()
                                        : "—"}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                          <p className="mt-2 font-medium text-sm">
                            Total requested: ₱
                            {Number(r.total_requested_amount).toLocaleString(
                              "en-PH",
                              { minimumFractionDigits: 2 },
                            )}
                          </p>
                        </div>
                        <div className="rounded border bg-muted/20 p-3">
                          <span className="text-xs font-medium text-muted-foreground uppercase">
                            Approval history
                          </span>
                          <ul className="mt-1.5 space-y-1 text-sm">
                            {r.project_manager_approved_at && (
                              <li>
                                <span className="font-medium">
                                  Project Manager:
                                </span>{" "}
                                {approverNames[
                                  r.project_manager_approved_by ?? ""
                                ] ?? "—"}{" "}
                                on{" "}
                                {format(
                                  new Date(r.project_manager_approved_at),
                                  "MMM d, yyyy",
                                )}{" "}
                                at{" "}
                                {format(
                                  new Date(r.project_manager_approved_at),
                                  "h:mm a",
                                )}
                              </li>
                            )}
                            {r.purchasing_officer_approved_at && (
                              <li>
                                <span className="font-medium">
                                  Purchasing Officer:
                                </span>{" "}
                                {approverNames[
                                  r.purchasing_officer_approved_by ?? ""
                                ] ?? "—"}{" "}
                                on{" "}
                                {format(
                                  new Date(r.purchasing_officer_approved_at),
                                  "MMM d, yyyy",
                                )}{" "}
                                at{" "}
                                {format(
                                  new Date(r.purchasing_officer_approved_at),
                                  "h:mm a",
                                )}
                              </li>
                            )}
                            {r.management_approved_at && (
                              <li>
                                <span className="font-medium">Management:</span>{" "}
                                {approverNames[
                                  r.management_approved_by ?? ""
                                ] ?? "—"}{" "}
                                on{" "}
                                {format(
                                  new Date(r.management_approved_at),
                                  "MMM d, yyyy",
                                )}{" "}
                                at{" "}
                                {format(
                                  new Date(r.management_approved_at),
                                  "h:mm a",
                                )}
                              </li>
                            )}
                            {r.rejected_at && (
                              <li className="text-destructive">
                                <span className="font-medium">
                                  Rejected by:
                                </span>{" "}
                                {approverNames[r.rejected_by ?? ""] ?? "—"} on{" "}
                                {format(new Date(r.rejected_at), "MMM d, yyyy")}{" "}
                                at {format(new Date(r.rejected_at), "h:mm a")}
                                {r.rejection_reason &&
                                  ` — ${r.rejection_reason}`}
                              </li>
                            )}
                            {!r.project_manager_approved_at &&
                              !r.purchasing_officer_approved_at &&
                              !r.management_approved_at &&
                              !r.rejected_at && (
                                <li className="text-muted-foreground">
                                  No approvals yet.
                                </li>
                              )}
                          </ul>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
