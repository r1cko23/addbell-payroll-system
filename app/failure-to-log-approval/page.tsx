"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useUserRole } from "@/lib/hooks/useUserRole";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CardSection } from "@/components/ui/card-section";
import { H1, H3, BodySmall, Caption } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { toast } from "sonner";
import { formatPHTime } from "@/utils/format";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from "date-fns";
import { EmployeeAvatar } from "@/components/EmployeeAvatar";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { MetricCard } from "@/components/ui/metric-card";
import {
  isFinalHrApprover,
  isFirstApproverForGroup,
} from "@/lib/requestApprovalRouting";

interface FailureToLog {
  id: string;
  employee_id: string;
  time_entry_id: string | null;
  missed_date: string | null;
  actual_clock_in_time: string | null;
  actual_clock_out_time: string | null;
  entry_type: "in" | "out" | "both";
  manual_notes: string | null;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  rejection_reason: string | null;
  account_manager_id: string | null;
  approved_at: string | null;
  updated_at: string | null;
  created_at: string;
  employees: {
    employee_id: string;
    full_name: string;
    profile_picture_url?: string | null;
  };
  time_clock_entries?: {
    clock_in_time: string;
    clock_out_time: string | null;
  };
}

type EmployeeFilterOption = {
  id: string;
  employee_id: string;
  full_name: string;
  last_name?: string | null;
  first_name?: string | null;
};

export default function FailureToLogApprovalPage() {
  const supabase = createClient();
  const router = useRouter();
  const { role, isHR, isAdmin, loading: roleLoading } = useUserRole();
  const normalizedRole = (role || "").trim().toLowerCase();
  const canManageFailureToLog =
    isAdmin ||
    normalizedRole === "upper_management" ||
    isHR ||
    normalizedRole === "operations_manager";

  const canActOnFailureToLog = canManageFailureToLog;

  // All hooks must be declared before any conditional returns
  const [requests, setRequests] = useState<FailureToLog[]>([]);
  const [employees, setEmployees] = useState<EmployeeFilterOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  const [selectedRequest, setSelectedRequest] = useState<FailureToLog | null>(
    null
  );
  const [rejectionReason, setRejectionReason] = useState("");
  const [approveLoading, setApproveLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [employeeGroupNameByEmployeeId, setEmployeeGroupNameByEmployeeId] =
    useState<Record<string, string>>({});
  const [approverNames, setApproverNames] = useState<Record<string, string>>(
    {}
  );

  const getRequestGroupName = (request: FailureToLog): string | null =>
    employeeGroupNameByEmployeeId[request.employee_id] || null;

  const isManagerStagePending = (request: FailureToLog): boolean =>
    request.status === "pending" && !request.account_manager_id;

  const isHrStagePending = (request: FailureToLog): boolean =>
    request.status === "pending" && Boolean(request.account_manager_id);

  const canCurrentUserActOnRequest = (request: FailureToLog): boolean => {
    if (request.status !== "pending") return false;
    if (isAdmin || normalizedRole === "upper_management") return true;
    if (!currentUserId) return false;
    if (
      normalizedRole === "operations_manager" &&
      isManagerStagePending(request)
    ) {
      return isFirstApproverForGroup(currentUserId, getRequestGroupName(request));
    }
    if (isHR && isHrStagePending(request)) {
      return isFinalHrApprover(currentUserId);
    }
    return false;
  };

  // HR users also have approver permissions, so they can access this page

  const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(selectedWeek, { weekStartsOn: 1 }); // Sunday
  const safeFormat = (value: string | null | undefined, fmt: string) =>
    value ? formatPHTime(value, fmt) : "—";

  useEffect(() => {
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    })();
  }, [supabase]);

  const statusStyles: Record<FailureToLog["status"], string> = {
    pending: "bg-amber-100 text-amber-900 border-amber-200",
    approved: "bg-emerald-100 text-emerald-900 border-emerald-200",
    rejected: "bg-rose-100 text-rose-900 border-rose-200",
    cancelled: "bg-muted text-muted-foreground border-transparent",
  };

  useEffect(() => {
    if (canManageFailureToLog) {
      loadEmployees();
    }
  }, [
    canManageFailureToLog,
    isAdmin,
    isHR,
    normalizedRole,
    currentUserId,
    employeeGroupNameByEmployeeId,
  ]);

  useEffect(() => {
    if (canManageFailureToLog) {
      void loadEmployeeGroupMap();
    }
  }, [canManageFailureToLog]);

  async function loadEmployeeGroupMap() {
    const [employeesRes, groupsRes] = await Promise.all([
      supabase.from("employees").select("id, overtime_group_id"),
      supabase.from("overtime_groups").select("id, name"),
    ]);

    if (employeesRes.error || groupsRes.error) {
      setEmployeeGroupNameByEmployeeId({});
      return;
    }

    const groupNameById: Record<string, string> = {};
    (groupsRes.data || []).forEach((g: any) => {
      groupNameById[g.id] = g.name;
    });

    const map: Record<string, string> = {};
    (employeesRes.data || []).forEach((emp: any) => {
      if (emp.overtime_group_id && groupNameById[emp.overtime_group_id]) {
        map[emp.id] = groupNameById[emp.overtime_group_id];
      }
    });
    setEmployeeGroupNameByEmployeeId(map);
  }

  async function loadEmployees() {
    if (!canManageFailureToLog) {
      setEmployees([]);
      return;
    }
    let data: any[] | null = null;
    const withPosition = await supabase
      .from("employees")
      .select("id, employee_id, full_name, last_name, first_name")
      .order("last_name", { ascending: true, nullsFirst: false })
      .order("first_name", { ascending: true, nullsFirst: false });

    if (withPosition.error) {
      console.warn(
        "Failed to load employees with position join, retrying basic employee list:",
        withPosition.error
      );
      const basic = await supabase
        .from("employees")
        .select("id, employee_id, full_name, last_name, first_name")
        .order("last_name", { ascending: true, nullsFirst: false })
        .order("first_name", { ascending: true, nullsFirst: false });
      if (basic.error) {
        console.error("Failed to load employees", basic.error);
        return;
      }
      data = basic.data as any[] | null;
    } else {
      data = withPosition.data as any[] | null;
    }

    const filteredEmployees = (data || []).filter((employee: any) => {
      if (isAdmin || normalizedRole === "upper_management") return true;
      if (normalizedRole === "operations_manager") {
        return isFirstApproverForGroup(
          currentUserId,
          employeeGroupNameByEmployeeId[employee.id]
        );
      }
      if (isHR) {
        return isFinalHrApprover(currentUserId);
      }
      return false;
    });

    setEmployees(filteredEmployees);
  }

  useEffect(() => {
    if (canManageFailureToLog) {
      fetchRequests();
    }
  }, [
    statusFilter,
    selectedWeek,
    selectedEmployee,
    canManageFailureToLog,
    isAdmin,
    isHR,
    normalizedRole,
    currentUserId,
    employeeGroupNameByEmployeeId,
  ]);

  async function fetchRequests() {
    setLoading(true);

    // Ensure weekEnd includes the full day
    const weekEndInclusive = new Date(weekEnd);
    weekEndInclusive.setHours(23, 59, 59, 999);

    const weekStartStr = format(weekStart, "yyyy-MM-dd");
    const weekEndStr = format(weekEndInclusive, "yyyy-MM-dd");

    const applyFilters = <T extends { eq: Function }>(query: T): T => {
      let filtered = query;
      if (statusFilter !== "all") {
        filtered = filtered.eq("status", statusFilter);
      }
      if (selectedEmployee !== "all") {
        filtered = filtered.eq("employee_id", selectedEmployee);
      }
      return filtered;
    };

    const fullQuery = applyFilters(
      supabase
        .from("failure_to_log")
        .select(
          `
          *,
          employees (
            employee_id,
            full_name,
              profile_picture_url
          ),
          time_clock_entries (
            clock_in_time,
            clock_out_time
          )
        `
        )
        .gte("missed_date", weekStartStr)
        .lte("missed_date", weekEndStr)
        .order("created_at", { ascending: false })
    );

    let { data, error } = await fullQuery;

    if (error) {
      console.warn(
        "Failure-to-log query with clock entry join failed, retrying without time_clock_entries:",
        error
      );
      const fallbackQuery = applyFilters(
        supabase
          .from("failure_to_log")
          .select(
            `
            *,
            employees (
              employee_id,
              full_name,
              profile_picture_url
            )
          `
          )
          .gte("missed_date", weekStartStr)
          .lte("missed_date", weekEndStr)
          .order("created_at", { ascending: false })
      );
      const fallbackResult = await fallbackQuery;
      data = fallbackResult.data;
      error = fallbackResult.error;
    }

    if (error) {
      console.warn(
        "Failure-to-log query with employee position join failed, retrying with basic employee fields:",
        error
      );
      const basicFallbackQuery = applyFilters(
        supabase
          .from("failure_to_log")
          .select(
            `
            *,
            employees (
              employee_id,
              full_name,
              profile_picture_url
            )
          `
          )
          .gte("missed_date", weekStartStr)
          .lte("missed_date", weekEndStr)
          .order("created_at", { ascending: false })
      );
      const basicFallbackResult = await basicFallbackQuery;
      data = basicFallbackResult.data;
      error = basicFallbackResult.error;
    }

    setLoading(false);

    if (error) {
      console.error("Error fetching failure to log requests:", error);
      toast.error("Failed to load requests");
      return;
    }

    let filteredData = data;
    if (!isAdmin && normalizedRole !== "upper_management" && data) {
      filteredData = data.filter((request: any) => {
        if (!currentUserId) return false;
        if (normalizedRole === "operations_manager") {
          return (
            request.status === "pending" &&
            !request.account_manager_id &&
            isFirstApproverForGroup(
              currentUserId,
              employeeGroupNameByEmployeeId[request.employee_id]
            )
          );
        }
        if (isHR) {
          return (
            isFinalHrApprover(currentUserId) &&
            request.status === "pending" &&
            Boolean(request.account_manager_id)
          );
        }
        return false;
      });
    }

    const requestsData = filteredData as Array<{
      status: string;
      approved_by?: string | null;
      rejected_by?: string | null;
      account_manager_id?: string | null;
    }> | null;

    const cleaned = (requestsData || []).filter(
      (r) => r.status !== "cancelled"
    );
    setRequests(cleaned as any);

    // Load approver names for approved items
    const approverIds = Array.from(
      new Set(
        cleaned
          .map((r) => r.account_manager_id)
          .filter((id): id is string => Boolean(id))
      )
    );
    if (approverIds.length > 0) {
      loadApproverNames(approverIds);
    }
  }

  async function loadApproverNames(ids: string[]) {
    if (ids.length === 0) return;

    const { data: userData, error: userError } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", ids);

    if (userData && !userError) {
      const usersArray = userData as Array<{
        id: string;
        full_name: string | null;
        email: string | null;
      }>;

      setApproverNames((prev) => {
        const next = { ...prev };
        usersArray.forEach((row) => {
          next[row.id] = row.full_name || row.email || row.id;
        });
        return next;
      });
      return;
    }

    const { data: empData, error: empError } = await supabase
      .from("employees")
      .select("id, full_name, email")
      .in("id", ids);

    if (empError || !empData) return;

    const employeesArray = empData as Array<{
      id: string;
      full_name: string | null;
      email: string | null;
    }>;

    setApproverNames((prev) => {
      const next = { ...prev };
      employeesArray.forEach((row) => {
        next[row.id] = row.full_name || row.email || row.id;
      });
      return next;
    });
  }

  async function handleApprove(requestId: string) {
    setApproveLoading(true);
    const selectedFailureToLog = requests.find((request) => request.id === requestId);
    if (!selectedFailureToLog || !canCurrentUserActOnRequest(selectedFailureToLog)) {
      toast.error("You do not have permission to approve this request.");
      setApproveLoading(false);
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setApproveLoading(false);
      return;
    }

    // First, get the failure to log request details
    const { data: request, error: fetchError } = await supabase
      .from("failure_to_log")
      .select(
        `
        id,
        employee_id,
        time_entry_id,
        entry_type,
        actual_clock_in_time,
        actual_clock_out_time,
        reason
      `
      )
      .eq("id", requestId)
      .single();

    if (fetchError || !request) {
      console.error("Error fetching request:", fetchError);
      toast.error("Failed to fetch request details", {
        description: fetchError?.message || "Unable to load request information",
      });
      setApproveLoading(false);
      return;
    }

    const requestData = request as {
      entry_type: "in" | "out" | "both";
      actual_clock_in_time: string | null;
      actual_clock_out_time: string | null;
    };

    // Validate required times based on entry_type
    if (
      (requestData.entry_type === "in" && !requestData.actual_clock_in_time) ||
      (requestData.entry_type === "out" &&
        !requestData.actual_clock_out_time) ||
      (requestData.entry_type === "both" &&
        (!requestData.actual_clock_in_time ||
          !requestData.actual_clock_out_time))
    ) {
      toast.error("Missing clock times", {
        description: "Please ensure all required clock times are provided for this request",
      });
      setApproveLoading(false);
      return;
    }

    const now = new Date().toISOString();
    const managerStage = isManagerStagePending(selectedFailureToLog);
    const patch: Record<string, unknown> = managerStage
      ? {
          status: "pending",
          account_manager_id: user.id,
          updated_at: now,
        }
      : {
          status: "approved",
          approved_by: user.id,
          approved_at: now,
          updated_at: now,
        };
    const { error: finalError } = await supabase
      .from("failure_to_log")
      .update(patch)
      .eq("id", requestId)
      .eq("status", "pending");

    if (finalError) {
      console.error("Error approving request:", finalError);
      toast.error("Failed to approve failure to log request", {
        description: finalError.message || "An error occurred while approving the request",
      });
      setApproveLoading(false);
      return;
    }

    // Get employee name for toast message
    const approvedRequest = requests.find((r) => r.id === requestId);
    const employeeName = approvedRequest?.employees?.full_name || "Employee";
    if (managerStage) {
      toast.success("Failure-to-log request endorsed to HR", {
        description: `${employeeName}'s request is now awaiting HR approval`,
      });
    } else {
      toast.success("Failure to log request approved!", {
        description: `${employeeName}'s time entry has been updated successfully`,
      });
    }
    fetchRequests();
    setSelectedRequest(null);
    setApproveLoading(false);
  }

  async function handleReject(requestId: string) {
    const selectedFailureToLog = requests.find((request) => request.id === requestId);
    if (!selectedFailureToLog || !canCurrentUserActOnRequest(selectedFailureToLog)) {
      toast.error("You do not have permission to reject this request.");
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Get request details for toast message
    const request = requests.find((r) => r.id === requestId);
    const employeeName = request?.employees?.full_name || "Employee";

    const now = new Date().toISOString();
    const managerStage = isManagerStagePending(selectedFailureToLog);
    const patch: Record<string, unknown> = managerStage
      ? {
          status: "rejected",
          account_manager_id: user.id,
          approved_by: user.id,
          approved_at: now,
          updated_at: now,
          rejection_reason: rejectionReason.trim() || "Request rejected",
        }
      : {
          status: "rejected",
          approved_by: user.id,
          approved_at: now,
          updated_at: now,
          rejection_reason: rejectionReason.trim() || "Request rejected",
        };
    const { error: finalError } = await supabase
      .from("failure_to_log")
      .update(patch)
      .eq("id", requestId)
      .eq("status", "pending");

    if (finalError) {
      console.error("Error rejecting request:", finalError);
      toast.error("Failed to reject failure to log request", {
        description: finalError.message || "An error occurred while rejecting the request",
      });
      return;
    }

    toast.success("Failure to log request rejected", {
      description: `${employeeName}'s request has been declined`,
    });
    fetchRequests();
    setSelectedRequest(null);
    setRejectionReason("");
  }

  const stats = {
    total: requests.length,
    pending: requests.filter((r) => r.status === "pending").length,
    approved: requests.filter((r) => r.status === "approved").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
  };

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

  if (!canManageFailureToLog) {
    return (
      <DashboardLayout>
        <VStack gap="4" className="p-8">
          <BodySmall>
            Only Admin, Upper Management, HR, and Operations Managers can access failure to log approvals.
          </BodySmall>
        </VStack>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <VStack gap="8" className="w-full pb-24">
        <VStack gap="2" align="start">
          <H1>Failure to log approvals</H1>
          <BodySmall>
            Review missed punch requests, filter by employee and week, and act on pending items.
          </BodySmall>
        </VStack>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full items-stretch">
          <MetricCard label="Total" value={stats.total} />
          <MetricCard label="Pending" value={stats.pending} />
          <MetricCard label="Approved" value={stats.approved} />
          <MetricCard label="Rejected" value={stats.rejected} />
        </div>

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

        {/* Requests List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Icon
              name="ArrowsClockwise"
              size={IconSizes.lg}
              className="animate-spin text-primary"
            />
          </div>
        ) : requests.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <VStack gap="4" align="center">
                <Icon
                  name="WarningCircle"
                  size={IconSizes.xl}
                  className="text-muted-foreground"
                />
                <BodySmall>No failure-to-log requests found</BodySmall>
              </VStack>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {requests.map((request) => (
              <Card
                key={request.id}
                className="border-muted/60 transition-shadow hover:shadow-hover h-full min-h-[220px]"
                role="button"
                tabIndex={0}
                onClick={() => setSelectedRequest(request)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedRequest(request);
                  }
                }}
              >
                <CardContent className="p-4 flex flex-col gap-3 h-full">
                  <HStack justify="between" align="start">
                    <div className="flex-1">
                      <HStack gap="3" align="center" className="mb-2 flex-wrap">
                        <EmployeeAvatar
                          profilePictureUrl={
                            request.employees?.profile_picture_url
                          }
                          fullName={
                            request.employees?.full_name || "Unknown employee"
                          }
                          size="sm"
                        />
                        <span className="font-bold text-lg">
                          {request.employees?.full_name || "Unknown employee"}
                        </span>
                        <Caption>
                          ({request.employees?.employee_id || "Unknown ID"})
                        </Caption>
                        <Badge variant="secondary">FTL</Badge>
                      </HStack>
                      <HStack
                        gap="4"
                        align="center"
                        className="text-sm text-muted-foreground mb-2 flex-wrap"
                      >
                        <HStack gap="1" align="center">
                          <Icon name="CalendarBlank" size={IconSizes.sm} />
                          Missed{" "}
                          {safeFormat(request.missed_date, "MMM dd, yyyy")}
                        </HStack>
                        <HStack gap="1" align="center">
                          <Icon name="ClockClockwise" size={IconSizes.sm} />
                          Entry type: {request.entry_type.toUpperCase()}
                        </HStack>
                        {request.actual_clock_in_time ||
                        request.actual_clock_out_time ? (
                          <HStack gap="1" align="center">
                            <Icon name="Timer" size={IconSizes.sm} />
                            Actual:{" "}
                            {safeFormat(
                              request.actual_clock_in_time ||
                                request.actual_clock_out_time,
                              "MMM dd, h:mm a"
                            )}
                          </HStack>
                        ) : null}
                      </HStack>
                      <BodySmall className="mt-2">
                        <strong>Reason:</strong> {request.reason}
                      </BodySmall>
                      {request.manual_notes && (
                        <BodySmall className="mt-2">
                          <strong>Employee notes:</strong>{" "}
                          {request.manual_notes}
                        </BodySmall>
                      )}
                      {request.status === "approved" &&
                        (request.account_manager_id || request.approved_at) && (
                          <Caption className="text-xs text-gray-600 mt-2">
                            Approved by Manager:{" "}
                            {(request.account_manager_id
                              ? approverNames[request.account_manager_id]
                              : undefined) || "Manager"}
                            {request.approved_at &&
                              ` on ${format(new Date(request.approved_at), "MMM dd, yyyy h:mm a")}`}
                          </Caption>
                        )}
                      {request.status === "rejected" && request.updated_at && (
                        <Caption className="text-xs text-gray-600 mt-2">
                          Rejected on{" "}
                          {format(new Date(request.updated_at), "MMM dd, yyyy h:mm a")}
                        </Caption>
                      )}
                    </div>
                    <Badge
                      variant={
                        request.status === "pending"
                          ? "secondary"
                          : request.status === "approved"
                          ? "default"
                          : request.status === "rejected"
                          ? "destructive"
                          : "secondary"
                      }
                      className={statusStyles[request.status]}
                    >
                      {request.status.toUpperCase()}
                    </Badge>
                  </HStack>
                  {canActOnFailureToLog && canCurrentUserActOnRequest(request) && (
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
                          setSelectedRequest(request);
                        }}
                      >
                        View details
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRejectionReason("");
                          setSelectedRequest(request);
                        }}
                      >
                        <Icon name="X" size={IconSizes.sm} />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRequest(request);
                          handleApprove(request.id);
                        }}
                        disabled={approveLoading}
                      >
                        <Icon name="Check" size={IconSizes.sm} />
                        {approveLoading ? "Processing..." : "Approve"}
                      </Button>
                    </HStack>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog
          open={!!selectedRequest}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedRequest(null);
              setRejectionReason("");
            }
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Failure-to-log details</DialogTitle>
            </DialogHeader>
            {selectedRequest && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Employee</p>
                    <HStack gap="2" align="center">
                      <EmployeeAvatar
                        profilePictureUrl={
                          selectedRequest.employees?.profile_picture_url
                        }
                        fullName={
                          selectedRequest.employees?.full_name || "Unknown"
                        }
                        size="md"
                      />
                      <p className="text-base font-semibold">
                        {selectedRequest.employees?.full_name || "Unknown"}
                      </p>
                    </HStack>
                    <p className="text-sm text-muted-foreground">
                      ID: {selectedRequest.employees?.employee_id || "—"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge
                      variant="outline"
                      className={statusStyles[selectedRequest.status]}
                    >
                      {selectedRequest.status.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Missed date</p>
                    <p className="text-base font-medium">
                      {safeFormat(selectedRequest.missed_date, "MMM dd, yyyy")}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Entry type</p>
                    <p className="text-base font-medium uppercase">
                      {selectedRequest.entry_type}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      Actual clock-in
                    </p>
                    <p className="text-base font-medium">
                      {safeFormat(
                        selectedRequest.actual_clock_in_time,
                        "MMM dd, h:mm a"
                      )}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      Actual clock-out
                    </p>
                    <p className="text-base font-medium">
                      {safeFormat(
                        selectedRequest.actual_clock_out_time,
                        "MMM dd, h:mm a"
                      )}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Reason</Label>
                  <p className="rounded-md border border-dashed border-muted bg-muted/40 p-3 text-sm text-muted-foreground">
                    {selectedRequest.reason || "No reason provided."}
                  </p>
                </div>

                {selectedRequest.manual_notes && (
                  <div className="space-y-2">
                    <Label className="text-sm">Employee notes</Label>
                    <p className="rounded-md border border-dashed border-muted bg-muted/40 p-3 text-sm text-muted-foreground">
                      {selectedRequest.manual_notes}
                    </p>
                  </div>
                )}

                {selectedRequest.rejection_reason && (
                  <div className="space-y-2">
                    <Label className="text-sm">Previous rejection</Label>
                    <p className="rounded-md border border-dashed border-muted bg-muted/40 p-3 text-sm text-muted-foreground">
                      {selectedRequest.rejection_reason}
                    </p>
                  </div>
                )}

                {selectedRequest.status === "approved" &&
                  (selectedRequest.account_manager_id ||
                    selectedRequest.approved_at) && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Approved by Manager:{" "}
                        <span className="font-medium text-foreground">
                          {(selectedRequest.account_manager_id
                            ? approverNames[selectedRequest.account_manager_id]
                            : undefined) || "Manager"}
                        </span>
                        {selectedRequest.approved_at &&
                          ` on ${format(new Date(selectedRequest.approved_at), "MMM dd, yyyy h:mm a")}`}
                      </p>
                    </div>
                  )}

                {selectedRequest.status === "rejected" &&
                  selectedRequest.updated_at && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Rejected on{" "}
                        <span className="font-medium text-foreground">
                          {format(
                            new Date(selectedRequest.updated_at),
                            "MMM dd, yyyy h:mm a"
                          )}
                        </span>
                      </p>
                    </div>
                  )}

                {selectedRequest && canCurrentUserActOnRequest(selectedRequest) && (
                  <div className="space-y-2">
                    <Label htmlFor="rejection-reason">Rejection reason</Label>
                    <textarea
                      id="rejection-reason"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Add an optional reason for rejection"
                      className="min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>
                )}
              </div>
            )}
            <DialogFooter className="flex flex-wrap justify-between gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setSelectedRequest(null);
                  setRejectionReason("");
                }}
              >
                Close
              </Button>
              {selectedRequest && canActOnFailureToLog && canCurrentUserActOnRequest(selectedRequest) && (
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (!selectedRequest) return;
                      handleReject(selectedRequest.id);
                    }}
                  >
                    <Icon name="X" size={IconSizes.sm} />
                    Reject
                  </Button>
                  <Button
                    onClick={() => {
                      if (!selectedRequest) return;
                      handleApprove(selectedRequest.id);
                    }}
                    disabled={approveLoading}
                  >
                    <Icon name="Check" size={IconSizes.sm} />
                    {approveLoading ? "Processing..." : "Approve"}
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