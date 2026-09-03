"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const DASHBOARD_TABLE_PAGE_SIZE = 20;

type DashboardTablePaginationProps = {
  page: number;
  pageCount: number;
  total: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
};

export function DashboardTablePagination({
  page,
  pageCount,
  total,
  pageSize = DASHBOARD_TABLE_PAGE_SIZE,
  onPageChange,
  disabled = false,
}: DashboardTablePaginationProps) {
  if (total === 0) return null;

  const safePage = Math.min(Math.max(1, page), Math.max(1, pageCount));
  const rangeStart = (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, total);

  return (
    <div className="flex flex-col gap-2 border-t px-1 pt-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        Showing {rangeStart}–{rangeEnd} of {total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-9"
          disabled={disabled || safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
        >
          <ChevronLeft className="mr-1 h-4 w-4" aria-hidden />
          Previous
        </Button>
        <span className="min-w-[5.5rem] text-center text-sm tabular-nums text-muted-foreground">
          Page {safePage} of {Math.max(1, pageCount)}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-9"
          disabled={disabled || safePage >= pageCount}
          onClick={() => onPageChange(safePage + 1)}
        >
          Next
          <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

export function paginateItems<T>(
  items: T[],
  page: number,
  pageSize: number = DASHBOARD_TABLE_PAGE_SIZE
): { pageItems: T[]; pageCount: number; safePage: number } {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = (safePage - 1) * pageSize;
  return {
    pageItems: items.slice(start, start + pageSize),
    pageCount,
    safePage,
  };
}
