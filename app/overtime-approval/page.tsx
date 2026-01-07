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

  // All hooks must be declared before any conditional returns
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<OTRequest[]>([]);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);
  const [employees, setEmployees] = useState<
    { id: string; employee_id: string; full_name: string }[]
  >([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [selected, setSelected] = useState<OTRequest | null>(null);
  const [approverNames, setApproverNames] = useState<Record<string, string>>(
    {}
  );

  // Block HR users from accessing this page
  // Allow approver and viewer roles
  useEffect(() => {
    if (!roleLoading && isHR) {
      router.push("/dashboard");
    }
  }, [roleLoading, isHR, router]);

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
    
    // Filter by assigned groups if user is approver/viewer (not admin)
    let filteredData = data;
    if (!isAdmin && assignedGroupIds.length > 0 && data) {
      console.log("Filtering requests for approver/viewer:", {
        totalRequests: data.length,
        assignedGroupIds: assignedGroupIds,
        isAdmin: isAdmin,
      });
      
      filteredData = data.filter((req: any) => {
        // Handle both array and object formats for employees relationship
        let employeeGroupId = null;
        let employeeName = "Unknown";
        
        if (Array.isArray(req.employees)) {
          employeeGroupId = req.employees[0]?.overtime_group_id;
          employeeName = req.employees[0]?.full_name || "Unknown";
        } else if (req.employees) {
          employeeGroupId = req.employees.overtime_group_id;
          employeeName = req.employees.full_name || "Unknown";
        }
        
        const matches = employeeGroupId && assignedGroupIds.includes(employeeGroupId);
        
        if (!matches) {
          console.log(`Filtered out: ${employeeName} (group: ${employeeGroupId || "NULL"})`);
        }
        
        return matches;
      });
      
      console.log("Filtered requests:", {
        before: data.length,
        after: filteredData.length,
        filteredOut: data.length - filteredData.length,
      });
    } else if (!isAdmin && assignedGroupIds.length === 0) {
      console.warn("Approver/viewer has no assigned groups - showing no requests");
      filteredData = [];
    }
    
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
    let query = supabase
      .from("employees")
      .select("id, employee_id, full_name, overtime_group_id")
      .order("full_name", { ascending: true });

    // Filter by assigned groups if user is approver/viewer (not admin)
    if (!isAdmin && assignedGroupIds.length > 0) {
      query = query.in("overtime_group_id", assignedGroupIds);
    }

    const { data, error } = await query;

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
    if ((role === "admin" || role === "approver" || role === "viewer") && !groupsLoading) {
      console.log("Loading requests with:", {
        role,
        isAdmin,
        assignedGroupIds,
        groupsLoading,
      });
      loadRequests();
    }
  }, [selectedWeek, statusFilter, selectedEmployee, role, assignedGroupIds, groupsLoading, isAdmin]);

  const handleApprove = async (id: string) => {
    setActioningId(id);
    const { error } = await supabase.rpc("approve_overtime_request", {
      p_request_id: id,
    } as any);
    if (error) {
      toast.error(error.message || "Failed to approve OT");
    } else {
      toast.success("Overtime request approved successfully!", {
        description: "Offset hours have been added to employee balance",
      });
      loadRequests();
    }
    setActioningId(null);
  };

  const handleReject = async (id: string) => {
    setActioningId(id);
    const { error } = await supabase.rpc("reject_overtime_request", {
      p_request_id: id,
      p_reason: null,
    } as any);
    if (error) {
      toast.error(error.message || "Failed to reject OT");
    } else {
      toast.success("Overtime request rejected", {
        description: "The request has been declined",
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

  // Block HR users - redirect handled by useEffect above
  if (isHR) {
    return null;
  }

  // Only allow admins, approvers, and viewers
  if (role !== "admin" && role !== "approver" && role !== "viewer") {
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
            Approve or reject employee-filed OT. Approved hours convert 1:1 to
            off-setting credits.
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
                      (role === "admin" || role === "approver") && (
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
                (role === "admin" || role === "approver") && (
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
