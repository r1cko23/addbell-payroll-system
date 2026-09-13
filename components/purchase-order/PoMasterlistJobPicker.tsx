"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { dbFilterSelect } from "@/lib/dashboard-ui";
import {
  PO_MASTERLIST_PICKER_PAGE_SIZE,
  usePoMasterlistJobs,
} from "@/lib/hooks/usePoMasterlistJobs";
import {
  formatInternalPoJobPickerLabel,
  matchesInternalPoJobSearch,
} from "@/lib/purchase-order-job-fill";
import { cn } from "@/lib/utils";
import type { PoMasterlistJob } from "@/types/po-masterlist";

const SEARCH_DEBOUNCE_MS = 250;

type PoMasterlistJobPickerProps = {
  selectedJob: PoMasterlistJob | null;
  onSelect: (job: PoMasterlistJob | null) => void;
  enabled?: boolean;
  className?: string;
};

export function PoMasterlistJobPicker({
  selectedJob,
  onSelect,
  enabled = true,
  className,
}: PoMasterlistJobPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [query]);

  const { jobs, isLoading, isFetching, isError } = usePoMasterlistJobs(
    {
      q: debouncedQuery || undefined,
      page: 1,
      pageSize: PO_MASTERLIST_PICKER_PAGE_SIZE,
    },
    { enabled }
  );

  const matches = useMemo(
    () => jobs.filter((job) => matchesInternalPoJobSearch(job, query)),
    [jobs, query]
  );

  const triggerLabel = selectedJob
    ? formatInternalPoJobPickerLabel(selectedJob)
    : "Search P.O. number, title, or location…";

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            dbFilterSelect,
            "w-full min-w-0 justify-between font-normal sm:w-[28rem]",
            !selectedJob && "text-muted-foreground",
            className
          )}
          aria-label={
            selectedJob
              ? `Selected project ${triggerLabel}`
              : "Search project by P.O. number, title, or location"
          }
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-60" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 w-[min(28rem,90vw)]">
        <DropdownMenuLabel>Projects masterlist</DropdownMenuLabel>
        <div
          className="px-2 pb-2"
          onKeyDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="P.O. number, title, or location"
              className="h-8 pl-7 text-sm"
              aria-label="Filter jobs by P.O. number, title, or location"
            />
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-muted-foreground"
          onSelect={() => onSelect(null)}
        >
          Don't link yet — For completion of details
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {isError ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">
            Could not load projects. Try again.
          </p>
        ) : isLoading && matches.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">Loading jobs…</p>
        ) : matches.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">
            {isFetching ? "Searching…" : "No matching jobs"}
          </p>
        ) : (
          matches.map((job) => (
            <DropdownMenuItem
              key={job.id}
              className="items-start whitespace-normal py-2"
              onSelect={() => onSelect(job)}
            >
              <span className="min-w-0">
                <span className="block font-mono text-xs text-muted-foreground">
                  {job.po_number}
                </span>
                <span className="block text-sm font-medium leading-snug">
                  {job.project_title?.trim() || "Untitled job"}
                </span>
                {job.location?.trim() ? (
                  <span className="block text-xs text-muted-foreground">
                    {job.location.trim()}
                  </span>
                ) : null}
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
