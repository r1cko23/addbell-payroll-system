"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { useAssignedGroups } from "@/lib/hooks/useAssignedGroups";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from "date-fns";
import { toast } from "sonner";
import { EmployeeAvatar } from "@/components/EmployeeAvatar";

type OvertimeDocument = {
  id: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
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
  created_at: string;
  overtime_documents?: OvertimeDocument[];
  employees?: {
    full_name: string;
    employee_id: string;
    profile_picture_url?: string | null;
    overtime_group_id?: string | null;
    overtime_groups?: {
      id: string;
      name: string;
      approver_id: string | null;
      viewer_id: string | null;
    } | null;
  };
};

export default function OvertimeApprovalPage() {
  const supabase = createClient();
  const router = useRouter();
  const { isAdmin, role, isHR, isApprover, isViewer, isRestrictedAccess, loading: roleLoading } = useUserRole();
  const { groupIds: assignedGroupIds, loading: groupsLoading } = useAssignedGroups();

  // Check if HR user is a group approver (HR users need to be group approvers to approve OT)
  const isHRGroupApprover = isHR && assignedGroupIds.length > 0;

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
  const [approverNames, setApproverNames] = useState<Record<string, string>>(
    {}
  );

  // HR users also have approver permissions, so they can access this page
  // Allow approver, HR, and viewer roles

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

  async function downloadDocument(docId: string) {
    setDownloadingDocId(docId);
    const { data, error } = await supabase
      .from("overtime_documents")
      .select("file_base64, file_name, file_type")
      .eq("id", docId)
      .maybeSingle();

    setDownloadingDocId(null);

    if (error || !data) {
      console.error("Error fetching document:", error);
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

    let query = supabase
      .from("overtime_requests")
      .select(
        `
        *,
        employees (
          full_name,
          employee_id,
          profile_picture_url,
          overtime_group_id,
          overtime_groups (
            id,
            name,
            approver_id,
            viewer_id
          )
        ),
        overtime_documents (
          id,
          file_name,
          file_type,
          file_size
        )
      `
      )
      .gte("ot_date", weekStartStr)
      .lte("ot_date", weekEndStr)
      .order("created_at", { ascending: false });

    if (statusFilter !== "all") {
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

    // Filter by assigned groups AND individual approver assignments:
    // - Admin: See all (no filtering)
    // - HR: Always see all (bypass group filtering, even if assigned to groups)
    // - Approver/Viewer: Filter by assigned groups AND individual employee assignments
    let filteredData = data;
    if (!isAdmin && !isHR && data) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        filteredData = [];
      } else {
        // Get employee IDs where user is assigned as individual approver or viewer
        const { data: individualEmployees } = await supabase
          .from("employees")
          .select("id")
          .or(`overtime_approver_id.eq.${user.id},overtime_viewer_id.eq.${user.id}`);

        const individualEmployeeIds = new Set(
          (individualEmployees || []).map((e) => e.id)
        );

        console.log("Filtering requests for approver/viewer:", {
          totalRequests: data.length,
          assignedGroupIds: assignedGroupIds,
          individualEmployeeIds: Array.from(individualEmployeeIds),
          isAdmin: isAdmin,
          isHR: isHR,
        });

        filteredData = data.filter((req: any) => {
          // Handle both array and object formats for employees relationship
          let employeeGroupId = null;
          let employeeId = null;
          let employeeName = "Unknown";

          if (Array.isArray(req.employees)) {
            employeeGroupId = req.employees[0]?.overtime_group_id;
            employeeId = req.employees[0]?.id;
            employeeName = req.employees[0]?.full_name || "Unknown";
          } else if (req.employees) {
            employeeGroupId = req.employees.overtime_group_id;
            employeeId = req.employees.id;
            employeeName = req.employees.full_name || "Unknown";
          }

          // Check if employee is in assigned groups OR has user as individual approver/viewer
          const matchesGroup =
            employeeGroupId && assignedGroupIds.includes(employeeGroupId);
          const matchesIndividual =
            employeeId && individualEmployeeIds.has(employeeId);

          const matches = matchesGroup || matchesIndividual;

          if (!matches) {
            console.log(
              `Filtered out: ${employeeName} (group: ${employeeGroupId || "NULL"}, individual: ${matchesIndividual})`
            );
          }

          return matches;
        });

        console.log("Filtered requests:", {
          before: data.length,
          after: filteredData.length,
          filteredOut: data.length - filteredData.length,
        });
      }
    } else if (!isAdmin && !isHR && assignedGroupIds.length === 0) {
      // Check if user has individual assignments
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: individualEmployees } = await supabase
          .from("employees")
          .select("id")
          .or(`overtime_approver_id.eq.${user.id},overtime_viewer_id.eq.${user.id}`);

        if (!individualEmployees || individualEmployees.length === 0) {
          // Approver/viewer with no assigned groups and no individual assignments see nothing
          console.warn(
            "Approver/viewer has no assigned groups or individual assignments - showing no requests"
          );
          filteredData = [];
        } else {
          // Filter by individual assignments only
          const individualEmployeeIds = new Set(
            individualEmployees.map((e) => e.id)
          );
          filteredData = data.filter((req: any) => {
            let employeeId = null;
            if (Array.isArray(req.employees)) {
              employeeId = req.employees[0]?.id;
            } else if (req.employees) {
              employeeId = req.employees.id;
            }
            return employeeId && individualEmployeeIds.has(employeeId);
          });
        }
      } else {
        filteredData = [];
      }
    }
    // Admin and HR always see all (filteredData remains as data)

    console.log("OT Requests loaded:", {
      count: filteredData?.length || 0,
      dateRange: `${weekStartStr} to ${weekEndStr}`,
      statusFilter,
      selectedEmployee,
      assignedGroups: assignedGroupIds,
      isAdmin: isAdmin,
    });
    const requestsData = filteredData as Array<{
      status: string;
      account_manager_id?: string | null;
    }> | null;

    // Filter out cancelled requests to avoid flooding the UI
    const cleaned = (requestsData || []).filter(
      (r) => r.status !== "cancelled"
    );
    setRequests(cleaned as OTRequest[]);

    // Load approver names for approved requests
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
    setLoading(false);
  };

  useEffect(() => {
    if (!groupsLoading) {
      loadEmployees();
    }
  }, [assignedGroupIds, groupsLoading, isAdmin]);

  async function loadEmployees() {
    // Admin and HR see all employees
    if (isAdmin || isHR) {
      const { data, error } = await supabase
        .from("employees")
        .select("id, employee_id, full_name, overtime_group_id, last_name, first_name")
        .order("last_name", { ascending: true, nullsFirst: false })
        .order("first_name", { ascending: true, nullsFirst: false });

      if (error) {
        console.error("Failed to load employees", error);
        return;
      }

      setEmployees(data || []);
      return;
    }

    // For approvers/viewers: get employees from assigned groups AND individual assignments
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setEmployees([]);
      return;
    }

    // Get employees from assigned groups
    let groupEmployeeIds: string[] = [];
    if (assignedGroupIds.length > 0) {
      const { data: groupEmployees, error: groupError } = await supabase
        .from("employees")
        .select("id")
        .in("overtime_group_id", assignedGroupIds);

      if (!groupError && groupEmployees) {
        groupEmployeeIds = groupEmployees.map((e) => e.id);
      }
    }

    // Get employees where user is assigned as individual approver or viewer
    const { data: individualEmployees, error: individualError } = await supabase
      .from("employees")
      .select("id")
      .or(`overtime_approver_id.eq.${user.id},overtime_viewer_id.eq.${user.id}`);

    const individualEmployeeIds = (individualEmployees || []).map((e) => e.id);

    // Combine and deduplicate employee IDs
    const allEmployeeIds = Array.from(
      new Set([...groupEmployeeIds, ...individualEmployeeIds])
    );

    if (allEmployeeIds.length === 0) {
      setEmployees([]);
      return;
    }

    // Fetch full employee data
    const { data, error } = await supabase
      .from("employees")
      .select("id, employee_id, full_name, overtime_group_id, last_name, first_name")
      .in("id", allEmployeeIds)
      .order("last_name", { ascending: true, nullsFirst: false })
      .order("first_name", { ascending: true, nullsFirst: false });

    if (error) {
      console.error("Failed to load employees", error);
      return;
    }

    setEmployees(data || []);
  }

  async function loadApproverNames(ids: string[]) {
    if (ids.length === 0) return;

    // Primary: users table (auth profiles), fallback: employees
    const { data: userData, error: userError } = await supabase
      .from("users")
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

  useEffect(() => {
    if ((role === "admin" || role === "approver" || role === "hr" || role === "viewer") && !groupsLoading) {
      console.log("Loading requests with:", {
        role,
        isAdmin,
        isHR,
        assignedGroupIds,
        groupsLoading,
      });
      loadRequests();
    }
  }, [selectedWeek, statusFilter, selectedEmployee, role, assignedGroupIds, groupsLoading, isAdmin, isHR]);

  const handleApprove = async (id: string) => {
    setActioningId(id);
    // Get request details for toast message
    const request = requests.find((r) => r.id === id);
    const employeeName = request?.employees?.full_name || "Employee";

    const { error } = await supabase.rpc("approve_overtime_request", {
      p_request_id: id,
    } as any);
    if (error) {
      toast.error("Failed to approve overtime request", {
        description: error.message || "An error occurred while approving the request",
      });
    } else {
      toast.success("Overtime request approved!", {
        description: `${employeeName}'s overtime request has been approved successfully`,
      });
      loadRequests();
    }
    setActioningId(null);
  };

  const handleReject = async (id: string) => {
    setActioningId(id);
    // Get request details for toast message
    const request = requests.find((r) => r.id === id);
    const employeeName = request?.employees?.full_name || "Employee";

    const { error } = await supabase.rpc("reject_overtime_request", {
      p_request_id: id,
      p_reason: null,
    } as any);
    if (error) {
      toast.error("Failed to reject overtime request", {
        description: error.message || "An error occurred while rejecting the request",
      });
    } else {
      toast.success("Overtime request rejected", {
        description: `${employeeName}'s overtime request has been declined`,
      });
      loadRequests();
    }
    setActioningId(null);
  };

  // Show loading state while checking role or loading groups
  if (roleLoading || groupsLoading) {
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

  // Only allow admins, HR, approvers, and viewers
  if (role !== "admin" && role !== "hr" && role !== "approver" && role !== "viewer") {
    return (
      <DashboardLayout>
        <VStack gap="4" className="p-8">
          <BodySmall>
            Only Account Managers, Admins, OT Approvers, and OT Viewers can access OT approvals.
          </BodySmall>
        </VStack>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <VStack gap="8" className="w-full pb-24">
        <VStack gap="2" align="start">
          <H1>OT Approvals</H1>
          <BodySmall>
            Approve or reject employee-filed OT.
          </BodySmall>
        </VStack>

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
                    {employees.map((employee) => {
                      const nameParts = employee.full_name?.trim().split(/\s+/) || [];
                      const lastName = employee.last_name || (nameParts.length > 0 ? nameParts[nameParts.length - 1] : "");
                      const firstName = employee.first_name || (nameParts.length > 0 ? nameParts[0] : "");
                      const middleParts = nameParts.length > 2 ? nameParts.slice(1, -1) : [];
                      const displayName = lastName && firstName
                        ? `${lastName.toUpperCase()}, ${firstName.toUpperCase()}${middleParts.length > 0 ? " " + middleParts.join(" ").toUpperCase() : ""}`
                        : employee.full_name || "";
                      return (
                        <option key={employee.id} value={employee.id}>
                          {displayName} ({employee.employee_id})
                        </option>
                      );
                    })}
                  </select>
                </div>
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
                  className="h-full min-h-[200px] shadow-sm border-border bg-white transition-shadow hover:shadow-hover cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelected(req)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(req);
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
                            {req.start_time} - {req.end_time}
                          </HStack>
                          <span className="font-semibold text-emerald-600">
                            {req.total_hours}h
                          </span>
                        </HStack>
                        {req.reason && (
                          <BodySmall className="mt-2">
                            <strong>Reason:</strong> {req.reason}
                          </BodySmall>
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
                        {req.status === "approved" &&
                          req.account_manager_id && (
                            <Caption className="text-xs text-gray-600 mt-2">
                              Approved by Manager:{" "}
                              {approverNames[req.account_manager_id] ||
                                "Manager"}
                            </Caption>
                          )}
                      </div>
                      <Badge
                        variant={
                          req.status === "approved"
                            ? "default"
                            : req.status === "rejected"
                            ? "destructive"
                            : "secondary"
                        }
                        className={
                          req.status === "approved"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : req.status === "rejected"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }
                      >
                        {req.status.toUpperCase()}
                      </Badge>
                    </HStack>
                    {req.status === "pending" &&
                      (role === "admin" || (role === "hr" && isHRGroupApprover) || role === "approver") && (
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
                              setSelected(req);
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
            if (!open) {
              setSelected(null);
            }
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>OT Request Details</DialogTitle>
            </DialogHeader>
            {selected && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
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
                      className={
                        selected.status === "approved"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : selected.status === "rejected"
                          ? "bg-red-50 text-red-700 border-red-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }
                    >
                      {selected.status.toUpperCase()}
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
                      {selected.start_time} - {selected.end_time}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Total Hours</p>
                    <p className="text-base font-semibold text-emerald-600">
                      {selected.total_hours}h
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

                {selected.status === "approved" &&
                  selected.account_manager_id && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Approved by Manager:{" "}
                        <span className="font-medium text-foreground">
                          {approverNames[selected.account_manager_id] ||
                            "Manager"}
                        </span>
                      </p>
                    </div>
                  )}
              </div>
            )}
            <DialogFooter className="flex flex-wrap justify-between gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setSelected(null);
                }}
              >
                Close
              </Button>
              {selected?.status === "pending" &&
                (role === "admin" || (role === "hr" && isHRGroupApprover) || role === "approver") && (
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      onClick={() => {
                        if (!selected) return;
                        handleReject(selected.id);
                        setSelected(null);
                      }}
                      disabled={actioningId === selected.id}
                    >
                      <Icon name="X" size={IconSizes.sm} />
                      Reject
                    </Button>
                    <Button
                      onClick={() => {
                        if (!selected) return;
                        handleApprove(selected.id);
                        setSelected(null);
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