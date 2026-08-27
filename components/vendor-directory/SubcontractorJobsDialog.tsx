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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  isCompletedSubcontractorProjectStatus,
  isOpenSubcontractorProjectStatus,
  type SubcontractorJobRow,
  type SubcontractorWorkloadStats,
} from "@/lib/subcontractor-workload";
import { cn } from "@/lib/utils";

function projectStatusBadgeVariant(
  status: string | null
): "default" | "secondary" | "outline" | "destructive" {
  const normalized = (status ?? "").toLowerCase().replace(/-/g, "_");
  if (normalized === "completed") return "default";
  if (normalized === "on_hold") return "outline";
  if (normalized === "active" || normalized === "pending") return "secondary";
  return "outline";
}

function formatProjectStatus(status: string | null): string {
  if (!status) return "—";
  return status.replace(/_/g, " ").toUpperCase();
}

type SubcontractorJobsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subcontractorName: string;
  workload: SubcontractorWorkloadStats;
};

export function SubcontractorJobsDialog({
  open,
  onOpenChange,
  subcontractorName,
  workload,
}: SubcontractorJobsDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusView, setStatusView] = useState<"active" | "completed" | "all">(
    "active"
  );
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!open) return;
    setSearchTerm("");
    setStatusView("active");
    setPage(1);
  }, [open, subcontractorName]);

  const filteredJobs = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return workload.jobs.filter((job) => {
      if (statusView === "active" && !isOpenSubcontractorProjectStatus(job.projectStatus)) {
        return false;
      }
      if (
        statusView === "completed" &&
        !isCompletedSubcontractorProjectStatus(job.projectStatus)
      ) {
        return false;
      }
      if (!term) return true;
      return (
        job.poNumber.toLowerCase().includes(term) ||
        job.projectName.toLowerCase().includes(term) ||
        (job.projectStatus || "").toLowerCase().includes(term)
      );
    });
  }, [workload.jobs, searchTerm, statusView]);

  const { pageItems, pageCount, safePage } = useMemo(
    () => paginateItems(filteredJobs, page, DASHBOARD_TABLE_PAGE_SIZE),
    [filteredJobs, page]
  );

  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusView]);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dbDialogWideForm} style={dbDialogWideFormStyle}>
        <DialogHeader className={dbDialogWideFormHeader}>
          <DialogTitle>Jobs — {subcontractorName}</DialogTitle>
          <DialogDescription>
            Workload from Projects masterlist jobs. Use active jobs to
            decide who can take new work.
          </DialogDescription>
          <div className="flex flex-wrap gap-2 pt-2">
            <Badge variant="secondary" title="active, pending, on hold">
              Active {workload.active}
            </Badge>
            <Badge variant="default" title="completed">
              Completed {workload.completed}
            </Badge>
            <Badge variant="outline">Total {workload.total}</Badge>
          </div>
        </DialogHeader>
        <div className={cn(dbDialogWideFormBody, "space-y-4")}>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search P.O. or project…"
                className="pl-8"
                aria-label="Search jobs for this subcontractor"
              />
            </div>
            <Select
              value={statusView}
              onValueChange={(value) =>
                setStatusView(value as "active" | "completed" | "all")
              }
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active only</SelectItem>
                <SelectItem value="completed">Completed only</SelectItem>
                <SelectItem value="all">All jobs</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredJobs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {workload.jobs.length === 0
                ? "No Projects masterlist jobs linked to this subcontractor yet."
                : "No jobs match this filter."}
            </p>
          ) : (
            <>
              <DbMobileBlock>
                <div className="space-y-2">
                  {pageItems.map((job) => (
                    <JobCard key={job.poId} job={job} />
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
                      <TableHead className="w-[18%]">P.O.</TableHead>
                      <TableHead className="w-[42%]">Project</TableHead>
                      <TableHead className="w-[18%]">Job status</TableHead>
                      <TableHead className="w-[12%]">PO status</TableHead>
                      <TableHead className="w-[10%] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageItems.map((job) => (
                      <TableRow key={job.poId}>
                        <TableCell className="min-w-0 font-medium">
                          <span className="block truncate" title={job.poNumber}>
                            {job.poNumber}
                          </span>
                        </TableCell>
                        <TableCell className="min-w-0">
                          <span
                            className="line-clamp-2 break-words"
                            title={job.projectName}
                          >
                            {job.projectName || "—"}
                          </span>
                        </TableCell>
                        <TableCell className={dbStatusBadgeCell}>
                          <Badge
                            variant={projectStatusBadgeVariant(job.projectStatus)}
                            className={dbStatusBadge}
                          >
                            {formatProjectStatus(job.projectStatus)}
                          </Badge>
                        </TableCell>
                        <TableCell className="truncate capitalize text-muted-foreground">
                          {job.poStatus || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {job.projectId ? (
                            <Button variant="outline" size="sm" className="h-8" asChild>
                              <Link href={`/projects/${job.projectId}`}>Detail</Link>
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

function JobCard({ job }: { job: SubcontractorJobRow }) {
  return (
    <article className={dbMobileListCard}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-mono text-sm font-medium">{job.poNumber}</p>
          <p className="mt-0.5 line-clamp-2 text-sm">{job.projectName || "—"}</p>
        </div>
        <Badge
          variant={projectStatusBadgeVariant(job.projectStatus)}
          className={cn(dbStatusBadge, "shrink-0")}
        >
          {formatProjectStatus(job.projectStatus)}
        </Badge>
      </div>
      <div className="mt-2 space-y-1">
        <DashboardMobileField label="PO status" value={job.poStatus || "—"} />
      </div>
      {job.projectId ? (
        <Button variant="outline" size="sm" className="mt-3 min-h-10 w-full" asChild>
          <Link href={`/projects/${job.projectId}`}>Open project</Link>
        </Button>
      ) : null}
    </article>
  );
}
