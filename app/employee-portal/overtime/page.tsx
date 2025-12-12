"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { formatPHTime } from "@/utils/format";
import { createClient } from "@/lib/supabase/client";
import { useEmployeeSession } from "@/contexts/EmployeeSessionContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSection } from "@/components/ui/card-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { H1, H3, BodySmall, Caption } from "@/components/ui/typography";
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
    const start = new Date(`2000-01-01T${formData.start_time}:00`);
    const end = new Date(`2000-01-01T${formData.end_time}:00`);
    const diffMs = end.getTime() - start.getTime();
    if (diffMs <= 0) return 0;
    return Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
  }, [formData.start_time, formData.end_time]);

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
      toast.error("End time must be after start time.");
      return;
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

      toast.success("Overtime request submitted successfully!", {
        description: `Date: ${formatPHTime(
          new Date(formData.ot_date),
          "MMM d, yyyy"
        )} • ${totalHours.toFixed(2)} hours`,
      });
      setFormData({
        ot_date: "",
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
      <CardSection
        title="OT Filing"
        description="File overtime. After approval, hours convert 1:1 to Off-setting credits."
      >
        <form onSubmit={handleSubmit} className="w-full">
          <VStack gap="6" className="w-full">
            <div className="w-full grid grid-cols-1 gap-4 md:grid-cols-2">
              <VStack gap="2" align="start" className="w-full">
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
              </VStack>
              <VStack gap="2" align="start" className="w-full">
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
              </VStack>
              <VStack gap="2" align="start" className="w-full">
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
              </VStack>
              <VStack gap="2" align="start" className="w-full">
                <Label htmlFor="total-hours">Total Hours (auto)</Label>
                <Input
                  id="total-hours"
                  value={totalHours.toFixed(2)}
                  readOnly
                />
              </VStack>
            </div>

            <VStack gap="2" align="start" className="w-full">
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                rows={3}
                value={formData.reason}
                onChange={(e) =>
                  setFormData({ ...formData, reason: e.target.value })
                }
              />
            </VStack>

            <VStack gap="2" align="start" className="w-full">
              <Label htmlFor="ot-doc">Supporting Document (optional)</Label>
              <input
                id="ot-doc"
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setSupportingDoc(file);
                  setDocError(null);
                }}
                className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
              />
              {supportingDoc && (
                <Caption>
                  {supportingDoc.name} (
                  {(supportingDoc.size / 1024 / 1024).toFixed(2)} MB)
                </Caption>
              )}
              {docError && (
                <Caption className="text-destructive">{docError}</Caption>
              )}
              {!supportingDoc && <Caption>Optional</Caption>}
            </VStack>

            <HStack justify="end" align="center">
              <Button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto"
              >
                {submitting ? "Submitting..." : "Submit OT Request"}
              </Button>
            </HStack>
          </VStack>
        </form>
      </CardSection>

      <CardSection title="My OT Requests">
        {loading ? (
          <div className="py-8 text-center">
            <BodySmall>Loading OT requests...</BodySmall>
          </div>
        ) : requests.length === 0 ? (
          <div className="py-8 text-center">
            <BodySmall>No OT requests yet.</BodySmall>
          </div>
        ) : (
          <VStack gap="3">
            {requests.map((req) => (
              <div
                key={req.id}
                className="w-full border border-border rounded-lg p-4 bg-card"
              >
                <HStack
                  justify="between"
                  align="start"
                  className="flex-col md:flex-row gap-3"
                >
                  <VStack gap="1" align="start">
                    <BodySmall className="font-semibold">
                      {format(new Date(req.ot_date), "MMM d, yyyy")}
                    </BodySmall>
                    <BodySmall>
                      {req.start_time} - {req.end_time} · {req.total_hours}h
                    </BodySmall>
                    {req.reason && (
                      <Caption className="mt-2">{req.reason}</Caption>
                    )}
                    {req.overtime_documents?.length ? (
                      <VStack gap="1" className="mt-2">
                        {req.overtime_documents.map((doc) => (
                          <Caption key={doc.id} className="text-emerald-600">
                            📎 {doc.file_name}{" "}
                            {doc.file_size
                              ? `(${(doc.file_size / 1024 / 1024).toFixed(
                                  2
                                )} MB)`
                              : ""}
                          </Caption>
                        ))}
                      </VStack>
                    ) : null}
                  </VStack>
                  <VStack gap="2" align="end">
                    <Badge
                      variant="outline"
                      className={statusStyles[req.status]}
                    >
                      {req.status.toUpperCase()}
                    </Badge>
                    {req.status === "pending" && (
                      <Button
                        size="sm"
                        variant="secondary"
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
                              error.message || "Failed to cancel OT request"
                            );
                          } else {
                            toast.success("OT request cancelled");
                            await loadRequests();
                          }
                          setCancelLoading(null);
                        }}
                      >
                        {cancelLoading === req.id ? "Cancelling..." : "Cancel"}
                      </Button>
                    )}
                  </VStack>
                </HStack>
              </div>
            ))}
          </VStack>
        )}
      </CardSection>
    </VStack>
  );
}
