"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DashboardTablePagination,
  DASHBOARD_TABLE_PAGE_SIZE,
  paginateItems,
} from "@/components/dashboard/DashboardTablePagination";
import { DbDesktopBlock, DbMobileBlock } from "@/components/dashboard/DashboardViewport";
import { DashboardMobileField } from "@/components/dashboard/DashboardMobileField";
import {
  dbDialogWideForm,
  dbDialogWideFormBody,
  dbDialogWideFormHeader,
  dbDialogWideFormStyle,
  dbMobileListCard,
  dbStatusBadge,
  dbStatusBadgeCell,
  dbTableShellFit,
} from "@/lib/dashboard-ui";
import { formatPoMasterlistSheetAmount } from "@/lib/po-masterlist-sheet-row";
import {
  summarizeClientMasterlistJobs,
  type ClientMasterlistJobSummary,
} from "@/lib/client-masterlist-job-stats";
import { cn } from "@/lib/utils";

export type { ClientMasterlistJobSummary };

function statusBadgeVariant(
  status: string | null
): "default" | "secondary" | "outline" | "destructive" {
  const normalized = (status ?? "").toUpperCase();
  if (normalized === "COMPLETED" || normalized === "PAID") return "default";
  if (normalized === "CANCELLED") return "destructive";
  if (
    normalized === "ON-GOING" ||
    normalized === "ONGOING" ||
    normalized === "PENDING" ||
    normalized === "FOR INVOICE"
  ) {
    return "secondary";
  }
  return "outline";
}

function formatAmount(value: number | null): string {
  const formatted = formatPoMasterlistSheetAmount(value);
  return formatted || "—";
}

type ClientMasterlistJobsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientName: string;
  jobs: ClientMasterlistJobSummary[];
};

export function ClientMasterlistJobsDialog({
  open,
  onOpenChange,
  clientName,
  jobs,
}: ClientMasterlistJobsDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);

  const stats = useMemo(() => summarizeClientMasterlistJobs(jobs), [jobs]);

  useEffect(() => {
    if (!open) return;
    setSearchTerm("");
    setPage(1);
  }, [open, clientName]);

  const filteredJobs = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return jobs;
    return jobs.filter((job) => {
      return (
        job.po_number.toLowerCase().includes(term) ||
        (job.project_title || "").toLowerCase().includes(term) ||
        (job.location || "").toLowerCase().includes(term) ||
        (job.project_status || "").toLowerCase().includes(term) ||
        (job.payment_status || "").toLowerCase().includes(term)
      );
    });
  }, [jobs, searchTerm]);

  const { pageItems, pageCount, safePage } = useMemo(
    () => paginateItems(filteredJobs, page, DASHBOARD_TABLE_PAGE_SIZE),
    [filteredJobs, page]
  );

  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dbDialogWideForm} style={dbDialogWideFormStyle}>
        <DialogHeader className={dbDialogWideFormHeader}>
          <DialogTitle>P.O. / jobs — {clientName}</DialogTitle>
          <DialogDescription>
            ADD-BELL masterlist jobs linked to this client ({stats.total} total).
          </DialogDescription>
          <div className="flex flex-wrap gap-2 pt-2">
            <Badge variant="secondary" title="ON-GOING + PENDING">
              Active {stats.active}
            </Badge>
            <Badge variant="default" title="COMPLETED">
              Completed {stats.completed}
            </Badge>
            <Badge variant="outline" title="PAID payment status">
              Paid {stats.paid}
            </Badge>
          </div>
        </DialogHeader>
        <div className={cn(dbDialogWideFormBody, "space-y-4")}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search P.O., project, location, or status…"
              className="pl-8"
              aria-label="Search jobs for this client"
            />
          </div>

          {filteredJobs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {jobs.length === 0
                ? "No masterlist jobs are linked to this client yet."
                : "No jobs match your search."}
            </p>
          ) : (
            <>
              <DbMobileBlock>
                <div className="space-y-2">
                  {pageItems.map((job) => (
                    <article key={job.id} className={dbMobileListCard}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-mono text-sm font-medium">
                            {job.po_number}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-sm">
                            {job.project_title || "—"}
                          </p>
                        </div>
                        <Badge
                          variant={statusBadgeVariant(job.project_status)}
                          className="shrink-0"
                        >
                          {job.project_status || "—"}
                        </Badge>
                      </div>
                      <div className="mt-2 space-y-1">
                        <DashboardMobileField
                          label="Location"
                          value={job.location || "—"}
                        />
                        <DashboardMobileField
                          label="Amount"
                          value={formatAmount(job.po_amount)}
                        />
                        <DashboardMobileField
                          label="Payment"
                          value={job.payment_status || "—"}
                        />
                        <DashboardMobileField
                          label="P.O. date"
                          value={job.po_date || "—"}
                        />
                      </div>
                      {job.id ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3 min-h-10 w-full"
                          asChild
                        >
                          <Link href={`/projects/${job.id}`}>
                            Open project
                          </Link>
                        </Button>
                      ) : null}
                    </article>
                  ))}
                </div>
              </DbMobileBlock>

              <DbDesktopBlock className={dbTableShellFit}>
                <Table
                  className="w-full table-fixed"
                  containerClassName="overflow-x-hidden"
                >
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[12%]">P.O.</TableHead>
                      <TableHead className="w-[10%]">Date</TableHead>
                      <TableHead className="w-[24%]">Project</TableHead>
                      <TableHead className="hidden w-[12%] xl:table-cell">
                        Location
                      </TableHead>
                      <TableHead className="w-[11%] text-right">Amount</TableHead>
                      <TableHead className="w-[12%]">Status</TableHead>
                      <TableHead className="hidden w-[12%] lg:table-cell">
                        Payment
                      </TableHead>
                      <TableHead className="w-[11%] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageItems.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="min-w-0 font-medium">
                          <span className="block truncate" title={job.po_number}>
                            {job.po_number}
                          </span>
                        </TableCell>
                        <TableCell className="min-w-0 truncate tabular-nums">
                          {job.po_date || "—"}
                        </TableCell>
                        <TableCell className="min-w-0">
                          <span
                            className="line-clamp-2 break-words"
                            title={job.project_title || undefined}
                          >
                            {job.project_title || "—"}
                          </span>
                        </TableCell>
                        <TableCell className="hidden min-w-0 xl:table-cell">
                          <span
                            className="block truncate text-muted-foreground"
                            title={job.location || undefined}
                          >
                            {job.location || "—"}
                          </span>
                        </TableCell>
                        <TableCell className="min-w-0 text-right tabular-nums">
                          <span className="block truncate">
                            {formatAmount(job.po_amount)}
                          </span>
                        </TableCell>
                        <TableCell className={dbStatusBadgeCell}>
                          <Badge
                            variant={statusBadgeVariant(job.project_status)}
                            className={dbStatusBadge}
                            title={job.project_status || undefined}
                          >
                            {job.project_status || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={cn(dbStatusBadgeCell, "hidden lg:table-cell")}
                        >
                          <Badge
                            variant={statusBadgeVariant(job.payment_status)}
                            className={dbStatusBadge}
                            title={job.payment_status || undefined}
                          >
                            {job.payment_status || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {job.id ? (
                            <Button variant="outline" size="sm" className="h-8" asChild>
                              <Link href={`/projects/${job.id}`}>Detail</Link>
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </DbDesktopBlock>

              <DashboardTablePagination
                page={safePage}
                pageCount={pageCount}
                total={filteredJobs.length}
                onPageChange={setPage}
              />
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
