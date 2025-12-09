"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { format } from "date-fns";
import toast from "react-hot-toast";

type OTRequest = {
  id: string;
  employee_id: string;
  ot_date: string;
  start_time: string;
  end_time: string;
  total_hours: number;
  reason: string | null;
  attachment_url: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  employees?: { full_name: string; employee_id: string };
};

export default function OvertimeApprovalPage() {
  const supabase = createClient();
  const { isAdmin, role, loading: roleLoading } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<OTRequest[]>([]);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const loadRequests = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("overtime_requests")
      .select(
        `
        *,
        employees (
          full_name,
          employee_id
        )
      `
      )
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Error loading OT requests", error);
      toast.error("Failed to load OT requests");
    } else {
      setRequests((data || []) as OTRequest[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleApprove = async (id: string) => {
    setActioningId(id);
    const { error } = await supabase.rpc("approve_overtime_request", {
      p_request_id: id,
    });
    if (error) {
      toast.error(error.message || "Failed to approve OT");
    } else {
      toast.success("OT approved and offset hours added");
      loadRequests();
    }
    setActioningId(null);
  };

  const handleReject = async (id: string) => {
    setActioningId(id);
    const { error } = await supabase.rpc("reject_overtime_request", {
      p_request_id: id,
      p_reason: null,
    });
    if (error) {
      toast.error(error.message || "Failed to reject OT");
    } else {
      toast.success("OT rejected");
      loadRequests();
    }
    setActioningId(null);
  };

  if (roleLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      </DashboardLayout>
    );
  }

  if (!isAdmin && role !== "account_manager") {
    return (
      <DashboardLayout>
        <div className="p-6">
          <p className="text-sm text-gray-600">
            Only Account Managers or Admins can access OT approvals.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">OT Approvals</h1>
          <p className="text-sm text-muted-foreground">
            Approve or reject employee-filed OT. Approved hours convert 1:1 to
            off-setting credits.
          </p>
        </div>

        <Card className="p-6 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No overtime requests yet.
            </p>
          ) : (
            <div className="space-y-3">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="border rounded-lg p-4 bg-white flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                >
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">
                      {req.employees?.full_name || "Unknown"} (
                      {req.employees?.employee_id || "—"})
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(req.ot_date), "MMM d, yyyy")} ·{" "}
                      {req.start_time} - {req.end_time} · {req.total_hours}h
                    </p>
                    {req.reason && (
                      <p className="text-xs text-gray-500">{req.reason}</p>
                    )}
                    {req.attachment_url && (
                      <a
                        href={req.attachment_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-emerald-600 underline"
                      >
                        Attachment
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        req.status === "approved"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : req.status === "rejected"
                          ? "bg-red-50 text-red-700 border border-red-200"
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}
                    >
                      {req.status.toUpperCase()}
                    </span>
                    {req.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleApprove(req.id)}
                          isLoading={actioningId === req.id}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleReject(req.id)}
                          disabled={actioningId === req.id}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
