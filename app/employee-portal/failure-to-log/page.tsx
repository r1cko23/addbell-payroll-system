"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Hourglass,
  Clock,
} from "lucide-react";
import { formatPHTime } from "@/utils/format";

interface EmployeeSession {
  id: string;
  employee_id: string;
  full_name: string;
}

interface FailureToLog {
  id: string;
  time_entry_id: string | null;
  missed_date: string | null;
  actual_clock_in_time: string | null;
  actual_clock_out_time: string | null;
  entry_type: "in" | "out" | "both";
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  rejection_reason: string | null;
  created_at: string;
  time_clock_entries?: {
    clock_in_time: string;
    clock_out_time: string | null;
  };
}

export default function FailureToLogPage() {
  const router = useRouter();
  const supabase = createClient();
  const [employee, setEmployee] = useState<EmployeeSession | null>(null);
  const [requests, setRequests] = useState<FailureToLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  // Form state
  const [entryType, setEntryType] = useState<"in" | "out" | "both">("out");
  const [missedDate, setMissedDate] = useState("");
  const [timeIn, setTimeIn] = useState("");
  const [timeOut, setTimeOut] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [timeEntries, setTimeEntries] = useState<any[]>([]);
  const [selectedTimeEntryId, setSelectedTimeEntryId] = useState("");

  useEffect(() => {
    const sessionData = localStorage.getItem("employee_session");
    if (!sessionData) {
      router.push("/employee-login");
      return;
    }

    const emp = JSON.parse(sessionData) as EmployeeSession;
    setEmployee(emp);
    fetchFailureToLogRequests(emp.id);
    fetchTimeEntries(emp.id);
  }, [router]);

  async function fetchTimeEntries(employeeId: string) {
    const { data, error } = await supabase
      .from("time_clock_entries")
      .select("id, clock_in_time, clock_out_time, status")
      .eq("employee_id", employeeId)
      .order("clock_in_time", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error fetching time entries:", error);
    } else {
      setTimeEntries(data || []);
    }
  }

  async function fetchFailureToLogRequests(employeeId: string) {
    setLoading(true);
    const { data, error } = await supabase
      .from("failure_to_log")
      .select(
        `
        *,
        time_clock_entries (
          clock_in_time,
          clock_out_time
        )
      `
      )
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching failure to log requests:", error);
      toast.error("Failed to load requests");
    } else {
      setRequests(data || []);
    }
    setLoading(false);
  }

  async function handleCancel(requestId: string) {
    setCancelLoading(true);
    const { data, error } = await supabase
      .from("failure_to_log")
      .update({ status: "cancelled" })
      .eq("id", requestId)
      .eq("employee_id", employee?.id || "")
      .eq("status", "pending")
      .select()
      .maybeSingle();

    setCancelLoading(false);

    if (error) {
      console.error("Error cancelling request:", error);
      toast.error("Failed to cancel request");
      return;
    }

    if (!data) {
      toast.error("Could not cancel; request may no longer be pending.");
      return;
    }

    toast.success("Request cancelled");
    setCancelId(null);
    if (employee) {
      fetchFailureToLogRequests(employee.id);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!employee || !reason.trim()) {
      toast.error("Please fill in the required fields");
      return;
    }

    const buildDateTime = (date: string, time: string) => {
      if (!date || !time) return null;
      return new Date(`${date}T${time}`).toISOString();
    };

    const actualClockInTime =
      entryType === "in" || entryType === "both"
        ? buildDateTime(missedDate, timeIn)
        : null;
    const actualClockOutTime =
      entryType === "out" || entryType === "both"
        ? buildDateTime(missedDate, timeOut)
        : null;

    if (
      (entryType === "in" && !actualClockInTime) ||
      (entryType === "out" && !actualClockOutTime) ||
      (entryType === "both" && (!actualClockInTime || !actualClockOutTime))
    ) {
      toast.error("Please provide the missing clock time(s).");
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.from("failure_to_log").insert({
      employee_id: employee.id,
      time_entry_id: selectedTimeEntryId || null,
      missed_date: missedDate || null,
      actual_clock_in_time: actualClockInTime,
      actual_clock_out_time: actualClockOutTime,
      entry_type: entryType,
      reason: reason.trim(),
      status: "pending",
    });

    setSubmitting(false);

    if (error) {
      console.error("Error submitting failure to log request:", error);
      toast.error("Failed to submit request");
      return;
    }

    toast.success("✅ Failure to log request submitted successfully!");
    setMissedDate("");
    setTimeIn("");
    setTimeOut("");
    setEntryType("out");
    setReason("");
    setSelectedTimeEntryId("");
    fetchFailureToLogRequests(employee.id);
    fetchTimeEntries(employee.id);
  }

  if (loading || !employee) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600" />
      </div>
    );
  }

  const visibleRequests = requests.filter((r) => r.status !== "cancelled");
  const pendingCount = visibleRequests.filter(
    (r) => r.status === "pending"
  ).length;
  const approvedCount = visibleRequests.filter(
    (r) => r.status === "approved"
  ).length;
  const formatSafe = (value?: string | null, fmt?: string) =>
    value ? formatPHTime(value, fmt || "MMM dd, yyyy h:mm a") : "—";

  return (
    <>
      <div className="min-h-screen bg-background">
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/employee-portal/bundy")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Failure to Log Request</h1>
              <p className="text-sm text-muted-foreground">
                {employee.full_name}
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">Pending</div>
                <div className="text-2xl font-bold text-yellow-600">
                  {pendingCount}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">Approved</div>
                <div className="text-2xl font-bold text-green-600">
                  {approvedCount}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">
                  Total Requests
                </div>
                <div className="text-2xl font-bold">{requests.length}</div>
              </CardContent>
            </Card>
          </div>

          {/* Request Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                File Failure to Log Request
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="entry-type">Log Type</Label>
                  <select
                    id="entry-type"
                    value={entryType}
                    onChange={(e) =>
                      setEntryType(e.target.value as "in" | "out" | "both")
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="out">Time Out</option>
                    <option value="in">Time In</option>
                    <option value="both">Time In & Out</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="missed-date">Date</Label>
                  <Input
                    id="missed-date"
                    type="date"
                    value={missedDate}
                    onChange={(e) => setMissedDate(e.target.value)}
                    max={new Date().toISOString().split("T")[0]}
                    required
                  />
                </div>

                {(entryType === "in" || entryType === "both") && (
                  <div className="space-y-2">
                    <Label htmlFor="time-in">Time In</Label>
                    <Input
                      id="time-in"
                      type="time"
                      value={timeIn}
                      onChange={(e) => setTimeIn(e.target.value)}
                      required={entryType === "in" || entryType === "both"}
                    />
                  </div>
                )}

                {(entryType === "out" || entryType === "both") && (
                  <div className="space-y-2">
                    <Label htmlFor="time-out">Time Out</Label>
                    <Input
                      id="time-out"
                      type="time"
                      value={timeOut}
                      onChange={(e) => setTimeOut(e.target.value)}
                      required={entryType === "out" || entryType === "both"}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="reason">Reason</Label>
                  <textarea
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Explain why you forgot to clock in/out..."
                    rows={4}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Please provide a detailed explanation
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full"
                  isLoading={submitting}
                >
                  Request Change
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Requests List */}
          <Card>
            <CardHeader>
              <CardTitle>My Failure to Log Requests</CardTitle>
            </CardHeader>
            <CardContent>
              {visibleRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No failure to log requests yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {visibleRequests.map((request) => (
                    <Card
                      key={request.id}
                      className={`${
                        request.status === "pending"
                          ? "border-yellow-300"
                          : request.status === "approved"
                          ? "border-green-300"
                          : request.status === "rejected"
                          ? "border-red-300"
                          : "border-slate-300"
                      }`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="font-bold text-lg">
                                {formatSafe(
                                  request.missed_date,
                                  "MMM dd, yyyy"
                                )}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {request.entry_type === "in" && (
                                  <>
                                    Actual In:{" "}
                                    {formatSafe(
                                      request.actual_clock_in_time,
                                      "MMM dd, h:mm a"
                                    )}
                                  </>
                                )}
                                {request.entry_type === "out" && (
                                  <>
                                    Actual Out:{" "}
                                    {formatSafe(
                                      request.actual_clock_out_time,
                                      "MMM dd, h:mm a"
                                    )}
                                  </>
                                )}
                                {request.entry_type === "both" && (
                                  <>
                                    Actual In:{" "}
                                    {formatSafe(
                                      request.actual_clock_in_time,
                                      "MMM dd, h:mm a"
                                    )}{" "}
                                    | Actual Out:{" "}
                                    {formatSafe(
                                      request.actual_clock_out_time,
                                      "MMM dd, h:mm a"
                                    )}
                                  </>
                                )}
                              </span>
                            </div>

                            <div className="text-sm">
                              <strong>Reason:</strong>
                              <div className="mt-1 text-muted-foreground">
                                {request.reason}
                              </div>
                            </div>

                            {request.status === "rejected" &&
                              request.rejection_reason && (
                                <div className="p-2 bg-red-50 border border-red-200 rounded-md text-sm">
                                  <strong className="text-red-900">
                                    Rejection Reason:
                                  </strong>
                                  <div className="text-red-800 mt-1">
                                    {request.rejection_reason}
                                  </div>
                                </div>
                              )}

                            <div className="text-xs text-muted-foreground">
                              Filed:{" "}
                              {formatSafe(
                                request.created_at,
                                "MMM dd, yyyy h:mm a"
                              )}
                            </div>
                          </div>

                          <div className="ml-4">
                            {request.status === "pending" && (
                              <Badge
                                variant="warning"
                                className="flex items-center gap-2"
                              >
                                <Hourglass className="h-4 w-4" />
                                PENDING
                              </Badge>
                            )}
                            {request.status === "approved" && (
                              <Badge
                                variant="success"
                                className="flex items-center gap-2"
                              >
                                <CheckCircle className="h-4 w-4" />
                                APPROVED
                              </Badge>
                            )}
                            {request.status === "rejected" && (
                              <Badge
                                variant="destructive"
                                className="flex items-center gap-2"
                              >
                                <XCircle className="h-4 w-4" />
                                REJECTED
                              </Badge>
                            )}
                            {request.status === "cancelled" && (
                              <Badge
                                variant="secondary"
                                className="flex items-center gap-2"
                              >
                                <XCircle className="h-4 w-4" />
                                CANCELLED
                              </Badge>
                            )}
                          </div>
                        </div>
                        {request.status === "pending" && (
                          <div className="flex justify-end pt-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCancelId(request.id);
                              }}
                            >
                              Cancel Request
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      {cancelId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-semibold text-foreground">
              Cancel failure-to-log request?
            </h3>
            <p className="text-sm text-muted-foreground">
              This will mark the request as cancelled and hide it from your
              list.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setCancelId(null)}
                disabled={cancelLoading}
              >
                Keep request
              </Button>
              <Button
                variant="destructive"
                onClick={() => cancelId && handleCancel(cancelId)}
                isLoading={cancelLoading}
              >
                Cancel request
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
