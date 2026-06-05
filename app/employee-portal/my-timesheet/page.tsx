"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageTitle, BodySmall, Caption } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  epPageStack,
  epPageHeaderRow,
  epTouchButton,
  epCardInteractive,
} from "@/lib/employee-portal-ui";
import { useEmployeeSession } from "@/contexts/EmployeeSessionContext";
import {
  getWednesdayWeekStart,
  getWeeklyCutoffEnd,
  getNextWeeklyCutoff,
  getPreviousWeeklyCutoff,
  formatWeeklyCutoffPeriod,
} from "@/utils/bimonthly";

type TimesheetDay = {
  date: string;
  dayType?: string;
  regularHours?: number;
  overtimeHours?: number;
  nightDiffHours?: number;
  clockInTime?: string;
  clockOutTime?: string;
};

type TimesheetPayload = {
  period_start: string;
  period_end: string;
  source: "saved" | "live";
  timesheet_status: string;
  finalized_at: string | null;
  total_regular_hours: number;
  total_overtime_hours: number;
  total_night_diff_hours: number;
  days: TimesheetDay[];
};

const statusBadge: Record<string, string> = {
  finalized: "bg-emerald-100 text-emerald-900 border-emerald-200",
  draft: "bg-slate-100 text-slate-800 border-slate-200",
  preview: "bg-blue-100 text-blue-900 border-blue-200",
};

export default function EmployeeMyTimesheetPage() {
  const { employee } = useEmployeeSession();
  const [weekStart, setWeekStart] = useState(() => getWednesdayWeekStart(new Date()));
  const [data, setData] = useState<TimesheetPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const weekEnd = useMemo(() => getWeeklyCutoffEnd(weekStart), [weekStart]);
  const periodStartStr = format(weekStart, "yyyy-MM-dd");
  const periodEndStr = format(weekEnd, "yyyy-MM-dd");
  const periodLabel = formatWeeklyCutoffPeriod(weekStart, weekEnd);

  const loadTimesheet = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/employee-portal/my-timesheet?employee_id=${encodeURIComponent(
          employee.id
        )}&period_start=${periodStartStr}&period_end=${periodEndStr}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load timesheet");
      setData(json as TimesheetPayload);
    } catch (error: any) {
      toast.error(error.message || "Failed to load timesheet");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [employee.id, periodStartStr, periodEndStr]);

  useEffect(() => {
    loadTimesheet();
  }, [loadTimesheet]);

  const statusKey = data?.timesheet_status || "preview";
  const statusLabel =
    statusKey === "finalized"
      ? "Finalized"
      : statusKey === "draft"
        ? "Draft"
        : "Live preview";

  return (
    <div className="w-full py-1 sm:py-2">
      <div className={cn("mx-auto w-full max-w-6xl", epPageStack)}>
        <div className={epPageHeaderRow}>
          <PageTitle className="min-w-0 shrink-0">My Timesheet</PageTitle>
          <HStack gap="2" className="w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              className={epTouchButton}
              onClick={() => setWeekStart(getPreviousWeeklyCutoff(weekStart))}
            >
              <Icon name="CaretLeft" size={IconSizes.sm} />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={epTouchButton}
              onClick={() => setWeekStart(getNextWeeklyCutoff(weekStart))}
            >
              Next
              <Icon name="CaretRight" size={IconSizes.sm} />
            </Button>
          </HStack>
        </div>

        <Card className={cn("border-border/80", epCardInteractive)}>
          <CardContent className="p-4 sm:p-5">
            <HStack justify="between" align="start" className="flex-wrap gap-3 mb-4">
              <VStack gap="1" align="start">
                <BodySmall className="font-semibold text-foreground">{periodLabel}</BodySmall>
                <Caption className="text-muted-foreground">
                  {periodStartStr} → {periodEndStr}
                </Caption>
              </VStack>
              {!loading && data && (
                <Badge variant="outline" className={statusBadge[statusKey] || statusBadge.preview}>
                  {statusLabel}
                  {data.source === "live" ? " · from punches" : ""}
                </Badge>
              )}
            </HStack>

            {loading ? (
              <VStack gap="2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </VStack>
            ) : !data || data.days.length === 0 ? (
              <BodySmall className="text-muted-foreground py-6 text-center">
                No attendance recorded for this week yet.
              </BodySmall>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 mb-4 text-center sm:max-w-md">
                  <div className="rounded-lg border bg-muted/40 p-2">
                    <Caption>Regular</Caption>
                    <p className="text-sm font-semibold tabular-nums">
                      {data.total_regular_hours.toFixed(2)}h
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/40 p-2">
                    <Caption>OT</Caption>
                    <p className="text-sm font-semibold tabular-nums">
                      {data.total_overtime_hours.toFixed(2)}h
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/40 p-2">
                    <Caption>Night Diff</Caption>
                    <p className="text-sm font-semibold tabular-nums">
                      {data.total_night_diff_hours.toFixed(2)}h
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Reg</TableHead>
                        <TableHead className="text-right">OT</TableHead>
                        <TableHead className="text-right">ND</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.days.map((day) => (
                        <TableRow key={day.date}>
                          <TableCell className="text-sm">{day.date}</TableCell>
                          <TableCell className="text-sm capitalize">
                            {(day.dayType || "regular").replace(/-/g, " ")}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm">
                            {Number(day.regularHours || 0).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm">
                            {Number(day.overtimeHours || 0).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm">
                            {Number(day.nightDiffHours || 0).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}

            <Card className="mt-4 border-dashed bg-muted/30">
              <CardContent className="p-4">
                <BodySmall className="text-muted-foreground">
                  Hours look wrong or missing? File a{" "}
                  <Link
                    href="/employee-portal/failure-to-log"
                    className="text-primary font-medium underline-offset-4 hover:underline"
                  >
                    Failure To Log
                  </Link>{" "}
                  request so HR can correct your cutoff.
                </BodySmall>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
