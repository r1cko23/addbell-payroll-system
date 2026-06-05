"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { BodySmall, Caption } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { MetricCard } from "@/components/ui/metric-card";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import type {
  PayrollEntryRow,
  PayrollEntrySummary,
} from "@/lib/ph-payroll/payroll-entry-validation";
import { payrollEntryRowsToCsv } from "@/lib/ph-payroll/payroll-entry-validation";

const statusStyles: Record<string, string> = {
  saved: "bg-blue-100 text-blue-900 border-blue-200",
  ready: "bg-emerald-100 text-emerald-900 border-emerald-200",
  warning: "bg-amber-100 text-amber-900 border-amber-200",
  blocked: "bg-red-100 text-red-900 border-red-200",
};

type Props = {
  validation: PayrollEntrySummary & { payroll_run_id?: string };
  cutoffStart: string;
  loading?: boolean;
  onRefresh?: () => void;
};

export function PayrollReadinessPanel({
  validation,
  cutoffStart,
  loading,
  onRefresh,
}: Props) {
  const blockedRows = validation.rows.filter((r) => r.status === "blocked");
  const warningRows = validation.rows.filter((r) => r.status === "warning");

  function exportBlockedCsv() {
    const csv = payrollEntryRowsToCsv(validation.rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll-blocked-${validation.periodStart}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <HStack justify="between" align="center" className="flex-wrap gap-2">
          <VStack gap="0" align="start">
            <CardTitle className="text-sm font-medium">Cutoff Readiness</CardTitle>
            <Caption className="text-muted-foreground">
              Pre-payroll checks before bulk generate (Frappe Payroll Entry pattern)
            </Caption>
          </VStack>
          <HStack gap="2">
            {onRefresh && (
              <Button variant="ghost" size="sm" onClick={onRefresh} disabled={loading}>
                <Icon name="ArrowsClockwise" size={IconSizes.sm} />
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={exportBlockedCsv}
              disabled={blockedRows.length === 0}
            >
              <Icon name="FileCsv" size={IconSizes.sm} className="mr-1" />
              Export Blocked
            </Button>
            <Button variant="link" size="sm" className="h-8 px-2" asChild>
              <Link href={`/timesheet?period_start=${cutoffStart}`}>
                Time Attendance
              </Link>
            </Button>
          </HStack>
        </HStack>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <MetricCard label="Ready" value={validation.ready} />
          <MetricCard label="Warning" value={validation.warning} />
          <MetricCard label="Blocked" value={validation.blocked} />
          <MetricCard label="Saved" value={validation.saved} />
          <MetricCard
            label="Finalized TS"
            value={`${validation.timesheetsFinalized}/${validation.total}`}
          />
        </div>

        {validation.blocked > 0 && (
          <BodySmall className="text-red-700 mb-3">
            {validation.blocked} employee(s) blocked — fix issues or use admin override on
            generate.
          </BodySmall>
        )}

        {(blockedRows.length > 0 || warningRows.length > 0) && (
          <div className="overflow-x-auto border rounded-md max-h-64">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Timesheet</TableHead>
                  <TableHead>Issues / Warnings</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...blockedRows, ...warningRows].map((row) => (
                  <ReadinessRow key={row.employeeId} row={row} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {validation.blocked === 0 && validation.warning === 0 && (
          <BodySmall className="text-emerald-700">
            All employees in scope are ready for payslip generation.
          </BodySmall>
        )}
      </CardContent>
    </Card>
  );
}

function ReadinessRow({ row }: { row: PayrollEntryRow }) {
  const notes = [...row.issues, ...row.warnings];
  return (
    <TableRow>
      <TableCell>
        <div className="text-sm font-medium">{row.fullName}</div>
        <Caption>{row.employeeCode}</Caption>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={statusStyles[row.status]}>
          {row.status}
        </Badge>
      </TableCell>
      <TableCell className="capitalize text-sm">{row.timesheetStatus}</TableCell>
      <TableCell className="text-xs text-muted-foreground max-w-md">
        {notes.join(" · ") || "—"}
      </TableCell>
    </TableRow>
  );
}
