"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { formatPHTime } from "@/utils/format";
import { useEmployeeSession } from "@/contexts/EmployeeSessionContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { BodySmall, Caption, H1, H3 } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

type OvertimeDocSummary = { id: string; file_name: string };

type OvertimeRequest = {
  id: string;
  ot_date: string;
  start_time: string;
  end_time: string;
  total_hours: number;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  project_manager_id?: string | null;
  account_manager_id?: string | null;
  project_manager_approved_at?: string | null;
  approved_by?: string | null;
  hr_approved_by?: string | null;
  approved_at?: string | null;
  manager_approval_name?: string | null;
  final_approval_name?: string | null;
  created_at: string;
  overtime_documents?: OvertimeDocSummary[];
};

export default function OvertimePage() {
  const { employee } = useEmployeeSession();
  const [requests, setRequests] = useState<OvertimeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cancelLoading, setCancelLoading] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    ot_date: "",
    end_date: "",
    start_time: "",
    end_time: "",
    reason: "",
  });
  const [supportingDoc, setSupportingDoc] = useState<File | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [replaceDocByRequestId, setReplaceDocByRequestId] = useState<
    Record<string, File | null>
  >({});
  const [replaceDocLoadingId, setReplaceDocLoadingId] = useState<string | null>(
    null
  );
  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  const ALLOWED_TYPES = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  const statusStyles: Record<OvertimeRequest["status"], string> = {
    pending: "bg-amber-100 text-amber-800 border-amber-200",
    approved: "bg-emerald-100 text-emerald-900 border-emerald-200",
    rejected: "bg-rose-100 text-rose-900 border-rose-200",
  };
  const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx"];
  const isManagerApproved = (request: OvertimeRequest) =>
    request.status === "pending" &&
    Boolean(request.project_manager_id || request.account_manager_id);

  const approvedCount = requests.filter(
    (r) => r.status === "approved" || isManagerApproved(r)
  ).length;

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

  const totalHours = useMemo(() => {
    if (!formData.start_time || !formData.end_time) return 0;
    if (!formData.ot_date) return 0;

    // Build start datetime
    const startDate = new Date(`${formData.ot_date}T${formData.start_time}:00`);

    // Build end datetime
    let endDate: Date;

    // If end_date is explicitly provided, use it (for multi-day OT)
    if (formData.end_date) {
      endDate = new Date(`${formData.end_date}T${formData.end_time}:00`);
    } else {
      // Auto-detect: if end_time < start_time, it spans midnight
      const startTimeOnly = new Date(`2000-01-01T${formData.start_time}:00`);
      const endTimeOnly = new Date(`2000-01-01T${formData.end_time}:00`);
      if (endTimeOnly.getTime() <= startTimeOnly.getTime()) {
        // Spans midnight - automatically add 1 day
        endDate = new Date(`${formData.ot_date}T${formData.end_time}:00`);
        endDate.setDate(endDate.getDate() + 1);
      } else {
        endDate = new Date(`${formData.ot_date}T${formData.end_time}:00`);
      }
    }

    const diffMs = endDate.getTime() - startDate.getTime();
    if (diffMs <= 0) return 0;
    return Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
  }, [
    formData.start_time,
    formData.end_time,
    formData.ot_date,
    formData.end_date,
  ]);

  const loadRequests = async () => {
    setLoading(true);
    const response = await fetch(
      `/api/employee-portal/overtime-requests?employee_id=${encodeURIComponent(
        employee.id
      )}`
    );
    const payload = await response.json();

    if (!response.ok) {
      console.error("Error loading OT requests", payload);
      toast.error("Failed to load OT requests");
      setLoading(false);
      return;
    }

    setRequests((payload.requests || []) as OvertimeRequest[]);
    setLoading(false);
  };

  useEffect(() => {
    loadRequests();
  }, [employee.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.ot_date || !formData.start_time || !formData.end_time) {
      toast.error("Please fill date, start time, and end time.");
      return;
    }
    if (totalHours <= 0) {
      toast.error("Invalid time range. Please check your times.");
      return;
    }

    if (supportingDoc) {
      if (!isAllowedFile(supportingDoc)) {
        toast.error("Only PDF, DOC, or DOCX files are allowed.");
        return;
      }
      if (supportingDoc.size > MAX_FILE_SIZE) {
        toast.error("File too large. Max size is 5MB.");
        return;
      }
    }

    // Auto-calculate end_date if not provided but spans midnight
    let calculatedEndDate: string | null = null;
    if (!formData.end_date) {
      const startTimeOnly = new Date(`2000-01-01T${formData.start_time}:00`);
      const endTimeOnly = new Date(`2000-01-01T${formData.end_time}:00`);
      if (endTimeOnly.getTime() <= startTimeOnly.getTime()) {
        // Spans midnight - calculate end_date as ot_date + 1 day
        const endDateObj = new Date(formData.ot_date);
        endDateObj.setDate(endDateObj.getDate() + 1);
        calculatedEndDate = endDateObj.toISOString().split("T")[0];
      }
    }

    setSubmitting(true);
    setDocError(null);

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

    const createResponse = await fetch("/api/employee-portal/overtime-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employee_id: employee.id,
        ot_date: formData.ot_date,
        end_date: formData.end_date || calculatedEndDate || null,
        start_time: formData.start_time,
        end_time: formData.end_time,
        total_hours: totalHours,
        reason: formData.reason || null,
        document: documentPayload,
      }),
    });
    const createPayload = await createResponse.json();

    if (!createResponse.ok) {
      console.error("Error filing OT", createPayload);
      toast.error(createPayload?.error || "Failed to submit OT request");
    } else {
      // Determine if OT spans midnight
      const startTimeOnly = new Date(`2000-01-01T${formData.start_time}:00`);
      const endTimeOnly = new Date(`2000-01-01T${formData.end_time}:00`);
      const spansMidnight = endTimeOnly.getTime() <= startTimeOnly.getTime();
      const actualEndDate =
        formData.end_date ||
        (spansMidnight
          ? (() => {
              const d = new Date(formData.ot_date);
              d.setDate(d.getDate() + 1);
              return d.toISOString().split("T")[0];
            })()
          : formData.ot_date);

      const dateRange =
        spansMidnight ||
        (formData.end_date && formData.end_date !== formData.ot_date)
          ? `${formatPHTime(
              new Date(formData.ot_date),
              "MMM d"
            )} - ${formatPHTime(new Date(actualEndDate), "MMM d, yyyy")}`
          : formatPHTime(new Date(formData.ot_date), "MMM d, yyyy");

      if (createPayload?.warning) {
        toast.warning(createPayload.warning, {
          description: `Date: ${dateRange} • ${totalHours.toFixed(2)} hours`,
        });
      } else {
        toast.success("Overtime request submitted successfully!", {
          description: `Date: ${dateRange} • ${totalHours.toFixed(2)} hours`,
        });
      }
      setFormData({
        ot_date: "",
        end_date: "",
        start_time: "",
        end_time: "",
        reason: "",
      });
      setSupportingDoc(null);
      await loadRequests();
    }
    setSubmitting(false);
  };

  return (
    <VStack gap="6" className="w-full">
      <VStack gap="2" align="start">
        <H1>OT filing</H1>
        <BodySmall className="text-muted-foreground">
          Submit overtime hours, attach supporting documents, and track request status.
        </BodySmall>
      </VStack>
      {/* Request Form */}
      <Card className="w-full">
        <CardHeader className="pb-4">
          <CardTitle>
            <HStack gap="2" align="center">
              <Icon name="ClockClockwise" size={IconSizes.md} />
              OT Filing
            </HStack>
          </CardTitle>
          <BodySmall className="text-muted-foreground">
            File overtime request for approval.
          </BodySmall>
        </CardHeader>
        <CardContent className="w-full">
          <form onSubmit={handleSubmit} className="w-full">
            <VStack gap="6" className="w-full">
              <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="w-full space-y-2">
                  <Label htmlFor="ot-date">OT Date</Label>
                  <Input
                    id="ot-date"
                    type="date"
                    required
                    value={formData.ot_date}
                    onChange={(e) =>
                      setFormData({ ...formData, ot_date: e.target.value })
                    }
                  />
                </div>
                <div className="w-full space-y-2">
                  <Label htmlFor="start-time">Start Time</Label>
                  <Input
                    id="start-time"
                    type="time"
                    required
                    value={formData.start_time}
                    onChange={(e) =>
                      setFormData({ ...formData, start_time: e.target.value })
                    }
                  />
                </div>
                <div className="w-full space-y-2">
                  <Label htmlFor="end-time">End Time</Label>
                  <Input
                    id="end-time"
                    type="time"
                    required
                    value={formData.end_time}
                    onChange={(e) =>
                      setFormData({ ...formData, end_time: e.target.value })
                    }
                  />
                </div>
                <div className="w-full space-y-2">
                  <Label htmlFor="total-hours">Total Hours (auto)</Label>
                  <Input
                    id="total-hours"
                    value={totalHours.toFixed(2)}
                    readOnly
                    className="bg-muted"
                  />
                </div>
              </div>

              {/* Optional end date for multi-day OT */}
              {(() => {
                const startTimeOnly = new Date(
                  `2000-01-01T${formData.start_time}:00`
                );
                const endTimeOnly = new Date(
                  `2000-01-01T${formData.end_time}:00`
                );
                const autoSpansMidnight =
                  formData.start_time &&
                  formData.end_time &&
                  endTimeOnly.getTime() <= startTimeOnly.getTime();

                return (
                  <div className="w-full space-y-2">
                    <Label htmlFor="end-date">
                      End Date {autoSpansMidnight && "(auto-calculated)"}
                    </Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={formData.end_date}
                      min={formData.ot_date}
                      onChange={(e) =>
                        setFormData({ ...formData, end_date: e.target.value })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      {autoSpansMidnight
                        ? "Automatically set to next day. Change only if OT spans multiple days."
                        : "Optional: Only needed if overtime spans multiple days beyond the next day."}
                    </p>
                  </div>
                );
              })()}

              {totalHours > 0 && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="text-sm font-semibold text-blue-900">
                    Calculated Hours:{" "}
                    <span className="text-lg">{totalHours.toFixed(2)}</span>
                  </div>
                </div>
              )}

              <div className="w-full space-y-2">
                <Label htmlFor="reason">Reason</Label>
                <Textarea
                  id="reason"
                  rows={4}
                  value={formData.reason}
                  onChange={(e) =>
                    setFormData({ ...formData, reason: e.target.value })
                  }
                  placeholder="Provide reason for overtime request..."
                />
              </div>

              <div className="w-full space-y-2">
                <Label htmlFor="ot-doc">
                  Supporting Document (optional, PDF/DOC/DOCX)
                </Label>
                <input
                  id="ot-doc"
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
                      setDocError("Only PDF, DOC, or DOCX files are allowed.");
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
                  Optional: attach supporting document for overtime. Max 5MB.
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

              <Button
                type="submit"
                disabled={
                  submitting ||
                  !formData.ot_date ||
                  !formData.start_time ||
                  !formData.end_time
                }
                className="w-full md:w-auto md:min-w-[200px] text-sm md:text-base px-3 md:px-4 py-3 md:py-4 min-h-[48px] md:min-h-[56px]"
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
                    Submit OT Request
                  </>
                )}
              </Button>
            </VStack>
          </form>
        </CardContent>
      </Card>

      {/* Requests List */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle>My OT Requests</CardTitle>
        </CardHeader>
        <CardContent className="w-full">
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12">
              <VStack gap="4" align="center">
                <div className="rounded-full bg-muted p-6">
                  <Icon
                    name="ClockClockwise"
                    size={IconSizes.xl}
                    className="text-muted-foreground"
                  />
                </div>
                <VStack gap="2" align="center">
                  <H3 className="text-lg font-semibold">No OT Requests Yet</H3>
                  <BodySmall className="text-muted-foreground max-w-md">
                    You haven't filed any overtime requests. Use the form above
                    to submit a new OT request.
                  </BodySmall>
                </VStack>
              </VStack>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((req, idx) => (
                <Card
                  key={req.id}
                  className={`w-full ${idx > 0 ? "hidden md:block" : ""} ${
                    req.status === "pending"
                      ? "border-yellow-300"
                      : req.status === "approved"
                      ? "border-emerald-300"
                      : req.status === "rejected"
                      ? "border-destructive"
                      : "border-border"
                  }`}
                >
                  <CardContent className="w-full p-4 sm:p-6">
                    <div className="mb-2 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <span className="font-bold text-lg">
                            {format(new Date(req.ot_date), "MMM dd, yyyy")}
                          </span>
                          <Badge
                            variant="outline"
                            className="bg-emerald-50 text-emerald-800 border-emerald-200"
                          >
                            OT
                          </Badge>
                          <span className="text-lg font-bold text-emerald-600">
                            {req.total_hours}h
                          </span>
                        </div>

                        <div className="text-sm mb-2">
                          <strong>Time:</strong> {req.start_time} -{" "}
                          {req.end_time}
                        </div>

                        {req.reason && (
                          <div className="text-sm mb-2">
                            <strong>Reason:</strong>
                            <div className="mt-1 text-muted-foreground">
                              {req.reason}
                            </div>
                          </div>
                        )}

                        {req.overtime_documents &&
                          req.overtime_documents.length > 0 && (
                          <div className="hidden md:block">
                            <VStack gap="1" align="start" className="mt-2">
                                <HStack gap="2" align="center">
                                  <Icon name="FileText" size={IconSizes.sm} />
                                  <BodySmall className="font-semibold">
                                    Supporting document
                                    {req.overtime_documents.length > 1 ? "s" : ""}
                                  </BodySmall>
                                </HStack>
                                {req.overtime_documents.map((d) => (
                                  <Caption
                                    key={d.id}
                                    className="text-muted-foreground"
                                  >
                                    {d.file_name}
                                  </Caption>
                                ))}
                              </VStack>
                          </div>
                          )}

                        {req.status === "pending" && !isManagerApproved(req) && (
                          <div className="hidden md:block mt-3 w-full space-y-2 rounded-md border border-dashed border-muted-foreground/30 p-3">
                            <Label
                              htmlFor={`replace-doc-${req.id}`}
                              className="text-xs font-medium"
                            >
                              Replace supporting document (PDF/DOC/DOCX)
                            </Label>
                            <input
                              id={`replace-doc-${req.id}`}
                              type="file"
                              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                              className="flex w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs file:mr-2 file:border-0 file:bg-transparent file:text-xs"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) {
                                  setReplaceDocByRequestId((prev) => ({
                                    ...prev,
                                    [req.id]: null,
                                  }));
                                  return;
                                }
                                if (!isAllowedFile(file)) {
                                  toast.error("Only PDF, DOC, or DOCX files are allowed.");
                                  e.target.value = "";
                                  return;
                                }
                                if (file.size > MAX_FILE_SIZE) {
                                  toast.error("File too large. Max size is 5MB.");
                                  e.target.value = "";
                                  return;
                                }
                                setReplaceDocByRequestId((prev) => ({
                                  ...prev,
                                  [req.id]: file,
                                }));
                              }}
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={
                                replaceDocLoadingId === req.id ||
                                !replaceDocByRequestId[req.id]
                              }
                              onClick={async () => {
                                const file = replaceDocByRequestId[req.id];
                                if (!file || !employee?.id) return;
                                setReplaceDocLoadingId(req.id);
                                try {
                                  const base64 = await fileToBase64(file);
                                  const res = await fetch(
                                    "/api/employee-portal/overtime-requests",
                                    {
                                      method: "PATCH",
                                      headers: {
                                        "Content-Type": "application/json",
                                      },
                                      body: JSON.stringify({
                                        request_id: req.id,
                                        employee_id: employee.id,
                                        document: {
                                          file_name: file.name,
                                          file_type: resolveMimeType(file),
                                          file_size: file.size,
                                          file_base64: base64,
                                        },
                                      }),
                                    }
                                  );
                                  const payload = await res.json();
                                  if (!res.ok) {
                                    toast.error(
                                      payload?.error || "Failed to update document"
                                    );
                                  } else {
                                    if (payload?.warning) {
                                      toast.warning(payload.warning);
                                    } else {
                                      toast.success("Supporting document updated");
                                    }
                                    setReplaceDocByRequestId((prev) => ({
                                      ...prev,
                                      [req.id]: null,
                                    }));
                                    await loadRequests();
                                  }
                                } catch (err) {
                                  console.error(err);
                                  toast.error("Failed to update document");
                                } finally {
                                  setReplaceDocLoadingId(null);
                                }
                              }}
                            >
                              {replaceDocLoadingId === req.id
                                ? "Uploading..."
                                : "Save new file"}
                            </Button>
                          </div>
                        )}
                      </div>

                      <VStack
                        gap="2"
                        align="end"
                        className="w-full lg:ml-4 lg:w-auto"
                      >
                        {req.status === "pending" && !isManagerApproved(req) && (
                          <>
                            <Badge
                              variant="outline"
                              className={`flex w-full items-center justify-center gap-2 text-center lg:w-auto ${statusStyles.pending}`}
                            >
                              <Icon name="Hourglass" size={IconSizes.sm} />
                              PENDING
                            </Badge>
                            <Button
                              variant="secondary"
                              size="sm"
                              className="w-full lg:w-auto"
                              disabled={cancelLoading === req.id}
                              onClick={async () => {
                                setCancelLoading(req.id);
                                const response = await fetch(
                                  "/api/employee-portal/overtime-requests",
                                  {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      request_id: req.id,
                                      employee_id: employee.id,
                                    }),
                                  }
                                );
                                const payload = await response.json();
                                if (!response.ok) {
                                  toast.error(
                                    payload?.error ||
                                      "Failed to cancel OT request"
                                  );
                                } else {
                                  toast.success("OT request removed");
                                  await loadRequests();
                                }
                                setCancelLoading(null);
                              }}
                            >
                              {cancelLoading === req.id
                                ? "Cancelling..."
                                : "Cancel"}
                            </Button>
                          </>
                        )}
                        {isManagerApproved(req) && (
                          <>
                            <Badge
                              variant="outline"
                              className="flex w-full items-center justify-center gap-2 text-center bg-blue-100 text-blue-800 border-blue-200 lg:w-auto"
                            >
                              <Icon name="CheckCircle" size={IconSizes.sm} />
                              APPROVED BY OPERATIONS MANAGER
                            </Badge>
                            <div className="w-full rounded-md border bg-blue-50 px-3 py-2 text-left text-xs text-blue-900 lg:max-w-[220px] lg:text-right">
                              {req.manager_approval_name && (
                                <div className="font-semibold">
                                  {req.manager_approval_name}
                                </div>
                              )}
                              {req.project_manager_approved_at && (
                                <div className="text-blue-700">
                                  {formatPHTime(
                                    req.project_manager_approved_at,
                                    "MMM dd, yyyy h:mm a"
                                  )}
                                </div>
                              )}
                            </div>
                          </>
                        )}
                        {req.status === "approved" && (
                          <Badge
                            variant="outline"
                            className={`flex w-full items-center justify-center gap-2 text-center lg:w-auto ${statusStyles.approved}`}
                          >
                            <Icon name="CheckCircle" size={IconSizes.sm} />
                            APPROVED
                          </Badge>
                        )}
                        {req.status === "approved" &&
                          (req.final_approval_name || req.approved_at) && (
                            <div className="w-full rounded-md border bg-emerald-50 px-3 py-2 text-left text-xs text-emerald-900 lg:max-w-[220px] lg:text-right">
                              <div className="font-semibold">Approved by HR</div>
                              {req.final_approval_name && (
                                <div>{req.final_approval_name}</div>
                              )}
                              {req.approved_at && (
                                <div className="text-emerald-700">
                                  {formatPHTime(
                                    req.approved_at,
                                    "MMM dd, yyyy h:mm a"
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        {req.status === "rejected" && (
                          <Badge
                            variant="outline"
                            className={`flex w-full items-center justify-center gap-2 text-center lg:w-auto ${statusStyles.rejected}`}
                          >
                            <Icon name="XCircle" size={IconSizes.sm} />
                            REJECTED
                          </Badge>
                        )}
                        {/* "Cancelled" state is represented as REJECTED in the new schema */}
                      </VStack>
                    </div>

                    <div className="text-xs text-muted-foreground mt-2">
                      Filed:{" "}
                      {format(new Date(req.created_at), "MMM dd, yyyy h:mm a")}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </VStack>
  );
}