"use client";

import { useState, useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { CardSection } from "@/components/ui/card-section";
import { H1, H3, BodySmall, Caption } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from "date-fns";
import { EmployeeAvatar } from "@/components/EmployeeAvatar";
import { isSchemaMissingTableOrRelationError } from "@/lib/postgrestSchema";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { MetricCard } from "@/components/ui/metric-card";
import {
  isHrFirstApproverPosition,
  normalizePositionName,
} from "@/lib/requestApprovalRouting";

interface LeaveDocument {
  id: string;
  leave_request_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
}

interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type:
    | "SIL"
    | "LWOP"
    | "Maternity Leave"
    | "Paternity Leave"
  start_date: string;
  end_date: string;
  selected_dates?: string[] | null;
  total_days: number;
  total_hours?: number | null;
  reason: string | null;
  status:
    | "pending"
    | "approved_by_manager"
    | "approved_by_hr"
    | "rejected"
    | "cancelled";
  rejection_reason: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  account_manager_id: string | null;
  account_manager_approved_at: string | null;
  account_manager_notes: string | null;
  hr_notes: string | null;
  hr_approved_by?: string | null;
  hr_approver_id?: string | null;
  hr_approved_at: string | null;
  created_at: string;
  employees: {
    employee_id: string;
    full_name: string;
    profile_picture_url?: string | null;
    sil_credits: number;
    positions?: { name: string | null } | null;
  };
  leave_request_documents?: LeaveDocument[];
}

export default function LeaveApprovalPage() {
  const supabase = createClient();
  const router = useRouter();
  const { isAdmin, role, isHR, loading: roleLoading } = useUserRole();
  const normalizedRole = role?.trim().toLowerCase() || "";
  const canManageLeave =
    isAdmin ||
    normalizedRole === "upper_management" ||
    isHR ||
    normalizedRole === "operations_manager";
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<
    { id: string; employee_id: string; full_name: string; last_name?: string | null; first_name?: string | null }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(
    null
  );
  const [rejectionReason, setRejectionReason] = useState("");
  const [notes, setNotes] = useState("");
  const [userRole, setUserRole] = useState<string>("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);
  const [approverNames, setApproverNames] = useState<Record<string, string>>(
    {}
  );
  const [hrApproverNames, setHrApproverNames] = useState<
    Record<string, string>
  >({});
  const [rejectedByNames, setRejectedByNames] = useState<
    Record<string, string>
  >({});

  const getRequestPositionName = (request: LeaveRequest): string =>
    normalizePositionName(request.employees?.positions?.name);

  const getApprovalLevel = (
    request: LeaveRequest
  ): "manager" | "hr" | null => {
    const isHrFirst = isHrFirstApproverPosition(getRequestPositionName(request));

    if (request.status === "approved_by_manager") {
      return normalizedRole === "hr" || isAdmin || normalizedRole === "upper_management"
        ? "hr"
        : null;
    }

    if (request.status !== "pending") return null;
    if (isAdmin || normalizedRole === "upper_management") {
      return isHrFirst ? "hr" : "manager";
    }
    if (normalizedRole === "operations_manager") {
      return isHrFirst ? null : "manager";
    }
    if (normalizedRole === "hr") {
      return isHrFirst ? "hr" : null;
    }
    return null;
  };

  const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(selectedWeek, { weekStartsOn: 1 }); // Sunday

  const base64ToBlob = (base64: string, type: string) => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type });
  };

  useEffect(() => {
    fetchUserRole();
  }, []);

  useEffect(() => {
    if (canManageLeave) {
      loadEmployees();
    }
  }, [canManageLeave, isAdmin, isHR, normalizedRole]);

  async function loadEmployees() {
    if (!canManageLeave) {
      setEmployees([]);
      return;
    }
    const { data, error } = await supabase
      .from("employees")
      .select("id, employee_id, full_name, last_name, first_name, positions:position_id ( name )")
      .order("last_name", { ascending: true, nullsFirst: false })
      .order("first_name", { ascending: true, nullsFirst: false });

    if (error) {
      console.error("Failed to load employees", error);
      return;
    }

    const filteredEmployees = (data || []).filter((employee: any) => {
      if (isAdmin || normalizedRole === "upper_management" || isHR) {
        return true;
      }
      if (normalizedRole === "operations_manager") {
        return !isHrFirstApproverPosition(employee.positions?.name);
      }
      return false;
    });

    setEmployees(filteredEmployees);
  }

  async function fetchUserRole() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      console.log("No user found");
      return;
    }

    setCurrentUserId(user.id);

    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("Error fetching user role:", error);
      return;
    }

    if (data) {
      setUserRole((data as { role: string }).role);
    }
  }

  async function fetchRequests() {
    if (!normalizedRole) {
      return;
    }

    setLoading(true);

    // Ensure weekEnd includes the full day
    const weekEndInclusive = new Date(weekEnd);
    weekEndInclusive.setHours(23, 59, 59, 999);

    const weekStartStr = format(weekStart, "yyyy-MM-dd");
    const weekEndStr = format(weekEndInclusive, "yyyy-MM-dd");

    let query = supabase
      .from("leave_requests")
      .select(
        `
        *,
        employees (
          employee_id,
          full_name,
          profile_picture_url,
          sil_credits,
          positions:position_id (
            name
          )
        )
      `
      )
      // Filter by week - leave request overlaps with week if:
      // start_date <= weekEnd AND end_date >= weekStart
      .lte("start_date", weekEndStr)
      .gte("end_date", weekStartStr)
      .order("created_at", { ascending: false });

    // HR can see all requests (pending, approved_by_manager, approved_by_hr, rejected)
    // Admin can see all requests (no filtering)
    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }
    // Admin and HR see all requests regardless of status (no filtering)

    if (selectedEmployee !== "all") {
      query = query.eq("employee_id", selectedEmployee);
    }

    const { data, error } = await query;

    setLoading(false);

    if (error) {
      console.error("Error fetching leave requests:", error);
      toast.error("Failed to load requests");
      return;
    }

    if (!data) {
      setRequests([]);
      return;
    }

    let filteredData = data;
    if (!isAdmin && normalizedRole !== "upper_management") {
      filteredData = data.filter((request: any) => {
        const isHrFirst = isHrFirstApproverPosition(
          request.employees?.positions?.name
        );

        if (normalizedRole === "operations_manager") {
          return !isHrFirst;
        }
        if (normalizedRole === "hr") {
          return request.status === "pending" ? isHrFirst : true;
        }
        return false;
      });
    }

    const requestsData = filteredData as any[];

    // Load supporting documents separately to avoid relying on DB FK metadata
    // for nested selects (which may be missing in schema cache).
    let docsByRequestId: Record<string, LeaveDocument[]> = {};
    if (requestsData.length > 0) {
      const requestIds = requestsData.map((r) => r.id);
      const { data: docs, error: docsError } = await supabase
        .from("leave_request_documents")
        .select("id, leave_request_id, file_name, file_type, file_size")
        .in("leave_request_id", requestIds);

      if (!docsError && docs) {
        docsByRequestId = (docs as LeaveDocument[]).reduce(
          (acc, doc) => {
            if (!acc[doc.leave_request_id]) acc[doc.leave_request_id] = [];
            acc[doc.leave_request_id].push(doc);
            return acc;
          },
          {} as Record<string, LeaveDocument[]>
        );
      } else if (
        docsError &&
        !isSchemaMissingTableOrRelationError(docsError)
      ) {
        console.error("Error fetching leave request documents:", docsError);
      }
    }

    const cleaned = (requestsData || []).filter(
      (r) => r.status !== "cancelled"
    );
    const withDocs = cleaned.map((r: any) => ({
      ...r,
      leave_request_documents: docsByRequestId[r.id] || [],
    }));
    setRequests(withDocs as any);

    // Load manager names for approved items
    const managerIds = Array.from(
      new Set(
        cleaned
          .map((r) => r.account_manager_id)
          .filter((id): id is string => Boolean(id))
      )
    );
    if (managerIds.length > 0) {
      loadApproverNames(managerIds);
    }

    // Load HR approver names when available
    const hrIds = Array.from(
      new Set(
        cleaned
          .map((r) => r.hr_approver_id)
          .filter((id): id is string => Boolean(id))
      )
    );
    if (hrIds.length > 0) {
      loadHrApproverNames(hrIds);
    }

    // Load rejected_by names when available
    const rejectedIds = Array.from(
      new Set(
        cleaned
          .map((r) => r.rejected_by)
          .filter((id): id is string => Boolean(id))
      )
    );
    if (rejectedIds.length > 0) {
      loadRejectedByNames(rejectedIds);
    }
  }

  async function loadApproverNames(ids: string[]) {
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

  async function loadHrApproverNames(ids: string[]) {
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

      setHrApproverNames((prev) => {
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

    setHrApproverNames((prev) => {
      const next = { ...prev };
      employeesArray.forEach((row) => {
        next[row.id] = row.full_name || row.email || row.id;
      });
      return next;
    });
  }

  async function loadRejectedByNames(ids: string[]) {
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

      setRejectedByNames((prev) => {
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

    setRejectedByNames((prev) => {
      const next = { ...prev };
      employeesArray.forEach((row) => {
        next[row.id] = row.full_name || row.email || row.id;
      });
      return next;
    });
  }

  async function downloadDocument(docId: string) {
    setDownloadingDocId(docId);
    const { data, error } = await supabase
      .from("leave_request_documents")
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

  async function handleApprove(request: LeaveRequest, level: "manager" | "hr") {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const isHrFirst = isHrFirstApproverPosition(getRequestPositionName(request));

    if (
      level === "hr" &&
      request.status !== "approved_by_manager" &&
      !(request.status === "pending" && isHrFirst)
    ) {
      toast.error("Approval workflow error", {
        description: "HR can only approve eligible pending requests or those already approved by Operations Manager",
      });
      return;
    }

    if (level === "manager" && (request.status !== "pending" || isHrFirst)) {
      toast.error("Invalid request status", {
        description: "Operations Manager can only approve pending requests outside the HR-first positions",
      });
      return;
    }

    const now = new Date().toISOString();
    let finalError = null;

    if (level === "manager") {
      const patch: Record<string, unknown> = {
        status: "approved_by_manager",
        account_manager_id: user.id,
        account_manager_approved_at: now,
      };
      if (notes.trim()) {
        patch.account_manager_notes = notes.trim();
      }
      const { error } = await supabase
        .from("leave_requests")
        .update(patch)
        .eq("id", request.id)
        .eq("status", "pending");
      finalError = error;
    } else {
      const patch: Record<string, unknown> = {
        status: "approved_by_hr",
        hr_approved_by: user.id,
        hr_approved_at: now,
      };
      if (notes.trim()) {
        patch.hr_notes = notes.trim();
      }
      const { error } = await supabase
        .from("leave_requests")
        .update(patch)
        .eq("id", request.id)
        .eq("status", request.status);
      finalError = error;
    }

    if (finalError) {
      console.error("Error approving request:", finalError);
      toast.error("Failed to approve leave request", {
        description: finalError.message || "An error occurred while approving the request",
      });
      return;
    }

    const employeeName = request.employees?.full_name || "Employee";
    toast.success(
      `Leave request ${level === "manager" ? "approved by Operations Manager" : "approved by HR"}!`,
      {
        description: `${employeeName}'s ${request.leave_type} request for ${
          request.total_days || 0
        } day(s) has been ${
          level === "manager" ? "approved. Awaiting HR approval." : "fully approved."
        }`,
      }
    );
    fetchRequests();
    setSelectedRequest(null);
    setNotes("");
  }

  async function handleReject(requestId: string) {
    if (!rejectionReason.trim()) {
      toast.error("Rejection reason required", {
        description: "Please provide a reason for rejecting this leave request",
      });
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
    const { error: finalError } = await supabase
      .from("leave_requests")
      .update({
        status: "rejected",
        rejection_reason: rejectionReason.trim(),
        rejected_by: user.id,
        rejected_at: now,
      })
      .eq("id", requestId);

    if (finalError) {
      console.error("Error rejecting request:", finalError);
      toast.error("Failed to reject leave request", {
        description: finalError.message || "An error occurred while rejecting the request",
      });
      return;
    }

    toast.success("Leave request rejected", {
      description: `${employeeName}'s ${request?.leave_type || "leave"} request has been declined`,
    });
    fetchRequests();
    setSelectedRequest(null);
    setRejectionReason("");
  }

  // This useEffect must be called before any conditional returns (React hooks rule)
  useEffect(() => {
    if (!normalizedRole || !canManageLeave) return;
    fetchRequests();
  }, [statusFilter, normalizedRole, selectedWeek, selectedEmployee, canManageLeave, isAdmin, isHR]);

  // Show loading state while checking role
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

  if (!canManageLeave) {
    return (
      <DashboardLayout>
        <VStack gap="4" className="p-8">
          <BodySmall>
            Only Admin, Upper Management, HR, and Operations Managers can access leave approvals.
          </BodySmall>
        </VStack>
      </DashboardLayout>
    );
  }

  const stats = {
    total: requests.length,
    pending: requests.filter((r) => r.status === "pending").length,
    approvedByManager: requests.filter(
      (r) => r.status === "approved_by_manager"
    ).length,
    approvedByHR: requests.filter((r) => r.status === "approved_by_hr").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
  };

  const canApprove = (request: LeaveRequest): boolean => {
    return getApprovalLevel(request) !== null;
  };

  return (
    <DashboardLayout>
      <VStack gap="8" className="w-full pb-24">
        <VStack gap="2" align="start">
          <H1>Leave approvals</H1>
          <BodySmall>
            Review leave filings, filter by employee and week, and act on pending requests.
          </BodySmall>
        </VStack>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 w-full items-stretch">
          <MetricCard label="Total" value={stats.total} />
          <MetricCard label="Pending" value={stats.pending} />
          <MetricCard label="Manager approved" value={stats.approvedByManager} />
          <MetricCard label="HR approved" value={stats.approvedByHR} />
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
                    <option value="approved_by_manager">
                      Approved by Manager
                    </option>
                    <option value="approved_by_hr">Approved by HR</option>
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
                  name="CalendarBlank"
                  size={IconSizes.xl}
                  className="text-muted-foreground"
                />
                <BodySmall>No requests found</BodySmall>
              </VStack>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {requests.map((request) => (
              <Card
                key={request.id}
                className="border-muted/60 transition-shadow hover:shadow-hover h-full min-h-[220px] cursor-pointer"
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
                          fullName={request.employees?.full_name || "Unknown"}
                          size="sm"
                        />
                        <span className="font-bold text-lg">
                          {request.employees?.full_name || "Unknown"}
                        </span>
                        <Caption>({request.employees?.employee_id})</Caption>
                        <Badge
                          variant={
                            request.leave_type === "SIL"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {request.leave_type}
                        </Badge>
                      </HStack>
                      <HStack
                        gap="4"
                        align="center"
                        className="text-sm text-muted-foreground mb-2 flex-wrap"
                      >
                        <HStack gap="1" align="center">
                          <Icon name="CalendarBlank" size={IconSizes.sm} />
                          {request.selected_dates &&
                          request.selected_dates.length > 0 ? (
                            // Show individual dates if available
                            request.selected_dates.length === 1 ? (
                              format(
                                new Date(request.selected_dates[0]),
                                "MMM dd, yyyy"
                              )
                            ) : (
                              `${
                                request.selected_dates.length
                              } dates: ${request.selected_dates
                                .slice(0, 3)
                                .map((d) => format(new Date(d), "MMM dd"))
                                .join(", ")}${
                                request.selected_dates.length > 3 ? "..." : ""
                              }`
                            )
                          ) : (
                            // Fallback to date range
                            <>
                              {format(new Date(request.start_date), "MMM dd")} -{" "}
                              {format(
                                new Date(request.end_date),
                                "MMM dd, yyyy"
                              )}
                            </>
                          )}
                        </HStack>
                        <span className="font-semibold text-emerald-600">
                          {request.total_days}{" "}
                          {request.total_days === 1 ? "day" : "days"}
                        </span>
                        {request.leave_type === "SIL" && request.employees && (
                          <Caption>
                            Available SIL Credits: {request.employees.sil_credits} (Allotted: 5)
                          </Caption>
                        )}
                      </HStack>
                      {request.reason && (
                        <BodySmall className="mt-2">
                          <strong>Reason:</strong> {request.reason}
                        </BodySmall>
                      )}
                      {(request.account_manager_id ||
                        request.hr_approver_id ||
                        request.rejected_by) && (
                        <VStack
                          gap="1"
                          align="start"
                          className="text-xs text-gray-600 mt-2"
                        >
                          {/* Account Manager Stage */}
                          {request.account_manager_id && (
                            <Caption>
                              Approved by Manager:{" "}
                              {approverNames[request.account_manager_id] ||
                                "Manager"}
                              {request.account_manager_approved_at &&
                                ` on ${format(new Date(request.account_manager_approved_at), "MMM dd, yyyy h:mm a")}`}
                            </Caption>
                          )}
                          {request.status === "rejected" &&
                            request.rejected_by &&
                            !request.account_manager_id && (
                              <Caption className="text-red-600">
                                Rejected by Manager:{" "}
                                {rejectedByNames[request.rejected_by] ||
                                  "Manager"}
                                {request.rejected_at &&
                                  ` on ${format(new Date(request.rejected_at), "MMM dd, yyyy h:mm a")}`}
                                {request.rejection_reason &&
                                  ` - ${request.rejection_reason}`}
                              </Caption>
                            )}

                          {/* HR Stage */}
                          {request.status === "rejected" &&
                            request.rejected_by &&
                            request.account_manager_id && (
                              <Caption className="text-red-600">
                                Rejected by HR:{" "}
                                {rejectedByNames[request.rejected_by] || "HR"}
                                {request.rejected_at &&
                                  ` on ${format(new Date(request.rejected_at), "MMM dd, yyyy h:mm a")}`}
                                {request.rejection_reason &&
                                  ` - ${request.rejection_reason}`}
                              </Caption>
                            )}
                          {request.status !== "rejected" &&
                            (request.hr_approver_id || request.hr_approved_by) && (
                              <Caption>
                                Approved by HR:{" "}
                                {hrApproverNames[request.hr_approver_id || request.hr_approved_by!] ||
                                  "HR"}
                                {request.hr_approved_at &&
                                  ` on ${format(new Date(request.hr_approved_at), "MMM dd, yyyy h:mm a")}`}
                              </Caption>
                            )}
                        </VStack>
                      )}
                    </div>
                    <Badge
                      variant={
                        request.status === "pending"
                          ? "secondary"
                          : request.status === "approved_by_hr"
                          ? "default"
                          : request.status === "rejected"
                          ? "destructive"
                          : "default"
                      }
                      className={
                        request.status === "approved_by_manager"
                          ? "bg-blue-100 text-blue-900 border-blue-200"
                          : ""
                      }
                    >
                      {request.status === "pending"
                        ? "PENDING"
                        : request.status === "approved_by_manager"
                        ? "APPROVED BY MANAGER"
                        : request.status === "approved_by_hr"
                        ? "APPROVED"
                        : request.status === "rejected"
                        ? "REJECTED"
                        : "CANCELLED"}
                    </Badge>
                  </HStack>
                  {canApprove(request) && (
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
                          setSelectedRequest(request);
                          setRejectionReason("");
                          setNotes("");
                        }}
                      >
                        <Icon name="X" size={IconSizes.sm} />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          const approvalLevel = getApprovalLevel(request);
                          if (!approvalLevel) return;
                          handleApprove(request, approvalLevel);
                        }}
                      >
                        <Icon name="Check" size={IconSizes.sm} />
                        {getApprovalLevel(request) === "manager"
                          ? "Approve (Operations Manager)"
                          : "Approve (HR)"}
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
              setNotes("");
            }
          }}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            {selectedRequest && (
              <>
                <DialogHeader>
                  <DialogTitle>Leave Request Details</DialogTitle>
                </DialogHeader>
                <VStack gap="4" className="py-2 w-full">
                  <VStack gap="1" align="start">
                    <BodySmall>Employee</BodySmall>
                    <HStack gap="3" align="center">
                      <EmployeeAvatar
                        profilePictureUrl={
                          selectedRequest.employees?.profile_picture_url
                        }
                        fullName={
                          selectedRequest.employees?.full_name || "Unknown"
                        }
                        size="lg"
                      />
                      <H3>
                        {selectedRequest.employees?.full_name} (
                        {selectedRequest.employees?.employee_id})
                      </H3>
                    </HStack>
                  </VStack>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">
                        Leave Type
                      </div>
                      <div
                        className={`font-semibold px-2 py-1 rounded inline-block ${
                          selectedRequest.leave_type === "SIL"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-orange-100 text-orange-800"
                        }`}
                      >
                        {selectedRequest.leave_type}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">
                        Total Days
                      </div>
                      <div className="font-semibold text-emerald-600">
                        {selectedRequest.total_days}{" "}
                        {selectedRequest.total_days === 1 ? "day" : "days"}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-muted-foreground">
                      Date Range
                    </div>
                    <div className="font-semibold">
                      {format(
                        new Date(selectedRequest.start_date),
                        "MMMM dd, yyyy"
                      )}{" "}
                      -{" "}
                      {format(
                        new Date(selectedRequest.end_date),
                        "MMMM dd, yyyy"
                      )}
                    </div>
                  </div>

                  {selectedRequest.leave_type === "SIL" &&
                    selectedRequest.employees && (
                      <div className="space-y-2">
                        <div>
                          <div className="text-sm text-muted-foreground">
                            Allotted SIL Credits
                          </div>
                          <div className="font-semibold text-gray-900">
                            5 credits
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">
                            Available SIL Credits
                          </div>
                          <div
                            className={`font-semibold ${
                              selectedRequest.employees.sil_credits >=
                              selectedRequest.total_days
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {selectedRequest.employees.sil_credits} credits
                            {selectedRequest.employees.sil_credits <
                              selectedRequest.total_days && (
                              <span className="text-red-600 ml-2">
                                (Insufficient)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}


                  {selectedRequest.reason && (
                    <div className="space-y-2">
                      <Label className="text-sm">Reason</Label>
                      <p className="rounded-md border border-dashed border-muted bg-muted/40 p-3 text-sm text-muted-foreground">
                        {selectedRequest.reason}
                      </p>
                    </div>
                  )}

                  {selectedRequest.leave_type === "SIL" && (
                    <VStack gap="2" align="start">
                      <HStack gap="2" align="center">
                        <Icon name="Receipt" size={IconSizes.sm} />
                        <BodySmall>Supporting Document</BodySmall>
                      </HStack>
                      {selectedRequest.leave_request_documents &&
                      selectedRequest.leave_request_documents.length > 0 ? (
                        <VStack gap="2">
                          {selectedRequest.leave_request_documents.map(
                            (doc) => (
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
                                <Caption>
                                  {(doc.file_size / 1024).toFixed(1)} KB
                                </Caption>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => downloadDocument(doc.id)}
                                  disabled={downloadingDocId === doc.id}
                                >
                                  <Icon
                                    name="ArrowsClockwise"
                                    size={IconSizes.sm}
                                  />
                                  View
                                </Button>
                              </HStack>
                            )
                          )}
                        </VStack>
                      ) : (
                        <BodySmall>No supporting document attached.</BodySmall>
                      )}
                    </VStack>
                  )}

                  {selectedRequest.account_manager_notes && (
                    <div>
                      <div className="text-sm text-muted-foreground">
                        Manager Notes
                      </div>
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                        {selectedRequest.account_manager_notes}
                      </div>
                    </div>
                  )}

                  {selectedRequest.hr_notes && (
                    <div>
                      <div className="text-sm text-muted-foreground">
                        HR Notes
                      </div>
                      <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                        {selectedRequest.hr_notes}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="text-sm text-muted-foreground">
                      Submitted
                    </div>
                    <div className="text-sm">
                      {format(
                        new Date(selectedRequest.created_at),
                        "MMMM dd, yyyy h:mm a"
                      )}
                    </div>
                  </div>

                  {(selectedRequest.account_manager_approved_at ||
                    selectedRequest.hr_approved_at ||
                    selectedRequest.rejected_at) && (
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">
                        Approval / Rejection
                      </div>
                      <div className="space-y-1 text-sm">
                        {selectedRequest.account_manager_approved_at && (
                          <div>
                            Approved by Manager on{" "}
                            {format(
                              new Date(selectedRequest.account_manager_approved_at),
                              "MMM dd, yyyy h:mm a"
                            )}
                          </div>
                        )}
                        {selectedRequest.hr_approved_at && (
                          <div>
                            Approved by HR on{" "}
                            {format(
                              new Date(selectedRequest.hr_approved_at),
                              "MMM dd, yyyy h:mm a"
                            )}
                          </div>
                        )}
                        {selectedRequest.rejected_at && (
                          <div className="text-red-600">
                            Rejected on{" "}
                            {format(
                              new Date(selectedRequest.rejected_at),
                              "MMM dd, yyyy h:mm a"
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedRequest.status === "rejected" &&
                    selectedRequest.rejection_reason && (
                      <div>
                        <div className="text-sm text-muted-foreground">
                          Rejection Reason
                        </div>
                        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-900">
                          {selectedRequest.rejection_reason}
                        </div>
                      </div>
                    )}

                  {/* Actions */}
                  {canApprove(selectedRequest) ? (
                    <div className="space-y-6 pt-4 border-t w-full">
                      <div className="space-y-4 w-full">
                        <div className="space-y-2 w-full">
                          <Label htmlFor="notes">Notes (optional)</Label>
                          <Textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Add notes about this approval..."
                            rows={3}
                            className="w-full"
                          />
                        </div>

                        <div className="space-y-2 w-full">
                          <Label htmlFor="rejection-reason">
                            Rejection Reason (if rejecting)
                          </Label>
                          <Textarea
                            id="rejection-reason"
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            placeholder="Provide reason for rejection..."
                            rows={3}
                            className="w-full"
                          />
                        </div>
                      </div>

                      <DialogFooter className="pt-4">
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setSelectedRequest(null);
                            setRejectionReason("");
                            setNotes("");
                          }}
                        >
                          Close
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => handleReject(selectedRequest.id)}
                          disabled={!rejectionReason.trim()}
                        >
                          <Icon name="X" size={IconSizes.sm} />
                          Reject
                        </Button>
                        <Button
                          onClick={() => {
                            const approvalLevel = getApprovalLevel(selectedRequest);
                            if (!approvalLevel) return;
                            handleApprove(selectedRequest, approvalLevel);
                          }}
                        >
                          <Icon name="Check" size={IconSizes.sm} />
                          {getApprovalLevel(selectedRequest) === "manager"
                            ? "Approve (Operations Manager)"
                            : "Approve (HR)"}
                        </Button>
                      </DialogFooter>
                    </div>
                  ) : (
                    <DialogFooter className="pt-2">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setSelectedRequest(null);
                          setRejectionReason("");
                          setNotes("");
                        }}
                      >
                        Close
                      </Button>
                    </DialogFooter>
                  )}
                </VStack>
              </>
            )}
          </DialogContent>
        </Dialog>
      </VStack>
    </DashboardLayout>
  );
}