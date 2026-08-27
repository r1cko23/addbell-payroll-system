"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePoMasterlistJobs } from "@/lib/hooks/usePoMasterlistJobs";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { cn } from "@/lib/utils";
import type { PoMasterlistJob } from "@/types/po-masterlist";
import { isClientPoPlaceholder } from "@/lib/fund-request-client-po-masterlist";
import {
  rankMasterlistJobsForFundRequestHints,
  type MasterlistPoSuggestHints,
  type MasterlistPoSuggestJob,
} from "@/lib/fund-request-masterlist-po-suggest";

const PLACEHOLDER_HINTS = [
  "NTP",
  "No PO, with NTP",
  "With NTP only",
  "PO to follow",
  "P.O. FOR APPROVAL",
];

export type FundRequestMasterlistPoSelection = {
  poNumber: string;
  projectTitle?: string;
  location?: string;
  poAmount?: string;
  jobId?: string;
};

type Props = {
  id?: string;
  label?: string;
  value: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  /** Hide the long helper (use when multiple rows share one explanation). */
  compact?: boolean;
  /** When true, selecting a masterlist job also returns title/location/amount. */
  autofillProjectFields?: boolean;
  /**
   * When current value is NTP / empty, suggest live masterlist jobs using
   * this request’s title, location, and client P.O. amount.
   */
  suggestHints?: MasterlistPoSuggestHints | null;
  /** Preloaded masterlist rows for offline-style suggestion ranking. */
  suggestJobs?: readonly MasterlistPoSuggestJob[] | null;
  onChange: (next: FundRequestMasterlistPoSelection) => void;
};

/**
 * Client P.O. from Operations → Projects masterlist.
 * Free text still allowed for NTP / PO to follow until the client PO is live.
 */
export function FundRequestMasterlistPoField({
  id = "client-po-number",
  label = "Client P.O. Number",
  value,
  required,
  disabled,
  className,
  inputClassName,
  compact = false,
  autofillProjectFields = true,
  suggestHints = null,
  suggestJobs = null,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const debouncedQuery = useDebounce(query.trim(), 250);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const queryIsPlaceholder = isClientPoPlaceholder(debouncedQuery);
  const searchNeedle = useMemo(() => {
    if (debouncedQuery.length >= 2 && !queryIsPlaceholder) {
      return debouncedQuery;
    }
    const title = suggestHints?.title?.trim() ?? "";
    if (title.length >= 2) return title;
    const location = suggestHints?.location?.trim() ?? "";
    if (location.length >= 2) return location;
    return undefined;
  }, [debouncedQuery, queryIsPlaceholder, suggestHints]);

  const { jobs, isLoading, isFetching } = usePoMasterlistJobs({
    q: searchNeedle,
    page: 1,
    pageSize: 20,
  });

  const rankedSuggestions = useMemo(() => {
    const pool: MasterlistPoSuggestJob[] =
      suggestJobs && suggestJobs.length > 0
        ? [...suggestJobs]
        : jobs.map((job) => ({
            id: job.id,
            po_number: job.po_number,
            project_title: job.project_title,
            location: job.location,
            po_amount: job.po_amount,
            client_name: job.client_name,
          }));
    return rankMasterlistJobsForFundRequestHints(pool, suggestHints, {
      limit: 8,
    });
  }, [jobs, suggestHints, suggestJobs]);

  const typedSearchActive =
    debouncedQuery.length >= 2 && !queryIsPlaceholder;
  const showResults =
    open &&
    !disabled &&
    (typedSearchActive || rankedSuggestions.length > 0 || Boolean(searchNeedle));

  const applyManual = (raw: string) => {
    onChange({ poNumber: raw });
  };

  const applyJob = (job: Pick<
    PoMasterlistJob,
    "id" | "po_number" | "project_title" | "location" | "po_amount"
  >) => {
    const next: FundRequestMasterlistPoSelection = {
      poNumber: job.po_number,
      jobId: job.id,
    };
    if (autofillProjectFields) {
      next.projectTitle = job.project_title?.trim() || undefined;
      next.location = job.location?.trim() || undefined;
      next.poAmount =
        job.po_amount != null && Number.isFinite(Number(job.po_amount))
          ? String(job.po_amount)
          : undefined;
    }
    onChange(next);
    setQuery(job.po_number);
    setOpen(false);
  };

  const listJobs: MasterlistPoSuggestJob[] = typedSearchActive
    ? jobs
    : rankedSuggestions;

  return (
    <div className={cn("relative space-y-1", className)}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      <Input
        id={id}
        value={query}
        disabled={disabled}
        required={required}
        autoComplete="off"
        placeholder="Search Projects masterlist or type NTP / PO to follow"
        className={inputClassName}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Allow click on result before closing.
          window.setTimeout(() => setOpen(false), 150);
        }}
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          applyManual(next);
          setOpen(true);
        }}
      />
      {!compact ? (
        <p className="text-xs text-muted-foreground">
          Always reference the <span className="font-medium">client P.O.</span> from
          Operations → Projects. Cost POs to vendors/subcons are created separately under
          Internal POs (purchasing only). If the client PO is not live yet, enter NTP or
          PO to follow and update this later.
        </p>
      ) : null}
      {showResults ? (
        <div className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md">
          {!typedSearchActive && rankedSuggestions.length > 0 ? (
            <p className="border-b px-3 py-1.5 text-[11px] font-medium text-amber-950 bg-amber-50/80">
              Suggested from this request’s title / location / amount
            </p>
          ) : null}
          {isLoading || isFetching ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Searching masterlist…</p>
          ) : listJobs.length === 0 ? (
            <div className="space-y-1 px-3 py-2 text-xs text-muted-foreground">
              <p>No masterlist match. Keep typing a placeholder if needed:</p>
              <p className="font-mono text-[11px]">{PLACEHOLDER_HINTS.join(" · ")}</p>
            </div>
          ) : (
            <ul className="py-1">
              {listJobs.map((job) => {
                const ranked = job as {
                  score?: number;
                  reasons?: string[];
                };
                return (
                  <li key={job.id ?? job.po_number}>
                    <button
                      type="button"
                      className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-muted"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() =>
                        applyJob({
                          id: job.id ?? "",
                          po_number: job.po_number,
                          project_title: job.project_title ?? null,
                          location: job.location ?? null,
                          po_amount: job.po_amount ?? null,
                        })
                      }
                    >
                      <span className="font-mono text-xs font-semibold">
                        {job.po_number}
                      </span>
                      <span className="line-clamp-2 text-xs text-muted-foreground">
                        {[
                          job.project_title,
                          job.client_name,
                          job.location,
                          job.po_amount != null
                            ? `₱${Number(job.po_amount).toLocaleString()}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      {ranked.reasons && ranked.reasons.length > 0 ? (
                        <span className="text-[10px] text-amber-900/80">
                          Matched: {ranked.reasons.join(", ")}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
