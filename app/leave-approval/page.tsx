"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
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
    | "Off-setting";
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
  account_manager_id: string | null;
  account_manager_notes: string | null;
  hr_notes: string | null;
  hr_approver_id?: string | null;
  created_at: string;
  employees: {
    employee_id: string;
    full_name: string;
    profile_picture_url?: string | null;
    sil_credits: number;
    offset_hours?: number | null;
  };
  leave_request_documents?: LeaveDocument[];
}

export default function LeaveApprovalPage() {
  const supabase = createClient();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<
    { id: string; employee_id: string; full_name: string }[]
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
    loadEmployees();
  }, []);

  async function loadEmployees() {
    const { data, error } = await supabase
      .from("employees")
      .select("id, employee_id, full_name")
      .order("full_name", { ascending: true });

    if (error) {
      console.error("Failed to load employees", error);
      return;
    }

    setEmployees(data || []);
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

    // Try using the RPC function first (bypasses RLS)
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "get_user_role"
    );

    if (!rpcError && rpcData !== null && rpcData !== undefined) {
      console.log("User role fetched via RPC:", rpcData);
      setUserRole(rpcData as string);
      return;
    }

    console.log(
      "RPC failed, trying direct query. RPC error:",
      rpcError,
      "RPC data:",
      rpcData
    );

    // Fallback to direct query
    const { data, error } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("Error fetching user role:", error);
      return;
    }

    if (data) {
      console.log("User role fetched via query:", data.role);
      setUserRole(data.role);
    } else {
      console.log("No role data found");
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
          offset_hours
        ),
        leave_request_documents (
          id,
          file_name,
          file_type,
          file_size
        )
      `
      )
      // Filter by week - leave request overlaps with week if:
      // start_date <= weekEnd AND end_date >= weekStart
      .lte("start_date", weekEndStr)
      .gte("end_date", weekStartStr)
      .order("created_at", { ascending: false });

    // HR should only see requests that have already passed manager review
    const hrVisibleStatuses = [
      "approved_by_manager",
      "approved_by_hr",
      "rejected",
      "cancelled",
    ];

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    } else if (normalizedRole === "hr") {
      query = query.in("status", hrVisibleStatuses);
    }

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

    const cleaned = (data || []).filter((r) => r.status !== "cancelled");
    setRequests(cleaned);

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
    // Primary: users table (auth profiles), fallback: employees
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, full_name, email")
      .in("id", ids);

    if (userData && !userError) {
      setApproverNames((prev) => {
        const next = { ...prev };
        userData.forEach((row) => {
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

    setApproverNames((prev) => {
      const next = { ...prev };
      empData.forEach((row) => {
        next[row.id] = row.full_name || row.email || row.id;
      });
      return next;
    });
  }

  async function loadHrApproverNames(ids: string[]) {
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, full_name, email")
      .in("id", ids);

    if (userData && !userError) {
      setHrApproverNames((prev) => {
        const next = { ...prev };
        userData.forEach((row) => {
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

    setHrApproverNames((prev) => {
      const next = { ...prev };
      empData.forEach((row) => {
        next[row.id] = row.full_name || row.email || row.id;
      });
      return next;
    });
  }

  async function loadRejectedByNames(ids: string[]) {
    // Primary: users table (auth profiles), fallback: employees
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, full_name, email")
      .in("id", ids);

    if (userData && !userError) {
      setRejectedByNames((prev) => {
        const next = { ...prev };
        userData.forEach((row) => {
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

    setRejectedByNames((prev) => {
      const next = { ...prev };
      empData.forEach((row) => {
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

    if (error || !data) {
      console.error("Error fetching document:", error);
      toast.error("Unable to fetch document");
      return;
    }

    const blob = base64ToBlob(
      data.file_base64,
      data.file_type || "application/octet-stream"
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = data.file_name || "document";
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

    if (request.leave_type === "Off-setting") {
      const requestedHours = Number(request.total_hours || 0);
      const availableHours = Number(request.employees?.offset_hours || 0);
      if (requestedHours > availableHours) {
        toast.error(
          `Requested Off-setting (${requestedHours.toFixed(
            2
          )} hrs) exceeds available credits (${availableHours.toFixed(2)} hrs)`
        );
        return;
      }
    }

    if (level === "hr" && request.status !== "approved_by_manager") {
      toast.error("HR approval requires manager approval first");
      return;
    }

    const updateData: any = {
      account_manager_notes: notes.trim() || null,
    };

    if (level === "manager") {
      updateData.status = "approved_by_manager";
      updateData.account_manager_id = user.id;
      updateData.account_manager_approved_at = new Date().toISOString();
    } else {
      updateData.status = "approved_by_hr";
      updateData.hr_approved_by = user.id;
      updateData.hr_approved_at = new Date().toISOString();
      updateData.hr_notes = notes.trim() || null;
    }

    const { error } = await supabase
      .from("leave_requests")
      .update(updateData)
      .eq("id", request.id);

    if (error) {
      console.error("Error approving request:", error);
      toast.error("Failed to approve request");
      return;
    }

    // Deduct SIL credits on HR approval
    if (
      level === "hr" &&
      request.leave_type === "SIL" &&
      request.employees &&
      typeof request.employees.sil_credits === "number"
    ) {
      const remaining = Math.max(
        0,
        request.employees.sil_credits - (request.total_days || 0)
      );
      const { error: creditError } = await supabase
        .from("employees")
        .update({ sil_credits: remaining })
        .eq("id", request.employee_id);

      if (creditError) {
        console.error("Error deducting SIL credits:", creditError);
        toast.error("Approved but failed to deduct SIL credits");
        // continue, since approval succeeded
      }
    }

    toast.success(
      `Leave request ${
        level === "manager" ? "approved by manager" : "approved by HR"
      }!`,
      {
        description: `${request.leave_type} • ${
          request.total_days || 0
        } day(s)`,
      }
    );
    fetchRequests();
    setSelectedRequest(null);
    setNotes("");
  }

  async function handleReject(requestId: string) {
    if (!rejectionReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("leave_requests")
      .update({
        status: "rejected",
        rejection_reason: rejectionReason.trim(),
        rejected_by: user.id,
        rejected_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (error) {
      console.error("Error rejecting request:", error);
      toast.error("Failed to reject request");
      return;
    }

    toast.success("Leave request rejected", {
      description: "The request has been declined",
    });
    fetchRequests();
    setSelectedRequest(null);
    setRejectionReason("");
  }

  const normalizedRole = userRole?.trim().toLowerCase() || "";

  useEffect(() => {
    if (!normalizedRole) return;
    fetchRequests();
  }, [statusFilter, normalizedRole, selectedWeek, selectedEmployee]);

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
    // Don't show buttons until user role is loaded
    if (!normalizedRole) {
      console.log("canApprove: userRole not loaded yet");
      return false;
    }

    if (normalizedRole === "account_manager") {
      // Account managers approve pending requests
      const canApproveResult = request.status === "pending";
      console.log("canApprove (account_manager on pending):", {
        status: request.status,
        canApprove: canApproveResult,
      });
      return canApproveResult;
    }
    if (normalizedRole === "hr" || normalizedRole === "admin") {
      // HR/Admin approve only after manager approval
      const canApproveResult = request.status === "approved_by_manager";
      console.log("canApprove (hr/admin on approved_by_manager):", {
        status: request.status,
        canApprove: canApproveResult,
      });
      return canApproveResult;
    }
    console.log(
      "canApprove: userRole does not match any condition:",
      normalizedRole
    );
    return false;
  };

  return (
    <DashboardLayout>
      <VStack gap="8" className="w-full pb-24">
        {/* Header */}
        <VStack gap="2" align="start">
          <H1>Leave Approval</H1>
          <BodySmall>
            Review and approve employee leave requests (SIL/LWOP)
          </BodySmall>
          {/* Debug info - remove after testing */}
          {process.env.NODE_ENV === "development" && (
            <Caption>
              Debug: User Role = {userRole || "loading..."}, User ID ={" "}
              {currentUserId
                ? currentUserId.substring(0, 8) + "..."
                : "loading..."}
            </Caption>
          )}
        </VStack>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 w-full items-stretch">
          <Card className="h-full w-full">
            <CardContent className="p-4 h-full flex flex-col w-full">
              <VStack gap="1" align="start" className="flex-1 w-full">
                <BodySmall>Total Requests</BodySmall>
                <div className="text-2xl font-bold">{stats.total}</div>
              </VStack>
            </CardContent>
          </Card>
          <Card className="h-full w-full">
            <CardContent className="p-4 h-full flex flex-col w-full">
              <VStack gap="1" align="start" className="flex-1 w-full">
                <BodySmall>Pending</BodySmall>
                <div className="text-2xl font-bold text-yellow-600">
                  {stats.pending}
                </div>
              </VStack>
            </CardContent>
          </Card>
          <Card className="h-full w-full">
            <CardContent className="p-4 h-full flex flex-col w-full">
              <VStack gap="1" align="start" className="flex-1 w-full">
                <BodySmall>Approved by Manager</BodySmall>
                <div className="text-2xl font-bold text-blue-600">
                  {stats.approvedByManager}
                </div>
              </VStack>
            </CardContent>
          </Card>
          <Card className="h-full w-full">
            <CardContent className="p-4 h-full flex flex-col w-full">
              <VStack gap="1" align="start" className="flex-1 w-full">
                <BodySmall>Approved by HR</BodySmall>
                <div className="text-2xl font-bold text-green-600">
                  {stats.approvedByHR}
                </div>
              </VStack>
            </CardContent>
          </Card>
          <Card className="h-full w-full">
            <CardContent className="p-4 h-full flex flex-col w-full">
              <VStack gap="1" align="start" className="flex-1 w-full">
                <BodySmall>Rejected</BodySmall>
                <div className="text-2xl font-bold text-red-600">
                  {stats.rejected}
                </div>
              </VStack>
            </CardContent>
          </Card>
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
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Icon
                    name="MagnifyingGlass"
                    size={IconSizes.sm}
                    className="text-muted-foreground flex-shrink-0 hidden sm:block"
                  />
                  <select
                    value={selectedEmployee}
                    onChange={(e) => setSelectedEmployee(e.target.value)}
                    className="flex h-10 w-full sm:w-[200px] lg:w-[240px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="all">All Employees</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.full_name} ({employee.employee_id})
                      </option>
                    ))}
                  </select>
                </div>
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
                        {request.leave_type === "Off-setting" ? (
                          <span className="font-semibold text-emerald-600">
                            {request.total_hours ?? 0} hours
                          </span>
                        ) : (
                          <span className="font-semibold text-emerald-600">
                            {request.total_days}{" "}
                            {request.total_days === 1 ? "day" : "days"}
                          </span>
                        )}
                        {request.leave_type === "SIL" && request.employees && (
                          <Caption>
                            Available Credits: {request.employees.sil_credits}
                          </Caption>
                        )}
                        {request.leave_type === "Off-setting" &&
                          typeof request.employees?.offset_hours ===
                            "number" && (
                            <Caption
                              className={
                                (request.total_hours || 0) >
                                (request.employees?.offset_hours || 0)
                                  ? "text-red-600 font-semibold"
                                  : ""
                              }
                            >
                              Available Off-setting Hours:{" "}
                              {request.employees.offset_hours?.toFixed(2)}
                              {(request.total_hours || 0) >
                                (request.employees?.offset_hours || 0) && (
                                <span className="ml-1">
                                  (request exceeds credits)
                                </span>
                              )}
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
                            </Caption>
                          )}
                          {request.status === "rejected" &&
                            request.rejected_by &&
                            !request.account_manager_id && (
                              <Caption className="text-red-600">
                                Rejected by Manager:{" "}
                                {rejectedByNames[request.rejected_by] ||
                                  "Manager"}
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
                                {request.rejection_reason &&
                                  ` - ${request.rejection_reason}`}
                              </Caption>
                            )}
                          {request.status !== "rejected" &&
                            request.hr_approver_id && (
                              <Caption>
                                Approved by HR:{" "}
                                {hrApproverNames[request.hr_approver_id] ||
                                  "HR"}
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
                          handleApprove(
                            request,
                            userRole === "account_manager" ? "manager" : "hr"
                          );
                        }}
                      >
                        <Icon name="Check" size={IconSizes.sm} />
                        {userRole === "account_manager"
                          ? "Approve"
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
                      {selectedRequest.leave_type === "Off-setting" ? (
                        <div className="font-semibold text-emerald-600">
                          {selectedRequest.total_hours ?? 0} hours
                        </div>
                      ) : (
                        <div className="font-semibold text-emerald-600">
                          {selectedRequest.total_days}{" "}
                          {selectedRequest.total_days === 1 ? "day" : "days"}
                        </div>
                      )}
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
                    )}

                  {selectedRequest.leave_type === "Off-setting" &&
                    selectedRequest.employees && (
                      <div>
                        <div className="text-sm text-muted-foreground">
                          Off-setting Credits Check
                        </div>
                        <div className="space-y-1">
                          <div className="font-semibold text-emerald-600">
                            Requested: {selectedRequest.total_hours ?? 0} hours
                          </div>
                          <div
                            className={`font-semibold ${
                              (selectedRequest.total_hours || 0) >
                              (selectedRequest.employees.offset_hours || 0)
                                ? "text-red-600"
                                : "text-green-600"
                            }`}
                          >
                            Available Credits:{" "}
                            {selectedRequest.employees.offset_hours?.toFixed(
                              2
                            ) ?? "0.00"}{" "}
                            hours
                            {(selectedRequest.total_hours || 0) >
                              (selectedRequest.employees.offset_hours || 0) && (
                              <HStack
                                gap="1"
                                align="center"
                                className="text-red-600 mt-1"
                              >
                                <Icon
                                  name="WarningCircle"
                                  size={IconSizes.sm}
                                />
                                Requested hours exceed available offset credits.
                              </HStack>
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
                          onClick={() =>
                            handleApprove(
                              selectedRequest,
                              userRole === "account_manager" ? "manager" : "hr"
                            )
                          }
                        >
                          <Icon name="Check" size={IconSizes.sm} />
                          {userRole === "account_manager"
                            ? "Approve (Manager)"
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
