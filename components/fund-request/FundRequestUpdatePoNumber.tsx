"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FundRequestRow } from "@/types/fund-request";
import { bustCache } from "@/lib/cache-client";
import { buildFundRequestPoNumberColumnUpdates } from "@/lib/fund-request-requester-edit";
import { FundRequestMasterlistPoField } from "@/components/fund-request/FundRequestMasterlistPoField";
import {
  buildMasterlistPoKeySet,
  buildUniqueMasterlistTitleKeySet,
  evaluateFundRequestClientPoMasterlist,
} from "@/lib/fund-request-client-po-masterlist";
import {
  fundRequestMasterlistSuggestHints,
  rankMasterlistJobsForFundRequestHints,
} from "@/lib/fund-request-masterlist-po-suggest";
import { fetchPoMasterlistPoLookup } from "@/lib/queries/fetchers";
import { queryKeys } from "@/lib/queries/query-keys";
import { cn } from "@/lib/utils";
import { isOfficeRelatedFundRequest } from "@/types/fund-request";
import { formatFundRequestPoAmount } from "@/lib/fund-request-project-details";

type Props = {
  request: FundRequestRow;
  onUpdated: (next: Pick<FundRequestRow, "po_number" | "project_details">) => void;
  className?: string;
};

/**
 * Correct client PO# after filing with NTP / PO to follow / typo.
 * Source of truth is Operations → Projects masterlist.
 * Allowed even after approval so project tracking can catch up.
 */
export function FundRequestUpdatePoNumber({ request, onUpdated, className }: Props) {
  const [open, setOpen] = useState(false);
  const [poNumber, setPoNumber] = useState(request.po_number ?? "");
  const [saving, setSaving] = useState(false);

  const suggestHints = useMemo(
    () => fundRequestMasterlistSuggestHints(request),
    [request]
  );

  const {
    data: masterlistLookup = [],
    isFetched: masterlistFetched,
  } = useQuery({
    queryKey: queryKeys.poMasterlistJobs.poLookup(),
    queryFn: fetchPoMasterlistPoLookup,
    staleTime: 60_000,
    enabled: !isOfficeRelatedFundRequest(request.reference_mode),
  });

  const masterlistStatus = useMemo(() => {
    if (isOfficeRelatedFundRequest(request.reference_mode)) {
      return {
        needsUpdate: false,
        readyOnMasterlist: false,
        reason: "office_related" as const,
      };
    }
    const poKeys = buildMasterlistPoKeySet(
      masterlistLookup.map((row) => row.po_number)
    );
    const titleKeys = buildUniqueMasterlistTitleKeySet(
      masterlistLookup.map((row) => row.project_title)
    );
    return evaluateFundRequestClientPoMasterlist(request, poKeys, titleKeys, {
      masterlistLoaded: masterlistFetched,
    });
  }, [masterlistLookup, masterlistFetched, request]);

  const previewSuggestions = useMemo(
    () =>
      rankMasterlistJobsForFundRequestHints(masterlistLookup, suggestHints, {
        limit: 5,
      }),
    [masterlistLookup, suggestHints]
  );

  if (isOfficeRelatedFundRequest(request.reference_mode)) {
    return null;
  }

  const handleSave = async () => {
    const next = poNumber.trim();
    if (!next) {
      toast.error("Enter the client PO number from Operations → Projects.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/fund-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          update_mode: "po_number",
          request_id: request.id,
          requested_by: request.requested_by,
          po_number: next,
        }),
      });
      const json = (await res.json()) as { error?: string; po_number?: string | null };
      if (!res.ok) {
        toast.error(json.error || "Failed to update client PO number");
        return;
      }
      const columns = buildFundRequestPoNumberColumnUpdates(request, next);
      onUpdated({
        po_number: columns.po_number,
        project_details: columns.project_details,
      });
      // Refresh My Requests / inbox session cache so the amber flag clears immediately.
      await bustCache();
      toast.success("Client PO number updated from Projects masterlist.");
      setOpen(false);
    } catch {
      toast.error("Failed to update client PO number");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <div
        className={cn(
          className,
          masterlistStatus.needsUpdate &&
            "rounded-lg border border-amber-300/80 bg-amber-50 px-3 py-3"
        )}
      >
        {masterlistStatus.needsUpdate ? (
          <p className="mb-2 text-sm font-medium text-amber-950">
            {previewSuggestions.length > 0
              ? `${previewSuggestions.length} Projects masterlist job${
                  previewSuggestions.length === 1 ? "" : "s"
                } may match this request — update the client P.O.`
              : masterlistStatus.readyOnMasterlist
                ? "A matching job is now on Operations → Projects — update this Fund Request’s client P.O."
                : "This Fund Request still needs a client P.O. from the Projects masterlist."}
          </p>
        ) : null}
        {masterlistStatus.needsUpdate && previewSuggestions.length > 0 ? (
          <ul className="mb-2 space-y-1.5 rounded-md border border-amber-200 bg-white/70 px-2.5 py-2 text-xs text-amber-950">
            {previewSuggestions.map((job) => (
              <li key={job.id ?? job.po_number} className="min-w-0">
                <button
                  type="button"
                  className="w-full rounded-md px-1 py-1 text-left hover:bg-amber-100/80"
                  onClick={() => {
                    setPoNumber(job.po_number);
                    setOpen(true);
                  }}
                >
                  <p className="font-mono text-[11px] font-semibold">{job.po_number}</p>
                  <p className="line-clamp-2 text-[11px] text-amber-900/85">
                    {[
                      job.project_title,
                      job.location,
                      job.po_amount != null
                        ? formatFundRequestPoAmount(job.po_amount)
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <p className="text-[10px] text-amber-800/80">
                    Matched: {job.reasons.join(", ")} — tap to select
                  </p>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
          Update client PO number
        </Button>
        <p className="mt-1 text-xs text-muted-foreground">
          {masterlistStatus.needsUpdate
            ? "Update even if already approved. Open the picker to choose a suggested match by title, location, or amount — or search the masterlist. Internal POs are separate."
            : "Use when this request was filed with NTP / PO to follow, or a wrong client PO. Once the client PO is live on Operations → Projects, select it here."}
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="rounded-lg border border-amber-300/80 bg-amber-50/70 p-3 space-y-3">
        {(suggestHints.title ||
          suggestHints.location ||
          suggestHints.poAmount != null) && (
          <p className="text-xs text-amber-950/90">
            Matching against this request:{" "}
            {[
              suggestHints.title,
              suggestHints.location,
              suggestHints.poAmount != null
                ? formatFundRequestPoAmount(suggestHints.poAmount)
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
        <FundRequestMasterlistPoField
          id={`fr-update-po-${request.id}`}
          label="Client P.O. from Projects masterlist"
          value={poNumber}
          onChange={(next) => setPoNumber(next.poNumber)}
          autofillProjectFields={false}
          suggestHints={suggestHints}
          suggestJobs={masterlistLookup}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save client PO number"
            )}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={saving}
            onClick={() => {
              setPoNumber(request.po_number ?? "");
              setOpen(false);
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
