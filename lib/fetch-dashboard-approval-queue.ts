import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildManagerQueueUrl,
  isUserApproverForOvertimeGroup,
  type ManagerQueueType,
} from "@/lib/manager-approval-queue";
import {
  ftlRequestAwaitingApproval,
  ftlRequestInHrQueue,
  ftlRequestInOperationsManagerQueue,
  isFtlManagerStage,
  isLeaveManagerStage,
  isOtOrFtlManagerStage,
  leaveRequestAwaitingApproval,
  leaveRequestInHrQueue,
  leaveRequestInOperationsManagerQueue,
  overtimeRequestAwaitingApproval,
  overtimeRequestInHrQueue,
  overtimeRequestInOperationsManagerQueue,
} from "@/lib/approval-queue-visibility";
import { normalizeGroupName } from "@/lib/requestApprovalRouting";
import {
  formatFiledAtLabel,
  formatFtlRequestDateLabel,
  formatLeaveRequestDateLabel,
  formatOtRequestDateLabel,
  truncateApprovalText,
} from "@/lib/approval-queue-card-format";

export type DashboardQueueItem = {
  id: string;
  queueType: ManagerQueueType;
  employeeName: string;
  employeeCode: string | null;
  requestDateLabel: string;
  reason: string | null;
  filedAtLabel: string | null;
  href: string;
  sortAt: string;
};

export type DashboardQueueFetchContext = {
  userId: string;
  isHR: boolean;
  isOperationsManager: boolean;
  /** Admin / upper management: all company requests still awaiting approval. */
  showAllCompanyPending: boolean;
  /** Non-HR roles on workforce dashboard (ops manager, upper management, admin). */
  isManagerFocus: boolean;
  scopedEmployeeIds: string[] | null;
};

const MAX_PER_TYPE = 100;

type GroupMaps = {
  employeeGroupNameByEmployeeId: Record<string, string>;
  approverIdByGroupName: Record<string, string>;
};

async function loadGroupMaps(supabase: SupabaseClient): Promise<GroupMaps> {
  const [employeesRes, groupsRes] = await Promise.all([
    supabase.from("employees").select("id, employee_id, overtime_group_id"),
    supabase.from("overtime_groups").select("id, name, approver_id").eq("is_active", true),
  ]);

  const groupNameById: Record<string, string> = {};
  const approverIdByGroupName: Record<string, string> = {};
  (groupsRes.data || []).forEach((g) => {
    if (!g.name) return;
    groupNameById[g.id] = g.name;
    if (g.approver_id) {
      approverIdByGroupName[g.name] = g.approver_id;
      approverIdByGroupName[g.name.trim().toLowerCase()] = g.approver_id;
      approverIdByGroupName[normalizeGroupName(g.name)] = g.approver_id;
    }
  });

  const employeeGroupNameByEmployeeId: Record<string, string> = {};
  (employeesRes.data || []).forEach((emp) => {
    const groupName =
      emp.overtime_group_id && groupNameById[emp.overtime_group_id]
        ? groupNameById[emp.overtime_group_id]
        : null;
    if (!groupName) return;
    if (emp.id) employeeGroupNameByEmployeeId[emp.id] = groupName;
    if (emp.employee_id) employeeGroupNameByEmployeeId[emp.employee_id] = groupName;
  });

  return { employeeGroupNameByEmployeeId, approverIdByGroupName };
}

function inEmployeeScope(
  employeeId: string,
  scopedEmployeeIds: string[] | null
): boolean {
  if (scopedEmployeeIds === null) return true;
  return scopedEmployeeIds.includes(employeeId);
}

function includeLeave(
  request: {
    status: string;
    project_manager_id?: string | null;
    account_manager_id?: string | null;
    employee_id: string;
  },
  ctx: DashboardQueueFetchContext,
  maps: GroupMaps
): boolean {
  if (!inEmployeeScope(request.employee_id, ctx.scopedEmployeeIds)) return false;
  const groupName = maps.employeeGroupNameByEmployeeId[request.employee_id] || null;
  if (ctx.showAllCompanyPending) {
    return leaveRequestAwaitingApproval(request);
  }
  if (ctx.isOperationsManager) {
    return leaveRequestInOperationsManagerQueue(
      request,
      ctx.userId,
      groupName,
      maps.approverIdByGroupName
    );
  }
  if (ctx.isHR) {
    return leaveRequestInHrQueue(
      request,
      ctx.userId,
      groupName,
      maps.approverIdByGroupName
    );
  }
  if (ctx.isManagerFocus) {
    if (!isUserApproverForOvertimeGroup(ctx.userId, groupName, maps.approverIdByGroupName)) {
      return false;
    }
    return isLeaveManagerStage(request);
  }
  return false;
}

function includeOt(
  request: {
    status: string;
    project_manager_id?: string | null;
    account_manager_id?: string | null;
    employee_id: string;
  },
  ctx: DashboardQueueFetchContext,
  maps: GroupMaps
): boolean {
  if (!inEmployeeScope(request.employee_id, ctx.scopedEmployeeIds)) return false;
  const groupName = maps.employeeGroupNameByEmployeeId[request.employee_id] || null;
  if (ctx.showAllCompanyPending) {
    return overtimeRequestAwaitingApproval(request);
  }
  if (ctx.isOperationsManager) {
    return overtimeRequestInOperationsManagerQueue(
      request,
      ctx.userId,
      groupName,
      maps.approverIdByGroupName
    );
  }
  if (ctx.isHR) {
    return overtimeRequestInHrQueue(
      request,
      ctx.userId,
      groupName,
      maps.approverIdByGroupName
    );
  }
  if (ctx.isManagerFocus) {
    if (!isUserApproverForOvertimeGroup(ctx.userId, groupName, maps.approverIdByGroupName)) {
      return false;
    }
    return isOtOrFtlManagerStage(request);
  }
  return false;
}

function includeFtl(
  request: {
    status: string;
    account_manager_id?: string | null;
    employee_id: string;
  },
  ctx: DashboardQueueFetchContext,
  maps: GroupMaps
): boolean {
  if (!inEmployeeScope(request.employee_id, ctx.scopedEmployeeIds)) return false;
  const groupName = maps.employeeGroupNameByEmployeeId[request.employee_id] || null;
  if (ctx.showAllCompanyPending) {
    return ftlRequestAwaitingApproval(request);
  }
  if (ctx.isOperationsManager) {
    return ftlRequestInOperationsManagerQueue(
      request,
      ctx.userId,
      groupName,
      maps.approverIdByGroupName
    );
  }
  if (ctx.isHR) {
    return ftlRequestInHrQueue(
      request,
      ctx.userId,
      groupName,
      maps.approverIdByGroupName
    );
  }
  if (ctx.isManagerFocus) {
    if (!isUserApproverForOvertimeGroup(ctx.userId, groupName, maps.approverIdByGroupName)) {
      return false;
    }
    return isFtlManagerStage(request);
  }
  return false;
}

export async function fetchDashboardApprovalQueueItems(
  supabase: SupabaseClient,
  ctx: DashboardQueueFetchContext
): Promise<DashboardQueueItem[]> {
  if (!ctx.userId) return [];

  const maps = await loadGroupMaps(supabase);
  const employeeNameById: Record<string, { full_name: string; employee_id: string }> =
    {};

  const { data: employeeRows } = await supabase
    .from("employees")
    .select("id, employee_id, full_name");
  (employeeRows || []).forEach((e) => {
    employeeNameById[e.id] = {
      full_name: e.full_name || "Unknown",
      employee_id: e.employee_id || "",
    };
    if (e.employee_id) {
      employeeNameById[e.employee_id] = {
        full_name: e.full_name || "Unknown",
        employee_id: e.employee_id || "",
      };
    }
  });

  const items: DashboardQueueItem[] = [];

  const { data: leaveRows, error: leaveRowsError } = await supabase
    .from("leave_requests")
    .select(
      "id, employee_id, status, leave_type, start_date, end_date, reason, project_manager_id, created_at"
    )
    .in("status", ["pending", "approved_by_pm", "approved_by_manager"])
    .order("created_at", { ascending: false });

  if (leaveRowsError) {
    console.error("Dashboard leave queue fetch failed:", leaveRowsError);
  }

  (leaveRows || []).forEach((row) => {
    if (!includeLeave(row, ctx, maps)) return;
    const emp = employeeNameById[row.employee_id];
    items.push({
      id: row.id,
      queueType: "leave",
      employeeName: emp?.full_name || "Unknown employee",
      employeeCode: emp?.employee_id || null,
      requestDateLabel: formatLeaveRequestDateLabel(
        row.start_date,
        row.end_date
      ),
      reason: truncateApprovalText(row.reason),
      filedAtLabel: formatFiledAtLabel(row.created_at),
      href: buildManagerQueueUrl("leave", {
        status: "pending",
        requestId: row.id,
      }),
      sortAt: row.created_at || row.start_date,
    });
  });

  const { data: otRows } = await supabase
    .from("overtime_requests")
    .select(
      "id, employee_id, status, ot_date, start_time, end_time, reason, project_manager_id, account_manager_id, created_at"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  (otRows || []).forEach((row) => {
    if (!includeOt(row, ctx, maps)) return;
    const emp = employeeNameById[row.employee_id];
    items.push({
      id: row.id,
      queueType: "overtime",
      employeeName: emp?.full_name || "Unknown employee",
      employeeCode: emp?.employee_id || null,
      requestDateLabel: formatOtRequestDateLabel(
        row.ot_date,
        row.start_time,
        row.end_time
      ),
      reason: truncateApprovalText(row.reason),
      filedAtLabel: formatFiledAtLabel(row.created_at),
      href: buildManagerQueueUrl("overtime", {
        status: "pending",
        requestId: row.id,
      }),
      sortAt: row.created_at || row.ot_date,
    });
  });

  const { data: ftlRows } = await supabase
    .from("failure_to_log")
    .select(
      "id, employee_id, status, missed_date, entry_type, reason, actual_clock_in_time, actual_clock_out_time, account_manager_id, created_at"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  (ftlRows || []).forEach((row) => {
    if (!includeFtl(row, ctx, maps)) return;
    const emp = employeeNameById[row.employee_id];
    items.push({
      id: row.id,
      queueType: "ftl",
      employeeName: emp?.full_name || "Unknown employee",
      employeeCode: emp?.employee_id || null,
      requestDateLabel: formatFtlRequestDateLabel(
        row.missed_date,
        row.entry_type,
        row.actual_clock_in_time,
        row.actual_clock_out_time
      ),
      reason: truncateApprovalText(row.reason),
      filedAtLabel: formatFiledAtLabel(row.created_at),
      href: buildManagerQueueUrl("ftl", {
        status: "pending",
        requestId: row.id,
      }),
      sortAt: row.created_at || row.missed_date || "",
    });
  });

  items.sort(
    (a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime()
  );

  const byType: Record<ManagerQueueType, DashboardQueueItem[]> = {
    leave: [],
    overtime: [],
    ftl: [],
  };
  items.forEach((item) => {
    if (byType[item.queueType].length < MAX_PER_TYPE) {
      byType[item.queueType].push(item);
    }
  });

  return [...byType.leave, ...byType.overtime, ...byType.ftl];
}

/** Section headings in the dashboard approval queue. */
export const QUEUE_TYPE_LABELS: Record<ManagerQueueType, string> = {
  leave: "Leave",
  overtime: "Overtime",
  ftl: "Failure To Log",
};

/** Short labels on request card pills. */
export const QUEUE_TYPE_BADGE_LABELS: Record<ManagerQueueType, string> = {
  leave: "Leave",
  overtime: "OT",
  ftl: "FTL",
};
