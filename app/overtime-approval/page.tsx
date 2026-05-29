"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSection } from "@/components/ui/card-section";
import { H1, BodySmall, Caption } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from "date-fns";
import { creditOvertimeHours } from "@/utils/overtime";
import { formatTime12h, formatTimeRange12h } from "@/utils/format";
import { toast } from "sonner";
import { EmployeeAvatar } from "@/components/EmployeeAvatar";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { isSchemaMissingTableOrRelationError } from "@/lib/postgrestSchema";
import {
  FINAL_HR_APPROVER_ID,
  isFinalHrApprover,
  LOCATION_FIRST_APPROVER_BY_GROUP,
  normalizeGroupName,
} from "@/lib/requestApprovalRouting";
import {
  approvalQueueUrlWithRequest,
  isUserApproverForOvertimeGroup,
} from "@/lib/manager-approval-queue";
import {
  canHrViewOtRequest,
  canOperationsManagerViewOtRequest,
  overtimeRequestInHrQueue,
  overtimeRequestInOperationsManagerQueue,
  shouldSkipServerStatusFilterForHrPending,
} from "@/lib/approval-queue-visibility";

type OvertimeDocument = {
  id: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
};

type OtPunchStatus = {
  hasCompletedPair: boolean;
  isOpen: boolean;
  lastPunchedAt: string | null;
  lastPunchType: "in" | "out" | null;
  lastLat: number | null;
  lastLng: number | null;
};

type OTRequest = {
  id: string;
  employee_id: string;
  ot_date: string;
  start_time: string;
  end_time: string;
  total_hours: number;
  reason: string | null;
  attachment_url: string | null;
  status: "pending" | "approved" | "rejected";
  account_manager_id?: string | null;
  project_manager_id?: string | null;
  project_manager_approved_at?: string | null;
  hr_approved_by?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  created_at: string;
  bundy_in_punch_id?: string | null;
  bundy_out_punch_id?: string | null;
  overtime_documents?: OvertimeDocument[];
  bundy_session?: {
    clock_in_time: string;
    clock_out_time: string;
    clock_in_lat: number | null;
    clock_in_lng: number | null;
    clock_out_lat: number | null;
    clock_out_lng: number | null;
  } | null;
  employees?: {
    id?: string;
    full_name: string;
    employee_id: string;
    profile_picture_url?: string | null;
    requires_ot_punch?: boolean | null;
    overtime_group_id?: string | null;
  };
};

type ViewerOtStatus = "pending" | "approved" | "rejected";

/** User id to show as approver/rejector — prefer final `approved_by`, then HR, then endorsement ids. */
function getOvertimeDecisionActorId(request: OTRequest): string | null {
  const id =
    request.approved_by ||
    request.hr_approved_by ||
    request.project_manager_id ||
    request.account_manager_id;
  return id || null;
}

export default function OvertimeApprovalPage() {
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const closeRequestModal = () => {
    setSelected(null);
    if (
      !searchParams.get("requestId") &&
      searchParams.get("focus") !== "1"
    ) {
      return;
    }
    router.replace(
      approvalQueueUrlWithRequest(pathname, searchParams, null),
      { scroll: false }
    );
  };

  const openRequestModal = (req: OTRequest) => {
    setSelected(req);
    if (searchParams.get("requestId") === req.id) return;
    router.replace(
      approvalQueueUrlWithRequest(pathname, searchParams, req.id),
      { scroll: false }
    );
  };
  const { isAdmin, role, isHR, isOperationsManager, loading: roleLoading } = useUserRole();
  const normalizedRole = (role || "").trim().toLowerCase();
  const canManageOvertime =
    isAdmin ||
    normalizedRole === "upper_management" ||
    isHR ||
    normalizedRole === "operations_manager";

  /** May approve or reject pending OT (not viewers). */
  const canActOnPendingOvertime = canManageOvertime;

  // All hooks must be declared before any conditional returns
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<OTRequest[]>([]);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);
  const [employees, setEmployees] = useState<
    { id: string; employee_id: string; full_name: string; last_name?: string | null; first_name?: string | null }[]
  >([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [selected, setSelected] = useState<OTRequest | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [employeeGroupNameByEmployeeId, setEmployeeGroupNameByEmployeeId] =
    useState<Record<string, string>>({});
  const [overtimeGroupNameById, setOvertimeGroupNameById] = useState<
    Record<string, string>
  >({});
  const [overtimeGroupFirstApproverIdById, setOvertimeGroupFirstApproverIdById] =
    useState<Record<string, string>>({});
  const [approverNames, setApproverNames] = useState<Record<string, string>>(
    {}
  );
  const [otPunchStatusByRequestId, setOtPunchStatusByRequestId] = useState<
    Record<string, OtPunchStatus>
  >({});

  const getRequestGroupName = (request: OTRequest): string | null => {
    const groupId = request.employees?.overtime_group_id || null;
    if (groupId) return overtimeGroupNameById[groupId] || null;
    return employeeGroupNameByEmployeeId[request.employee_id] || null;
  };

  /** OT requests for employees in this group are owned by any user with role upper_management (not only the UUID in legacy maps). */
  const isUpperManagementOvertimeGroupLabel = (
    groupName: string | null
  ): boolean => {
    const n = normalizeGroupName(groupName);
    if (!n) return false;
    return (
      n === "upper management group" ||
      n === "upper management" ||
      n.includes("upper management")
    );
  };

  const getRequestOvertimeGroupFirstApproverId = (
    request: OTRequest
  ): string | null => {
    const groupId = request.employees?.overtime_group_id || null;
    if (!groupId) return null;
    return overtimeGroupFirstApproverIdById[groupId] || null;
  };

  const isUserFirstApproverForRequest = (
    userId: string | null,
    request: OTRequest
  ): boolean => {
    if (!userId) return false;
    const byGroupId = getRequestOvertimeGroupFirstApproverId(request);
    if (byGroupId) return byGroupId === userId;

    // Fallback to group-name based routing (covers any missing join fields).
    const groupName = getRequestGroupName(request);
    const approverMap: Record<string, string> = {};
    Object.entries(overtimeGroupFirstApproverIdById).forEach(([groupId, approverId]) => {
      const name = overtimeGroupNameById[groupId];
      if (name && approverId) approverMap[name] = approverId;
    });
    return isUserApproverForOvertimeGroup(userId, groupName, approverMap);
  };

  const isManagerStagePending = (request: OTRequest): boolean =>
    request.status === "pending" &&
    !request.project_manager_id &&
    !request.account_manager_id;

  const isHrStagePending = (request: OTRequest): boolean =>
    request.status === "pending" &&
    Boolean(request.project_manager_id || request.account_manager_id);

  const canCurrentUserActOnRequest = (request: OTRequest): boolean => {
    if (request.status !== "pending") return false;
    // Admin and Upper Management (isAdmin) may act on any pending OT — same as original product behavior.
    if (isAdmin) return true;
    if (!currentUserId) return false;

    const upperManagementFirstApproverId =
      LOCATION_FIRST_APPROVER_BY_GROUP["upper management group"];

    // Upper management: first approver for the OT group, or any UM for "Upper Management" OT group employees.
    if (normalizedRole === "upper_management") {
      // Manager stage pending: designated first approver or UM queue by group name.
      if (isManagerStagePending(request)) {
        return (
          isUserFirstApproverForRequest(currentUserId, request) ||
          isUpperManagementOvertimeGroupLabel(getRequestGroupName(request))
        );
      }

      // HR stage pending: only the approver already assigned (account_manager/project_manager) can act.
      if (isHrStagePending(request)) {
        return (
          request.account_manager_id === currentUserId ||
          request.project_manager_id === currentUserId
        );
      }

      return false;
    }

    if (
      normalizedRole === "operations_manager" &&
      isManagerStagePending(request)
    ) {
      return isUserFirstApproverForRequest(currentUserId, request);
    }
    if (isHR) {
      // Standard HR step: HR can only act when the request is waiting for HR.
      if (isHrStagePending(request)) {
        // Special case: if upper management already endorsed the OT request,
        // only that upper-management approver can finalize it.
        if (
          (request.account_manager_id === upperManagementFirstApproverId ||
            request.project_manager_id === upperManagementFirstApproverId) &&
          isFinalHrApprover(currentUserId)
        ) {
          return false;
        }

        return isFinalHrApprover(currentUserId);
      }

      // Skip rule: when HR is also the first approver for the OT group,
      // the request should go directly to HR (so HR can act on manager-stage pending).
      if (isManagerStagePending(request)) {
        return isUserFirstApproverForRequest(currentUserId, request);
      }
    }
    return false;
  };

  const isFirstApproverDashboardView =
    normalizedRole === "operations_manager" ||
    normalizedRole === "upper_management";

  const getViewerStatus = (request: OTRequest): ViewerOtStatus => {
    if (request.status === "approved" || request.status === "rejected") {
      return request.status;
    }
    if (!isFirstApproverDashboardView) return "pending";
    const endorsedToHr = Boolean(
      request.project_manager_id || request.account_manager_id
    );
    if (
      endorsedToHr &&
      (isUserFirstApproverForRequest(currentUserId, request) ||
        (normalizedRole === "upper_management" &&
          isUpperManagementOvertimeGroupLabel(getRequestGroupName(request))))
    ) {
      return "approved";
    }
    return "pending";
  };

  const statusBadgeClass = (status: OTRequest["status"]) => {
    if (status === "approved") return "bg-emerald-600 text-white border-emerald-600";
    if (status === "rejected") return "bg-red-50 text-red-700 border-red-200";
    // Pending should be high-contrast (white text on blue pill).
    return "bg-blue-600 text-white border-blue-600";
  };

  const getWorkflowStep = (request: OTRequest): 1 | 2 | 3 => {
    if (request.status === "approved" || request.status === "rejected") return 3;
    if (isHrStagePending(request)) return 2;
    const upperManagementFirstApproverId =
      LOCATION_FIRST_APPROVER_BY_GROUP["upper management group"];
    if (
      isManagerStagePending(request) &&
      (getRequestOvertimeGroupFirstApproverId(request) ===
        upperManagementFirstApproverId ||
        isUpperManagementOvertimeGroupLabel(getRequestGroupName(request)))
    ) {
      // Upper management can approve in one step (skip Operations Manager + HR steps).
      return 3;
    }
    return 1;
  };

  // HR users also have approver permissions, so they can access this page
  // Allow approver, HR, and viewer roles

  const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(selectedWeek, { weekStartsOn: 1 }); // Sunday

  useEffect(() => {
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    })();
  }, [supabase]);

  const base64ToBlob = (base64: string, type: string) => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type });
  };

  async function downloadDocument(docId: string) {
    setDownloadingDocId(docId);
    const { data, error } = await supabase
      .from("overtime_documents")
      .select("file_base64, file_name, file_type")
      .eq("id", docId)
      .maybeSingle();

    setDownloadingDocId(null);

    if (error) {
      if (isSchemaMissingTableOrRelationError(error)) {
        toast.error("Document storage is not configured");
      } else {
        console.error("Error fetching document:", error);
        toast.error("Unable to fetch document");
      }
      return;
    }
    if (!data) {
      toast.error("Unable to fetch document");
      return;
    }

    const docData = data as {
      file_base64: string;
      file_name: string | null;
      file_type: string | null;
    };

    const blob = base64ToBlob(
      docData.file_base64,
      docData.file_type || "application/octet-stream"
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = docData.file_name || "document";
    link.target = "_blank";
    link.rel = "noopener";
    link.click();
    URL.revokeObjectURL(url);
  }

  const loadRequests = async () => {
    setLoading(true);

    // Ensure weekEnd includes the full day
    const weekEndInclusive = new Date(weekEnd);
    weekEndInclusive.setHours(23, 59, 59, 999);

    const weekStartStr = format(weekStart, "yyyy-MM-dd");
    const weekEndStr = format(weekEndInclusive, "yyyy-MM-dd");

    const skipWeekFilterForPendingQueue =
      statusFilter === "pending" &&
      (isOperationsManager || isHR || isFirstApproverDashboardView);

    let query = supabase.from("overtime_requests").select(
      `
        *,
        employees (
          id,
          full_name,
          employee_id,
          overtime_group_id,
          profile_picture_url,
          requires_ot_punch
        )
      `
    );

    if (!skipWeekFilterForPendingQueue) {
      query = query.gte("ot_date", weekStartStr).lte("ot_date", weekEndStr);
    }

    query = query.order("created_at", { ascending: false });

    if (
      statusFilter !== "all" &&
      !isFirstApproverDashboardView &&
      !shouldSkipServerStatusFilterForHrPending(isHR, statusFilter)
    ) {
      query = query.eq("status", statusFilter);
    }

    if (selectedEmployee !== "all") {
      query = query.eq("employee_id", selectedEmployee);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error loading OT requests", error);
      toast.error("Failed to load OT requests");
      setLoading(false);
      return;
    }

    let dataWithDocs = (data || []) as OTRequest[];
    if (dataWithDocs.length > 0) {
      const requestIds = dataWithDocs.map((r) => r.id);
      const { data: docsRows, error: docsError } = await supabase
        .from("overtime_documents")
        .select("id, overtime_request_id, file_name, file_type, file_size")
        .in("overtime_request_id", requestIds);

      if (docsError) {
        if (!isSchemaMissingTableOrRelationError(docsError)) {
          console.error("Error loading OT documents", docsError);
        }
      } else {
        const byRequest: Record<string, OvertimeDocument[]> = {};
        for (const d of docsRows || []) {
          const row = d as {
            id: string;
            overtime_request_id: string;
            file_name: string | null;
            file_type: string | null;
            file_size: number | null;
          };
          const rid = row.overtime_request_id;
          if (!byRequest[rid]) byRequest[rid] = [];
          byRequest[rid].push({
            id: row.id,
            file_name: row.file_name || "",
            file_type: row.file_type,
            file_size: row.file_size,
          });
        }
        dataWithDocs = dataWithDocs.map((r) => ({
          ...r,
          overtime_documents: byRequest[r.id] || [],
        }));
      }

      const bundyPunchIds = new Set<string>();
      dataWithDocs.forEach((r) => {
        if (r.bundy_in_punch_id) bundyPunchIds.add(r.bundy_in_punch_id);
        if (r.bundy_out_punch_id) bundyPunchIds.add(r.bundy_out_punch_id);
      });
      const punchById: Record<
        string,
        { id: string; punched_at: string; lat: number | null; lng: number | null }
      > = {};
      if (bundyPunchIds.size > 0) {
        const { data: punchRows, error: punchError } = await supabase
          .from("time_entries")
          .select("id, punched_at, lat, lng")
          .in("id", Array.from(bundyPunchIds));
        if (punchError) {
          console.error("Error loading Bundy punches for OT", punchError);
        } else {
          (punchRows || []).forEach((p: any) => {
            punchById[p.id] = p;
          });
        }
      }

      const statusMap: Record<string, OtPunchStatus> = {};
      dataWithDocs = dataWithDocs.map((r) => {
        const inP = r.bundy_in_punch_id ? punchById[r.bundy_in_punch_id] : null;
        const outP = r.bundy_out_punch_id ? punchById[r.bundy_out_punch_id] : null;
        const hasPair = Boolean(inP && outP);
        if (r.employees?.requires_ot_punch === true) {
          statusMap[r.id] = {
            hasCompletedPair: hasPair,
            isOpen: false,
            lastPunchedAt: outP?.punched_at || inP?.punched_at || null,
            lastPunchType: hasPair ? "out" : inP ? "in" : null,
            lastLat: outP?.lat ?? inP?.lat ?? null,
            lastLng: outP?.lng ?? inP?.lng ?? null,
          };
        }
        return {
          ...r,
          bundy_session:
            inP && outP
              ? {
                  clock_in_time: inP.punched_at,
                  clock_out_time: outP.punched_at,
                  clock_in_lat: inP.lat,
                  clock_in_lng: inP.lng,
                  clock_out_lat: outP.lat,
                  clock_out_lng: outP.lng,
                }
              : null,
        };
      });
      setOtPunchStatusByRequestId(statusMap);
    }

    // Role-based visibility: show requests the user is allowed to view.
    // Stage checks (manager vs HR pending) are kept for Approve/Reject permissions only.
    let filteredData: OTRequest[] | null = dataWithDocs;
    if (!isAdmin) {
      filteredData = dataWithDocs.filter((request) => {
        if (!currentUserId) return false;
        const groupName = getRequestGroupName(request);
        const otApproverMap: Record<string, string> = {};
        Object.entries(overtimeGroupFirstApproverIdById).forEach(([groupId, approverId]) => {
          const name = overtimeGroupNameById[groupId];
          if (name && approverId) otApproverMap[name] = approverId;
        });
        if (normalizedRole === "operations_manager") {
          return canOperationsManagerViewOtRequest(
            request,
            currentUserId,
            groupName,
            otApproverMap,
            statusFilter
          );
        }
        if (isHR) {
          return canHrViewOtRequest(
            request,
            currentUserId,
            groupName,
            otApproverMap,
            statusFilter
          );
        }
        return false;
      });
    }
    const requestsData = filteredData as Array<{
      status: string;
      account_manager_id?: string | null;
      approved_by?: string | null;
    }> | null;

    // Filter out cancelled requests to avoid flooding the UI
    const cleaned = (requestsData || []).filter(
      (r) => r.status !== "cancelled"
    );
    setRequests(cleaned as OTRequest[]);

    // Load display names for anyone who may appear on approved/rejected rows.
    const approverIds = Array.from(
      new Set(
        cleaned.flatMap((r) => {
          const row = r as OTRequest;
          return [
            row.approved_by,
            row.hr_approved_by,
            row.project_manager_id,
            row.account_manager_id,
          ].filter((id): id is string => Boolean(id));
        })
      )
    );
    if (approverIds.length > 0) {
      loadApproverNames(approverIds);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (canManageOvertime) {
      loadEmployeeGroupMap();
    }
  }, [canManageOvertime]);

  useEffect(() => {
    if (canManageOvertime) {
      loadEmployees();
    }
  }, [
    canManageOvertime,
    isAdmin,
    isHR,
    normalizedRole,
    currentUserId,
    employeeGroupNameByEmployeeId,
    overtimeGroupFirstApproverIdById,
  ]);

  async function loadEmployeeGroupMap() {
    const [employeesRes, groupsRes] = await Promise.all([
      supabase
        .from("employees")
        .select("id, employee_id, overtime_group_id"),
      supabase.from("overtime_groups").select("id, name, approver_id"),
    ]);

    if (employeesRes.error || groupsRes.error) {
      setEmployeeGroupNameByEmployeeId({});
      return;
    }

    const groupNameById: Record<string, string> = {};
    const firstApproverIdById: Record<string, string> = {};
    (groupsRes.data || []).forEach((g: any) => {
      groupNameById[g.id] = g.name;
      const normalized = normalizeGroupName(g.name);
      const forcedHrFirstApprover =
        normalized === "hr laguna" || normalized === "laguna hr";
      // Prefer group approver from DB (e.g. Laguna-HR lead) so routing matches production profiles;
      // fall back to legacy constant only when unset.
      const effectiveApproverId = forcedHrFirstApprover
        ? g.approver_id || FINAL_HR_APPROVER_ID
        : g.approver_id;
      if (effectiveApproverId) firstApproverIdById[g.id] = effectiveApproverId;
    });

    const map: Record<string, string> = {};
    (employeesRes.data || []).forEach((emp: any) => {
      if (emp.overtime_group_id && groupNameById[emp.overtime_group_id]) {
        // overtime_requests.employee_id may be either employees.employee_id (numeric/string)
        // or employees.id (UUID) depending on how the row was created.
        map[emp.employee_id] = groupNameById[emp.overtime_group_id];
        map[emp.id] = groupNameById[emp.overtime_group_id];
      }
    });
    setEmployeeGroupNameByEmployeeId(map);
    setOvertimeGroupNameById(groupNameById);
    setOvertimeGroupFirstApproverIdById(firstApproverIdById);
  }

  async function loadEmployees() {
    if (!canManageOvertime) {
      setEmployees([]);
      return;
    }
    const { data, error } = await supabase
      .from("employees")
      .select("id, employee_id, full_name, last_name, first_name, overtime_group_id")
      .order("last_name", { ascending: true, nullsFirst: false })
      .order("first_name", { ascending: true, nullsFirst: false });

    if (error) {
      console.error("Failed to load employees", error);
      return;
    }

    const filteredEmployees = (data || []).filter((employee: any) => {
      if (isAdmin) return true;
      if (normalizedRole === "operations_manager") {
        const gid = employee.overtime_group_id as string | null | undefined;
        if (gid && overtimeGroupFirstApproverIdById[gid]) {
          return overtimeGroupFirstApproverIdById[gid] === currentUserId;
        }
        const groupName =
          employeeGroupNameByEmployeeId[employee.employee_id] ||
          employeeGroupNameByEmployeeId[employee.id];
        const approverMap: Record<string, string> = {};
        Object.entries(overtimeGroupFirstApproverIdById).forEach(([groupId, approverId]) => {
          const name = overtimeGroupNameById[groupId];
          if (name && approverId) approverMap[name] = approverId;
        });
        return isUserApproverForOvertimeGroup(currentUserId, groupName, approverMap);
      }
      if (isHR) {
        return isFinalHrApprover(currentUserId);
      }
      return false;
    });

    setEmployees(filteredEmployees);
  }

  async function loadApproverNames(ids: string[]) {
    const uniq = Array.from(new Set(ids.filter(Boolean)));
    if (uniq.length === 0) return;

    const next: Record<string, string> = {};

    const { data: userData, error: userError } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", uniq);

    if (!userError && userData) {
      (userData as Array<{ id: string; full_name: string | null; email: string | null }>).forEach(
        (row) => {
          next[row.id] = row.full_name || row.email || row.id;
        }
      );
    }

    const missing = uniq.filter((id) => !next[id]);
    if (missing.length > 0) {
      const { data: empData, error: empError } = await supabase
        .from("employees")
        .select("id, full_name, email")
        .in("id", missing);

      if (!empError && empData) {
        (empData as Array<{ id: string; full_name: string | null; email: string | null }>).forEach(
          (row) => {
            next[row.id] = row.full_name || row.email || row.id;
          }
        );
      }
    }

    if (Object.keys(next).length === 0) return;

    setApproverNames((prev) => ({ ...prev, ...next }));
  }

  useEffect(() => {
    const status = searchParams.get("status");
    if (status) {
      setStatusFilter(status);
      return;
    }
    if (isOperationsManager || isHR) setStatusFilter("pending");
  }, [searchParams, isOperationsManager, isHR]);

  useEffect(() => {
    const canLoadOtRequests =
      role &&
      (role === "admin" ||
        role === "upper_management" ||
        role === "hr" ||
        role === "operations_manager");

    if (canLoadOtRequests) {
      loadRequests();
    }
  }, [
    selectedWeek,
    statusFilter,
    selectedEmployee,
    role,
    isAdmin,
    isHR,
    normalizedRole,
    currentUserId,
    employeeGroupNameByEmployeeId,
  ]);

  useEffect(() => {
    if (loading) return;
    if (
      !isFirstApproverDashboardView &&
      !isHR &&
      normalizedRole !== "operations_manager"
    ) {
      return;
    }

    const requestId = searchParams.get("requestId");
    if (requestId) {
      const match = requests.find((r) => r.id === requestId);
      if (match) {
        setSelected(match);
        return;
      }
      void (async () => {
        const { data, error } = await supabase
          .from("overtime_requests")
          .select(
            `
            *,
            employees (
              id,
              full_name,
              employee_id,
              overtime_group_id,
              profile_picture_url,
              requires_ot_punch
            )
          `
          )
          .eq("id", requestId)
          .maybeSingle();
        if (!error && data) {
          setSelected(data as OTRequest);
          if (data.ot_date) {
            setSelectedWeek(new Date(data.ot_date));
          }
        }
      })();
      return;
    }

    if (searchParams.get("focus") !== "1") return;

    const otApproverMap: Record<string, string> = {};
    Object.entries(overtimeGroupFirstApproverIdById).forEach(([groupId, approverId]) => {
      const name = overtimeGroupNameById[groupId];
      if (name && approverId) otApproverMap[name] = approverId;
    });
    const firstActionable = requests.find((r) => {
      const groupName = getRequestGroupName(r);
      if (normalizedRole === "operations_manager") {
        return (
          overtimeRequestInOperationsManagerQueue(
            r,
            currentUserId,
            groupName,
            otApproverMap
          ) && canCurrentUserActOnRequest(r)
        );
      }
      if (isHR) {
        return (
          overtimeRequestInHrQueue(r, currentUserId, groupName, otApproverMap) &&
          canCurrentUserActOnRequest(r)
        );
      }
      return getViewerStatus(r) === "pending" && canCurrentUserActOnRequest(r);
    });
    if (firstActionable) setSelected(firstActionable);
  }, [
    loading,
    requests,
    searchParams,
    isFirstApproverDashboardView,
    currentUserId,
    employeeGroupNameByEmployeeId,
    overtimeGroupFirstApproverIdById,
  ]);

  const handleApprove = async (id: string) => {
    setActioningId(id);
    // Get request details for toast message
    const request = requests.find((r) => r.id === id);
    if (!request || !canCurrentUserActOnRequest(request)) {
      toast.error("You do not have permission to approve this request.");
      setActioningId(null);
      return;
    }
    const employeeName = request?.employees?.full_name || "Employee";

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be signed in to approve requests");
      setActioningId(null);
      return;
    }

    const now = new Date().toISOString();
    const managerStage = isManagerStagePending(request);
    const skipManagerStageForHr =
      isHR &&
      Boolean(user?.id) &&
      managerStage &&
      isUserFirstApproverForRequest(user.id, request);
    const skipManagerStageForUpperManagement =
      normalizedRole === "upper_management" &&
      Boolean(user?.id) &&
      managerStage &&
      (isUserFirstApproverForRequest(user.id, request) ||
        isUpperManagementOvertimeGroupLabel(getRequestGroupName(request)));
    const effectiveManagerStage =
      managerStage && !skipManagerStageForHr && !skipManagerStageForUpperManagement;

    const patch: Record<string, unknown> = effectiveManagerStage
      ? {
          status: "pending",
          project_manager_id: user.id,
          project_manager_approved_at: now,
          account_manager_id: user.id,
          updated_at: now,
        }
      : {
          status: "approved",
          approved_by: user.id,
          hr_approved_by: user.id,
          approved_at: now,
          updated_at: now,
        };
    const { error: finalError } = await supabase
      .from("overtime_requests")
      .update(patch)
      .eq("id", id)
      .eq("status", "pending");

    if (finalError) {
      toast.error("Failed to approve overtime request", {
        description: finalError.message || "An error occurred while approving the request",
      });
    } else {
      if (effectiveManagerStage) {
        toast.success("Overtime request endorsed to HR", {
          description: `${employeeName}'s overtime request is now awaiting HR approval`,
        });
      } else {
        toast.success("Overtime request approved!", {
          description: `${employeeName}'s overtime request has been approved successfully`,
        });
      }
      loadRequests();
      closeRequestModal();
    }
    setActioningId(null);
  };

  const handleReject = async (id: string) => {
    setActioningId(id);
    // Get request details for toast message
    const request = requests.find((r) => r.id === id);
    if (!request || !canCurrentUserActOnRequest(request)) {
      toast.error("You do not have permission to reject this request.");
      setActioningId(null);
      return;
    }
    const employeeName = request?.employees?.full_name || "Employee";

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be signed in to reject requests");
      setActioningId(null);
      return;
    }

    const now = new Date().toISOString();
    const managerStage = isManagerStagePending(request);
    const skipManagerStageForHr =
      isHR &&
      Boolean(user?.id) &&
      managerStage &&
      isUserFirstApproverForRequest(user.id, request);
    const skipManagerStageForUpperManagement =
      normalizedRole === "upper_management" &&
      Boolean(user?.id) &&
      managerStage &&
      (isUserFirstApproverForRequest(user.id, request) ||
        isUpperManagementOvertimeGroupLabel(getRequestGroupName(request)));
    const effectiveManagerStageFinal =
      managerStage && !skipManagerStageForHr && !skipManagerStageForUpperManagement;
    const patch: Record<string, unknown> = effectiveManagerStageFinal
      ? {
          status: "rejected",
          project_manager_id: user.id,
          project_manager_approved_at: now,
          account_manager_id: user.id,
          approved_by: user.id,
          approved_at: now,
          updated_at: now,
        }
      : {
          status: "rejected",
          approved_by: user.id,
          hr_approved_by: user.id,
          approved_at: now,
          updated_at: now,
        };
    const { error: finalError } = await supabase
      .from("overtime_requests")
      .update(patch)
      .eq("id", id)
      .eq("status", "pending");

    if (finalError) {
      toast.error("Failed to reject overtime request", {
        description: finalError.message || "An error occurred while rejecting the request",
      });
    } else {
      toast.success("Overtime request rejected", {
        description: `${employeeName}'s overtime request has been declined`,
      });
      loadRequests();
      closeRequestModal();
    }
    setActioningId(null);
  };

  // Show loading state while checking role access
  if (roleLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Icon
            name="ArrowsClockwise"
            size={IconSizes.lg}
            className="animate-spin text-muted-foreground"
          />
        </div>
      </DashboardLayout>
    );
  }

  if (!canManageOvertime) {
    return (
      <DashboardLayout>
        <VStack gap="4" className="p-8">
          <BodySmall>
            Only Admin, Upper Management, HR, and Operations Managers can access OT approvals.
          </BodySmall>
        </VStack>
      </DashboardLayout>
    );
  }

  const stats = {
    total: requests.length,
    pending: requests.filter((r) => getViewerStatus(r) === "pending").length,
    approved: requests.filter((r) => getViewerStatus(r) === "approved").length,
    rejected: requests.filter((r) => getViewerStatus(r) === "rejected").length,
  };

  return (
    <DashboardLayout>
      <VStack gap="8" className="w-full pb-24">
        <VStack gap="2" align="start">
          <H1>OT approvals</H1>
          <BodySmall>Review and act on pending OT requests.</BodySmall>
        </VStack>

        <Card className="sticky top-4 z-20 border-primary/20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <CardContent className="p-4">
            <HStack justify="between" align="center" className="flex-col gap-3 sm:flex-row">
              <HStack gap="2" align="center" className="flex-wrap">
                <Badge className="border-blue-200 bg-blue-600 text-white">
                  {stats.pending} pending
                </Badge>
                <Badge variant="outline">{stats.approved} approved</Badge>
                <Badge variant="outline">{stats.rejected} rejected</Badge>
              </HStack>
              <HStack gap="2" align="center" className="flex-wrap">
                <Button size="sm" variant="outline" onClick={() => router.push("/leave-approval")}>
                  Leave queue
                </Button>
                <Button size="sm" variant="outline" onClick={() => router.push("/failure-to-log-approval")}>
                  FTL queue
                </Button>
              </HStack>
            </HStack>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card className="w-full">
          <CardContent className="p-4 sm:p-6 w-full">
            <div className="flex flex-col gap-4 md:flex-row md:items-center w-full">
              {/* Week Navigation */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-2 items-center sm:items-center flex-shrink-0 w-full sm:w-auto">
                <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-start">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSelectedWeek(subWeeks(selectedWeek, 1))}
                    className="flex-shrink-0"
                  >
                    <Icon name="CaretLeft" size={IconSizes.sm} />
                  </Button>
                  <Caption className="min-w-[180px] sm:min-w-[200px] text-center font-medium text-xs sm:text-sm">
                    {format(weekStart, "MMM d")} -{" "}
                    {format(weekEnd, "MMM d, yyyy")}
                  </Caption>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSelectedWeek(addWeeks(selectedWeek, 1))}
                    className="flex-shrink-0"
                  >
                    <Icon name="CaretRight" size={IconSizes.sm} />
                  </Button>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedWeek(new Date())}
                  className="w-full sm:w-auto"
                >
                  Today
                </Button>
              </div>

              {/* Spacer to push filters to the right (hidden on mobile) */}
              <div className="hidden md:block flex-1 min-w-0" />

              {/* Filters Section */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto">
                {/* Status Filter */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Icon
                    name="MagnifyingGlass"
                    size={IconSizes.sm}
                    className="text-muted-foreground flex-shrink-0 hidden sm:block"
                  />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="flex h-10 w-full sm:w-[160px] lg:w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                {/* Employee Filter */}
                <EmployeeSearchSelect
                  employees={employees.map((e) => ({
                    id: e.id,
                    employee_id: e.employee_id,
                    full_name: e.full_name ?? "",
                    first_name: e.first_name,
                    last_name: e.last_name,
                  }))}
                  value={selectedEmployee}
                  onValueChange={setSelectedEmployee}
                  showAllOption={true}
                  placeholder="Search by name or employee ID..."
                  className="w-full sm:w-[200px] lg:w-[240px]"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <CardSection>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Icon
                name="ArrowsClockwise"
                size={IconSizes.lg}
                className="animate-spin text-muted-foreground"
              />
            </div>
          ) : requests.length === 0 ? (
            <BodySmall>No overtime requests yet.</BodySmall>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {requests.map((req) => (
                <Card
                  key={req.id}
                  className="h-full min-h-[200px] cursor-pointer border-border/80 bg-card/95 shadow-sm transition-shadow hover:shadow-hover"
                  role="button"
                  tabIndex={0}
                  onClick={() => openRequestModal(req)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openRequestModal(req);
                    }
                  }}
                >
                  <CardContent className="p-4 flex flex-col gap-3 h-full">
                    <HStack justify="between" align="start">
                      <div className="flex-1">
                        <HStack
                          gap="3"
                          align="center"
                          className="mb-2 flex-wrap"
                        >
                          <EmployeeAvatar
                            profilePictureUrl={
                              req.employees?.profile_picture_url
                            }
                            fullName={req.employees?.full_name || "Unknown"}
                            size="sm"
                          />
                          <span className="font-bold text-lg">
                            {req.employees?.full_name || "Unknown"}
                          </span>
                          <Caption>
                            ({req.employees?.employee_id || "—"})
                          </Caption>
                          <Badge variant="secondary">OT</Badge>
                        </HStack>
                        <HStack
                          gap="4"
                          align="center"
                          className="text-sm text-muted-foreground mb-2 flex-wrap"
                        >
                          <HStack gap="1" align="center">
                            <Icon name="CalendarBlank" size={IconSizes.sm} />
                            {format(new Date(req.ot_date), "MMM d, yyyy")}
                          </HStack>
                          <HStack gap="1" align="center">
                            <Icon name="Timer" size={IconSizes.sm} />
                            {formatTimeRange12h(req.start_time, req.end_time)}
                          </HStack>
                          <span className="font-semibold text-primary">
                            {creditOvertimeHours(req.total_hours)}h
                          </span>
                        </HStack>
                        {req.reason ? (
                          <BodySmall className="mt-2 line-clamp-2">
                            <strong>Reason:</strong> {req.reason}
                          </BodySmall>
                        ) : (
                          <BodySmall className="mt-2 italic text-muted-foreground">
                            No reason provided
                          </BodySmall>
                        )}
                        {req.created_at ? (
                          <Caption className="mt-1 block text-muted-foreground">
                            Filed{" "}
                            {format(new Date(req.created_at), "MMM d, yyyy h:mm a")}
                          </Caption>
                        ) : null}
                        {req.employees?.requires_ot_punch === true && (
                          <div className="mt-2">
                            {otPunchStatusByRequestId[req.id]?.hasCompletedPair ? (
                              <Badge
                                variant="outline"
                                className="bg-emerald-100 text-emerald-900 border-emerald-200"
                              >
                                OT punch complete
                              </Badge>
                            ) : otPunchStatusByRequestId[req.id]?.isOpen ? (
                              <Badge
                                variant="outline"
                                className="bg-amber-100 text-amber-900 border-amber-200"
                              >
                                OT punch open (awaiting time out)
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-red-100 text-red-900 border-red-200"
                              >
                                OT punch not completed
                              </Badge>
                            )}
                          </div>
                        )}
                        {req.overtime_documents && req.overtime_documents.length > 0 ? (
                          <VStack gap="2" align="start" className="mt-2">
                            <HStack gap="2" align="center">
                              <Icon name="FileText" size={IconSizes.sm} />
                              <BodySmall className="font-semibold">
                                Supporting Document{req.overtime_documents.length > 1 ? "s" : ""}
                              </BodySmall>
                            </HStack>
                            <VStack gap="2">
                              {req.overtime_documents.map((doc) => (
                                <HStack key={doc.id} gap="2" align="center">
                                  <Icon
                                    name="Paperclip"
                                    size={IconSizes.sm}
                                    className="text-muted-foreground"
                                  />
                                  <span className="truncate max-w-[160px] text-sm">
                                    {doc.file_name}
                                  </span>
                                  {doc.file_size && (
                                    <Caption>
                                      (
                                      {(doc.file_size / 1024).toFixed(1)} KB
                                      )
                                    </Caption>
                                  )}
                                </HStack>
                              ))}
                            </VStack>
                          </VStack>
                        ) : req.attachment_url ? (
                          <BodySmall className="mt-2">
                            <a
                              href={req.attachment_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-600 underline"
                            >
                              View Attachment
                            </a>
                          </BodySmall>
                        ) : null}
                        {getViewerStatus(req) === "approved" &&
                          getOvertimeDecisionActorId(req) && (
                            <Caption className="mt-2 text-xs text-muted-foreground">
                              Approved by:{" "}
                              {approverNames[getOvertimeDecisionActorId(req)!] || "Unknown approver"}
                              {req.approved_at &&
                                ` on ${format(new Date(req.approved_at), "MMM dd, yyyy h:mm a")}`}
                            </Caption>
                          )}
                        {getViewerStatus(req) === "rejected" &&
                          getOvertimeDecisionActorId(req) && (
                            <Caption className="mt-2 text-xs text-muted-foreground">
                              Rejected by:{" "}
                              {approverNames[getOvertimeDecisionActorId(req)!] || "Unknown approver"}
                              {req.approved_at &&
                                ` on ${format(new Date(req.approved_at), "MMM dd, yyyy h:mm a")}`}
                            </Caption>
                          )}
                      </div>
                      <Badge
                        variant={
                          getViewerStatus(req) === "approved"
                            ? "default"
                            : getViewerStatus(req) === "rejected"
                            ? "destructive"
                            : "secondary"
                        }
                      className={statusBadgeClass(getViewerStatus(req))}
                      >
                        {getViewerStatus(req).toUpperCase()}
                      </Badge>
                    </HStack>
                    {canActOnPendingOvertime && canCurrentUserActOnRequest(req) && (
                        <HStack
                          gap="2"
                          align="center"
                          className="flex-wrap mt-auto pt-2 border-t"
                        >
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              openRequestModal(req);
                            }}
                          >
                            View details
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReject(req.id);
                            }}
                            disabled={actioningId === req.id}
                          >
                            <Icon name="X" size={IconSizes.sm} />
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApprove(req.id);
                            }}
                            disabled={actioningId === req.id}
                          >
                            <Icon name="Check" size={IconSizes.sm} />
                            Approve
                          </Button>
                        </HStack>
                      )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardSection>

        {/* Detail Modal */}
        <Dialog
          open={!!selected}
          onOpenChange={(open) => {
            if (!open) closeRequestModal();
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>OT Request Details</DialogTitle>
            </DialogHeader>
            {selected && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1 sm:col-span-2">
                    <p className="text-sm text-muted-foreground">Workflow</p>
                    <HStack gap="2" align="center" className="flex-wrap">
                      {[
                        "Operations Manager Review",
                        "HR Review",
                        "Final Decision",
                      ].map((label, index) => {
                        const step = getWorkflowStep(selected);
                        const isDone = step > index + 1;
                        const isCurrent = step === index + 1;
                        return (
                          <Badge
                            key={label}
                            variant="outline"
                            className={
                              isDone
                                  ? "bg-emerald-600 text-white border-emerald-600"
                                : isCurrent
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-slate-50 text-slate-500 border-slate-200"
                            }
                          >
                            {index + 1}. {label}
                          </Badge>
                        );
                      })}
                    </HStack>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Employee</p>
                    <HStack gap="2" align="center">
                      <EmployeeAvatar
                        profilePictureUrl={
                          selected.employees?.profile_picture_url
                        }
                        fullName={selected.employees?.full_name || "Unknown"}
                        size="md"
                      />
                      <p className="text-base font-semibold">
                        {selected.employees?.full_name || "Unknown"}
                      </p>
                    </HStack>
                    <p className="text-sm text-muted-foreground">
                      ID: {selected.employees?.employee_id || "—"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge
                      variant="outline"
                      className={statusBadgeClass(getViewerStatus(selected))}
                    >
                      {getViewerStatus(selected).toUpperCase()}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">OT Date</p>
                    <p className="text-base font-medium">
                      {format(new Date(selected.ot_date), "MMM dd, yyyy")}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Time Range</p>
                    <p className="text-base font-medium">
                      {formatTimeRange12h(selected.start_time, selected.end_time)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Total Hours</p>
                    <p className="text-base font-semibold text-primary">
                      {creditOvertimeHours(selected.total_hours)}h
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Submitted</p>
                    <p className="text-base font-medium">
                      {format(
                        new Date(selected.created_at),
                        "MMM dd, yyyy h:mm a"
                      )}
                    </p>
                  </div>
                </div>

                {selected.reason && (
                  <div className="space-y-2">
                    <Label className="text-sm">Reason</Label>
                    <p className="rounded-md border border-dashed border-muted bg-muted/40 p-3 text-sm text-muted-foreground">
                      {selected.reason}
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-sm">Bundy reference (optional)</Label>
                  {selected.bundy_session ? (
                      <>
                        <Badge
                          variant="outline"
                          className="border-primary/30 bg-primary/10 text-primary"
                        >
                          Linked
                        </Badge>
                        <p className="text-xs text-muted-foreground">
                          Span{" "}
                          {(
                            (new Date(selected.bundy_session.clock_out_time).getTime() -
                              new Date(selected.bundy_session.clock_in_time).getTime()) /
                            (1000 * 60 * 60)
                          ).toFixed(2)}
                          h · Claimed {creditOvertimeHours(selected.total_hours)}h
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Time In:{" "}
                          {format(
                            new Date(selected.bundy_session.clock_in_time),
                            "MMM d, h:mm a"
                          )}
                          {selected.bundy_session.clock_in_lat != null &&
                            selected.bundy_session.clock_in_lng != null && (
                              <>
                                {" "}
                                · {selected.bundy_session.clock_in_lat.toFixed(6)},{" "}
                                {selected.bundy_session.clock_in_lng.toFixed(6)}
                              </>
                            )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Time Out:{" "}
                          {format(
                            new Date(selected.bundy_session.clock_out_time),
                            "MMM d, h:mm a"
                          )}
                          {selected.bundy_session.clock_out_lat != null &&
                            selected.bundy_session.clock_out_lng != null && (
                              <>
                                {" "}
                                · {selected.bundy_session.clock_out_lat.toFixed(6)},{" "}
                                {selected.bundy_session.clock_out_lng.toFixed(6)}
                              </>
                            )}
                        </p>
                      </>
                    ) : (
                      <Caption className="text-muted-foreground">
                        None — filed with manual date and time only.
                      </Caption>
                    )}
                </div>

                {selected.overtime_documents && selected.overtime_documents.length > 0 ? (
                  <div className="space-y-2">
                    <Label className="text-sm">
                      Supporting Document{selected.overtime_documents.length > 1 ? "s" : ""}
                    </Label>
                    <VStack gap="2">
                      {selected.overtime_documents.map((doc) => (
                        <HStack
                          key={doc.id}
                          gap="2"
                          align="center"
                          className="text-sm"
                        >
                          <Icon
                            name="Receipt"
                            size={IconSizes.sm}
                            className="text-muted-foreground"
                          />
                          <div className="flex-1 truncate">
                            {doc.file_name}
                          </div>
                          {doc.file_size && (
                            <Caption>
                              {(doc.file_size / 1024).toFixed(1)} KB
                            </Caption>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadDocument(doc.id);
                            }}
                            disabled={downloadingDocId === doc.id}
                          >
                            <Icon
                              name={downloadingDocId === doc.id ? "ArrowsClockwise" : "Eye"}
                              size={IconSizes.sm}
                              className={downloadingDocId === doc.id ? "animate-spin" : ""}
                            />
                            View
                          </Button>
                        </HStack>
                      ))}
                    </VStack>
                  </div>
                ) : selected.attachment_url ? (
                  <div className="space-y-2">
                    <Label className="text-sm">Attachment</Label>
                    <a
                      href={selected.attachment_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-sm text-emerald-600 underline hover:text-emerald-700"
                    >
                      <Icon name="Paperclip" size={IconSizes.sm} />
                      View Attachment
                    </a>
                  </div>
                ) : null}

                {getViewerStatus(selected) === "approved" &&
                  getOvertimeDecisionActorId(selected) && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Approved by:{" "}
                        <span className="font-medium text-foreground">
                          {approverNames[getOvertimeDecisionActorId(selected)!] || "Unknown approver"}
                        </span>
                        {selected.approved_at &&
                          ` on ${format(new Date(selected.approved_at), "MMM dd, yyyy h:mm a")}`}
                      </p>
                    </div>
                  )}
                {getViewerStatus(selected) === "rejected" &&
                  getOvertimeDecisionActorId(selected) && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Rejected by:{" "}
                        <span className="font-medium text-foreground">
                          {approverNames[getOvertimeDecisionActorId(selected)!] || "Unknown approver"}
                        </span>
                        {selected.approved_at &&
                          ` on ${format(new Date(selected.approved_at), "MMM dd, yyyy h:mm a")}`}
                      </p>
                    </div>
                  )}
              </div>
            )}
            <DialogFooter className="flex flex-wrap justify-between gap-2">
              <Button variant="secondary" onClick={closeRequestModal}>
                Close
              </Button>
              {selected && canActOnPendingOvertime && canCurrentUserActOnRequest(selected) && (
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      onClick={() => {
                        if (!selected) return;
                        void handleReject(selected.id);
                      }}
                      disabled={actioningId === selected.id}
                    >
                      <Icon name="X" size={IconSizes.sm} />
                      Reject
                    </Button>
                    <Button
                      onClick={() => {
                        if (!selected) return;
                        void handleApprove(selected.id);
                      }}
                      disabled={actioningId === selected.id}
                    >
                      <Icon name="Check" size={IconSizes.sm} />
                      {actioningId === selected.id
                        ? "Processing..."
                        : "Approve"}
                    </Button>
                  </div>
                )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </VStack>
    </DashboardLayout>
  );
}