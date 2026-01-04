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
import { CardSection } from "@/components/ui/card-section";
import { H1, H3, BodySmall, Caption } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { Skeleton, SkeletonCard, SkeletonForm } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
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
    const { data, error } = await (supabase.from("failure_to_log") as any)
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

    toast.success("Request cancelled", {
      description: "Your failure to log request has been cancelled",
    });
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

    const { error } = await (supabase.from("failure_to_log") as any).insert({
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

    toast.success("Failure to log request submitted successfully!", {
      description: `Status: Pending approval • ${
        entryType === "both"
          ? "Clock in & out"
          : entryType === "in"
          ? "Clock in"
          : "Clock out"
      }`,
    });
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
      <VStack gap="8" className="w-full">
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <SkeletonCard />
        <SkeletonCard />
      </VStack>
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
      <VStack gap="8" className="w-full">
        {/* Header */}
        <VStack gap="2" align="start">
          <H1>Failure to Log Request</H1>
          <BodySmall className="text-muted-foreground">
            {employee.full_name}
          </BodySmall>
        </VStack>

        {/* Stats */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
          <Card className="w-full h-full border-l-4 border-l-amber-500 hover:shadow-md transition-shadow">
            <CardContent className="w-full p-5">
              <VStack gap="2" align="start" className="w-full">
                <HStack gap="2" align="center">
                  <Icon
                    name="ClockClockwise"
                    size={IconSizes.sm}
                    className="text-amber-600"
                  />
                  <BodySmall className="font-medium text-muted-foreground">
                    Pending
                  </BodySmall>
                </HStack>
                <div className="text-3xl font-bold text-amber-600">
                  {pendingCount}
                </div>
              </VStack>
            </CardContent>
          </Card>
          <Card className="w-full h-full border-l-4 border-l-emerald-500 hover:shadow-md transition-shadow">
            <CardContent className="w-full p-5">
              <VStack gap="2" align="start" className="w-full">
                <HStack gap="2" align="center">
                  <Icon
                    name="CheckCircle"
                    size={IconSizes.sm}
                    className="text-emerald-600"
                  />
                  <BodySmall className="font-medium text-muted-foreground">
                    Approved
                  </BodySmall>
                </HStack>
                <div className="text-3xl font-bold text-emerald-600">
                  {approvedCount}
                </div>
              </VStack>
            </CardContent>
          </Card>
          <Card className="w-full h-full border-l-4 border-l-gray-500 hover:shadow-md transition-shadow">
            <CardContent className="w-full p-5">
              <VStack gap="2" align="start" className="w-full">
                <HStack gap="2" align="center">
                  <Icon
                    name="List"
                    size={IconSizes.sm}
                    className="text-gray-600"
                  />
                  <BodySmall className="font-medium text-muted-foreground">
                    Total Requests
                  </BodySmall>
                </HStack>
                <div className="text-3xl font-bold text-gray-700">
                  {requests.length}
                </div>
              </VStack>
            </CardContent>
          </Card>
        </div>

        {/* Request Form */}
        <CardSection
          title={
            <HStack gap="2" align="center">
              <Icon name="WarningCircle" size={IconSizes.md} />
              File Failure to Log Request
            </HStack>
          }
        >
          <form onSubmit={handleSubmit} className="w-full">
            <VStack gap="4" className="w-full">
              <VStack gap="2" align="start" className="w-full">
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
              </VStack>

              <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
                <VStack gap="2" align="start" className="w-full">
                  <Label htmlFor="missed-date">Date</Label>
                  <Input
                    id="missed-date"
                    type="date"
                    value={missedDate}
                    onChange={(e) => setMissedDate(e.target.value)}
                    max={new Date().toISOString().split("T")[0]}
                    required
                  />
                </VStack>

                {(entryType === "in" || entryType === "both") && (
                  <VStack gap="2" align="start" className="w-full">
                    <Label htmlFor="time-in">Time In</Label>
                    <Input
                      id="time-in"
                      type="time"
                      value={timeIn}
                      onChange={(e) => setTimeIn(e.target.value)}
                      required={entryType === "in" || entryType === "both"}
                    />
                  </VStack>
                )}

                {(entryType === "out" || entryType === "both") && (
                  <VStack gap="2" align="start" className="w-full">
                    <Label htmlFor="time-out">Time Out</Label>
                    <Input
                      id="time-out"
                      type="time"
                      value={timeOut}
                      onChange={(e) => setTimeOut(e.target.value)}
                      required={entryType === "out" || entryType === "both"}
                    />
                  </VStack>
                )}
              </div>

              <VStack gap="2" align="start" className="w-full">
                <Label htmlFor="reason">
                  Reason <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why you forgot to clock in/out. Be specific about the circumstances..."
                  rows={4}
                  className="resize-none"
                  required
                  aria-describedby="reason-help"
                />
                <Caption id="reason-help" className="text-muted-foreground">
                  Please provide a detailed explanation to help HR process your
                  request faster
                </Caption>
              </VStack>

              <Button
                type="submit"
                disabled={submitting || !reason.trim()}
                className="w-full md:w-auto md:min-w-[200px]"
                size="lg"
              >
                {submitting ? (
                  <>
                    <Icon
                      name="ArrowsClockwise"
                      size={IconSizes.sm}
                      className="animate-spin"
                    />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Icon name="ArrowRight" size={IconSizes.sm} />
                    Submit Request
                  </>
                )}
              </Button>
            </VStack>
          </form>
        </CardSection>

        {/* Requests List */}
        <CardSection title="My Failure to Log Requests">
          {visibleRequests.length === 0 ? (
            <div className="text-center py-12">
              <VStack gap="4" align="center">
                <div className="rounded-full bg-muted p-6">
                  <Icon
                    name="Clock"
                    size={IconSizes.xl}
                    className="text-muted-foreground"
                  />
                </div>
                <VStack gap="2" align="center">
                  <H3 className="text-lg font-semibold">No Requests Yet</H3>
                  <BodySmall className="text-muted-foreground max-w-md">
                    You haven't filed any failure to log requests. Use the form
                    above to submit a new request if you forgot to clock in or
                    out.
                  </BodySmall>
                </VStack>
              </VStack>
            </div>
          ) : (
            <VStack gap="4">
              {visibleRequests.map((request) => (
                <Card
                  key={request.id}
                  className={`w-full ${
                    request.status === "pending"
                      ? "border-yellow-300"
                      : request.status === "approved"
                      ? "border-green-300"
                      : request.status === "rejected"
                      ? "border-red-300"
                      : "border-slate-300"
                  }`}
                >
                  <CardContent className="w-full p-4">
                    <HStack justify="between" align="start" className="mb-2">
                      <VStack gap="2" align="start" className="flex-1">
                        <HStack gap="3" align="center" className="flex-wrap">
                          <H3>
                            {formatSafe(request.missed_date, "MMM dd, yyyy")}
                          </H3>
                          <BodySmall>
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
                          </BodySmall>
                        </HStack>

                        <VStack gap="1" align="start">
                          <BodySmall>
                            <strong>Reason:</strong>
                          </BodySmall>
                          <BodySmall className="text-muted-foreground">
                            {request.reason}
                          </BodySmall>
                        </VStack>

                        {request.status === "rejected" &&
                          request.rejection_reason && (
                            <div className="p-2 bg-red-50 border border-red-200 rounded-md">
                              <BodySmall className="text-red-900 font-semibold">
                                Rejection Reason:
                              </BodySmall>
                              <BodySmall className="text-red-800 mt-1">
                                {request.rejection_reason}
                              </BodySmall>
                            </div>
                          )}

                        <Caption>
                          Filed:{" "}
                          {formatSafe(
                            request.created_at,
                            "MMM dd, yyyy h:mm a"
                          )}
                        </Caption>
                      </VStack>

                      <VStack gap="2" align="end" className="ml-4">
                        {request.status === "pending" && (
                          <Badge
                            variant="secondary"
                            className="flex items-center gap-2"
                          >
                            <Icon name="Hourglass" size={IconSizes.sm} />
                            PENDING
                          </Badge>
                        )}
                        {request.status === "approved" && (
                          <Badge
                            variant="default"
                            className="flex items-center gap-2"
                          >
                            <Icon name="CheckCircle" size={IconSizes.sm} />
                            APPROVED
                          </Badge>
                        )}
                        {request.status === "rejected" && (
                          <Badge
                            variant="destructive"
                            className="flex items-center gap-2"
                          >
                            <Icon name="XCircle" size={IconSizes.sm} />
                            REJECTED
                          </Badge>
                        )}
                        {request.status === "cancelled" && (
                          <Badge
                            variant="secondary"
                            className="flex items-center gap-2"
                          >
                            <Icon name="XCircle" size={IconSizes.sm} />
                            CANCELLED
                          </Badge>
                        )}
                      </VStack>
                    </HStack>
                    {request.status === "pending" && (
                      <HStack justify="end" align="center" className="pt-3">
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
                      </HStack>
                    )}
                  </CardContent>
                </Card>
              ))}
            </VStack>
          )}
        </CardSection>
      </VStack>
      {cancelId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-sm">
            <VStack gap="4">
              <H3>Cancel failure-to-log request?</H3>
              <BodySmall>
                This will mark the request as cancelled and hide it from your
                list.
              </BodySmall>
              <HStack gap="2" justify="end" align="center">
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
                  disabled={cancelLoading}
                >
                  Cancel request
                </Button>
              </HStack>
            </VStack>
          </div>
        </div>
      )}
    </>
  );
}