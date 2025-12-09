"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useEmployeeSession } from "@/contexts/EmployeeSessionContext";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input, Textarea } from "@/components/Input";
import { format } from "date-fns";
import { toast } from "sonner";

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

      toast.success("OT request submitted");
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
    <div className="space-y-6">
      <Card className="p-4 sm:p-6">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">OT Filing</h1>
            <p className="text-sm text-gray-600">
              File overtime; once approved by Account Manager, hours convert 1:1
              to Off-setting credits.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                type="date"
                label="OT Date"
                required
                value={formData.ot_date}
                onChange={(e) =>
                  setFormData({ ...formData, ot_date: e.target.value })
                }
              />
              <Input
                label="Start Time"
                type="time"
                required
                value={formData.start_time}
                onChange={(e) =>
                  setFormData({ ...formData, start_time: e.target.value })
                }
              />
              <Input
                label="End Time"
                type="time"
                required
                value={formData.end_time}
                onChange={(e) =>
                  setFormData({ ...formData, end_time: e.target.value })
                }
              />
              <Input
                label="Total Hours (auto)"
                value={totalHours.toFixed(2)}
                readOnly
              />
            </div>

            <Textarea
              label="Reason"
              rows={3}
              value={formData.reason}
              onChange={(e) =>
                setFormData({ ...formData, reason: e.target.value })
              }
            />

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                Supporting Document (PDF/DOC/DOCX)
              </label>
              <input
                id="ot-doc"
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setSupportingDoc(file);
                  setDocError(null);
                }}
                className="block w-full text-sm text-gray-700"
              />
              {supportingDoc && (
                <p className="text-xs text-gray-500">
                  {supportingDoc.name} (
                  {(supportingDoc.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
              {docError && <p className="text-xs text-red-600">{docError}</p>}
              {!supportingDoc && (
                <p className="text-xs text-gray-400">Optional</p>
              )}
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                isLoading={submitting}
                className="w-full sm:w-auto"
              >
                Submit OT Request
              </Button>
            </div>
          </form>
        </div>
      </Card>

      <Card className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            My OT Requests
          </h2>
        </div>
        {loading ? (
          <div className="py-8 text-center text-sm text-gray-500">
            Loading OT requests...
          </div>
        ) : requests.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500">
            No OT requests yet.
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <div
                key={req.id}
                className="border rounded-lg p-4 bg-white flex flex-col md:flex-row md:items-center md:justify-between gap-3"
              >
                <div>
                  <p className="font-semibold text-gray-900">
                    {format(new Date(req.ot_date), "MMM d, yyyy")}
                  </p>
                  <p className="text-sm text-gray-600">
                    {req.start_time} - {req.end_time} · {req.total_hours}h
                  </p>
                  {req.reason && (
                    <p className="text-xs text-gray-500 mt-1">{req.reason}</p>
                  )}
                  {req.overtime_documents?.length ? (
                    <div className="text-xs text-emerald-700 mt-1">
                      {req.overtime_documents.map((doc) => (
                        <div key={doc.id}>
                          📎 {doc.file_name}{" "}
                          {doc.file_size
                            ? `(${(doc.file_size / 1024 / 1024).toFixed(2)} MB)`
                            : ""}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="text-sm">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      req.status === "approved"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : req.status === "rejected"
                        ? "bg-red-50 text-red-700 border border-red-200"
                        : req.status === "cancelled"
                        ? "bg-gray-50 text-gray-700 border border-gray-200"
                        : "bg-amber-50 text-amber-700 border border-amber-200"
                    }`}
                  >
                    {req.status.toUpperCase()}
                  </span>
                  {req.status === "pending" && (
                    <div className="mt-2 flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        isLoading={cancelLoading === req.id}
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
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
