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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { H1, H3, H4, BodySmall, Caption } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import { format, addDays } from "date-fns";
import { MultiDatePicker } from "@/components/MultiDatePicker";

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
  leave_type:
    | "SIL"
    | "LWOP"
    | "Maternity Leave"
    | "Paternity Leave";
  start_date: string;
  end_date: string;
  selected_dates?: string[] | null;
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
  created_at: string;
  leave_request_documents?: LeaveDocument[];
}

interface EmployeeInfo {
  sil_credits: number;
  maternity_credits: number;
  paternity_credits: number;
}

export default function LeaveRequestPage() {
  const router = useRouter();
  const supabase = createClient();
  const [employee, setEmployee] = useState<EmployeeSession | null>(null);
  const [employeeInfo, setEmployeeInfo] = useState<EmployeeInfo | null>(null);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [holidayDates, setHolidayDates] = useState<Set<string>>(new Set());
  const [supportingDoc, setSupportingDoc] = useState<File | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [docUploading, setDocUploading] = useState(false);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);

  // Form state
  const [leaveType, setLeaveType] = useState<
    "SIL" | "LWOP" | "Maternity Leave" | "Paternity Leave"
  >("SIL");
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [calculatedDays, setCalculatedDays] = useState(0);
  const [calculatedHours, setCalculatedHours] = useState(0);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

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

    // Batch initial data fetching in parallel
    Promise.all([
      fetchLeaveRequests(emp.id),
      fetchEmployeeInfo(emp.id),
      fetchHolidayDates(),
    ]).catch((err) => {
      console.error("Error loading initial data:", err);
    });
  }, [router]);

  // Auto-switch to LWOP if SIL credits are zero
  useEffect(() => {
    if (
      employeeInfo &&
      employeeInfo.sil_credits !== null &&
      employeeInfo.sil_credits !== undefined
    ) {
      const credits = employeeInfo.sil_credits;
      if (credits <= 0 && leaveType === "SIL") {
        setLeaveType("LWOP");
        toast.info(
          "SIL credits are zero. Switched to LWOP (Leave Without Pay)."
        );
      }
    }
  }, [employeeInfo, leaveType]);

  // Update startDate and endDate when selectedDates changes
  useEffect(() => {
    if (selectedDates.length > 0) {
      const sortedDates = [...selectedDates].sort();
      setStartDate(sortedDates[0]);
      setEndDate(sortedDates[sortedDates.length - 1]);
    } else {
      setStartDate("");
      setEndDate("");
    }
  }, [selectedDates]);

  useEffect(() => {
    // Calculate days from selected dates array
    if (selectedDates.length > 0) {
      let days = 0;
      selectedDates.forEach((dateStr) => {
        const date = new Date(dateStr);
        const dow = date.getDay();
        const isWeekend = dow === 0 || dow === 6;
        const isHoliday = holidayDates.has(dateStr);
        if (!isWeekend && !isHoliday) {
          days += 1;
        }
      });
      setCalculatedDays(days);
    } else {
      setCalculatedDays(0);
    }
    setCalculatedHours(0);
  }, [selectedDates, holidayDates]);

  async function fetchEmployeeInfo(employeeId: string) {
    try {
      const { data, error } = await supabase.rpc("get_employee_leave_credits", {
        p_employee_uuid: employeeId,
      } as any);

      if (error) {
        console.error("Error fetching employee leave credits:", error);
        // Set default values instead of null to prevent infinite loading state
        setEmployeeInfo({
          sil_credits: 0,
          maternity_credits: 0,
          paternity_credits: 0,
        });
        return;
      }

      const creditsData = data as Array<{
        sil_credits: number | null;
        maternity_credits: number | null;
        paternity_credits: number | null;
      }> | null;

      if (creditsData && creditsData.length > 0) {
        setEmployeeInfo({
          sil_credits: Number(creditsData[0].sil_credits ?? 0),
          maternity_credits: Number(creditsData[0].maternity_credits ?? 0),
          paternity_credits: Number(creditsData[0].paternity_credits ?? 0),
        });
      } else {
        setEmployeeInfo({
          sil_credits: 0,
          maternity_credits: 0,
          paternity_credits: 0,
        });
      }
    } catch (err) {
      console.error("Error fetching employee info:", err);
      // Set default values instead of null to prevent infinite loading state
      setEmployeeInfo({
        sil_credits: 0,
        maternity_credits: 0,
        paternity_credits: 0,
      });
    }
  }

  async function fetchHolidayDates() {
    try {
      const { data, error } = await supabase
        .from("holidays")
        .select("holiday_date");
      if (error) {
        console.error("Error fetching holidays:", error);
        return;
      }
      const holidaysData = data as Array<{
        holiday_date: string;
        holiday_name: string;
        holiday_type: string;
      }> | null;

      const set = new Set<string>();
      (holidaysData || []).forEach((h) => {
        if (h.holiday_date) set.add(h.holiday_date);
      });
      setHolidayDates(set);
    } catch (err) {
      console.error("Error fetching holidays:", err);
    }
  }

  async function fetchLeaveRequests(employeeId: string) {
    setLoading(true);
    const { data, error } = await supabase
      .from("leave_requests")
      .select(
        `
        *,
        leave_request_documents (
          id,
          file_name,
          file_type,
          file_size
        )
      `
      )
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching leave requests:", error);
      toast.error("Failed to load leave requests");
    } else {
      setRequests(data || []);
    }
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
      toast.error("Please select valid dates");
      return;
    }

    // Check SIL credits if SIL type
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
      if (silCredits < calculatedDays) {
        const proceedAsLwop = window.confirm(
          `You only have ${silCredits.toFixed(
            2
          )} SIL credits but filed for ${calculatedDays} day(s).\n\n` +
            `Click OK to switch this request to LWOP, or Cancel to adjust dates.`
        );
        if (!proceedAsLwop) return;
        setLeaveType("LWOP");
        toast.warning(
          "Converted to LWOP because filed SIL exceeds available credits."
        );
      }
    }

    if (leaveType === "Maternity Leave") {
      if (calculatedDays > maternityDays) {
        toast.error(
          `Insufficient Maternity Leave credits. Available: ${maternityDays}`
        );
        return;
      }
    }

    if (leaveType === "Paternity Leave") {
      if (calculatedDays > paternityDays) {
        toast.error(
          `Insufficient Paternity Leave credits. Available: ${paternityDays}`
        );
        return;
      }
    }

    if (leaveType === "SIL" && supportingDoc) {
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

    const payload = {
      employee_id: employee.id,
      leave_type: leaveType,
      start_date: startDate,
      end_date: endDate,
      selected_dates: selectedDates.length > 0 ? selectedDates : null,
      total_days: calculatedDays,
      total_hours: 0,
      reason: reason.trim(),
      status: "pending",
    };

    const { data: inserted, error } = await (
      supabase.from("leave_requests") as any
    )
      .insert(payload)
      .select()
      .single();

    if (error || !inserted) {
      setSubmitting(false);
      console.error("Error submitting leave request:", error);
      toast.error("Failed to submit leave request");
      return;
    }

    if (leaveType === "SIL" && supportingDoc) {
      setDocUploading(true);
      try {
        const base64 = await fileToBase64(supportingDoc);
        const resolvedType = resolveMimeType(supportingDoc);
        const { error: docError } = await (
          supabase.from("leave_request_documents") as any
        ).insert({
          leave_request_id: inserted.id,
          employee_id: employee.id,
          document_type: "SIL",
          file_name: supportingDoc.name,
          file_type: resolvedType,
          file_size: supportingDoc.size,
          file_base64: base64,
        });

        if (docError) {
          console.error("Error saving document:", docError);
          await supabase.from("leave_requests").delete().eq("id", inserted.id);
          toast.error("Failed to save document. Please try again.");
          setDocUploading(false);
          setSubmitting(false);
          return;
        }
      } catch (err) {
        console.error("Error preparing document:", err);
        await supabase.from("leave_requests").delete().eq("id", inserted.id);
        toast.error("Failed to attach document. Please try again.");
        setDocUploading(false);
        setSubmitting(false);
        return;
      }
      setDocUploading(false);
    }

    setSubmitting(false);

    toast.success("Leave request submitted successfully!", {
      description: `${leaveType} • ${calculatedDays} day(s) • Status: Pending approval`,
    });
    setSelectedDates([]);
    setStartDate("");
    setEndDate("");
    setReason("");
    setCalculatedDays(0);
    setCalculatedHours(0);
    setStartTime("");
    setEndTime("");
    setSupportingDoc(null);
    setDocError(null);
    fetchLeaveRequests(employee.id);
    fetchEmployeeInfo(employee.id);
  }

  async function handleCancel(requestId: string) {
    setCancelLoading(true);
    const { data, error } = await (supabase.from("leave_requests") as any)
      .update({ status: "cancelled" })
      .eq("id", requestId)
      .eq("employee_id", employee?.id || "")
      .eq("status", "pending")
      .select()
      .maybeSingle();

    setCancelLoading(false);

    if (error) {
      console.error("Error cancelling leave request:", error);
      toast.error("Failed to cancel leave request");
      return;
    }

    if (!data || data.length === 0) {
      toast.error("Could not cancel; request may no longer be pending.");
      return;
    }

    toast.success("Leave request cancelled", {
      description: "Your request has been cancelled successfully",
    });
    setCancelId(null);
    if (employee) {
      fetchLeaveRequests(employee.id);
      fetchEmployeeInfo(employee.id);
    }
  }

  async function handleDownload(docId: string) {
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
      <VStack gap="8" className="w-full">
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
      </VStack>
    );
  }

  // Use actual values from database
  const silCredits =
    employeeInfo?.sil_credits !== undefined &&
    employeeInfo?.sil_credits !== null
      ? Number(employeeInfo.sil_credits)
      : null;
  const maternityDays = employeeInfo?.maternity_credits ?? 0;
  const paternityDays = employeeInfo?.paternity_credits ?? 0;

  const visibleRequests = requests.filter((r) => r.status !== "cancelled");
  const pendingCount = visibleRequests.filter(
    (r) => r.status === "pending"
  ).length;
  const approvedCount = visibleRequests.filter(
    (r) => r.status === "approved_by_hr"
  ).length;
  const statusClasses: Record<LeaveRequest["status"], string> = {
    pending: "bg-amber-100 text-amber-800 border-amber-200",
    approved_by_manager: "bg-blue-100 text-blue-800 border-blue-200",
    approved_by_hr: "bg-emerald-100 text-emerald-900 border-emerald-200",
    rejected: "bg-rose-100 text-rose-900 border-rose-200",
    cancelled: "bg-slate-100 text-slate-800 border-slate-200",
  };

  return (
    <>
      <VStack gap="8" className="w-full">
        {/* Header */}
        <VStack gap="2" align="start">
          <H1>Leave Request</H1>
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
          <Card className="w-full h-full border-l-4 border-l-blue-500 hover:shadow-md transition-shadow">
            <CardContent className="w-full p-5">
              <VStack gap="2" align="start" className="w-full">
                <HStack gap="2" align="center">
                  <Icon
                    name="CalendarBlank"
                    size={IconSizes.sm}
                    className="text-blue-600"
                  />
                  <BodySmall className="font-medium text-muted-foreground">
                    SIL Credits
                  </BodySmall>
                </HStack>
                <div className="text-3xl font-bold text-blue-600">
                  {silCredits !== null ? silCredits.toFixed(2) : "—"}
                </div>
              </VStack>
            </CardContent>
          </Card>
          <Card className="w-full h-full border-l-4 border-l-pink-500 hover:shadow-md transition-shadow">
            <CardContent className="w-full p-5">
              <VStack gap="2" align="start" className="w-full">
                <HStack gap="2" align="center">
                  <Icon
                    name="User"
                    size={IconSizes.sm}
                    className="text-pink-600"
                  />
                  <BodySmall className="font-medium text-muted-foreground">
                    Maternity Days
                  </BodySmall>
                </HStack>
                <div className="text-3xl font-bold text-pink-600">
                  {maternityDays.toFixed(2)}
                </div>
              </VStack>
            </CardContent>
          </Card>
          <Card className="w-full h-full border-l-4 border-l-purple-500 hover:shadow-md transition-shadow">
            <CardContent className="w-full p-5">
              <VStack gap="2" align="start" className="w-full">
                <HStack gap="2" align="center">
                  <Icon
                    name="UsersThree"
                    size={IconSizes.sm}
                    className="text-purple-600"
                  />
                  <BodySmall className="font-medium text-muted-foreground">
                    Paternity Days
                  </BodySmall>
                </HStack>
                <div className="text-3xl font-bold text-purple-600">
                  {paternityDays.toFixed(2)}
                </div>
              </VStack>
            </CardContent>
          </Card>
        </div>

        {/* Request Form */}
        <Card className="w-full">
          <CardHeader className="pb-4">
            <CardTitle>
              <HStack gap="2" align="center">
                <Icon name="CalendarBlank" size={IconSizes.md} />
                File Leave Request
              </HStack>
            </CardTitle>
          </CardHeader>
          <CardContent className="w-full">
            <form onSubmit={handleSubmit} className="w-full">
              <VStack gap="6" className="w-full">
                <div className="w-full space-y-2">
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
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        value="Maternity Leave"
                        checked={leaveType === "Maternity Leave"}
                        onChange={(e) =>
                          setLeaveType(e.target.value as typeof leaveType)
                        }
                        className="h-4 w-4"
                      />
                      <span>Maternity Leave</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        value="Paternity Leave"
                        checked={leaveType === "Paternity Leave"}
                        onChange={(e) =>
                          setLeaveType(e.target.value as typeof leaveType)
                        }
                        className="h-4 w-4"
                      />
                      <span>Paternity Leave</span>
                    </label>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    {leaveType === "SIL" && (
                      <>
                        <p>
                          Available SIL Credits:{" "}
                          <strong>
                            {silCredits !== null
                              ? silCredits.toFixed(2)
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
                    {leaveType === "Maternity Leave" && (
                      <p>
                        Available Maternity days:{" "}
                        <strong>{maternityDays}</strong>
                        {maternityDays === 0 && (
                          <span className="text-red-600 font-medium ml-1">
                            (no allocation)
                          </span>
                        )}
                      </p>
                    )}
                    {leaveType === "Paternity Leave" && (
                      <p>
                        Available Paternity days:{" "}
                        <strong>{paternityDays}</strong>
                        {paternityDays === 0 && (
                          <span className="text-red-600 font-medium ml-1">
                            (no allocation)
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </div>

                <div className="w-full space-y-2">
                  <Label>Select Dates</Label>
                  <MultiDatePicker
                    selectedDates={selectedDates}
                    onChange={setSelectedDates}
                    minDate={new Date().toISOString().split("T")[0]}
                    holidayDates={holidayDates}
                  />
                  <p className="text-xs text-muted-foreground">
                    Select multiple non-consecutive dates by clicking on
                    them in the calendar. Weekends and holidays are
                    automatically excluded from the day count.
                  </p>
                </div>

                {calculatedDays > 0 && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="text-sm font-semibold text-blue-900">
                      Calculated Days:{" "}
                      <span className="text-lg">{calculatedDays}</span>
                      {selectedDates.length > 0 && (
                        <span className="text-xs font-normal text-blue-700 ml-2">
                          ({selectedDates.length} date
                          {selectedDates.length !== 1 ? "s" : ""} selected)
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {leaveType === "SIL" && (
                  <div className="w-full space-y-2">
                    <Label htmlFor="supporting-doc">
                      Supporting Document (optional, PDF/DOC/DOCX)
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
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium"
                    />
                    <p className="text-xs text-muted-foreground">
                      Optional: attach clinic slip or documentation for SIL. Max
                      5MB.
                    </p>
                    {supportingDoc && !docError && (
                      <HStack
                        gap="2"
                        align="center"
                        className="text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2"
                      >
                        <Icon name="Paperclip" size={IconSizes.sm} />
                        <span>{supportingDoc.name}</span>
                        <Caption>
                          {(supportingDoc.size / 1024 / 1024).toFixed(2)} MB
                        </Caption>
                      </HStack>
                    )}
                    {docError && (
                      <p className="text-sm text-destructive font-medium">
                        {docError}
                      </p>
                    )}
                  </div>
                )}

                <div className="w-full space-y-2">
                  <Label htmlFor="reason">Reason</Label>
                  <Textarea
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Provide reason for leave request..."
                    rows={4}
                    required
                  />
                </div>

                <Button
                  type="submit"
                  disabled={submitting || docUploading}
                  className="w-full"
                >
                  {submitting || docUploading
                    ? "Submitting..."
                    : "Submit Leave Request"}
                </Button>
              </VStack>
            </form>
          </CardContent>
        </Card>

        {/* Requests List */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle>My Leave Requests</CardTitle>
          </CardHeader>
          <CardContent className="w-full">
            {visibleRequests.length === 0 ? (
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
              <div className="space-y-4">
                {visibleRequests.map((request) => (
                  <Card
                    key={request.id}
                    className={`w-full ${
                      request.status === "pending"
                        ? "border-yellow-300"
                        : request.status === "approved_by_hr"
                        ? "border-emerald-300"
                        : request.status === "rejected"
                        ? "border-destructive"
                        : "border-border"
                    }`}
                  >
                    <CardContent className="w-full p-6">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <span className="font-bold text-lg">
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
                                    request.selected_dates.length > 3
                                      ? "..."
                                      : ""
                                  }`
                                )
                              ) : (
                                // Fallback to date range
                                <>
                                  {format(
                                    new Date(request.start_date),
                                    "MMM dd"
                                  )}{" "}
                                  -{" "}
                                  {format(
                                    new Date(request.end_date),
                                    "MMM dd, yyyy"
                                  )}
                                </>
                              )}
                            </span>
                            <Badge
                              variant="outline"
                              className={
                                request.leave_type === "SIL"
                                  ? "bg-blue-50 text-blue-800 border-blue-200"
                                  : "bg-amber-50 text-amber-800 border-amber-200"
                              }
                            >
                              {request.leave_type}
                            </Badge>
                            <span className="text-lg font-bold text-emerald-600">
                              {request.total_days}{" "}
                              {request.total_days === 1 ? "day" : "days"}
                            </span>
                          </div>

                          {request.reason && (
                            <div className="text-sm mb-2">
                              <strong>Reason:</strong>
                              <div className="mt-1 text-muted-foreground">
                                {request.reason}
                              </div>
                            </div>
                          )}

                          {request.leave_type === "SIL" && (
                            <VStack gap="2" align="start" className="mt-2">
                              <HStack gap="2" align="center">
                                <Icon name="FileText" size={IconSizes.sm} />
                                <BodySmall className="font-semibold">
                                  Supporting Document
                                </BodySmall>
                              </HStack>
                              {request.leave_request_documents &&
                              request.leave_request_documents.length > 0 ? (
                                <VStack gap="2">
                                  {request.leave_request_documents.map(
                                    (doc) => (
                                      <HStack
                                        key={doc.id}
                                        gap="2"
                                        align="center"
                                      >
                                        <Icon
                                          name="Paperclip"
                                          size={IconSizes.sm}
                                          className="text-muted-foreground"
                                        />
                                        <span className="truncate max-w-[160px] text-sm">
                                          {doc.file_name}
                                        </span>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleDownload(doc.id)}
                                          disabled={downloadingDocId === doc.id}
                                        >
                                          {downloadingDocId === doc.id
                                            ? "Loading..."
                                            : "View"}
                                        </Button>
                                      </HStack>
                                    )
                                  )}
                                </VStack>
                              ) : (
                                <BodySmall>
                                  No supporting document attached.
                                </BodySmall>
                              )}
                            </VStack>
                          )}

                          {request.status === "rejected" &&
                            request.rejection_reason && (
                              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md text-sm">
                                <strong className="text-red-900">
                                  Rejection Reason:
                                </strong>
                                <div className="text-red-800 mt-1">
                                  {request.rejection_reason}
                                </div>
                              </div>
                            )}
                        </div>

                        <VStack gap="2" align="end" className="ml-4">
                          {request.status === "pending" && (
                            <>
                              <Badge
                                variant="outline"
                                className={`flex items-center gap-2 ${statusClasses.pending}`}
                              >
                                <Icon name="Hourglass" size={IconSizes.sm} />
                                PENDING
                              </Badge>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setCancelId(request.id)}
                              >
                                Cancel
                              </Button>
                            </>
                          )}
                          {request.status === "approved_by_manager" && (
                            <Badge
                              variant="outline"
                              className={`flex items-center gap-2 ${statusClasses.approved_by_manager}`}
                            >
                              <Icon name="CheckCircle" size={IconSizes.sm} />
                              APPROVED BY MANAGER
                            </Badge>
                          )}
                          {request.status === "approved_by_hr" && (
                            <Badge
                              variant="outline"
                              className={`flex items-center gap-2 ${statusClasses.approved_by_hr}`}
                            >
                              <Icon name="CheckCircle" size={IconSizes.sm} />
                              APPROVED
                            </Badge>
                          )}
                          {request.status === "rejected" && (
                            <Badge
                              variant="outline"
                              className={`flex items-center gap-2 ${statusClasses.rejected}`}
                            >
                              <Icon name="XCircle" size={IconSizes.sm} />
                              REJECTED
                            </Badge>
                          )}
                          {request.status === "cancelled" && (
                            <Badge
                              variant="outline"
                              className={`flex items-center gap-2 ${statusClasses.cancelled}`}
                            >
                              <Icon name="XCircle" size={IconSizes.sm} />
                              CANCELLED
                            </Badge>
                          )}
                        </VStack>
                      </div>

                      <div className="text-xs text-muted-foreground mt-2">
                        Filed:{" "}
                        {format(
                          new Date(request.created_at),
                          "MMM dd, yyyy h:mm a"
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </VStack>
      <AlertDialog
        open={!!cancelId}
        onOpenChange={(open) => {
          if (!open) setCancelId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel leave request?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the request as cancelled and hide it from your
              list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelLoading}>
              Keep request
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelId && handleCancel(cancelId)}
              disabled={cancelLoading}
            >
              {cancelLoading ? "Cancelling..." : "Cancel request"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}