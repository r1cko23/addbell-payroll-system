"use client";

import { useEffect, useState } from "react";
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
  created_at: string;
  employees: {
    employee_id: string;
    full_name: string;
  };
  time_clock_entries?: {
    clock_in_time: string;
    clock_out_time: string | null;
  };
}

export default function FailureToLogApprovalPage() {
  const supabase = createClient();
  const [requests, setRequests] = useState<FailureToLog[]>([]);
  const [employees, setEmployees] = useState<
    { id: string; employee_id: string; full_name: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  const [selectedRequest, setSelectedRequest] = useState<FailureToLog | null>(
    null
  );
  const [rejectionReason, setRejectionReason] = useState("");
  const [approveLoading, setApproveLoading] = useState(false);
  const [approverNames, setApproverNames] = useState<Record<string, string>>(
    {}
  );

  const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(selectedWeek, { weekStartsOn: 1 }); // Sunday
  const safeFormat = (value: string | null | undefined, fmt: string) =>
    value ? formatPHTime(value, fmt) : "—";

  const statusStyles: Record<FailureToLog["status"], string> = {
    pending: "bg-amber-100 text-amber-900 border-amber-200",
    approved: "bg-emerald-100 text-emerald-900 border-emerald-200",
    rejected: "bg-rose-100 text-rose-900 border-rose-200",
    cancelled: "bg-muted text-muted-foreground border-transparent",
  };

  useEffect(() => {
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

  useEffect(() => {
    fetchRequests();
  }, [statusFilter, selectedWeek, selectedEmployee]);

  async function fetchRequests() {
    setLoading(true);

    // Ensure weekEnd includes the full day
    const weekEndInclusive = new Date(weekEnd);
    weekEndInclusive.setHours(23, 59, 59, 999);

    const weekStartStr = format(weekStart, "yyyy-MM-dd");
    const weekEndStr = format(weekEndInclusive, "yyyy-MM-dd");

    let query = supabase
      .from("failure_to_log")
      .select(
        `
        *,
        employees (
          employee_id,
          full_name
        ),
        time_clock_entries (
          clock_in_time,
          clock_out_time
        )
      `
      )
      .gte("missed_date", weekStartStr)
      .lte("missed_date", weekEndStr)
      .order("created_at", { ascending: false });

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    if (selectedEmployee !== "all") {
      query = query.eq("employee_id", selectedEmployee);
    }

    const { data, error } = await query;

    setLoading(false);

    if (error) {
      console.error("Error fetching failure to log requests:", error);
      toast.error("Failed to load requests");
      return;
    }

    const cleaned = (data || []).filter((r) => r.status !== "cancelled");
    setRequests(cleaned);

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

  async function handleApprove(requestId: string) {
    setApproveLoading(true);
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
      toast.error("Failed to fetch request details");
      setApproveLoading(false);
      return;
    }

    // Validate required times based on entry_type
    if (
      (request.entry_type === "in" && !request.actual_clock_in_time) ||
      (request.entry_type === "out" && !request.actual_clock_out_time) ||
      (request.entry_type === "both" &&
        (!request.actual_clock_in_time || !request.actual_clock_out_time))
    ) {
      toast.error("Missing actual clock time(s) for this request");
      setApproveLoading(false);
      return;
    }

    // Update failure_to_log; time entry upsert is handled by DB trigger
    const { error } = await supabase
      .from("failure_to_log")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        account_manager_id: user.id,
        correct_clock_in_time: request.actual_clock_in_time,
        correct_clock_out_time: request.actual_clock_out_time,
      })
      .eq("id", requestId)
      .select()
      .single();

    if (error) {
      console.error("Error approving request:", error);
      toast.error("Failed to approve request");
      setApproveLoading(false);
      return;
    }

    toast.success("Failure to log request approved!", {
      description: "Time entry has been updated successfully",
    });
    fetchRequests();
    setSelectedRequest(null);
    setApproveLoading(false);
  }

  async function handleReject(requestId: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("failure_to_log")
      .update({
        status: "rejected",
        rejection_reason: rejectionReason.trim() || null,
        account_manager_id: user.id,
      })
      .eq("id", requestId)
      .select()
      .single();

    if (error) {
      console.error("Error rejecting request:", error);
      toast.error("Failed to reject request");
      return;
    }

    toast.success("Failure to log request rejected", {
      description: "The request has been declined",
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

  return (
    <DashboardLayout>
      <VStack gap="8" className="w-full pb-24">
        {/* Header */}
        <VStack gap="2" align="start">
          <H1>Failure to Log Approval</H1>
          <BodySmall>
            Review and approve employee failure to log requests
          </BodySmall>
        </VStack>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full items-stretch">
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
                <BodySmall>Approved</BodySmall>
                <div className="text-2xl font-bold text-emerald-600">
                  {stats.approved}
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
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="cancelled">Cancelled</option>
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
                <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
                  <VStack gap="1" align="start">
                    <HStack gap="2" align="center">
                      <Icon
                        name="User"
                        size={IconSizes.md}
                        className="text-muted-foreground"
                      />
                      <BodySmall>
                        {request.employees?.employee_id || "Unknown ID"}
                      </BodySmall>
                    </HStack>
                    <H3>
                      {request.employees?.full_name || "Unknown employee"}
                    </H3>
                    <HStack gap="2" align="center">
                      <Icon name="CalendarBlank" size={IconSizes.sm} />
                      <BodySmall>
                        Missed {safeFormat(request.missed_date, "MMM dd, yyyy")}
                      </BodySmall>
                    </HStack>
                  </VStack>
                  <Badge
                    className={statusStyles[request.status]}
                    variant="outline"
                  >
                    {request.status.toUpperCase()}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4 pt-0 flex flex-col h-full">
                  <HStack
                    gap="4"
                    align="center"
                    className="flex-wrap text-sm text-muted-foreground"
                  >
                    <HStack gap="2" align="center">
                      <Icon name="ClockClockwise" size={IconSizes.sm} />
                      Entry type: {request.entry_type.toUpperCase()}
                    </HStack>
                    <HStack gap="2" align="center">
                      <Icon name="Timer" size={IconSizes.sm} />
                      Actual:{" "}
                      {safeFormat(
                        request.actual_clock_in_time ||
                          request.actual_clock_out_time,
                        "MMM dd, h:mm a"
                      )}
                    </HStack>
                  </HStack>
                  <BodySmall>
                    <span className="font-semibold text-foreground">
                      Reason:
                    </span>{" "}
                    <span className="text-muted-foreground">
                      {request.reason}
                    </span>
                  </BodySmall>
                  {request.manual_notes && (
                    <BodySmall>
                      <span className="font-semibold text-foreground">
                        Employee notes:
                      </span>{" "}
                      <span className="text-muted-foreground">
                        {request.manual_notes}
                      </span>
                    </BodySmall>
                  )}
                  {request.status === "approved" &&
                    request.account_manager_id && (
                      <Caption className="text-xs text-gray-600 mt-1">
                        Approved by Manager:{" "}
                        {approverNames[request.account_manager_id] || "Manager"}
                      </Caption>
                    )}
                  <HStack gap="2" align="center" className="flex-wrap mt-auto">
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
                    {request.status === "pending" && (
                      <>
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
                      </>
                    )}
                  </HStack>
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
                    <p className="text-base font-semibold">
                      {selectedRequest.employees?.full_name || "Unknown"}
                    </p>
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
                  selectedRequest.account_manager_id && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Approved by Manager:{" "}
                        <span className="font-medium text-foreground">
                          {approverNames[selectedRequest.account_manager_id] ||
                            "Manager"}
                        </span>
                      </p>
                    </div>
                  )}

                {selectedRequest.status === "pending" && (
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
              {selectedRequest?.status === "pending" && (
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
