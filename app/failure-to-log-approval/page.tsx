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
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedRequest, setSelectedRequest] = useState<FailureToLog | null>(
    null
  );
  const [rejectionReason, setRejectionReason] = useState("");
  const [approveLoading, setApproveLoading] = useState(false);
  const safeFormat = (value: string | null | undefined, fmt: string) =>
    value ? formatPHTime(value, fmt) : "—";

  const statusStyles: Record<FailureToLog["status"], string> = {
    pending: "bg-amber-100 text-amber-900 border-amber-200",
    approved: "bg-emerald-100 text-emerald-900 border-emerald-200",
    rejected: "bg-rose-100 text-rose-900 border-rose-200",
    cancelled: "bg-muted text-muted-foreground border-transparent",
  };

  useEffect(() => {
    fetchRequests();
  }, [statusFilter]);

  async function fetchRequests() {
    setLoading(true);

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
      .order("created_at", { ascending: false });

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
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

    toast.success("✅ Request approved and time entry updated");
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

    toast.success("Request rejected");
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
          <Card className="border-muted h-full w-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Requests
              </CardTitle>
            </CardHeader>
            <CardContent className="h-full flex flex-col">
              <HStack justify="between" align="center" className="flex-1">
                <div className="text-3xl font-semibold">{stats.total}</div>
                <Icon
                  name="WarningCircle"
                  size={IconSizes.md}
                  className="text-muted-foreground"
                />
              </HStack>
            </CardContent>
          </Card>
          <Card className="border-muted h-full w-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending
              </CardTitle>
            </CardHeader>
            <CardContent className="h-full flex flex-col">
              <HStack justify="between" align="center" className="flex-1">
                <div className="text-3xl font-semibold text-amber-700">
                  {stats.pending}
                </div>
                <Icon
                  name="ClockClockwise"
                  size={IconSizes.md}
                  className="text-amber-600"
                />
              </HStack>
            </CardContent>
          </Card>
          <Card className="border-muted h-full w-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Approved
              </CardTitle>
            </CardHeader>
            <CardContent className="h-full flex flex-col">
              <HStack justify="between" align="center" className="flex-1">
                <div className="text-3xl font-semibold text-emerald-700">
                  {stats.approved}
                </div>
                <Icon
                  name="Check"
                  size={IconSizes.md}
                  className="text-emerald-600"
                />
              </HStack>
            </CardContent>
          </Card>
          <Card className="border-muted h-full w-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Rejected
              </CardTitle>
            </CardHeader>
            <CardContent className="h-full flex flex-col">
              <HStack justify="between" align="center" className="flex-1">
                <div className="text-3xl font-semibold text-rose-700">
                  {stats.rejected}
                </div>
                <Icon name="X" size={IconSizes.md} className="text-rose-600" />
              </HStack>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <CardSection
          title={
            <HStack gap="2" align="center">
              <Icon
                name="MagnifyingGlass"
                size={IconSizes.md}
                className="text-muted-foreground"
              />
              <span>Filters</span>
            </HStack>
          }
          description="Narrow down requests by their current status."
        >
          <VStack gap="2" align="start">
            <Label htmlFor="status">Status</Label>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value)}
            >
              <SelectTrigger id="status" className="w-full">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </VStack>
        </CardSection>

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
