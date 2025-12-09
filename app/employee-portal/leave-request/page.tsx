"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Calendar,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Hourglass,
  FileText,
  Paperclip,
} from "lucide-react";
import { format, differenceInDays, addDays } from "date-fns";

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
    | "Paternity Leave"
    | "Off-setting";
  start_date: string;
  end_date: string;
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
  offset_hours: number;
}

export default function LeaveRequestPage() {
  const router = useRouter();
  const supabase = createClient();
  const [employee, setEmployee] = useState<EmployeeSession | null>(null);
  const [employeeInfo, setEmployeeInfo] = useState<EmployeeInfo | null>(null);
  const [offsetBalance, setOffsetBalance] = useState<number | null>(null);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [holidayDates, setHolidayDates] = useState<Set<string>>(new Set());
  const [supportingDoc, setSupportingDoc] = useState<File | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [docUploading, setDocUploading] = useState(false);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);

  // Form state
  const [leaveType, setLeaveType] = useState<
    "SIL" | "LWOP" | "Maternity Leave" | "Paternity Leave" | "Off-setting"
  >("SIL");
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
    fetchLeaveRequests(emp.id);
    fetchEmployeeInfo(emp.id);
    fetchOffsetBalance(emp.id);
    fetchHolidayDates();
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

  useEffect(() => {
    if (leaveType === "Off-setting") {
      if (startDate && startTime && endTime) {
        const start = new Date(`${startDate}T${startTime}`);
        const end = new Date(`${startDate}T${endTime}`);
        if (end > start) {
          const diffHours =
            (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          setCalculatedHours(diffHours);
        } else {
          setCalculatedHours(0);
        }
      } else {
        setCalculatedHours(0);
      }
      setCalculatedDays(0);
      return;
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (end >= start) {
        let days = 0;
        let cursor = new Date(start);
        while (cursor <= end) {
          const iso = cursor.toISOString().slice(0, 10);
          const dow = cursor.getDay();
          const isWeekend = dow === 0 || dow === 6;
          const isHoliday = holidayDates.has(iso);
          if (!isWeekend && !isHoliday) {
            days += 1;
          }
          cursor = addDays(cursor, 1);
        }
        setCalculatedDays(days);
      } else {
        setCalculatedDays(0);
      }
    } else {
      setCalculatedDays(0);
    }
    setCalculatedHours(0);
  }, [startDate, endDate, leaveType, startTime, endTime, holidayDates]);

  async function fetchEmployeeInfo(employeeId: string) {
    try {
      const { data, error } = await supabase.rpc("get_employee_leave_credits", {
        p_employee_uuid: employeeId,
      });

      if (error) {
        console.error("Error fetching employee leave credits:", error);
        setEmployeeInfo(null);
        return;
      }

      if (data && data.length > 0) {
        setEmployeeInfo({
          sil_credits: Number(data[0].sil_credits ?? 0),
          maternity_credits: Number(data[0].maternity_credits ?? 0),
          paternity_credits: Number(data[0].paternity_credits ?? 0),
          offset_hours: Number(data[0].offset_hours ?? 0),
        });
      } else {
        setEmployeeInfo({
          sil_credits: 0,
          maternity_credits: 0,
          paternity_credits: 0,
          offset_hours: 0,
        });
      }
    } catch (err) {
      console.error("Error fetching employee info:", err);
      setEmployeeInfo(null);
    }
  }

  async function fetchOffsetBalance(employeeId: string) {
    try {
      const { data, error } = await supabase.rpc("get_offset_balance_rpc", {
        p_employee_uuid: employeeId,
      });
      if (error) {
        console.error("Error fetching offset balance:", error);
        setOffsetBalance(null);
        return;
      }
      const val = Array.isArray(data) ? data[0]?.get_offset_balance_rpc : data;
      setOffsetBalance(val !== undefined && val !== null ? Number(val) : 0);
    } catch (err) {
      console.error("Error fetching offset balance:", err);
      setOffsetBalance(null);
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
      const set = new Set<string>();
      (data || []).forEach((h) => {
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
      !startDate ||
      (!endDate && leaveType !== "Off-setting") ||
      !reason.trim()
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (leaveType === "Off-setting") {
      if (!startTime || !endTime) {
        toast.error("Please provide start and end time for Off-setting");
        return;
      }
      if (calculatedHours <= 0) {
        toast.error(
          "Please provide a valid time range (end time after start time)"
        );
        return;
      }
      const requestedHours = Number(calculatedHours || 0);
      const availableHours = Number(offsetHours || 0);
      if (requestedHours > availableHours) {
        toast.error(
          `Requested Off-setting hours (${requestedHours.toFixed(
            2
          )}) exceed your available credits (${availableHours.toFixed(2)})`
        );
        return;
      }
    } else {
      if (calculatedDays <= 0) {
        toast.error("Please select valid dates");
        return;
      }
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

    if (leaveType === "Off-setting") {
      if (calculatedHours > offsetHours) {
        toast.error(
          `Insufficient Off-setting hours. Available: ${offsetHours.toFixed(2)}`
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

    const payload =
      leaveType === "Off-setting"
        ? {
            employee_id: employee.id,
            leave_type: leaveType,
            start_date: startDate,
            end_date: startDate,
            start_time: startTime,
            end_time: endTime,
            total_days: 0,
            total_hours: calculatedHours,
            reason: reason.trim(),
            status: "pending",
          }
        : {
            employee_id: employee.id,
            leave_type: leaveType,
            start_date: startDate,
            end_date: endDate,
            total_days: calculatedDays,
            total_hours: 0,
            reason: reason.trim(),
            status: "pending",
          };

    const { data: inserted, error } = await supabase
      .from("leave_requests")
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
        const { error: docError } = await supabase
          .from("leave_request_documents")
          .insert({
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

    toast.success("✅ Leave request submitted successfully!");
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
    const { data, error } = await supabase
      .from("leave_requests")
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

    toast.success("Leave request cancelled");
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

    const blob = base64ToBlob(
      data.file_base64,
      data.file_type || "application/octet-stream"
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = data.file_name || "document";
    link.target = "_blank";
    link.rel = "noopener";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (loading || !employee) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600" />
      </div>
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
  // Display both configured offset_hours (credits) and actual balance from earned/usage
  const offsetHours = offsetBalance ?? employeeInfo?.offset_hours ?? 0;
  const exceedsOffset =
    leaveType === "Off-setting" && calculatedHours > offsetHours;

  const visibleRequests = requests.filter((r) => r.status !== "cancelled");
  const pendingCount = visibleRequests.filter(
    (r) => r.status === "pending"
  ).length;
  const approvedCount = visibleRequests.filter(
    (r) => r.status === "approved_by_hr"
  ).length;

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
              <h1 className="text-2xl font-bold">Leave Request</h1>
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
                <div className="text-sm text-muted-foreground">SIL Credits</div>
                <div className="text-2xl font-bold text-emerald-600">
                  {silCredits !== null ? silCredits.toFixed(2) : "Loading..."}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">
                  Maternity Days
                </div>
                <div className="text-2xl font-bold text-emerald-600">
                  {maternityDays.toFixed(2)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">
                  Paternity Days
                </div>
                <div className="text-2xl font-bold text-emerald-600">
                  {paternityDays.toFixed(2)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">
                  Off-setting Hours
                </div>
                <div className="text-2xl font-bold text-emerald-600">
                  {offsetHours.toFixed(2)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Request Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                File Leave Request
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Leave Type</Label>
                  <div className="flex flex-wrap gap-4">
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
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        value="Off-setting"
                        checked={leaveType === "Off-setting"}
                        onChange={(e) =>
                          setLeaveType(e.target.value as typeof leaveType)
                        }
                        className="h-4 w-4"
                      />
                      <span>Off-setting (hours)</span>
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
                            ⚠️ You have no SIL credits available. Please select
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
                    {leaveType === "Off-setting" && (
                      <p>
                        Available Off-setting hours:{" "}
                        <strong>{offsetHours}</strong>
                        {offsetHours === 0 && (
                          <span className="text-red-600 font-medium ml-1">
                            (no allocation)
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </div>

                {leaveType !== "Off-setting" && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="start-date">Start Date</Label>
                        <Input
                          id="start-date"
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          min={new Date().toISOString().split("T")[0]}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="end-date">End Date</Label>
                        <Input
                          id="end-date"
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          min={
                            startDate || new Date().toISOString().split("T")[0]
                          }
                          required
                        />
                      </div>
                    </div>

                    {calculatedDays > 0 && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                        <div className="text-sm font-semibold text-blue-900">
                          Calculated Days:{" "}
                          <span className="text-lg">{calculatedDays}</span>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {leaveType === "Off-setting" && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="offset-date">Date</Label>
                        <Input
                          id="offset-date"
                          type="date"
                          value={startDate}
                          onChange={(e) => {
                            setStartDate(e.target.value);
                            setEndDate(e.target.value);
                          }}
                          min={new Date().toISOString().split("T")[0]}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Duration (hours)</Label>
                        <div className="p-3 border rounded-md bg-gray-50 text-sm">
                          {calculatedHours > 0
                            ? `${calculatedHours.toFixed(2)} hours`
                            : "Enter time range"}
                        </div>
                        {exceedsOffset && (
                          <p className="text-sm text-red-600 font-semibold">
                            Requested hours exceed available Off-setting credits
                            ({offsetHours.toFixed(2)}).
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="start-time">Start Time</Label>
                        <Input
                          id="start-time"
                          type="time"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="end-time">End Time</Label>
                        <Input
                          id="end-time"
                          type="time"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  </>
                )}

                {leaveType === "SIL" && (
                  <div className="space-y-2">
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
                      <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-md px-3 py-2">
                        <Paperclip className="h-4 w-4" />
                        <span>{supportingDoc.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {(supportingDoc.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </div>
                    )}
                    {docError && (
                      <p className="text-sm text-red-600 font-medium">
                        {docError}
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="reason">Reason</Label>
                  <textarea
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Provide reason for leave request..."
                    rows={4}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  disabled={submitting || docUploading}
                  className="w-full"
                  isLoading={submitting || docUploading}
                >
                  Submit Leave Request
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Requests List */}
          <Card>
            <CardHeader>
              <CardTitle>My Leave Requests</CardTitle>
            </CardHeader>
            <CardContent>
              {visibleRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No leave requests yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {visibleRequests.map((request) => (
                    <Card
                      key={request.id}
                      className={`${
                        request.status === "pending"
                          ? "border-yellow-300"
                          : request.status === "approved_by_hr"
                          ? "border-green-300"
                          : request.status === "rejected"
                          ? "border-red-300"
                          : "border-gray-300"
                      }`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                              <span className="font-bold text-lg">
                                {format(new Date(request.start_date), "MMM dd")}{" "}
                                -{" "}
                                {format(
                                  new Date(request.end_date),
                                  "MMM dd, yyyy"
                                )}
                              </span>
                              <Badge
                                variant={
                                  request.leave_type === "SIL"
                                    ? "info"
                                    : "warning"
                                }
                              >
                                {request.leave_type}
                              </Badge>
                              {request.leave_type === "Off-setting" ? (
                                <span className="text-lg font-bold text-emerald-600">
                                  {request.total_hours ?? 0} hrs
                                </span>
                              ) : (
                                <span className="text-lg font-bold text-emerald-600">
                                  {request.total_days}{" "}
                                  {request.total_days === 1 ? "day" : "days"}
                                </span>
                              )}
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
                              <div className="mt-2">
                                <div className="flex items-center gap-2 text-sm font-semibold">
                                  <FileText className="h-4 w-4" />
                                  Supporting Document
                                </div>
                                {request.leave_request_documents &&
                                request.leave_request_documents.length > 0 ? (
                                  request.leave_request_documents.map((doc) => (
                                    <div
                                      key={doc.id}
                                      className="flex items-center gap-2 mt-1 text-sm"
                                    >
                                      <Paperclip className="h-4 w-4 text-muted-foreground" />
                                      <span className="truncate max-w-[160px]">
                                        {doc.file_name}
                                      </span>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleDownload(doc.id)}
                                        isLoading={downloadingDocId === doc.id}
                                      >
                                        View
                                      </Button>
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-sm text-muted-foreground">
                                    No supporting document attached.
                                  </p>
                                )}
                              </div>
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

                          <div className="ml-4 flex flex-col items-end gap-2">
                            {request.status === "pending" && (
                              <>
                                <Badge
                                  variant="warning"
                                  className="flex items-center gap-2"
                                >
                                  <Hourglass className="h-4 w-4" />
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
                                variant="info"
                                className="flex items-center gap-2"
                              >
                                <CheckCircle className="h-4 w-4" />
                                APPROVED BY MANAGER
                              </Badge>
                            )}
                            {request.status === "approved_by_hr" && (
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
        </div>
      </div>
      {cancelId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-semibold text-foreground">
              Cancel leave request?
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
