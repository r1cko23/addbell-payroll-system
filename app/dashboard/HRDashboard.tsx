"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { CardSection } from "@/components/ui/card-section";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { format } from "date-fns";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { MetricCard } from "@/components/ui/metric-card";
import { H1, BodySmall } from "@/components/ui/typography";
import { useUserRole } from "@/lib/hooks/useUserRole";

interface DepartmentStat { name: string; count: number; }
interface ActiveEmployeeLite {
  id: string;
  company_id_no: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  employment_type: string;
  employment_status: string;
  departments: { name: string } | { name: string }[] | null;
}
interface CurrentlyClockedInEmployee {
  id: string;
  company_id_no: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  department_name: string | null;
  clocked_in_at: string;
}

function getDepartmentName(
  relation: { name: string } | { name: string }[] | null | undefined
): string | null {
  if (!relation) return null;
  if (Array.isArray(relation)) {
    return relation[0]?.name ?? null;
  }
  return relation.name ?? null;
}

function normalizeEmploymentTypeLabel(value: string | null | undefined) {
  const normalized = (value || "").trim().toLowerCase();
  if (!normalized) return "Unspecified";
  if (normalized === "regular") return "Regular";
  return normalized
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function HRDashboard() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [activeEmployees, setActiveEmployees] = useState(0);
  const [pendingLeaveApprovals, setPendingLeaveApprovals] = useState(0);
  const [pendingOvertimeApprovals, setPendingOvertimeApprovals] = useState(0);
  const [pendingFailureToLogApprovals, setPendingFailureToLogApprovals] = useState(0);
  // Manager-stage pending counts (items still waiting for first-step approval).
  const [managerPendingLeaveCount, setManagerPendingLeaveCount] = useState(0);
  const [managerPendingOvertimeCount, setManagerPendingOvertimeCount] = useState(0);
  const [managerPendingFailureToLogCount, setManagerPendingFailureToLogCount] = useState(0);
  const [deptStats, setDeptStats] = useState<DepartmentStat[]>([]);
  const [unassignedActiveEmployees, setUnassignedActiveEmployees] = useState(0);
  const [currentlyClockedIn, setCurrentlyClockedIn] = useState<
    CurrentlyClockedInEmployee[]
  >([]);
  const [typeBreakdown, setTypeBreakdown] = useState<{ type: string; count: number }[]>([]);

  const { isHR, loading: roleLoading } = useUserRole();

  useEffect(() => {
    if (!roleLoading) loadData();
  }, [roleLoading]);

  async function loadData() {
    const initialLoad = !lastUpdatedAt;
    if (initialLoad) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    try {
      const [{ count: total }, { count: active }, { data: allEmps }] = await Promise.all([
        supabase.from("employees").select("*", { count: "exact", head: true }),
        supabase.from("employees").select("*", { count: "exact", head: true }).eq("employment_status", "active"),
        supabase
          .from("employees")
          .select(
            "id, company_id_no, employee_code, first_name, last_name, employment_type, employment_status, departments:department_id ( name )"
          )
          .eq("employment_status", "active"),
      ]);

      // HR-ready counts (items that should appear in the HR approval step)
      const [{ count: pendingLeave }] = await Promise.all([
        supabase
          .from("leave_requests")
          .select("id", { count: "exact", head: true })
          .in("status", ["approved_by_pm", "approved_by_manager"]),
      ]);

      const [
        { count: pendingOTProjectManagerId },
        { count: pendingOTAccountManagerId },
        { count: pendingOTBothIds },
      ] = await Promise.all([
        supabase
          .from("overtime_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
          .not("project_manager_id", "is", null),
        supabase
          .from("overtime_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
          .not("account_manager_id", "is", null),
        supabase
          .from("overtime_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
          .not("project_manager_id", "is", null)
          .not("account_manager_id", "is", null),
      ]);

      const pendingOT =
        (pendingOTProjectManagerId ?? 0) +
        (pendingOTAccountManagerId ?? 0) -
        (pendingOTBothIds ?? 0);

      const [{ count: pendingFTL }] = await Promise.all([
        supabase
          .from("failure_to_log")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
          .not("account_manager_id", "is", null),
      ]);

      // Manager-stage pending counts (first-step approval items).
      const [
        { count: managerLeavePending },
        { count: managerOTProjectManagerNullAccountManagerNull },
        { count: managerFTLPending },
      ] = await Promise.all([
        supabase
          .from("leave_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase
          .from("overtime_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
          .is("project_manager_id", null)
          .is("account_manager_id", null),
        supabase
          .from("failure_to_log")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
          .is("account_manager_id", null),
      ]);

      setTotalEmployees(total || 0);
      setActiveEmployees(active || 0);
      setPendingLeaveApprovals(pendingLeave || 0);
      setPendingOvertimeApprovals(pendingOT || 0);
      setPendingFailureToLogApprovals(pendingFTL || 0);
      setManagerPendingLeaveCount(managerLeavePending || 0);
      setManagerPendingOvertimeCount(managerOTProjectManagerNullAccountManagerNull || 0);
      setManagerPendingFailureToLogCount(managerFTLPending || 0);

      const deptMap = new Map<string, number>();
      const typeMap = new Map<string, number>();
      let unassignedCount = 0;
      const activeEmployeesList = (allEmps || []) as ActiveEmployeeLite[];
      activeEmployeesList.forEach((emp) => {
        const dept = getDepartmentName(emp.departments);
        if (dept) {
          deptMap.set(dept, (deptMap.get(dept) || 0) + 1);
        } else {
          unassignedCount += 1;
        }
        const type = normalizeEmploymentTypeLabel(emp.employment_type);
        typeMap.set(type, (typeMap.get(type) || 0) + 1);
      });

      const activeEmployeeIds = activeEmployeesList.map((emp) => emp.id);
      if (activeEmployeeIds.length > 0) {
        const now = new Date();
        const parts = new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Manila",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).formatToParts(now);
        const year = parts.find((p) => p.type === "year")?.value || "1970";
        const month = parts.find((p) => p.type === "month")?.value || "01";
        const day = parts.find((p) => p.type === "day")?.value || "01";
        const dayStartIso = new Date(`${year}-${month}-${day}T00:00:00+08:00`).toISOString();

        const { data: todayPunches, error: punchesError } = await supabase
          .from("time_entries")
          .select("employee_id, punch_type, punched_at")
          .in("employee_id", activeEmployeeIds)
          .gte("punched_at", dayStartIso)
          .order("punched_at", { ascending: true });

        if (punchesError) {
          console.error("Failed to load current clock-ins:", punchesError);
          setCurrentlyClockedIn([]);
        } else {
          const latestPunchByEmployee = new Map<
            string,
            { punch_type: string; punched_at: string }
          >();
          (todayPunches || []).forEach((p) => {
            latestPunchByEmployee.set(p.employee_id, {
              punch_type: p.punch_type,
              punched_at: p.punched_at,
            });
          });

          const activeById = new Map(activeEmployeesList.map((emp) => [emp.id, emp]));
          const clockedInRows: CurrentlyClockedInEmployee[] = [];

          latestPunchByEmployee.forEach((latest, employeeId) => {
            if (latest.punch_type !== "in") return;
            const emp = activeById.get(employeeId);
            if (!emp) return;
            clockedInRows.push({
              id: emp.id,
              company_id_no: emp.company_id_no,
              employee_code: emp.employee_code,
              first_name: emp.first_name,
              last_name: emp.last_name,
              department_name: getDepartmentName(emp.departments),
              clocked_in_at: latest.punched_at,
            });
          });

          clockedInRows.sort(
            (a, b) =>
              new Date(a.clocked_in_at).getTime() - new Date(b.clocked_in_at).getTime()
          );
          setCurrentlyClockedIn(clockedInRows);
        }
      } else {
        setCurrentlyClockedIn([]);
      }

      setDeptStats(Array.from(deptMap.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count));
      setUnassignedActiveEmployees(unassignedCount);
      setTypeBreakdown(Array.from(typeMap.entries()).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count));
      setLastUpdatedAt(new Date());
    } catch (error: any) {
      console.error("HR Dashboard error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Icon name="ArrowsClockwise" size={IconSizes.lg} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  const inactiveEmployees = totalEmployees - activeEmployees;
  const isManagerFocus = !isHR;
  const displayedLeaveCount = isManagerFocus ? managerPendingLeaveCount : pendingLeaveApprovals;
  const displayedOtCount = isManagerFocus ? managerPendingOvertimeCount : pendingOvertimeApprovals;
  const displayedFtlCount = isManagerFocus
    ? managerPendingFailureToLogCount
    : pendingFailureToLogApprovals;
  const totalPendingApprovals =
    displayedLeaveCount + displayedOtCount + displayedFtlCount;

  return (
    <VStack gap="8" align="stretch" className="w-full pb-16">
      <Card className="border-blue-200 bg-gradient-to-r from-blue-50 via-white to-blue-100">
        <CardContent className="p-5 sm:p-6">
          <HStack justify="between" align="start" className="flex-col gap-4 lg:flex-row">
            <div className="space-y-2">
              <Badge variant="outline" className="font-normal">Workforce overview</Badge>
              <H1>People snapshot</H1>
              <BodySmall>
                Monitor workforce count, team distribution, and recent hires from one HR workspace.
              </BodySmall>
              <HStack gap="2" className="flex-wrap">
                <Badge variant="secondary" className="bg-blue-100 text-blue-900 border-blue-200">
                  {totalPendingApprovals} approvals waiting
                </Badge>
                <Badge variant="secondary" className="bg-blue-100 text-blue-900 border-blue-200">
                  {activeEmployees} active employees
                </Badge>
                <Badge variant="secondary" className="bg-blue-100 text-blue-900 border-blue-200">
                  {currentlyClockedIn.length} currently clocked in
                </Badge>
                {lastUpdatedAt ? (
                  <Badge variant="outline" className="text-xs">
                    Updated {format(lastUpdatedAt, "MMM d, h:mm a")}
                  </Badge>
                ) : null}
              </HStack>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/employees">
                <Button size="sm">Open employees</Button>
              </Link>
              <Link href="/leave-approval">
                <Button variant="outline" size="sm">Review leave requests</Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadData()}
                disabled={refreshing}
              >
                <Icon
                  name="ArrowsClockwise"
                  size={IconSizes.sm}
                  className={refreshing ? "animate-spin" : ""}
                />
                {refreshing ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
          </HStack>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12">
        <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-white xl:col-span-6">
          <CardHeader className="pb-2">
            <CardDescription>{isManagerFocus ? "Today's manager focus" : "Today's HR focus"}</CardDescription>
            <CardTitle className="text-xl">
              {totalPendingApprovals === 0
                ? "No pending approvals"
                : `${totalPendingApprovals} request${totalPendingApprovals === 1 ? "" : "s"} waiting for review`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Link href="/leave-approval">
                <Button size="sm" variant="outline" className="w-full justify-start">
                  Leave ({displayedLeaveCount})
                </Button>
              </Link>
              <Link href="/overtime-approval">
                <Button size="sm" variant="outline" className="w-full justify-start">
                  Overtime ({displayedOtCount})
                </Button>
              </Link>
              <Link href="/failure-to-log-approval">
                <Button size="sm" variant="outline" className="w-full justify-start">
                  Failure-to-log ({displayedFtlCount})
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-gradient-to-b from-blue-50 to-white xl:col-span-2">
          <CardHeader className="pb-2">
            <CardDescription>{isManagerFocus ? "Leave approvals (Manager)" : "Leave approvals"}</CardDescription>
            <CardTitle className="text-2xl">{displayedLeaveCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/leave-approval">
              <Button size="sm" variant="outline" className="w-full">Open Leave Queue</Button>
            </Link>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-gradient-to-b from-blue-50 to-white xl:col-span-2">
          <CardHeader className="pb-2">
            <CardDescription>Overtime approvals</CardDescription>
            <CardTitle className="text-2xl">{displayedOtCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/overtime-approval">
              <Button size="sm" variant="outline" className="w-full">Open OT Queue</Button>
            </Link>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-gradient-to-b from-blue-50 to-white xl:col-span-2">
          <CardHeader className="pb-2">
            <CardDescription>Failure-to-log approvals</CardDescription>
            <CardTitle className="text-2xl">{displayedFtlCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/failure-to-log-approval">
              <Button size="sm" variant="outline" className="w-full">Open FTL Queue</Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <HStack justify="between" align="start" className="flex-col gap-2">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Workforce health</h2>
          <BodySmall className="text-muted-foreground">
            Snapshot metrics and breakdowns to support daily staffing decisions.
          </BodySmall>
        </div>
      </HStack>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <MetricCard
          className="xl:col-span-3"
          label="Employees"
          value={totalEmployees}
          meta={`${activeEmployees} active · ${inactiveEmployees} inactive`}
          icon={<Icon name="UsersThree" size={IconSizes.sm} />}
        />
        <MetricCard
          className="xl:col-span-3"
          label="Departments"
          value={deptStats.length}
          meta={
            unassignedActiveEmployees > 0
              ? `${unassignedActiveEmployees} active employee(s) without department`
              : "All active employees assigned to a department"
          }
          icon={<Icon name="Users" size={IconSizes.sm} />}
        />
        <Card className="rounded-2xl border bg-card/90 shadow-sm xl:col-span-6">
          <CardHeader className="pb-3">
            <CardDescription>Employment types</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {typeBreakdown.map((t) => (
                <div key={t.type} className="rounded-xl border bg-background/80 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Employment type
                  </p>
                  <HStack justify="between" align="end" className="mt-2">
                    <p className="text-base font-semibold">{t.type}</p>
                    <p className="text-2xl font-semibold tabular-nums">{t.count}</p>
                  </HStack>
                </div>
              ))}
              {typeBreakdown.length === 0 && <p className="text-xs text-muted-foreground">No data</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Department Breakdown & Currently Clocked In */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <CardSection title="By department" description="Active employee count per department." className="xl:col-span-4">
          {deptStats.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">No assigned departments yet.</p>
          ) : (
            <div className="space-y-2">
              {deptStats.map((d) => (
                <div key={d.name} className="flex items-center justify-between p-2 rounded border">
                  <span className="text-sm font-medium">{d.name}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-slate-200 rounded-full h-2">
                      <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${Math.min(100, (d.count / Math.max(activeEmployees, 1)) * 100)}%` }} />
                    </div>
                    <span className="text-sm font-mono w-6 text-right">{d.count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {unassignedActiveEmployees > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {unassignedActiveEmployees} active employee(s) are currently unassigned to a department.
            </div>
          ) : null}
        </CardSection>

        <CardSection
          title="Currently clocked in"
          description="Employees with latest punch set to time in today."
          className="xl:col-span-8"
        >
          {currentlyClockedIn.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">
              No employees currently clocked in.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Clocked in at</TableHead>
                    <TableHead>Time clock ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentlyClockedIn.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell>
                        <Link href={`/employees/${emp.id}`} className="text-primary hover:underline text-sm font-medium">
                          {emp.first_name} {emp.last_name}
                        </Link>
                        <p className="text-xs text-muted-foreground font-mono">{emp.company_id_no}</p>
                      </TableCell>
                      <TableCell className="text-sm">{emp.department_name || "—"}</TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(emp.clocked_in_at), "MMM d, h:mm a")}
                      </TableCell>
                      <TableCell className="text-sm font-mono">{emp.employee_code}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="flex justify-end mt-2">
            <Link href="/employees"><Button variant="ghost" size="sm">View all employees</Button></Link>
          </div>
        </CardSection>
      </div>
    </VStack>
  );
}
