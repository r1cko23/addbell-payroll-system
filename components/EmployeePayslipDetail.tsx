"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { PayslipPrint } from "@/components/PayslipPrint";
import { PayslipDetailedBreakdown } from "@/components/PayslipDetailedBreakdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HStack, VStack } from "@/components/ui/stack";
import { BodySmall, Caption, H3, StatValue } from "@/components/ui/typography";
import { formatCurrency } from "@/utils/format";
import {
  attendanceForPayslipPrint,
  employeeForPayslipComponents,
  getAttendanceDataFromEarningsBreakdown,
  mapAttendanceDaysForBreakdown,
  mapPayslipDeductionsForPrint,
  resolveAllowanceForPayslipDisplay,
  resolveAdjustmentForPayslipDisplay,
  type EmployeeProfileForPayslip,
  type PayslipRowForDisplay,
} from "@/lib/payslip-display";
import {
  buildPayslipPrintSyncFromPayslipRow,
  type PayslipPrintEarningsSync,
} from "@/lib/payslip-print-sync";

type Props = {
  payslip: PayslipRowForDisplay;
  profile: EmployeeProfileForPayslip;
  holidays?: Array<{ holiday_date: string }>;
  /** Screen breakdown only, print layout only, or both (default). */
  variant?: "screen" | "print" | "both";
  /** When true with variant both, classic payslip is visible on screen (for print preview). */
  inlinePrint?: boolean;
  /** Fired when classic print layout is ready (print variant). */
  onPrintPreviewReady?: (ready: boolean) => void;
  preparedBy?: string;
};

export function EmployeePayslipDetail({
  payslip,
  profile,
  holidays = [],
  variant = "both",
  inlinePrint = false,
  onPrintPreviewReady,
  preparedBy = "HR Department",
}: Props) {
  const employee = useMemo(
    () => employeeForPayslipComponents(profile),
    [profile]
  );
  const attendanceData = useMemo(
    () => getAttendanceDataFromEarningsBreakdown(payslip.earnings_breakdown),
    [payslip.earnings_breakdown]
  );
  const attendanceDays = useMemo(
    () => mapAttendanceDaysForBreakdown(attendanceData),
    [attendanceData]
  );
  const deductions = useMemo(
    () => mapPayslipDeductionsForPrint(payslip),
    [payslip]
  );
  const periodStart = useMemo(
    () => new Date(payslip.period_start),
    [payslip.period_start]
  );
  const periodEnd = useMemo(
    () => new Date(payslip.period_end),
    [payslip.period_end]
  );
  const hasAttendance = attendanceDays.length > 0;
  const grossPay = Number(payslip.gross_pay ?? 0);
  const netPay = Number(payslip.net_pay ?? 0);
  const { amount: adjustment, reason: adjustmentReason } = useMemo(
    () => resolveAdjustmentForPayslipDisplay(payslip),
    [payslip]
  );
  const { amount: allowanceAmount, lines: allowanceLines } = useMemo(
    () => resolveAllowanceForPayslipDisplay(payslip),
    [payslip]
  );
  const [printEarningsSync, setPrintEarningsSync] =
    useState<PayslipPrintEarningsSync | null>(null);
  const canRunDetailedBreakdown =
    hasAttendance && employee.rate_per_hour > 0;

  useEffect(() => {
    setPrintEarningsSync(null);
    onPrintPreviewReady?.(false);
  }, [payslip.period_start, payslip.period_end, payslip.gross_pay]);

  useEffect(() => {
    if (variant !== "print" && variant !== "both") return;

    if (!canRunDetailedBreakdown) {
      onPrintPreviewReady?.(true);
      return;
    }

    try {
      const sync = buildPayslipPrintSyncFromPayslipRow(
        payslip,
        attendanceDays,
        employee.rate_per_hour,
        {
          employment_type: profile.employment_type,
          position: profile.position,
          job_level: profile.job_level,
        }
      );
      if (sync) {
        setPrintEarningsSync(sync);
        onPrintPreviewReady?.(true);
        return;
      }
    } catch (err) {
      console.error("[EmployeePayslipDetail] print sync failed:", err);
    }

    onPrintPreviewReady?.(true);
  }, [
    variant,
    canRunDetailedBreakdown,
    payslip,
    attendanceDays,
    employee.rate_per_hour,
    profile.employment_type,
    profile.position,
    profile.job_level,
    onPrintPreviewReady,
  ]);

  const showScreen = variant === "screen" || variant === "both";
  const showPrint = variant === "print" || variant === "both";

  return (
    <VStack gap="6" className="w-full">
      {showScreen && (
        <>
          {!hasAttendance ? (
            <Card className="border-amber-200 bg-amber-50/80">
              <CardContent className="py-4 text-sm text-amber-900">
                Detailed hour-by-hour breakdown is not available for this
                payslip yet. Gross and net pay are shown below. Contact HR if
                you need a full breakdown re-generated.
              </CardContent>
            </Card>
          ) : employee.rate_per_hour <= 0 ? (
            <Card className="border-amber-200 bg-amber-50/80">
              <CardContent className="py-4 text-sm text-amber-900">
                Pay rates are not on file for this account. Contact HR to
                update your employee profile.
              </CardContent>
            </Card>
          ) : (
            <PayslipDetailedBreakdown
              employee={employee}
              attendanceData={attendanceDays as any}
              periodStart={periodStart}
              periodEnd={periodEnd}
              holidays={holidays}
              onPrintSync={setPrintEarningsSync}
            />
          )}

          <Card>
            <CardHeader>
              <CardTitle>Deductions</CardTitle>
            </CardHeader>
            <CardContent>
              <VStack gap="2">
                {deductions.sssContribution > 0 && (
                  <HStack justify="between">
                    <BodySmall>SSS (regular)</BodySmall>
                    <BodySmall className="font-semibold text-destructive">
                      −{formatCurrency(deductions.sssContribution)}
                    </BodySmall>
                  </HStack>
                )}
                {deductions.sssWisp > 0 && (
                  <HStack justify="between">
                    <BodySmall>SSS WISP</BodySmall>
                    <BodySmall className="font-semibold text-destructive">
                      −{formatCurrency(deductions.sssWisp)}
                    </BodySmall>
                  </HStack>
                )}
                {deductions.philhealthContribution > 0 && (
                  <HStack justify="between">
                    <BodySmall>PhilHealth</BodySmall>
                    <BodySmall className="font-semibold text-destructive">
                      −{formatCurrency(deductions.philhealthContribution)}
                    </BodySmall>
                  </HStack>
                )}
                {deductions.pagibigContribution > 0 && (
                  <HStack justify="between">
                    <BodySmall>Pag-IBIG</BodySmall>
                    <BodySmall className="font-semibold text-destructive">
                      −{formatCurrency(deductions.pagibigContribution)}
                    </BodySmall>
                  </HStack>
                )}
                {deductions.withholdingTax > 0 && (
                  <HStack justify="between">
                    <BodySmall>Withholding tax</BodySmall>
                    <BodySmall className="font-semibold text-destructive">
                      −{formatCurrency(deductions.withholdingTax)}
                    </BodySmall>
                  </HStack>
                )}
                {deductions.vale > 0 && (
                  <HStack justify="between">
                    <BodySmall>Vale</BodySmall>
                    <BodySmall className="font-semibold text-destructive">
                      −{formatCurrency(deductions.vale)}
                    </BodySmall>
                  </HStack>
                )}
                {deductions.sssLoan > 0 && (
                  <HStack justify="between">
                    <BodySmall>SSS salary loan</BodySmall>
                    <BodySmall className="font-semibold text-destructive">
                      −{formatCurrency(deductions.sssLoan)}
                    </BodySmall>
                  </HStack>
                )}
                {deductions.pagibigLoan > 0 && (
                  <HStack justify="between">
                    <BodySmall>Pag-IBIG loan</BodySmall>
                    <BodySmall className="font-semibold text-destructive">
                      −{formatCurrency(deductions.pagibigLoan)}
                    </BodySmall>
                  </HStack>
                )}
                <div className="border-t pt-2">
                  <HStack justify="between">
                    <BodySmall className="font-semibold">Total deductions</BodySmall>
                    <BodySmall className="font-semibold text-destructive">
                      −{formatCurrency(deductions.totalDeductions)}
                    </BodySmall>
                  </HStack>
                </div>
              </VStack>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>How Your Pay Was Computed</CardTitle>
            </CardHeader>
            <CardContent>
              <VStack gap="2">
                <HStack justify="between">
                  <BodySmall>Gross pay (earnings)</BodySmall>
                  <BodySmall className="font-semibold">
                    {formatCurrency(grossPay)}
                  </BodySmall>
                </HStack>
                {adjustment !== 0 && (
                  <HStack justify="between">
                    <BodySmall>
                      Adjustment
                      {adjustmentReason ? ` (${adjustmentReason})` : ""}
                    </BodySmall>
                    <BodySmall
                      className={
                        adjustment >= 0 ? "font-semibold" : "font-semibold text-destructive"
                      }
                    >
                      {adjustment >= 0 ? "+" : ""}
                      {formatCurrency(adjustment)}
                    </BodySmall>
                  </HStack>
                )}
                {allowanceAmount > 0 && (
                  <VStack gap="1">
                    {allowanceLines
                      ?.filter((line) => line.amount > 0)
                      .map((line) => (
                        <HStack key={line.type} justify="between">
                          <BodySmall>{line.type} allowance</BodySmall>
                          <BodySmall className="font-semibold">
                            +{formatCurrency(line.amount)}
                          </BodySmall>
                        </HStack>
                      ))}
                    {(!allowanceLines ||
                      allowanceLines.filter((line) => line.amount > 0).length ===
                        0) && (
                      <HStack justify="between">
                        <BodySmall>Allowance</BodySmall>
                        <BodySmall className="font-semibold">
                          +{formatCurrency(allowanceAmount)}
                        </BodySmall>
                      </HStack>
                    )}
                    {allowanceLines &&
                      allowanceLines.filter((line) => line.amount > 0).length >
                        1 && (
                        <HStack justify="between" className="border-t pt-1">
                          <BodySmall className="font-semibold">
                            Total allowance
                          </BodySmall>
                          <BodySmall className="font-semibold">
                            +{formatCurrency(allowanceAmount)}
                          </BodySmall>
                        </HStack>
                      )}
                  </VStack>
                )}
                <HStack justify="between">
                  <BodySmall>Total deductions</BodySmall>
                  <BodySmall className="font-semibold text-destructive">
                    −{formatCurrency(deductions.totalDeductions)}
                  </BodySmall>
                </HStack>
                <div className="border-t pt-2 mt-1">
                  <HStack justify="between" align="center">
                    <H3>Net Pay</H3>
                    <StatValue className="text-xl md:text-2xl">
                      {formatCurrency(netPay)}
                    </StatValue>
                  </HStack>
                </div>
                <Caption className="text-muted-foreground">
                  Period {format(periodStart, "MMM d")} –{" "}
                  {format(periodEnd, "MMM d, yyyy")}. Net pay = gross pay
                  {adjustment !== 0 ? " + adjustments" : ""}
                  {allowanceAmount > 0 ? " + allowances" : ""} minus all
                  deductions listed on your printed payslip.
                </Caption>
              </VStack>
            </CardContent>
          </Card>
        </>
      )}

      {showPrint && (
        <div
          className={
            showScreen && showPrint && !inlinePrint
              ? "hidden print:block"
              : showScreen && showPrint && inlinePrint
                ? "mt-6 border-t pt-6"
                : undefined
          }
        >
          <PayslipPrint
            employee={{
              ...employee,
              position: profile.position ?? undefined,
            }}
            weekStart={periodStart}
            weekEnd={periodEnd}
            attendance={attendanceForPayslipPrint(payslip)}
            earnings={{
              regularPay: grossPay,
              regularOT: 0,
              regularOTHours: 0,
              nightDiff: 0,
              nightDiffHours: 0,
              sundayRestDay: 0,
              sundayRestDayHours: 0,
              specialHoliday: 0,
              specialHolidayHours: 0,
              regularHoliday: 0,
              regularHolidayHours: 0,
              grossIncome: grossPay,
            }}
            deductions={deductions}
            adjustment={adjustment}
            adjustmentReason={adjustmentReason}
            allowanceAmount={allowanceAmount}
            allowanceLines={allowanceLines}
            netPay={netPay}
            summaryGrossPay={grossPay}
            summaryNetPay={netPay}
            printEarningsSync={printEarningsSync}
            workingDays={0}
            absentDays={0}
            preparedBy={preparedBy}
          />
        </div>
      )}
    </VStack>
  );
}
