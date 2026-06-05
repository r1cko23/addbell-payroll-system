"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { H2, BodySmall, Caption } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { MetricCard } from "@/components/ui/metric-card";
import { useUserRole } from "@/lib/hooks/useUserRole";
import {
  formatWeeklyPeriod,
  getNextWeeklyPeriod,
  getPreviousWeeklyPeriod,
  getWeeklyCutoffEndDate,
  getWeeklyPeriodStart,
} from "@/utils/weekly";
import type { TimesheetReviewStatus } from "@/lib/ph-payroll/timesheet-review";

type ReviewRow = {
  employee_id: string;
  employee_code: string;
  full_name: string;
  review_status: TimesheetReviewStatus;
  weekly_attendance_id: string | null;
  total_regular_hours: number;
  total_overtime_hours: number;
  total_night_diff_hours: number;
  gross_pay: number;
  finalized_at: string | null;
  session_count: number;
};

type ReviewSummary = {
  total: number;
  missing: number;
  draft: number;
  finalized: number;
};

const statusBadge: Record<
  TimesheetReviewStatus,
  { label: string; className: string }
> = {
  missing: {
    label: "Missing",
    className: "bg-red-100 text-red-800 border-red-200",
  },
  draft: {
    label: "Draft",
    className: "bg-slate-100 text-slate-800 border-slate-200",
  },
  finalized: {
    label: "Finalized",
    className: "bg-emerald-100 text-emerald-900 border-emerald-200",
  },
};

export default function TimesheetReviewPage() {
  const searchParams = useSearchParams();
  const { canAccessSalaryInfo, loading: roleLoading } = useUserRole();
  const [weekStart, setWeekStart] = useState(() => {
    const fromUrl = searchParams.get("period_start");
    if (fromUrl) {
      const parsed = new Date(`${fromUrl}T12:00:00`);
      if (!Number.isNaN(parsed.getTime())) {
        return getWeeklyPeriodStart(parsed);
      }
    }
    return getWeeklyPeriodStart(new Date());
  });
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const weekEnd = useMemo(() => getWeeklyCutoffEndDate(weekStart), [weekStart]);
  const periodStartStr = format(weekStart, "yyyy-MM-dd");
  const periodEndStr = format(weekEnd, "yyyy-MM-dd");
  const periodLabel = formatWeeklyPeriod(weekStart, weekEnd);

  const loadReview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/timesheet/review?period_start=${periodStartStr}&period_end=${periodEndStr}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load review");
      setRows(json.rows || []);
      setSummary(json.summary || null);
      setSelected(new Set());
    } catch (error: any) {
      toast.error(error.message || "Failed to load timesheet review");
      setRows([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [periodStartStr, periodEndStr]);

  useEffect(() => {
    if (!roleLoading && canAccessSalaryInfo) {
      loadReview();
    }
  }, [loadReview, roleLoading, canAccessSalaryInfo]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.full_name.toLowerCase().includes(q) ||
        r.employee_code.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const selectedRows = useMemo(
    () => filteredRows.filter((r) => selected.has(r.employee_id)),
    [filteredRows, selected]
  );

  async function autoGenerate(targetIds?: string[]) {
    setBusy(true);
    try {
      const res = await fetch("/api/timesheet/auto-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period_start: periodStartStr,
          period_end: periodEndStr,
          employee_ids: targetIds,
          overwrite_existing: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Auto-generate failed");
      const generated = (json.results || []).filter(
        (r: any) => r.status === "created" || r.status === "updated"
      ).length;
      toast.success(`Generated ${generated} draft timesheet(s) for ${periodLabel}`);
      await loadReview();
    } catch (error: any) {
      toast.error(error.message || "Auto-generate failed");
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(action: "finalize" | "reopen", targetIds: string[]) {
    if (targetIds.length === 0) {
      toast.error("Select at least one employee");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/timesheet/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period_start: periodStartStr,
          period_end: periodEndStr,
          employee_ids: targetIds,
          action,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Update failed");
      toast.success(
        action === "finalize"
          ? `Finalized ${json.updated} timesheet(s)`
          : `Reopened ${json.updated} timesheet(s) to draft`
      );
      await loadReview();
    } catch (error: any) {
      toast.error(error.message || "Failed to update timesheet status");
    } finally {
      setBusy(false);
    }
  }

  function toggleAll(checked: boolean) {
    if (checked) {
      setSelected(new Set(filteredRows.map((r) => r.employee_id)));
    } else {
      setSelected(new Set());
    }
  }

  function toggleOne(employeeId: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(employeeId);
      else next.delete(employeeId);
      return next;
    });
  }

  const draftSelected = selectedRows.filter((r) => r.review_status === "draft");
  const finalizedSelected = selectedRows.filter(
    (r) => r.review_status === "finalized"
  );
  const missingSelected = selectedRows.filter((r) => r.review_status === "missing");

  if (roleLoading) {
    return (
      <DashboardLayout>
        <BodySmall>Loading...</BodySmall>
      </DashboardLayout>
    );
  }

  if (!canAccessSalaryInfo) {
    return (
      <DashboardLayout>
        <BodySmall>You do not have permission to access timesheet review.</BodySmall>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <VStack gap="4" className="w-full min-w-0">
        <HStack justify="between" align="end" className="flex-col gap-3 lg:flex-row">
          <VStack gap="1">
            <H2 className="text-xl font-bold">Timesheet Review</H2>
            <Caption className="text-muted-foreground">
              Lock weekly attendance before payroll runs (Frappe HR finalize gate).
            </Caption>
          </VStack>
          <HStack gap="2" className="flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWeekStart(getPreviousWeeklyPeriod(weekStart))}
              disabled={busy}
            >
              <Icon name="CaretLeft" size={IconSizes.md} />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWeekStart(getNextWeeklyPeriod(weekStart))}
              disabled={busy}
            >
              Next
              <Icon name="CaretRight" size={IconSizes.md} />
            </Button>
          </HStack>
        </HStack>

        <Card>
          <CardHeader className="pb-2">
            <HStack justify="between" align="center" className="flex-wrap gap-3">
              <CardTitle className="text-sm font-medium">{periodLabel}</CardTitle>
              <Caption>
                {periodStartStr} → {periodEndStr}
              </Caption>
            </HStack>
          </CardHeader>
          <CardContent className="pt-0">
            {summary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <MetricCard label="Employees" value={summary.total} />
                <MetricCard label="Missing" value={summary.missing} />
                <MetricCard label="Draft" value={summary.draft} />
                <MetricCard label="Finalized" value={summary.finalized} />
              </div>
            )}

            <HStack gap="2" className="flex-wrap mb-4">
              <Button
                size="sm"
                onClick={() => autoGenerate()}
                disabled={busy || loading}
              >
                Auto-Generate All (Draft)
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  autoGenerate(
                    missingSelected.length > 0
                      ? missingSelected.map((r) => r.employee_id)
                      : selectedRows.map((r) => r.employee_id)
                  )
                }
                disabled={
                  busy ||
                  loading ||
                  (missingSelected.length === 0 && selectedRows.length === 0)
                }
              >
                Auto-Generate Selected
              </Button>
              <Button
                size="sm"
                variant="default"
                onClick={() =>
                  updateStatus(
                    "finalize",
                    draftSelected.length > 0
                      ? draftSelected.map((r) => r.employee_id)
                      : rows
                          .filter((r) => r.review_status === "draft")
                          .map((r) => r.employee_id)
                  )
                }
                disabled={busy || loading}
              >
                Finalize Draft
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  updateStatus(
                    "reopen",
                    finalizedSelected.map((r) => r.employee_id)
                  )
                }
                disabled={busy || loading || finalizedSelected.length === 0}
              >
                Reopen to Draft
              </Button>
              <Button size="sm" variant="ghost" asChild>
                <Link href={`/timesheet?period_start=${periodStartStr}`}>
                  Open Time Attendance
                </Link>
              </Button>
            </HStack>

            <div className="mb-3 max-w-sm">
              <Label className="text-xs mb-1">Search employee</Label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name or employee ID"
                className="h-9"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto border-t">
              {loading ? (
                <div className="p-8 text-center">
                  <BodySmall>Loading timesheet review...</BodySmall>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={
                            filteredRows.length > 0 &&
                            filteredRows.every((r) => selected.has(r.employee_id))
                          }
                          onCheckedChange={(v) => toggleAll(Boolean(v))}
                        />
                      </TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Sessions</TableHead>
                      <TableHead className="text-right">Reg Hrs</TableHead>
                      <TableHead className="text-right">OT Hrs</TableHead>
                      <TableHead className="text-right">ND Hrs</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.map((row) => {
                      const badge = statusBadge[row.review_status];
                      return (
                        <TableRow key={row.employee_id}>
                          <TableCell>
                            <Checkbox
                              checked={selected.has(row.employee_id)}
                              onCheckedChange={(v) =>
                                toggleOne(row.employee_id, Boolean(v))
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-sm">{row.full_name}</div>
                            <Caption>{row.employee_code}</Caption>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={badge.className}>
                              {badge.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.session_count}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.total_regular_hours.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.total_overtime_hours.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.total_night_diff_hours.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            <HStack gap="1" justify="end">
                              {row.review_status === "draft" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={busy}
                                  onClick={() =>
                                    updateStatus("finalize", [row.employee_id])
                                  }
                                >
                                  Finalize
                                </Button>
                              )}
                              {row.review_status === "finalized" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={busy}
                                  onClick={() =>
                                    updateStatus("reopen", [row.employee_id])
                                  }
                                >
                                  Reopen
                                </Button>
                              )}
                              {row.review_status === "missing" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={busy}
                                  onClick={() => autoGenerate([row.employee_id])}
                                >
                                  Generate
                                </Button>
                              )}
                            </HStack>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>
      </VStack>
    </DashboardLayout>
  );
}
