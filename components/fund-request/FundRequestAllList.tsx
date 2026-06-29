"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";
import type { FundRequestRow } from "@/types/fund-request";
import { FUND_REQUEST_STATUS_LABELS } from "@/types/fund-request";
import { getFundRequestListProjectLabel } from "@/lib/fund-request-project-details";
import {
  canRequesterDeleteFundRequest,
  getFundRequestStatusBadgeClass,
  getFundRequestStatusBadgeVariant,
} from "@/lib/fund-request-approval";

export type FundRequestListRow = FundRequestRow & {
  projects: { name: string; code: string } | null;
};

export function FundRequestAllList({
  rows,
  loading,
  searchTerm,
  statusFilter,
  base,
  requesterEmployeeId,
  onRequestDeleted,
  emptyLabel = "No fund requests yet.",
  filteredEmptyLabel = "No fund requests match your filters.",
}: {
  rows: FundRequestListRow[];
  loading: boolean;
  searchTerm: string;
  statusFilter: string;
  base: string;
  requesterEmployeeId: string | null;
  onRequestDeleted: (requestId: string) => void;
  emptyLabel?: string;
  filteredEmptyLabel?: string;
}) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteId || !requesterEmployeeId) return;

    setDeleting(true);
    try {
      const response = await fetch("/api/fund-requests", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: deleteId,
          requested_by: requesterEmployeeId,
        }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        toast.error(payload.error || "Failed to delete request");
        return;
      }

      toast.success("Fund request deleted");
      onRequestDeleted(deleteId);
      setDeleteId(null);
    } catch {
      toast.error("Failed to delete request");
    } finally {
      setDeleting(false);
    }
  };

  const filteredRows = rows.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchPurpose = (r.purpose || "").toLowerCase().includes(term);
      const matchProject = (r.project_title || r.projects?.name || "")
        .toLowerCase()
        .includes(term);
      if (!matchPurpose && !matchProject) return false;
    }
    return true;
  });

  const canDeleteRequest = (request: FundRequestListRow) =>
    Boolean(requesterEmployeeId) &&
    request.requested_by === requesterEmployeeId &&
    canRequesterDeleteFundRequest(request.status);

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  }

  if (filteredRows.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        {searchTerm || statusFilter !== "all" ? filteredEmptyLabel : emptyLabel}
      </div>
    );
  }

  return (
    <>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Project</th>
              <th className="px-4 py-3 font-medium">Purpose</th>
              <th className="px-4 py-3 font-medium text-right">Total (PHP)</th>
              <th className="px-4 py-3 font-medium">Date Needed</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => (
              <tr key={r.id} className="border-b last:border-0 hover:bg-primary/5">
                <td className="px-4 py-3 whitespace-nowrap">
                  {format(new Date(r.request_date), "MMM d, yyyy")}
                </td>
                <td className="px-4 py-3 max-w-[180px] truncate">
                  {getFundRequestListProjectLabel(r)}
                </td>
                <td className="px-4 py-3 max-w-[200px] truncate">{r.purpose}</td>
                <td className="px-4 py-3 font-medium text-right tabular-nums">
                  ₱{Number(r.total_requested_amount).toLocaleString()}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {r.date_needed ? format(new Date(r.date_needed), "MMM d") : "—"}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant={getFundRequestStatusBadgeVariant(r.status)}
                    className={cn(
                      "whitespace-nowrap text-xs",
                      getFundRequestStatusBadgeClass(r.status)
                    )}
                  >
                    {FUND_REQUEST_STATUS_LABELS[r.status] ?? r.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Link
                      href={`${base}/${r.id}`}
                      className="text-primary font-medium hover:underline text-sm"
                    >
                      View
                    </Link>
                    {canDeleteRequest(r) ? (
                      <button
                        type="button"
                        onClick={() => setDeleteId(r.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-destructive hover:bg-destructive/10"
                        aria-label="Delete request"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3 p-4">
        {filteredRows.map((r) => (
          <Card key={r.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">
                    {format(new Date(r.request_date), "MMM d, yyyy")}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {getFundRequestListProjectLabel(r)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 truncate">
                    {r.purpose}
                  </div>
                </div>
                <Badge
                  variant={getFundRequestStatusBadgeVariant(r.status)}
                  className={cn(
                    "max-w-[45%] shrink-0 whitespace-normal text-right text-xs leading-snug sm:max-w-none",
                    getFundRequestStatusBadgeClass(r.status)
                  )}
                >
                  {FUND_REQUEST_STATUS_LABELS[r.status] ?? r.status}
                </Badge>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="text-sm font-semibold tabular-nums">
                  ₱{Number(r.total_requested_amount).toLocaleString()}
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href={`${base}/${r.id}`}
                    className="text-primary font-medium hover:underline text-sm"
                  >
                    View
                  </Link>
                  {canDeleteRequest(r) ? (
                    <button
                      type="button"
                      onClick={() => setDeleteId(r.id)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-destructive hover:bg-destructive/10"
                      aria-label="Delete request"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={Boolean(deleteId)} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete fund request?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the request. You can only delete requests that are still
              pending with the Operations Manager or Purchasing Officer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
