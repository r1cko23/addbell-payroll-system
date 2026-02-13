"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import type { Database } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FundRequestRow } from "@/types/fund-request";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending (Project Manager)",
  project_manager_approved: "Approved by Project Manager (Purchasing Officer)",
  purchasing_officer_approved: "Approved by Purchasing Officer (Management)",
  management_approved: "Approved by Management",
  rejected: "Rejected",
};

type DetailItem = { description?: string; amount?: number };

export default function FundRequestApprovalDetailPage() {
  const params = useParams();
  const supabase = createClient();
  const [request, setRequest] = useState<FundRequestRow | null>(null);
  const [requesterName, setRequesterName] = useState<string>("");
  const [approverNames, setApproverNames] = useState<Record<string, string>>(
    {},
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = params?.id as string;
    if (!id) return;
    (async () => {
      const { data: req, error } = await supabase
        .from("fund_requests")
        .select("*")
        .eq("id", id)
        .single();
      if (error || !req) {
        setRequest(null);
        setLoading(false);
        return;
      }
      const row = req as FundRequestRow;
      setRequest(row);
      const [empRes, profilesRes] = await Promise.all([
        supabase
          .from("employees")
          .select("first_name, last_name, employee_id")
          .eq("id", row.requested_by)
          .single(),
        supabase
          .from("profiles")
          .select("id, full_name")
          .in(
            "id",
            [
              row.project_manager_approved_by,
              row.purchasing_officer_approved_by,
              row.management_approved_by,
              row.rejected_by,
            ].filter(Boolean) as string[],
          ),
      ]);
      const e = empRes.data as {
        first_name?: string;
        last_name?: string;
        employee_id?: string;
      } | null;
      setRequesterName(
        e
          ? [e.first_name, e.last_name].filter(Boolean).join(" ")
          : row.requested_by,
      );
      const names: Record<string, string> = {};
      (profilesRes.data ?? []).forEach(
        (p: { id: string; full_name: string | null }) => {
          names[p.id] = (p.full_name || p.id).trim() || "—";
        },
      );
      setApproverNames(names);
      setLoading(false);
    })();
  }, [params?.id, supabase]);

  if (loading)
    return <div className="animate-pulse h-8 w-48 bg-slate-200 rounded" />;
  if (!request) {
    return (
      <div className="space-y-4">
        <Link
          href="/fund-request-approval"
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ← Back to approval
        </Link>
        <p className="text-destructive">Fund request not found.</p>
      </div>
    );
  }

  const details = (request.details as DetailItem[] | null) ?? [];

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        href="/fund-request-approval"
        className="text-muted-foreground hover:text-foreground text-sm"
      >
        ← Back to Fund Request Approval
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Fund Request (approval view)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Request date:{" "}
            {format(new Date(request.request_date), "MMMM d, yyyy")} · Requested
            by {requesterName}
          </p>
          <span
            className={`inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-medium ${
              request.status === "management_approved"
                ? "bg-green-100 text-green-800"
                : request.status === "rejected"
                  ? "bg-red-100 text-red-800"
                  : "bg-amber-100 text-amber-800"
            }`}
          >
            {STATUS_LABELS[request.status] ?? request.status}
          </span>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Purpose
            </h4>
            <p className="mt-1">{request.purpose}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                P.O. Number
              </h4>
              <p className="mt-1">{request.po_number ?? "—"}</p>
            </div>
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Project Title
              </h4>
              <p className="mt-1">{request.project_title ?? "—"}</p>
            </div>
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Project Location
              </h4>
              <p className="mt-1">{request.project_location ?? "—"}</p>
            </div>
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                P.O. Amount (PHP)
              </h4>
              <p className="mt-1">
                {request.po_amount != null
                  ? Number(request.po_amount).toLocaleString()
                  : "—"}
              </p>
            </div>
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Current Accomplishment %
              </h4>
              <p className="mt-1">
                {request.current_project_percentage != null
                  ? `${request.current_project_percentage}%`
                  : "—"}
              </p>
            </div>
            {request.supplier_bank_details && (
              <div className="sm:col-span-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Bank details of supplier
                </h4>
                <p className="mt-1 whitespace-pre-wrap">
                  {request.supplier_bank_details}
                </p>
              </div>
            )}
          </div>
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Details of Request
            </h4>
            <table className="w-full text-sm border rounded-md">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-3 py-2">Details</th>
                  <th className="text-right px-3 py-2">Amount (PHP)</th>
                </tr>
              </thead>
              <tbody>
                {details.length === 0 ? (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-3 py-4 text-muted-foreground text-center"
                    >
                      No line items
                    </td>
                  </tr>
                ) : (
                  details.map((item, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="px-3 py-2">{item.description ?? "—"}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        {item.amount != null
                          ? Number(item.amount).toLocaleString()
                          : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <p className="mt-2 font-medium">
              Total Requested Amount: PHP{" "}
              {Number(request.total_requested_amount).toLocaleString("en-PH", {
                minimumFractionDigits: 2,
              })}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Date needed
              </h4>
              <p className="mt-1">
                {format(new Date(request.date_needed), "MMM d, yyyy")}
              </p>
            </div>
            {request.urgent_reason && (
              <div className="sm:col-span-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Urgent reason
                </h4>
                <p className="mt-1">{request.urgent_reason}</p>
              </div>
            )}
          </div>
          <div className="rounded-lg border bg-muted/20 p-4">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Approval history
            </h4>
            <ul className="space-y-2 text-sm">
              {request.project_manager_approved_at && (
                <li>
                  <span className="font-medium">Project Manager:</span>{" "}
                  {approverNames[request.project_manager_approved_by ?? ""] ??
                    "—"}{" "}
                  on{" "}
                  {format(
                    new Date(request.project_manager_approved_at),
                    "MMM d, yyyy",
                  )}{" "}
                  at{" "}
                  {format(
                    new Date(request.project_manager_approved_at),
                    "h:mm a",
                  )}
                </li>
              )}
              {request.purchasing_officer_approved_at && (
                <li>
                  <span className="font-medium">Purchasing Officer:</span>{" "}
                  {approverNames[
                    request.purchasing_officer_approved_by ?? ""
                  ] ?? "—"}{" "}
                  on{" "}
                  {format(
                    new Date(request.purchasing_officer_approved_at),
                    "MMM d, yyyy",
                  )}{" "}
                  at{" "}
                  {format(
                    new Date(request.purchasing_officer_approved_at),
                    "h:mm a",
                  )}
                </li>
              )}
              {request.management_approved_at && (
                <li>
                  <span className="font-medium">Management:</span>{" "}
                  {approverNames[request.management_approved_by ?? ""] ?? "—"}{" "}
                  on{" "}
                  {format(
                    new Date(request.management_approved_at),
                    "MMM d, yyyy",
                  )}{" "}
                  at{" "}
                  {format(new Date(request.management_approved_at), "h:mm a")}
                </li>
              )}
              {request.rejected_at && (
                <li className="text-destructive">
                  <span className="font-medium">Rejected by:</span>{" "}
                  {approverNames[request.rejected_by ?? ""] ?? "—"} on{" "}
                  {format(new Date(request.rejected_at), "MMM d, yyyy")} at{" "}
                  {format(new Date(request.rejected_at), "h:mm a")}
                  {request.rejection_reason && ` — ${request.rejection_reason}`}
                </li>
              )}
              {!request.project_manager_approved_at &&
                !request.purchasing_officer_approved_at &&
                !request.management_approved_at &&
                !request.rejected_at && (
                  <li className="text-muted-foreground">No approvals yet.</li>
                )}
            </ul>
          </div>
          {request.status === "rejected" && request.rejection_reason && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
              <h4 className="text-xs font-medium text-destructive uppercase tracking-wide">
                Rejection reason
              </h4>
              <p className="mt-1 text-sm">{request.rejection_reason}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
