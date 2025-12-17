"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { formatPHTime } from "@/utils/format";
import { createClient } from "@/lib/supabase/client";
import { useEmployeeSession } from "@/contexts/EmployeeSessionContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { BodySmall, Caption } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";

type OvertimeRequest = {
  id: string;
  ot_date: string;
  start_time: string;
  end_time: string;
  total_hours: number;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  created_at: string;
  overtime_documents?: {
    id: string;
    file_name: string;
    file_size: number | null;
  }[];
};

export default function OvertimePage() {
  const supabase = createClient();
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
    cancelled: "bg-slate-100 text-slate-800 border-slate-200",
  };
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
    const { data, error } = await supabase.rpc("get_my_overtime_requests", {
      p_employee_id: employee.id,
    });
    if (error) {
      console.error("Error loading OT requests", error);
      toast.error("Failed to load OT requests");
    } else {
      // data.overtime_documents is jsonb array; align with state shape
      const normalized = (data || []).map((row: any) => ({
        ...row,
        overtime_documents: row.overtime_documents || [],
      }));
      setRequests(normalized as OvertimeRequest[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadRequests();
  }, [employee.id, supabase]);

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
    const { data: created, error } = await supabase.rpc(
      "create_overtime_request",
      {
        p_employee_id: employee.id,
        p_ot_date: formData.ot_date,
        p_start_time: formData.start_time,
        p_end_time: formData.end_time,
        p_total_hours: totalHours,
        p_reason: formData.reason || null,
        p_end_date: formData.end_date || calculatedEndDate || null,
      }
    );
    if (error) {
      console.error("Error filing OT", error);
      toast.error(error.message || "Failed to submit OT request");
    } else {
      const latestId = created?.id;

      if (latestId && supportingDoc) {
        if (!isAllowedFile(supportingDoc)) {
          setDocError("Only PDF, DOC, or DOCX files are allowed");
        } else if (supportingDoc.size > MAX_FILE_SIZE) {
          setDocError("File too large. Max size is 5MB.");
        } else {
          try {
            const base64 = await fileToBase64(supportingDoc);
            const resolvedType = resolveMimeType(supportingDoc);
            const { error: docErr } = await supabase
              .from("overtime_documents")
              .insert({
                overtime_request_id: latestId,
                employee_id: employee.id,
                file_name: supportingDoc.name,
                file_type: resolvedType,
                file_size: supportingDoc.size,
                file_base64: base64,
              });
            if (docErr) {
              console.error("Error saving OT document:", docErr);
              setDocError(docErr.message || "Failed to attach document");
            }
          } catch (err: any) {
            console.error("Error preparing OT document:", err);
            setDocError(err?.message || "Failed to attach document");
          }
        }
      }

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

      toast.success("Overtime request submitted successfully!", {
        description: `Date: ${dateRange} • ${totalHours.toFixed(2)} hours`,
      });
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
            File overtime. After approval, hours convert 1:1 to Off-setting
            credits.
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

              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? "Submitting..." : "Submit OT Request"}
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
            <div className="text-center py-8">
              <BodySmall>Loading OT requests...</BodySmall>
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-8">
              <VStack gap="4" align="center">
                <Icon
                  name="ClockClockwise"
                  size={IconSizes.xl}
                  className="text-muted-foreground opacity-50"
                />
                <BodySmall>No OT requests yet</BodySmall>
              </VStack>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((req) => (
                <Card
                  key={req.id}
                  className={`w-full ${
                    req.status === "pending"
                      ? "border-yellow-300"
                      : req.status === "approved"
                      ? "border-emerald-300"
                      : req.status === "rejected"
                      ? "border-destructive"
                      : "border-border"
                  }`}
                >
                  <CardContent className="w-full p-6">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
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

                        {req.overtime_documents?.length ? (
                          <VStack gap="2" align="start" className="mt-2">
                            <HStack gap="2" align="center">
                              <Icon name="FileText" size={IconSizes.sm} />
                              <BodySmall className="font-semibold">
                                Supporting Document
                              </BodySmall>
                            </HStack>
                            <VStack gap="2">
                              {req.overtime_documents.map((doc) => (
                                <HStack key={doc.id} gap="2" align="center">
                                  <Icon
                                    name="Paperclip"
                                    size={IconSizes.sm}
                                    className="text-muted-foreground"
                                  />
                                  <span className="truncate max-w-[160px] text-sm">
                                    {doc.file_name}
                                  </span>
                                  {doc.file_size && (
                                    <Caption>
                                      (
                                      {(doc.file_size / 1024 / 1024).toFixed(2)}{" "}
                                      MB)
                                    </Caption>
                                  )}
                                </HStack>
                              ))}
                            </VStack>
                          </VStack>
                        ) : null}
                      </div>

                      <VStack gap="2" align="end" className="ml-4">
                        {req.status === "pending" && (
                          <>
                            <Badge
                              variant="outline"
                              className={`flex items-center gap-2 ${statusStyles.pending}`}
                            >
                              <Icon name="Hourglass" size={IconSizes.sm} />
                              PENDING
                            </Badge>
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={cancelLoading === req.id}
                              onClick={async () => {
                                setCancelLoading(req.id);
                                const { error } = await supabase.rpc(
                                  "cancel_overtime_request",
                                  {
                                    p_request_id: req.id,
                                    p_employee_id: employee.id,
                                  }
                                );
                                if (error) {
                                  toast.error(
                                    error.message ||
                                      "Failed to cancel OT request"
                                  );
                                } else {
                                  toast.success("OT request cancelled");
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
                        {req.status === "approved" && (
                          <Badge
                            variant="outline"
                            className={`flex items-center gap-2 ${statusStyles.approved}`}
                          >
                            <Icon name="CheckCircle" size={IconSizes.sm} />
                            APPROVED
                          </Badge>
                        )}
                        {req.status === "rejected" && (
                          <Badge
                            variant="outline"
                            className={`flex items-center gap-2 ${statusStyles.rejected}`}
                          >
                            <Icon name="XCircle" size={IconSizes.sm} />
                            REJECTED
                          </Badge>
                        )}
                        {req.status === "cancelled" && (
                          <Badge
                            variant="outline"
                            className={`flex items-center gap-2 ${statusStyles.cancelled}`}
                          >
                            <Icon name="XCircle" size={IconSizes.sm} />
                            CANCELLED
                          </Badge>
                        )}
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
