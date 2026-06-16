"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CardSection } from "@/components/ui/card-section";
import { PageTitle, H3, BodySmall, StatValue } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { Skeleton, SkeletonCard, SkeletonForm } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatPHTime } from "@/utils/format";
import {
  requestFormCopy,
  requestReasonLabel,
} from "@/lib/employee-portal-request-copy";
import {
  epFormActionButton,
  epFormActions,
  epFormGrid,
  epFormStack,
  epModalPanel,
  epFormField,
  epPageWrapper,
  epSubmitRequestButton,
} from "@/lib/employee-portal-ui";
import {
  epRequestApprovalBoxEmerald,
  epRequestApprovalBoxEmeraldHr,
  epRequestHistoryList,
  epRequestStatusBadgeApproved,
  epRequestStatusBadgeCancelled,
  epRequestStatusBadgeOpsManager,
  epRequestStatusBadgePending,
  epRequestStatusBadgeRejected,
} from "@/lib/employee-portal-request-history";
import {
  RequestHistoryCard,
  RequestHistoryReasonRow,
  RequestHistoryTimeRow,
} from "@/components/employee-portal/RequestHistoryCard";
import { cn } from "@/lib/utils";
import { getManilaTodayYmd, addCalendarDaysYmd } from "@/lib/bundy-business-day";

const FTL_PAGE_CACHE_MS = 2 * 60 * 1000;

type FtlPageCache = {
  employeeId: string;
  at: number;
  requests: FailureToLog[];
};

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
  account_manager_id?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  manager_approval_name?: string | null;
  final_approval_name?: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at?: string | null;
  time_entries?: { punched_at: string; punch_type: string } | { punched_at: string }[];
}

export default function FailureToLogPage() {
  const router = useRouter();
  const [employee, setEmployee] = useState<EmployeeSession | null>(null);
  const [requests, setRequests] = useState<FailureToLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  // Form state (time-out-only FTL removed — open sessions auto-close after 23h)
  const [missedDate, setMissedDate] = useState("");
  const [timeIn, setTimeIn] = useState("");
  const [timeOut, setTimeOut] = useState("");
  const [timeOutDate, setTimeOutDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const ftlCacheRef = useRef<FtlPageCache | null>(null);

  const todayManila = useMemo(() => getManilaTodayYmd(), []);

  const loadFtlPageData = useCallback(
    async (employeeId: string, opts?: { force?: boolean; silent?: boolean }) => {
      const now = Date.now();
      const cached = ftlCacheRef.current;
      if (
        !opts?.force &&
        cached?.employeeId === employeeId &&
        now - cached.at < FTL_PAGE_CACHE_MS
      ) {
        setRequests(cached.requests);
        return;
      }

      if (!opts?.silent) {
        setLoading(true);
      }

      try {
        const response = await fetch(
          `/api/employee-portal/failure-to-log?employee_id=${encodeURIComponent(
            employeeId
          )}`
        );
        const payload = await response.json();

        if (!response.ok) {
          console.error("Error loading failure to log page:", payload);
          if (!opts?.silent) {
            toast.error("Failed to load requests");
          }
          return;
        }

        const nextRequests = (payload.requests || []) as FailureToLog[];

        setRequests(nextRequests);
        ftlCacheRef.current = {
          employeeId,
          at: now,
          requests: nextRequests,
        };
      } catch (err) {
        console.error("Error loading failure to log page:", err);
        if (!opts?.silent) {
          toast.error("Failed to load requests");
        }
      } finally {
        if (!opts?.silent) {
          setLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    const sessionData = localStorage.getItem("employee_session");
    if (!sessionData) {
      router.push("/employee-login");
      return;
    }

    const emp = JSON.parse(sessionData) as EmployeeSession;
    setEmployee(emp);
    void loadFtlPageData(emp.id);
  }, [router, loadFtlPageData]);

  useEffect(() => {
    if (!missedDate) {
      setTimeOutDate("");
      return;
    }
    setTimeOutDate(missedDate);
  }, [missedDate]);

  const autoTimeOutNextDay = useMemo(() => {
    if (!timeIn || !timeOut) return false;
    const start = new Date(`2000-01-01T${timeIn}:00`);
    const end = new Date(`2000-01-01T${timeOut}:00`);
    return end.getTime() <= start.getTime();
  }, [timeIn, timeOut]);

  useEffect(() => {
    if (!missedDate || !timeIn || !timeOut) return;
    if (autoTimeOutNextDay) {
      setTimeOutDate(addCalendarDaysYmd(missedDate, 1));
      return;
    }
    setTimeOutDate(missedDate);
  }, [autoTimeOutNextDay, missedDate, timeIn, timeOut]);

  async function handleCancel(requestId: string) {
    setCancelLoading(true);
    const response = await fetch("/api/employee-portal/failure-to-log", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        request_id: requestId,
        employee_id: employee?.id || "",
      }),
    });
    const payload = await response.json();

    setCancelLoading(false);

    if (!response.ok) {
      console.error("Error cancelling request:", payload);
      toast.error("Failed to cancel request");
      return;
    }

    toast.success("Request removed", {
      description: "Your failure to log request has been removed",
    });
    setCancelId(null);
    if (employee) {
      void loadFtlPageData(employee.id, { force: true, silent: true });
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

    const resolvedTimeOutDate = timeOutDate || missedDate;

    const actualClockInTime = buildDateTime(missedDate, timeIn);
    const actualClockOutTime = buildDateTime(resolvedTimeOutDate, timeOut);

    if (
      resolvedTimeOutDate &&
      missedDate &&
      resolvedTimeOutDate < missedDate
    ) {
      toast.error("Time out date cannot be before time in date.");
      return;
    }

    if (
      actualClockInTime &&
      actualClockOutTime &&
      new Date(actualClockOutTime).getTime() <=
        new Date(actualClockInTime).getTime()
    ) {
      toast.error("Time out must be after time in.");
      return;
    }

    if (!actualClockInTime || !actualClockOutTime) {
      toast.error("Please provide time in and time out.");
      return;
    }

    setSubmitting(true);

    const response = await fetch("/api/employee-portal/failure-to-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employee_id: employee.id,
        time_entry_id: null,
        missed_date: missedDate || null,
        actual_clock_in_time: actualClockInTime,
        actual_clock_out_time: actualClockOutTime,
        entry_type: "both",
        reason: reason.trim(),
      }),
    });
    const payload = await response.json();

    setSubmitting(false);

    if (!response.ok) {
      console.error("Error submitting failure to log request:", payload);
      toast.error("Failed to submit request");
      return;
    }

    toast.success("Failure to log request submitted successfully!", {
      description: "Status: Pending approval • Clock in & out",
    });
    setMissedDate("");
    setTimeIn("");
    setTimeOut("");
    setTimeOutDate("");
    setReason("");
    void loadFtlPageData(employee.id, { force: true, silent: true });
  }

  if (loading || !employee) {
    return (
      <div className={cn("w-full", epPageWrapper)}>
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
      </div>
    );
  }

  const visibleRequests = requests.filter((r) => r.status !== "cancelled");
  const isManagerApproved = (request: FailureToLog) =>
    request.status === "pending" && Boolean(request.account_manager_id);
  const pendingCount = visibleRequests.filter(
    (r) => r.status === "pending" && !isManagerApproved(r)
  ).length;
  const approvedCount = visibleRequests.filter(
    (r) => r.status === "approved" || isManagerApproved(r)
  ).length;
  const formatSafe = (value?: string | null, fmt?: string) =>
    value ? formatPHTime(value, fmt || "MMM dd, yyyy h:mm a") : "—";

  return (
    <>
      <div className={cn("w-full", epPageWrapper)}>
        <PageTitle>Failure To Log</PageTitle>

        {/* Stats */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
          <Card className="w-full h-full border-primary/20 bg-primary/5">
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
                <StatValue>{pendingCount}</StatValue>
              </VStack>
            </CardContent>
          </Card>
          <Card className="w-full h-full border-primary/20 bg-primary/5">
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
                <StatValue>{approvedCount}</StatValue>
              </VStack>
            </CardContent>
          </Card>
          <Card className="w-full h-full border-primary/20 bg-primary/5">
            <CardContent className="w-full p-5">
              <VStack gap="2" align="start" className="w-full">
                <HStack gap="2" align="center">
                  <Icon
                    name="List"
                    size={IconSizes.sm}
                    className="text-primary"
                  />
                  <BodySmall className="font-medium text-muted-foreground">
                    Total Requests
                  </BodySmall>
                </HStack>
                <StatValue>{requests.length}</StatValue>
              </VStack>
            </CardContent>
          </Card>
        </div>

        {/* Request Form */}
        <CardSection
          title={
            <HStack gap="2" align="center">
              <Icon name="WarningCircle" size={IconSizes.md} />
              File Failure To Log Request
            </HStack>
          }
          description="File missed clock in and out for a shift. If you forgot to time out, the system auto-closes your session 23 hours after time in."
          headerClassName="space-y-1"
        >
          <form onSubmit={handleSubmit} className="w-full min-w-0 max-w-full">
            <div className={epFormStack}>
              <div className={epFormStack}>
                <div className={epFormGrid}>
                  <div className={epFormField}>
                    <Label htmlFor="missed-date" required>
                      Time In Date
                    </Label>
                    <Input
                      id="missed-date"
                      type="date"
                      value={missedDate}
                      onChange={(e) => setMissedDate(e.target.value)}
                      max={todayManila}
                      required
                    />
                  </div>

                  <div className={epFormField}>
                    <Label htmlFor="time-in" required>
                      Time In
                    </Label>
                    <Input
                      id="time-in"
                      type="time"
                      value={timeIn}
                      onChange={(e) => setTimeIn(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className={epFormGrid}>
                  <div className={epFormField}>
                    <Label htmlFor="time-out-date" required>
                      Time Out Date
                    </Label>
                    <Input
                      id="time-out-date"
                      type="date"
                      value={timeOutDate}
                      min={missedDate || undefined}
                      max={todayManila}
                      onChange={(e) => setTimeOutDate(e.target.value)}
                      required
                    />
                  </div>

                  <div className={epFormField}>
                    <Label htmlFor="time-out" required>
                      Time Out
                    </Label>
                    <Input
                      id="time-out"
                      type="time"
                      value={timeOut}
                      onChange={(e) => setTimeOut(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className={epFormField}>
                <Label htmlFor="reason" required>
                  {requestReasonLabel}
                </Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={requestFormCopy.failureToLog.reasonPlaceholder}
                  rows={4}
                  className="resize-none"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={
                  submitting ||
                  !reason.trim() ||
                  !missedDate ||
                  !timeIn ||
                  !timeOut
                }
                className={epSubmitRequestButton}
                size="sm"
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
            </div>
          </form>
        </CardSection>

        {/* Requests List */}
        <CardSection title="My Failure To Log Requests">
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
                  <H3>No Requests Yet</H3>
                </VStack>
              </VStack>
            </div>
          ) : (
            <div className={epRequestHistoryList}>
              {visibleRequests.map((request) => {
                const ftlTimeLabel =
                  request.entry_type === "in"
                    ? formatSafe(
                        request.actual_clock_in_time,
                        "MMM d, h:mm a"
                      )
                    : request.entry_type === "out"
                    ? formatSafe(
                        request.actual_clock_out_time,
                        "MMM d, h:mm a"
                      )
                    : request.entry_type === "both" &&
                      request.actual_clock_in_time &&
                      request.actual_clock_out_time
                    ? `${formatSafe(request.actual_clock_in_time, "MMM d, h:mm a")} – ${formatSafe(request.actual_clock_out_time, "h:mm a")}`
                    : null;

                return (
                  <RequestHistoryCard
                    key={request.id}
                    status={request.status}
                    title={formatSafe(request.missed_date, "MMM dd, yyyy")}
                    categoryLabel="FTL"
                    filedAt={formatSafe(
                      request.created_at,
                      "MMM dd, yyyy h:mm a"
                    )}
                    statusColumn={
                      <>
                        {request.status === "pending" &&
                          !isManagerApproved(request) && (
                            <Badge variant="outline" className={epRequestStatusBadgePending}>
                              <Icon name="Hourglass" size={IconSizes.sm} />
                              PENDING
                            </Badge>
                          )}
                        {isManagerApproved(request) && (
                          <>
                            <Badge variant="outline" className={epRequestStatusBadgeOpsManager}>
                              <Icon name="CheckCircle" size={IconSizes.sm} />
                              APPROVED BY OPERATIONS MANAGER
                            </Badge>
                            <div className={epRequestApprovalBoxEmerald}>
                              {request.manager_approval_name && (
                                <div className="font-semibold">
                                  {request.manager_approval_name}
                                </div>
                              )}
                              {(request.approved_at || request.updated_at) && (
                                <div className="text-emerald-700">
                                  {formatSafe(
                                    request.approved_at || request.updated_at,
                                    "MMM dd, yyyy h:mm a"
                                  )}
                                </div>
                              )}
                            </div>
                          </>
                        )}
                        {request.status === "approved" && (
                          <Badge variant="outline" className={epRequestStatusBadgeApproved}>
                            <Icon name="CheckCircle" size={IconSizes.sm} />
                            APPROVED
                          </Badge>
                        )}
                        {request.status === "approved" &&
                          (request.final_approval_name || request.approved_at) && (
                            <div className={epRequestApprovalBoxEmeraldHr}>
                              <div className="font-semibold">Approved by HR</div>
                              {request.final_approval_name && (
                                <div>{request.final_approval_name}</div>
                              )}
                              {request.approved_at && (
                                <div className="text-emerald-700">
                                  {formatSafe(
                                    request.approved_at,
                                    "MMM dd, yyyy h:mm a"
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        {request.status === "rejected" && (
                          <Badge variant="outline" className={epRequestStatusBadgeRejected}>
                            <Icon name="XCircle" size={IconSizes.sm} />
                            REJECTED
                          </Badge>
                        )}
                        {request.status === "cancelled" && (
                          <Badge variant="outline" className={epRequestStatusBadgeCancelled}>
                            <Icon name="XCircle" size={IconSizes.sm} />
                            CANCELLED
                          </Badge>
                        )}
                      </>
                    }
                  >
                    {ftlTimeLabel ? (
                      <RequestHistoryTimeRow>{ftlTimeLabel}</RequestHistoryTimeRow>
                    ) : null}
                    <RequestHistoryReasonRow reason={request.reason} />
                    {request.status === "rejected" && request.rejection_reason && (
                      <div className="mb-2 rounded-md border border-red-200 bg-red-50 p-2 text-sm">
                        <strong className="text-red-900">Rejection Reason:</strong>
                        <div className="mt-1 text-red-800">
                          {request.rejection_reason}
                        </div>
                      </div>
                    )}
                  </RequestHistoryCard>
                );
              })}
            </div>
          )}
        </CardSection>
      </div>
      {cancelId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className={epModalPanel} role="dialog" aria-modal="true">
            <VStack gap="4" className="w-full">
              <H3>Cancel Failure To Log Request?</H3>
              <BodySmall>
                This will permanently remove the request from your records.
              </BodySmall>
              <div className={epFormActions}>
                <Button
                  variant="outline"
                  onClick={() => setCancelId(null)}
                  disabled={cancelLoading}
                  className={epFormActionButton}
                >
                  Keep request
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => cancelId && handleCancel(cancelId)}
                  disabled={cancelLoading}
                  className={epFormActionButton}
                >
                  Cancel request
                </Button>
              </div>
            </VStack>
          </div>
        </div>
      )}
    </>
  );
}