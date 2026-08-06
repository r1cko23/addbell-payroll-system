import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchApproverOvertimeGroupIds,
  fetchApproverOvertimeGroupNames,
  fetchManagedEmployeeIdsForApprover,
} from "@/lib/manager-approval-queue";
import {
  fetchDashboardApprovalQueueItems,
  type DashboardQueueItem,
} from "@/lib/fetch-dashboard-approval-queue";
import {
  isOperationsManagerRole,
  isOvertimeGroupQueueApproverRole,
  normalizeUserRole,
} from "@/lib/user-roles";

const NO_SCOPE_MATCH_EMPLOYEE_ID = "00000000-0000-0000-0000-000000000000";

export type DepartmentStat = { name: string; count: number };

export type ActiveEmployeeLite = {
  id: string;
  company_id_no: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  employment_type: string;
  employment_status: string;
  departments: { name: string } | { name: string }[] | null;
};

export type CurrentlyClockedInEmployee = {
  id: string;
  company_id_no: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  department_name: string | null;
  clocked_in_at: string;
};

export type HrDashboardPayload = {
  totalEmployees: number;
  activeEmployees: number;
  pendingLeaveApprovals: number;
  pendingOvertimeApprovals: number;
  pendingFailureToLogApprovals: number;
  managerPendingLeaveCount: number;
  managerPendingOvertimeCount: number;
  managerPendingFailureToLogCount: number;
  companyPendingLeaveCount: number;
  companyPendingOvertimeCount: number;
  companyPendingFtlCount: number;
  deptStats: DepartmentStat[];
  unassignedActiveEmployees: number;
  currentlyClockedIn: CurrentlyClockedInEmployee[];
  typeBreakdown: { type: string; count: number }[];
  queueItems: DashboardQueueItem[];
  approverGroupNames: string[];
};

function employeeScopeFilter(
  scopedEmployeeIds: string[] | null
): string[] | null {
  if (scopedEmployeeIds === null) return null;
  if (scopedEmployeeIds.length === 0) return [NO_SCOPE_MATCH_EMPLOYEE_ID];
  return scopedEmployeeIds;
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

function getManilaDayStartIso(): string {
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
  return new Date(`${year}-${month}-${day}T00:00:00+08:00`).toISOString();
}

async function fetchCurrentlyClockedInForEmployees(
  supabase: SupabaseClient,
  activeEmployeesList: ActiveEmployeeLite[]
): Promise<CurrentlyClockedInEmployee[]> {
  const activeEmployeeIds = activeEmployeesList.map((emp) => emp.id);
  if (activeEmployeeIds.length === 0) return [];

  const { data: todayPunches, error: punchesError } = await supabase
    .from("time_entries")
    .select("employee_id, punch_type, punched_at")
    .in("employee_id", activeEmployeeIds)
    .gte("punched_at", getManilaDayStartIso())
    .order("punched_at", { ascending: true });

  if (punchesError) {
    console.error("Failed to load current clock-ins:", punchesError);
    return [];
  }

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
  return clockedInRows;
}

export async function loadHrDashboardPayload(
  supabase: SupabaseClient,
  userId: string,
  role: string
): Promise<HrDashboardPayload> {
  const normalizedRole = normalizeUserRole(role);
  const isHR = normalizedRole === "hr";
  const isAdmin = normalizedRole === "admin";
  const isManagement =
    normalizedRole === "admin" || normalizedRole === "upper_management";
  const isOperationsManager = isOperationsManagerRole(normalizedRole);
  const isOvertimeGroupQueueApprover =
    isOvertimeGroupQueueApproverRole(normalizedRole);
  const showAllCompanyPending =
    isManagement && !isHR && !isOvertimeGroupQueueApprover;
  const usesManagerApprovalQueue =
    isOvertimeGroupQueueApprover || isHR || showAllCompanyPending;
  const isManagerFocus = !isHR;

  let scopedEmployeeIds: string[] | null = null;
  let approverGroupIds: string[] = [];
  let approverGroupNames: string[] = [];

  if (isOvertimeGroupQueueApprover) {
    const [managedIds, groupNames, groupIds] = await Promise.all([
      fetchManagedEmployeeIdsForApprover(supabase, userId),
      fetchApproverOvertimeGroupNames(supabase, userId),
      fetchApproverOvertimeGroupIds(supabase, userId),
    ]);
    scopedEmployeeIds = managedIds;
    approverGroupNames = groupNames;
    approverGroupIds = groupIds;
  }

  const employeeScope = employeeScopeFilter(scopedEmployeeIds);

  let totalEmployees = 0;
  let activeEmployees = 0;
  let pendingLeaveApprovals = 0;
  let pendingOvertimeApprovals = 0;
  let pendingFailureToLogApprovals = 0;
  let companyPendingLeaveCount = 0;
  let companyPendingOvertimeCount = 0;
  let companyPendingFtlCount = 0;
  let deptStats: DepartmentStat[] = [];
  let unassignedActiveEmployees = 0;
  let currentlyClockedIn: CurrentlyClockedInEmployee[] = [];
  let typeBreakdown: { type: string; count: number }[] = [];

  if (isOvertimeGroupQueueApprover) {
    const teamCount = scopedEmployeeIds?.length ?? 0;
    totalEmployees = teamCount;
    activeEmployees = teamCount;

    if (approverGroupIds.length > 0) {
      const { data: teamEmps, error: teamEmpsError } = await supabase
        .from("employees")
        .select(
          "id, company_id_no, employee_code, first_name, last_name, employment_type, employment_status, departments:department_id ( name )"
        )
        .eq("employment_status", "active")
        .in("overtime_group_id", approverGroupIds);

      if (teamEmpsError) {
        console.error("Failed to load team employees:", teamEmpsError);
        currentlyClockedIn = [];
      } else {
        currentlyClockedIn = await fetchCurrentlyClockedInForEmployees(
          supabase,
          (teamEmps || []) as ActiveEmployeeLite[]
        );
      }
    }
  } else {
    const [{ count: total }, { count: active }, { data: allEmps }] =
      await Promise.all([
        supabase.from("employees").select("*", { count: "exact", head: true }),
        supabase
          .from("employees")
          .select("*", { count: "exact", head: true })
          .eq("employment_status", "active"),
        supabase
          .from("employees")
          .select(
            "id, company_id_no, employee_code, first_name, last_name, employment_type, employment_status, departments:department_id ( name )"
          )
          .eq("employment_status", "active"),
      ]);

    totalEmployees = total || 0;
    activeEmployees = active || 0;

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

    pendingLeaveApprovals = pendingLeave || 0;
    pendingOvertimeApprovals = pendingOT || 0;
    pendingFailureToLogApprovals = pendingFTL || 0;

    const [
      { count: allPendingLeave },
      { count: allPendingOt },
      { count: allPendingFtl },
    ] = await Promise.all([
      supabase
        .from("leave_requests")
        .select("id", { count: "exact", head: true })
        .in("status", ["pending", "approved_by_pm", "approved_by_manager"]),
      supabase
        .from("overtime_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("failure_to_log")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
    ]);
    companyPendingLeaveCount = allPendingLeave || 0;
    companyPendingOvertimeCount = allPendingOt || 0;
    companyPendingFtlCount = allPendingFtl || 0;

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

    currentlyClockedIn = await fetchCurrentlyClockedInForEmployees(
      supabase,
      activeEmployeesList
    );

    deptStats = Array.from(deptMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    unassignedActiveEmployees = unassignedCount;
    typeBreakdown = Array.from(typeMap.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  }

  let leaveManagerCountQuery = supabase
    .from("leave_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .is("project_manager_id", null);
  let otManagerCountQuery = supabase
    .from("overtime_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .is("project_manager_id", null)
    .is("account_manager_id", null);
  let ftlManagerCountQuery = supabase
    .from("failure_to_log")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .is("account_manager_id", null);

  if (employeeScope) {
    leaveManagerCountQuery = leaveManagerCountQuery.in(
      "employee_id",
      employeeScope
    );
    otManagerCountQuery = otManagerCountQuery.in("employee_id", employeeScope);
    ftlManagerCountQuery = ftlManagerCountQuery.in(
      "employee_id",
      employeeScope
    );
  }

  const [
    { count: managerLeavePending },
    { count: managerOTProjectManagerNullAccountManagerNull },
    { count: managerFTLPending },
  ] = await Promise.all([
    leaveManagerCountQuery,
    otManagerCountQuery,
    ftlManagerCountQuery,
  ]);

  let queueItems: DashboardQueueItem[] = [];
  if (usesManagerApprovalQueue || isManagerFocus) {
    queueItems = await fetchDashboardApprovalQueueItems(supabase, {
      userId,
      isHR,
      isOperationsManager,
      isOvertimeGroupQueueApprover,
      isAdmin,
      showAllCompanyPending,
      isManagerFocus,
      scopedEmployeeIds,
    });
  }

  return {
    totalEmployees,
    activeEmployees,
    pendingLeaveApprovals,
    pendingOvertimeApprovals,
    pendingFailureToLogApprovals,
    managerPendingLeaveCount: managerLeavePending || 0,
    managerPendingOvertimeCount:
      managerOTProjectManagerNullAccountManagerNull || 0,
    managerPendingFailureToLogCount: managerFTLPending || 0,
    companyPendingLeaveCount,
    companyPendingOvertimeCount,
    companyPendingFtlCount,
    deptStats,
    unassignedActiveEmployees,
    currentlyClockedIn,
    typeBreakdown,
    queueItems,
    approverGroupNames,
  };
}
