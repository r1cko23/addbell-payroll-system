"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { PageTitle, H3, H4, BodySmall, Caption, StatValue } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import { format, addDays, differenceInCalendarDays } from "date-fns";
import {
  epFileInput,
  epFormCard,
  epFormField,
  epFormStack,
  epNativeSelect,
  epPageWrapper,
  epSubmitRequestButton,
} from "@/lib/employee-portal-ui";
import { PortalPageHeader } from "@/components/portal/PortalPageHeader";
import {
  epRequestApprovalBoxEmerald,
  epRequestApprovalBoxEmeraldHr,
  epRequestHistoryDocLink,
  epRequestHistoryList,
  epRequestHistorySectionContent,
  epRequestStatusBadgeApproved,
  epRequestStatusBadgeCancelled,
  epRequestStatusBadgePending,
  epRequestStatusBadgeRejected,
} from "@/lib/employee-portal-request-history";
import {
  RequestHistoryCard,
  RequestHistoryReasonRow,
  RequestHistorySupportingDocuments,
} from "@/components/employee-portal/RequestHistoryCard";
import { cn } from "@/lib/utils";
import { useEmployeeLeaveCredits } from "@/lib/hooks/useEmployeeData";
import { formatSilCreditsAvailable } from "@/lib/employee-sil-display";
import { MultiDatePicker } from "@/components/MultiDatePicker";
import { getBiMonthlyPeriodStart } from "@/utils/bimonthly";
import {
  requestFormCopy,
  requestReasonLabel,
  requestSupportingDocLabel,
} from "@/lib/employee-portal-request-copy";
import { isSchemaMissingTableOrRelationError } from "@/lib/postgrestSchema";
import {
  BUSINESS_WINDOW_HOURS,
  formatHourLabel24,
  getBusinessStartHour,
} from "@/utils/business-hours";

interface EmployeeSession {
  id: string;
  employee_id: string;
  full_name: string;
}

interface LeaveDocument {
  id: string;
  leave_request_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
}

interface LeaveRequest {
  id: string;
  leave_type: "SIL" | "LWOP";
  leave_subtype?:
    | "regular_sil"
    | "vacation_leave"
    | "emergency_leave"
    | "sick_leave"
    | "others"
    | "half_day_leave"
    | null;
  start_date: string;
  end_date: string;
  selected_dates?: string[] | null;
  half_day_dates?: string[] | null; // Array of dates that are half-day
  start_time?: string | null;
  end_time?: string | null;
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
  project_manager_id?: string | null;
  project_manager_approved_at?: string | null;
  manager_approval_name?: string | null;
  hr_approved_by?: string | null;
  hr_approved_at?: string | null;
  hr_approval_name?: string | null;
  created_at: string;
  leave_request_documents?: LeaveDocument[];
}

const DEFAULT_BUSINESS_START_HOUR = 7;
const BUSINESS_START_LABEL = formatHourLabel24(DEFAULT_BUSINESS_START_HOUR);
const BUSINESS_WINDOW_END_LABEL = formatHourLabel24(
  DEFAULT_BUSINESS_START_HOUR + BUSINESS_WINDOW_HOURS
);

type LeaveSubtype =
  | "regular_sil"
  | "vacation_leave"
  | "emergency_leave"
  | "sick_leave"
  | "others"
  | "half_day_leave";

const LEAVE_SUBTYPE_OPTIONS: {
  value: LeaveSubtype;
  label: string;
  notice: string;
}[] = [
  {
    value: "regular_sil",
    label: "Regular SIL",
    notice: "File at least 3 days ahead.",
  },
  {
    value: "vacation_leave",
    label: "Vacation Leave",
    notice: "File at least 3 days ahead.",
  },
  {
    value: "emergency_leave",
    label: "Emergency Leave",
    notice: `File on leave day, ${BUSINESS_START_LABEL}–${BUSINESS_WINDOW_END_LABEL}.`,
  },
  {
    value: "sick_leave",
    label: "Sick Leave",
    notice: `File on leave day, ${BUSINESS_START_LABEL}–${BUSINESS_WINDOW_END_LABEL}.`,
  },
  {
    value: "others",
    label: "Others",
    notice: "File at least 3 days ahead.",
  },
  {
    value: "half_day_leave",
    label: "Half-Day Leave",
    notice: "Pick one date and mark half-day (0.5 day).",
  },
];

function getLeaveTypeLabel(leaveType: string): "SIL" | "LWOP" {
  const normalized = leaveType.trim().toLowerCase();
  if (
    ["sil", "sick leave", "service incentive leave"].includes(normalized)
  ) {
    return "SIL";
  }
  return "LWOP";
}

function getLeaveSubtypeLabel(value?: string | null): string {
  if (!value) return "—";
  return (
    LEAVE_SUBTYPE_OPTIONS.find((option) => option.value === value)?.label ??
    value
  );
}

export default function LeaveRequestPage() {
  const router = useRouter();
  const supabase = createClient();
  const [employee, setEmployee] = useState<EmployeeSession | null>(null);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const {
    silCredits,
    silAnnualAllotment,
    refetch: refetchSilCredits,
  } = useEmployeeLeaveCredits({
    employeeId: employee?.id ?? null,
    enabled: Boolean(employee?.id),
  });
  const [requestsFetchError, setRequestsFetchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [holidayDates, setHolidayDates] = useState<Set<string>>(new Set());
  const [supportingDoc, setSupportingDoc] = useState<File | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);

  // Form state
  const [leaveType, setLeaveType] = useState<"SIL" | "LWOP">("SIL");
  const [leaveSubtype, setLeaveSubtype] = useState<LeaveSubtype>("regular_sil");
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [halfDayDates, setHalfDayDates] = useState<Set<string>>(new Set()); // Track which dates are half-day
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [calculatedDays, setCalculatedDays] = useState(0);
  const [calculatedHours, setCalculatedHours] = useState(0);
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB cap to keep DB light
  const ALLOWED_TYPES = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx"];

  const resolveMimeType = (file: File) => {
    if (file.type) return file.type;
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".pdf")) return "application/pdf";
    if (lower.endsWith(".docx"))
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (lower.endsWith(".doc")) return "application/msword";
    return "application/octet-stream";
  };

  const isAllowedFile = (file: File) => {
    const typeOk = ALLOWED_TYPES.includes(resolveMimeType(file));
    const extOk = ALLOWED_EXTENSIONS.some((ext) =>
      file.name.toLowerCase().endsWith(ext)
    );
    return typeOk || extOk;
  };

  const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        if (base64) resolve(base64);
        else reject(new Error("Unable to read file"));
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

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
    const sessionData = localStorage.getItem("employee_session");
    if (!sessionData) {
      router.push("/employee-login");
      return;
    }

    const emp = JSON.parse(sessionData) as EmployeeSession;
    setEmployee(emp);

    // employee_id in leave_requests is UUID (employees.id). Session must have id = employees.id.
    if (!emp?.id) {
      console.error("Employee session missing id (UUID). Re-login may fix this.");
      setRequestsFetchError("Session invalid. Please sign out and sign in again.");
      setLoading(false);
      return;
    }

    setRequestsFetchError(null);
    // Batch initial data fetching in parallel
    Promise.all([fetchLeaveRequests(emp.id), fetchHolidayDates()]).catch((err) => {
      console.error("Error loading initial data:", err);
    });
  }, [router]);

  // Auto-switch to LWOP if SIL credits are zero
  useEffect(() => {
    if (silCredits !== null && silCredits <= 0 && leaveType === "SIL") {
      setLeaveType("LWOP");
      toast.info(
        "SIL credits are zero. Switched to LWOP (Leave Without Pay)."
      );
    }
  }, [silCredits, leaveType]);

  useEffect(() => {
    if (leaveSubtype === "regular_sil" && leaveType === "LWOP") {
      setLeaveSubtype("others");
    }
  }, [leaveSubtype, leaveType]);

  // Update startDate and endDate when selectedDates changes
  useEffect(() => {
    if (selectedDates.length > 0) {
      const sortedDates = [...selectedDates].sort();
      setStartDate(sortedDates[0]);
      setEndDate(sortedDates[sortedDates.length - 1]);

      // Remove half-day flags for dates that are no longer selected
      const newHalfDayDates = new Set(halfDayDates);
      halfDayDates.forEach((dateStr) => {
        if (!selectedDates.includes(dateStr)) {
          newHalfDayDates.delete(dateStr);
        }
      });
      setHalfDayDates(newHalfDayDates);
    } else {
      setStartDate("");
      setEndDate("");
      setHalfDayDates(new Set()); // Clear half-day dates when no dates selected
    }
  }, [selectedDates]);

  useEffect(() => {
    // Calculate days from selected dates array
    // Half-day dates count as 0.5, full-day dates count as 1.0
    // Weekends are allowed and counted based on company policy.
    if (selectedDates.length > 0) {
      let days = 0;
      selectedDates.forEach((dateStr) => {
        const isHoliday = holidayDates.has(dateStr);
        if (!isHoliday) {
          // Check if this date is marked as half-day
          if (halfDayDates.has(dateStr)) {
            days += 0.5;
          } else {
            days += 1;
          }
        }
      });
      setCalculatedDays(days);
    } else {
      setCalculatedDays(0);
    }
    setCalculatedHours(0);
  }, [selectedDates, halfDayDates, holidayDates]);

  async function fetchHolidayDates() {
    try {
      const year = new Date().getFullYear();
      const start = `${year}-01-01`;
      const end = `${year}-12-31`;

      const { data, error } = await supabase
        .from("holidays")
        .select("holiday_date")
        .gte("holiday_date", start)
        .lte("holiday_date", end);

      if (error) {
        console.warn("Error loading holidays for leave request:", error);
        setHolidayDates(new Set<string>());
        return;
      }

      setHolidayDates(
        new Set<string>((data || []).map((h: any) => String(h.holiday_date)))
      );
    } catch (e) {
      console.warn("Error loading holidays for leave request (exception):", e);
      setHolidayDates(new Set<string>());
    }
  }

  async function fetchLeaveRequests(employeeId: string | undefined) {
    if (!employeeId) {
      setRequestsFetchError("Cannot load leave requests: missing employee id.");
      setRequests([]);
      return;
    }
    setRequestsFetchError(null);
    setLoading(true);

    // Load requests directly from table (new schema without get_my_leave_requests RPC)
    const response = await fetch(
      `/api/employee-portal/leave-requests?employee_id=${encodeURIComponent(
        employeeId
      )}`
    );
    const payload = await response.json();

    if (!response.ok) {
      console.error("Error fetching leave requests:", payload);
      setRequestsFetchError("Unable to load leave requests. Please try again.");
      setRequests([]);
      toast.error("Failed to load leave requests");
      setLoading(false);
      return;
    }

    setRequestsFetchError(null);
    setRequests((payload.requests || []) as LeaveRequest[]);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (
      !employee ||
      selectedDates.length === 0 ||
      !reason.trim()
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (calculatedDays <= 0) {
      toast.error(
        "Selected dates are invalid for filing. Please pick at least one valid date."
      );
      return;
    }

    const sortedDates = [...selectedDates].sort();
    const earliestSelectedDate = sortedDates[0];
    const today = new Date();
    const todayOnly = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const leaveStartDateOnly = new Date(`${earliestSelectedDate}T00:00:00`);

    if (
      leaveSubtype === "regular_sil" ||
      leaveSubtype === "vacation_leave" ||
      leaveSubtype === "others"
    ) {
      const noticeDays = differenceInCalendarDays(leaveStartDateOnly, todayOnly);
      if (noticeDays < 3) {
        toast.error("This leave subtype requires at least 3 days notice.");
        return;
      }
    }

    if (leaveSubtype === "emergency_leave" || leaveSubtype === "sick_leave") {
      const isSameDayFiling =
        differenceInCalendarDays(leaveStartDateOnly, todayOnly) === 0;
      const currentHour = today.getHours();
      const businessStartHour = getBusinessStartHour(today);
      if (!isSameDayFiling) {
        toast.error(
          "Emergency and Sick Leave must be filed on the leave day during the business start window."
        );
        return;
      }
      if (businessStartHour === null) {
        toast.error(
          "Emergency and Sick Leave cannot be filed outside regular business days."
        );
        return;
      }
      const businessWindowEnd = businessStartHour + BUSINESS_WINDOW_HOURS;
      if (currentHour < businessStartHour || currentHour >= businessWindowEnd) {
        const windowStartLabel = formatHourLabel24(businessStartHour);
        const windowEndLabel = formatHourLabel24(businessWindowEnd);
        toast.error(
          `Emergency and Sick Leave filing window is ${windowStartLabel} to ${windowEndLabel}.`
        );
        return;
      }
    }

    if (leaveSubtype === "half_day_leave") {
      if (selectedDates.length !== 1) {
        toast.error("Half-Day Leave requires exactly one selected date.");
        return;
      }
      if (halfDayDates.size === 0) {
        toast.error("Mark the selected date as half-day before submitting.");
        return;
      }
    }

    // Check SIL credits if SIL type
    // Employees cannot file leaves if they don't have sufficient leave credits
    // Rule: calculatedDays must be <= silCredits (strict validation, NO rounding up)
    // Examples:
    // - 0.83 credits can file 0.83 days (half day) but NOT 1.0 day
    // - 2.76 credits can file 2.76 days (2 full days + half day) but NOT 3.0 days
    // - No rounding up: if you have less than 1 credit, you cannot file a full day
    if (leaveType === "SIL") {
      if (silCredits === null) {
        toast.error("Unable to verify SIL credits. Please try again.");
        return;
      }
      if (silCredits <= 0) {
        toast.error(
          "You have no SIL credits available. Please select LWOP (Leave Without Pay) instead."
        );
        return;
      }
      // Strict validation: calculatedDays must be <= silCredits (no rounding up)
      // This ensures employees cannot file more days than their available credits
      // Example: 0.83 credits cannot file 1.0 day, 2.76 credits cannot file 3.0 days
      if (calculatedDays > silCredits) {
        toast.error(
          `Insufficient SIL credits. You have ${silCredits.toFixed(2)} credit(s) but filed for ${calculatedDays.toFixed(2)} day(s). Please adjust your dates or select LWOP instead.`
        );
        return;
      }
    }

    if (supportingDoc) {
      if (!isAllowedFile(supportingDoc)) {
        toast.error("Only PDF, DOC, or DOCX files are allowed");
        return;
      }
      if (supportingDoc.size > MAX_FILE_SIZE) {
        toast.error("File too large. Max size is 5MB.");
        return;
      }
    }

    setSubmitting(true);

    let documentPayload:
      | {
          file_name: string;
          file_type: string;
          file_size: number;
          file_base64: string;
        }
      | null = null;
    if (supportingDoc) {
      const base64 = await fileToBase64(supportingDoc);
      documentPayload = {
        file_name: supportingDoc.name,
        file_type: resolveMimeType(supportingDoc),
        file_size: supportingDoc.size,
        file_base64: base64,
      };
    }

    const createResponse = await fetch("/api/employee-portal/leave-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employee_id: employee.id,
        leave_type: leaveType,
        leave_subtype: leaveSubtype,
        start_date: startDate,
        end_date: endDate,
        total_days: calculatedDays,
        selected_dates: selectedDates.length > 0 ? selectedDates : null,
        half_day_dates: halfDayDates.size > 0 ? Array.from(halfDayDates) : [],
        reason: reason.trim() || null,
        document: documentPayload,
      }),
    });
    const createPayload = await createResponse.json();

    if (!createResponse.ok || !createPayload?.id) {
      setSubmitting(false);
      console.error("Error submitting leave request:", createPayload);
      toast.error("Failed to submit leave request");
      return;
    }

    setSubmitting(false);

    if (createPayload?.warning) {
      toast.warning(createPayload.warning, {
        description: `${leaveType} • ${calculatedDays} day(s) • Status: Pending approval`,
      });
    } else {
      toast.success("Leave request submitted successfully!", {
        description: `${leaveType} • ${calculatedDays} day(s) • Status: Pending approval`,
      });
    }
    setSelectedDates([]);
    setHalfDayDates(new Set());
    setStartDate("");
    setEndDate("");
    setReason("");
    setLeaveSubtype(leaveType === "SIL" ? "regular_sil" : "others");
    setCalculatedDays(0);
    setCalculatedHours(0);
    setStartTime("");
    setEndTime("");
    setSupportingDoc(null);
    setDocError(null);
    fetchLeaveRequests(employee.id);
    refetchSilCredits();
  }

  async function handleDownload(docId: string) {
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

  if (loading || !employee) {
    return (
      <div className={cn("w-full", epPageWrapper)}>
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  // Include cancelled in history so employees can see all past requests
  const visibleRequests = requests;
  const pendingCount = visibleRequests.filter(
    (r) => r.status === "pending"
  ).length;
  const approvedCount = visibleRequests.filter(
    (r) => r.status === "approved_by_hr"
  ).length;
  const formatApprovalTime = (value?: string | null) =>
    value ? format(new Date(value), "MMM dd, yyyy h:mm a") : null;

  return (
    <>
      <div className={cn("w-full", epPageWrapper)}>
        <PortalPageHeader
          title="Leave Request"
          description="Submit and track your leave requests."
        />

        {/* Stats */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 items-stretch">
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
                    name="CalendarBlank"
                    size={IconSizes.sm}
                    className="text-emerald-600"
                  />
                  <BodySmall className="font-medium text-muted-foreground">
                    Allotted SIL Credits
                  </BodySmall>
                </HStack>
                <StatValue>{silAnnualAllotment}</StatValue>
                <div className="text-xs text-muted-foreground mt-1">
                  Available: {formatSilCreditsAvailable(silCredits)}
                </div>
              </VStack>
            </CardContent>
          </Card>
          <Card className="w-full h-full border-primary/20 bg-primary/5">
            <CardContent className="w-full p-5">
              <VStack gap="2" align="start" className="w-full">
                <HStack gap="2" align="center">
                  <Icon
                    name="CalendarCheck"
                    size={IconSizes.sm}
                    className="text-indigo-600"
                  />
                  <BodySmall className="font-medium text-muted-foreground">
                    Available SIL Credits
                  </BodySmall>
                </HStack>
                <StatValue>{formatSilCreditsAvailable(silCredits)}</StatValue>
              </VStack>
            </CardContent>
          </Card>
        </div>

        {/* Request Form */}
        <Card className={epFormCard}>
          <CardHeader className="pb-4">
            <CardTitle>
              <HStack gap="2" align="center">
                <Icon name="CalendarBlank" size={IconSizes.md} />
                File Leave Request
              </HStack>
            </CardTitle>
          </CardHeader>
          <CardContent className="w-full min-w-0">
            <form onSubmit={handleSubmit} className="w-full min-w-0">
              <div className={epFormStack}>
                <div className={epFormField}>
                  <Label>Leave Type</Label>
                  <div className="w-full flex flex-wrap gap-4">
                    <label
                      className={`flex items-center space-x-2 ${
                        silCredits !== null && silCredits <= 0
                          ? "opacity-50 cursor-not-allowed"
                          : ""
                      }`}
                    >
                      <input
                        type="radio"
                        value="SIL"
                        checked={leaveType === "SIL"}
                        onChange={(e) =>
                          setLeaveType(e.target.value as typeof leaveType)
                        }
                        disabled={silCredits !== null && silCredits <= 0}
                        className="h-4 w-4"
                      />
                      <span>SIL (Service Incentive Leave)</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        value="LWOP"
                        checked={leaveType === "LWOP"}
                        onChange={(e) =>
                          setLeaveType(e.target.value as typeof leaveType)
                        }
                        className="h-4 w-4"
                      />
                      <span>LWOP (Leave Without Pay)</span>
                    </label>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    {leaveType === "SIL" && (
                      <>
                        <p>
                          Allotted SIL Credits:{" "}
                          <strong>{silAnnualAllotment}</strong>
                        </p>
                        <p>
                          Available SIL Credits:{" "}
                          <strong>
                            {silCredits !== null
                              ? formatSilCreditsAvailable(silCredits)
                              : "Loading..."}
                          </strong>
                        </p>
                        {silCredits !== null && silCredits <= 0 && (
                          <p className="text-red-600 font-medium">
                            You have no SIL credits available. Please select
                            LWOP instead.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className={epFormField}>
                  <Label htmlFor="leave_subtype">Leave Sub-Type</Label>
                  <select
                    id="leave_subtype"
                    value={leaveSubtype}
                    onChange={(e) => setLeaveSubtype(e.target.value as LeaveSubtype)}
                    className={epNativeSelect}
                  >
                    {LEAVE_SUBTYPE_OPTIONS.filter((option) =>
                      leaveType === "LWOP"
                        ? option.value !== "regular_sil"
                        : true
                    ).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    {LEAVE_SUBTYPE_OPTIONS.find((option) => option.value === leaveSubtype)
                      ?.notice ?? "Follow company leave policy."}
                  </p>
                </div>

                <div className={epFormField}>
                  <Label>Select Dates</Label>
                  <MultiDatePicker
                    selectedDates={selectedDates}
                    onChange={setSelectedDates}
                    minDate={format(getBiMonthlyPeriodStart(new Date()), "yyyy-MM-dd")}
                    holidayDates={holidayDates}
                  />
                  <p className="text-xs text-muted-foreground">
                    Tap dates in the calendar. Holidays are excluded from the count.
                  </p>

                  {/* Half-day option for SIL and LWOP */}
                  {(leaveType === "SIL" || leaveType === "LWOP") && selectedDates.length > 0 && (
                    <div className="mt-3 rounded-md border border-primary/20 bg-primary/5 p-3">
                      <Label className="mb-2 block text-sm font-medium text-primary">
                        Half-Day Leave Options
                      </Label>
                      <p className="mb-3 text-xs text-primary/80">
                        Half-day = 0.5 day per date.
                      </p>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {selectedDates
                          .filter((dateStr) => {
                            const isHoliday = holidayDates.has(dateStr);
                            return !isHoliday;
                          })
                          .map((dateStr) => (
                            <label
                              key={dateStr}
                              className="flex cursor-pointer items-center space-x-2 rounded p-2 text-sm hover:bg-primary/10"
                            >
                              <input
                                type="checkbox"
                                checked={halfDayDates.has(dateStr)}
                                onChange={(e) => {
                                  const newHalfDayDates = new Set(halfDayDates);
                                  if (e.target.checked) {
                                    newHalfDayDates.add(dateStr);
                                  } else {
                                    newHalfDayDates.delete(dateStr);
                                  }
                                  setHalfDayDates(newHalfDayDates);
                                }}
                                className="h-4 w-4 rounded border-primary/40 text-primary focus:ring-primary"
                              />
                              <span className="text-primary">
                                {format(new Date(dateStr), "MMM dd, yyyy (EEE)")}
                                {halfDayDates.has(dateStr) && (
                                  <Badge className="ml-2 border-primary/30 bg-primary/10 text-primary">
                                    Half-Day
                                  </Badge>
                                )}
                              </span>
                            </label>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                {calculatedDays > 0 && (
                  <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
                    <div className="text-sm font-semibold text-primary">
                      Calculated Days:{" "}
                      <span className="text-lg">{calculatedDays.toFixed(2)}</span>
                      {selectedDates.length > 0 && (
                        <span className="ml-2 text-xs font-normal text-primary/80">
                          ({selectedDates.length} date
                          {selectedDates.length !== 1 ? "s" : ""} selected
                          {halfDayDates.size > 0 && `, ${halfDayDates.size} half-day`})
                        </span>
                      )}
                    </div>
                    {leaveType === "SIL" && (
                      <div className="mt-1 text-xs text-primary/80">
                        SIL Credits Required: {calculatedDays.toFixed(2)} credits
                      </div>
                    )}
                  </div>
                )}

                {leaveType === "SIL" && (
                  <div className="w-full space-y-2">
                    <Label htmlFor="supporting-doc">
                      {requestSupportingDocLabel}
                    </Label>
                    <input
                      id="supporting-doc"
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) {
                          setSupportingDoc(null);
                          setDocError(null);
                          return;
                        }
                        if (!isAllowedFile(file)) {
                          setDocError(
                            "Only PDF, DOC, or DOCX files are allowed."
                          );
                          setSupportingDoc(null);
                          return;
                        }
                        if (file.size > MAX_FILE_SIZE) {
                          setDocError("File too large. Max size is 5MB.");
                          setSupportingDoc(null);
                          return;
                        }
                        setDocError(null);
                        setSupportingDoc(file);
                      }}
                      className={epFileInput}
                    />
                    <p className="text-xs text-muted-foreground">
                      {requestFormCopy.leave.supportingDocHint}
                    </p>
                    {supportingDoc && !docError && (
                      <HStack
                        gap="2"
                        align="center"
                        className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary"
                      >
                        <Icon name="Paperclip" size={IconSizes.sm} />
                        <span>{supportingDoc.name}</span>
                        <Caption>
                          {(supportingDoc.size / 1024 / 1024).toFixed(2)} MB
                        </Caption>
                      </HStack>
                    )}
                    {docError && (
                      <p className="text-sm font-medium text-destructive">
                        {docError}
                      </p>
                    )}
                  </div>
                )}

                <div className="w-full space-y-2">
                  <Label htmlFor="reason">{requestReasonLabel}</Label>
                  <Textarea
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={requestFormCopy.leave.reasonPlaceholder}
                    rows={4}
                    className="resize-none"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
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
          </CardContent>
        </Card>

        {/* Requests List */}
        <Card className={epFormCard}>
          <CardHeader className="px-3 pb-3 pt-4 sm:px-6 sm:pb-4">
            <CardTitle className="text-base sm:text-lg">My Leave Requests</CardTitle>
          </CardHeader>
          <CardContent className={epRequestHistorySectionContent}>
            {requestsFetchError ? (
              <div className="text-center py-8">
                <VStack gap="4" align="center">
                  <Icon
                    name="WarningCircle"
                    size={IconSizes.xl}
                    className="text-destructive opacity-70"
                  />
                  <BodySmall className="text-destructive">{requestsFetchError}</BodySmall>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (employee?.id) {
                        setRequestsFetchError(null);
                        fetchLeaveRequests(employee.id);
                      }
                    }}
                  >
                    Retry
                  </Button>
                </VStack>
              </div>
            ) : visibleRequests.length === 0 ? (
              <div className="text-center py-8">
                <VStack gap="4" align="center">
                  <Icon
                    name="CalendarBlank"
                    size={IconSizes.xl}
                    className="text-muted-foreground opacity-50"
                  />
                  <BodySmall>No leave requests yet</BodySmall>
                </VStack>
              </div>
            ) : (
              <div className={epRequestHistoryList}>
                {visibleRequests.map((request) => {
                  const title =
                    request.selected_dates && request.selected_dates.length > 0
                      ? request.selected_dates.length === 1
                        ? format(
                            new Date(request.selected_dates[0]),
                            "MMM dd, yyyy"
                          )
                        : `${request.selected_dates.length} dates: ${request.selected_dates
                            .slice(0, 3)
                            .map((d) => format(new Date(d), "MMM dd"))
                            .join(", ")}${
                            request.selected_dates.length > 3 ? "..." : ""
                          }`
                      : `${format(new Date(request.start_date), "MMM dd")} - ${format(
                          new Date(request.end_date),
                          "MMM dd, yyyy"
                        )}`;

                  return (
                    <RequestHistoryCard
                      key={request.id}
                      status={request.status}
                      title={title}
                      categoryLabel={getLeaveTypeLabel(request.leave_type)}
                      subtitle={
                        request.leave_subtype
                          ? getLeaveSubtypeLabel(request.leave_subtype)
                          : null
                      }
                      metric={`${request.total_days} ${
                        request.total_days === 1 ? "day" : "days"
                      }`}
                      filedAt={format(
                        new Date(request.created_at),
                        "MMM dd, yyyy h:mm a"
                      )}
                      statusColumn={
                        <>
                          {request.status === "pending" && (
                            <Badge variant="outline" className={epRequestStatusBadgePending}>
                              <Icon name="Hourglass" size={IconSizes.sm} />
                              PENDING
                            </Badge>
                          )}
                          {request.status === "approved_by_manager" && (
                            <>
                              <Badge
                                variant="outline"
                                className={epRequestStatusBadgeApproved}
                              >
                                <Icon name="CheckCircle" size={IconSizes.sm} />
                                APPROVED BY OPERATIONS MANAGER
                              </Badge>
                              {(request.manager_approval_name ||
                                request.project_manager_approved_at) && (
                                <div className={epRequestApprovalBoxEmerald}>
                                  {request.manager_approval_name && (
                                    <div className="font-semibold">
                                      {request.manager_approval_name}
                                    </div>
                                  )}
                                  {formatApprovalTime(
                                    request.project_manager_approved_at
                                  ) && (
                                    <div className="text-emerald-700">
                                      {formatApprovalTime(
                                        request.project_manager_approved_at
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                          {request.status === "approved_by_hr" && (
                            <>
                              <Badge
                                variant="outline"
                                className={epRequestStatusBadgeApproved}
                              >
                                <Icon name="CheckCircle" size={IconSizes.sm} />
                                APPROVED
                              </Badge>
                              {(request.manager_approval_name ||
                                request.project_manager_approved_at) && (
                                <div className={epRequestApprovalBoxEmerald}>
                                  <div className="font-semibold">
                                    Approved by Operations Manager
                                  </div>
                                  {request.manager_approval_name && (
                                    <div>{request.manager_approval_name}</div>
                                  )}
                                  {formatApprovalTime(
                                    request.project_manager_approved_at
                                  ) && (
                                    <div className="text-emerald-700">
                                      {formatApprovalTime(
                                        request.project_manager_approved_at
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                              {(request.hr_approval_name ||
                                request.hr_approved_at) && (
                                <div className={epRequestApprovalBoxEmeraldHr}>
                                  <div className="font-semibold">Approved by HR</div>
                                  {request.hr_approval_name && (
                                    <div>{request.hr_approval_name}</div>
                                  )}
                                  {formatApprovalTime(request.hr_approved_at) && (
                                    <div className="text-emerald-700">
                                      {formatApprovalTime(request.hr_approved_at)}
                                    </div>
                                  )}
                                </div>
                              )}
                            </>
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
                      <RequestHistoryReasonRow reason={request.reason ?? ""} />
                      {getLeaveTypeLabel(request.leave_type) === "SIL" &&
                        request.leave_request_documents &&
                        request.leave_request_documents.length > 0 && (
                          <RequestHistorySupportingDocuments
                            documents={request.leave_request_documents}
                            renderFileName={(doc) => (
                              <button
                                type="button"
                                className={epRequestHistoryDocLink}
                                onClick={() => handleDownload(doc.id)}
                                disabled={downloadingDocId === doc.id}
                              >
                                {downloadingDocId === doc.id
                                  ? "Loading…"
                                  : doc.file_name}
                              </button>
                            )}
                          />
                        )}
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
          </CardContent>
        </Card>
      </div>
    </>
  );
}