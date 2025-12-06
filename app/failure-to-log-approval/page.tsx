"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AlertCircle, Check, X, User, Calendar, Filter } from "lucide-react";
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
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Failure to Log Approval</h1>
          <p className="text-muted-foreground mt-2">
            Review and approve employee failure to log requests
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">
                Total Requests
              </div>
              <div className="text-2xl font-bold mt-1">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Pending</div>
              <div className="text-2xl font-bold mt-1 text-yellow-600">
                {stats.pending}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Approved</div>
              <div className="text-2xl font-bold mt-1 text-green-600">
                {stats.approved}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Rejected</div>
              <div className="text-2xl font-bold mt-1 text-red-600">
                {stats.rejected}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Filter className="h-5 w-5 text-muted-foreground" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Requests List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : requests.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No requests found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <Card
                key={request.id}
                className="hover:shadow-md transition-shadow"
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <User className="h-5 w-5 text-muted-foreground" />
                        <span className="font-bold text-lg">
                          {request.employees?.full_name || "Unknown"}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          ({request.employees?.employee_id})
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          Missed:{" "}
                          {safeFormat(request.missed_date, "MMM dd, yyyy")}
                        </div>
                        <div>
                          Actual:{" "}
                          {safeFormat(
                            request.actual_clock_out_time,
                            "MMM dd, h:mm a"
                          )}
                        </div>
                      </div>
                      <div className="text-sm">
                        <strong>Reason:</strong> {request.reason}
                      </div>
                    </div>
                    <div className="ml-4 flex flex-col items-end gap-2">
                      {request.status === "pending" && (
                        <>
                          <Badge variant="warning">PENDING</Badge>
                          <div
                            className="flex gap-2 mt-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRejectionReason("");
                                handleReject(request.id);
                              }}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleApprove(request.id);
                              }}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                          </div>
                        </>
                      )}
                      {request.status === "approved" && (
                        <Badge variant="success">APPROVED</Badge>
                      )}
                      {request.status === "rejected" && (
                        <Badge variant="destructive">REJECTED</Badge>
                      )}
                      {request.status === "cancelled" && (
                        <Badge variant="secondary">CANCELLED</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Detail Modal removed */}
      </div>
    </DashboardLayout>
  );
}
