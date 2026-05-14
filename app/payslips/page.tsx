"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSection } from "@/components/ui/card-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PayslipPrint } from "@/components/PayslipPrint";
import { PayslipDetailedBreakdown } from "@/components/PayslipDetailedBreakdown";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { calculateBasePay } from "@/utils/base-pay-calculator";
import {
  H1,
  H2,
  H3,
  H4,
  BodySmall,
  Caption,
} from "@/components/ui/typography";
import { Label } from "@/components/ui/label";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { toast } from "sonner";
import { format, addDays, getWeek, parseISO, startOfYear, endOfYear, startOfMonth, endOfMonth } from "date-fns";
import {
  countWeeklyPaysInSemiMonth,
  isFourthStatutoryWeeklyPay,
  isLastWeeklyPayOfSemiMonth,
  semiMonthlyPeriodIndex,
} from "@/lib/weekly-statutory-deductions";
import {
  applyStatutoryProration,
  fetchDistinctWorkDaysMonthToDate,
  statutoryProrationFactorFromDays,
  STATUTORY_PRORATION_REFERENCE_DAYS,
} from "@/lib/statutory-proration";
import { formatCurrency, generatePayslipNumber } from "@/utils/format";
import {
  calculateSSS,
  calculatePhilHealth,
  calculatePagIBIG,
  calculateMonthlySalary,
  calculateSemiMonthlyWithholdingTax,
  getWithholdingTaxBreakdown,
} from "@/utils/ph-deductions";
import { calculateWeeklyPayroll } from "@/utils/payroll-calculator";
import {
  creditNightDiffHours,
  creditOvertimeHours,
  creditWorkHoursHalfHour,
} from "@/utils/overtime";
import {
  getWeekOfMonth,
  isEligibleForHolidayPayRule,
  isSubstantiveHolidayWork,
  HOLIDAY_UNWORKED_CREDIT_HOURS,
} from "@/utils/holidays";
import { fetchHolidaysRange } from "@/lib/holidays/fetchHolidays";
// Bi-monthly helpers are no longer used; payslips now align with weekly (Wed–Tue) cutoffs.
import { generateTimesheetFromClockEntries } from "@/lib/timesheet-auto-generator";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { getSessionSafe, refreshSessionSafe } from "@/lib/session-utils";
import { fetchSessionsForEmployee, fetchProjectTimeSessionsForEmployee, manilaDatesWithCompleteBundySession } from "@/lib/timeEntries";

const normalizeValue = (value: unknown) => String(value || "").trim().toLowerCase();

interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
  last_name?: string | null;
  first_name?: string | null;
  monthly_rate?: number | null;
  per_day?: number | null;
  position?: string | null;
  eligible_for_ot?: boolean | null;
  assigned_hotel?: string | null;
  employee_type?: "office-based" | "client-based" | null;
  job_level?: string | null;
  hire_date?: string | null;
  termination_date?: string | null;
  transferred_from_employee_id?: string | null; // When transferred (new record), previous employees.id so OT is still loaded
  // Computed fields for backward compatibility
  rate_per_day?: number; // Alias for per_day
  rate_per_hour?: number; // Computed from per_day / 8
}

interface WeeklyAttendance {
  id: string;
  period_start: string;
  period_end: string;
  attendance_data: any;
  gross_pay: number;
}

interface EmployeeDeductions {
  vale_amount: number;
  sss_salary_loan: number;
  sss_calamity_loan: number;
  pagibig_salary_loan: number;
  pagibig_calamity_loan: number;
  monthly_loans?: {
    sssLoan?: number;
    pagibigLoan?: number;
    companyLoan?: number;
    emergencyLoan?: number;
    otherLoan?: number;
  }; // Manual loan deductions for 1st cutoff (1-15) only, separated by loan type
  sss_contribution: number;
  sss_wisp?: number; // WISP (Workers' Investment and Savings Program) - mandatory for MSC > PHP 20,000
  philhealth_contribution: number;
  pagibig_contribution: number;
  withholding_tax: number;
}

/** Manual other deductions: one amount per fixed type (no free-text types). */
const OTHER_DEDUCTION_TYPES = ["Vale", "Uniform", "PPE", "Gasul"] as const;
type OtherDeductionType = (typeof OTHER_DEDUCTION_TYPES)[number];

type OtherDeductionRow = {
  id: string;
  type: OtherDeductionType;
  amount: string;
};

function createDefaultOtherDeductionRows(): OtherDeductionRow[] {
  return OTHER_DEDUCTION_TYPES.map((type) => ({
    id: `row-${type}`,
    type,
    amount: "0",
  }));
}

function mergeOtherDeductionRowsFromSaved(
  savedLines: unknown,
  valeFromDb: number
): OtherDeductionRow[] {
  const amounts = new Map<string, string>();
  for (const t of OTHER_DEDUCTION_TYPES) {
    amounts.set(t, "0");
  }
  amounts.set("Vale", String(valeFromDb ?? 0));
  if (Array.isArray(savedLines)) {
    for (const line of savedLines) {
      const L = line as { type?: string; amount?: number | string };
      const typ = String(L?.type ?? "").trim();
      if ((OTHER_DEDUCTION_TYPES as readonly string[]).includes(typ)) {
        const amt =
          L?.amount !== undefined && L?.amount !== null
            ? String(L.amount)
            : "0";
        amounts.set(typ, amt);
      }
    }
  }
  return OTHER_DEDUCTION_TYPES.map((type) => ({
    id: `row-${type}`,
    type,
    amount: amounts.get(type) ?? "0",
  }));
}

/** Multiple adjustment lines (description + amount); total stored in payslip.adjustment_amount. */
type AdjustmentRow = {
  id: string;
  description: string;
  amount: string;
};

function createDefaultAdjustmentRows(): AdjustmentRow[] {
  return [{ id: "adj-1", description: "", amount: "0" }];
}

function mergeAdjustmentRowsFromSaved(
  adjustmentAmount: number,
  adjustmentReason: string | null | undefined,
  deductionsBreakdown: Record<string, unknown> | undefined
): AdjustmentRow[] {
  const lines = deductionsBreakdown?.adjustment_lines;
  if (Array.isArray(lines) && lines.length > 0) {
    return lines.map((line: unknown, i: number) => {
      const L = line as {
        description?: string;
        reason?: string;
        amount?: number | string;
      };
      const desc = String(L?.description ?? L?.reason ?? "").trim();
      const amt =
        L?.amount !== undefined && L?.amount !== null
          ? String(L.amount)
          : "0";
      return { id: `adj-${i}`, description: desc, amount: amt };
    });
  }
  if (
    (adjustmentAmount !== 0 && !Number.isNaN(adjustmentAmount)) ||
    (adjustmentReason && adjustmentReason.trim())
  ) {
    return [
      {
        id: "adj-legacy",
        description: adjustmentReason?.trim() ?? "",
        amount: String(adjustmentAmount ?? 0),
      },
    ];
  }
  return createDefaultAdjustmentRows();
}

/** Single field for DB + print preview (legacy consumers). */
function combineAdjustmentReasonForDb(rows: AdjustmentRow[]): string | null {
  const parts = rows
    .map((r) => {
      const d = r.description.trim();
      const a = parseFloat(r.amount) || 0;
      if (!d && a === 0) return "";
      if (!d) return `${a}`;
      return `${d}: ${a}`;
    })
    .filter(Boolean);
  if (parts.length === 0) return null;
  return parts.join(" | ").slice(0, 2000);
}

export default function PayslipsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { canAccessSalaryInfo, canUpdatePayslip, loading: roleLoading } = useUserRole();
  const { canRead, loading: permissionsLoading } = usePermissions();
  const hasPayslipsAccess = canAccessSalaryInfo || canRead("payslips");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null
  );
  const [periodStart, setPeriodStart] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    // Company cutoff: Wednesday to Tuesday — find current week's Wednesday
    while (d.getDay() !== 3) {
      d.setDate(d.getDate() - 1);
    }
    return d;
  });
  const [payrollRunId, setPayrollRunId] = useState<string | null>(null);
  const [payrollRunStatus, setPayrollRunStatus] = useState<string | null>(null);
  const [attendance, setAttendance] = useState<WeeklyAttendance | null>(null);
  const [deductions, setDeductions] = useState<EmployeeDeductions | null>(null);
  const [govContributionOverrides, setGovContributionOverrides] = useState<{
    sssReg: number | null;
    sssWisp: number | null;
    phil: number | null;
    pagibig: number | null;
    tax: number | null;
  }>({
    sssReg: null,
    sssWisp: null,
    phil: null,
    pagibig: null,
    tax: null,
  });
  const [loading, setLoading] = useState(true);
  const [clockEntries, setClockEntries] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [holidays, setHolidays] = useState<
    Array<{ holiday_date: string; holiday_type?: string }>
  >([]);
  const [restDaysMap, setRestDaysMap] = useState<Map<string, boolean>>(new Map());
  const [calculatedTotalGrossPay, setCalculatedTotalGrossPay] = useState<number | null>(null);

  // Debug: Log when calculatedTotalGrossPay changes
  useEffect(() => {
    console.log('[PayslipsPage] calculatedTotalGrossPay state updated:', calculatedTotalGrossPay);
  }, [calculatedTotalGrossPay]);

  // Redirect HR users without salary access
  useEffect(() => {
    if (!roleLoading && !permissionsLoading) {
      if (!hasPayslipsAccess) {
        toast.error("You do not have permission to access this page.");
        router.push("/dashboard");
      }
    }
  }, [hasPayslipsAccess, roleLoading, permissionsLoading, router]);

  // Deep-link support from Payroll Run: /payslips?employee_id=...&period_start=YYYY-MM-DD&payroll_run_id=...
  useEffect(() => {
    const employeeId = searchParams.get("employee_id");
    const periodStartStr = searchParams.get("period_start");
    const runId = searchParams.get("payroll_run_id");

    if (runId) setPayrollRunId(runId);

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (employeeId && uuidRegex.test(employeeId)) {
      setSelectedEmployeeId(employeeId);
    }

    if (periodStartStr && /^\d{4}-\d{2}-\d{2}$/.test(periodStartStr)) {
      const d = new Date(`${periodStartStr}T00:00:00`);
      if (!Number.isNaN(d.getTime())) {
        d.setHours(0, 0, 0, 0);
        setPeriodStart(d);
      }
    }
    // Intentionally run once on mount; params shouldn't be reactive for editing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If editing from a payroll run, only lock after finalization.
  useEffect(() => {
    let cancelled = false;
    async function loadRunStatus(runId: string) {
      try {
        const { data, error } = await supabase
          .from("payroll_runs")
          .select("status")
          .eq("id", runId)
          .single();
        if (error) throw error;
        if (!cancelled) setPayrollRunStatus((data as any)?.status ?? null);
      } catch {
        if (!cancelled) setPayrollRunStatus(null);
      }
    }

    if (payrollRunId) loadRunStatus(payrollRunId);
    else setPayrollRunStatus(null);

    return () => {
      cancelled = true;
    };
  }, [payrollRunId, supabase]);

  /**
   * Weekly pay (Wed–Tue): statutory month = calendar month of period end (Tuesday).
   * SSS / PhilHealth / Pag-IBIG: full month (prorated) on the 4th weekly pay (last Tue if fewer than four).
   * BIR withholding: semi-monthly — last Tuesday in days 1–15 and last Tuesday of the month (days 16–end);
   * gross for that half minus ½ prorated monthly contributions; BIR monthly table on (2× semi taxable) ÷ 2.
   */
  const payWeekContainsDayOfMonth = (dayOfMonth: number) => {
    const start = new Date(periodStart);
    start.setHours(0, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      if (d.getDate() === dayOfMonth) return true;
    }
    return false;
  };

  const payWeekContainsLastDayOfAnyMonth = () => {
    const start = new Date(periodStart);
    start.setHours(0, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const next = new Date(d);
      next.setDate(d.getDate() + 1);
      if (next.getMonth() !== d.getMonth()) return true;
    }
    return false;
  };

  const isFirstCutoff = () => payWeekContainsDayOfMonth(15);

  const isSecondCutoff = () => payWeekContainsLastDayOfAnyMonth();

  // State for active loans with full details
  interface LoanDetail {
    id: string;
    loan_type: string;
    current_balance: number;
    monthly_payment: number;
    total_terms: number;
    remaining_terms: number;
    cutoff_assignment: string;
    deduction_amount: number; // Amount for this cutoff
  }

  const [activeLoans, setActiveLoans] = useState<LoanDetail[]>([]);

  // State for calculated monthly loans totals (for calculations)
  const [monthlyLoans, setMonthlyLoans] = useState<{
    sssLoan: number;
    pagibigLoan: number;
    companyLoan: number;
    emergencyLoan: number;
    otherLoan: number;
  }>({
    sssLoan: 0,
    pagibigLoan: 0,
    companyLoan: 0,
    emergencyLoan: 0,
    otherLoan: 0,
  });

  // Payslip form data - Mandatory deductions are now always applied
  const [applySss] = useState(true); // Always true - mandatory
  const [applyPhilhealth] = useState(true); // Always true - mandatory
  const [applyPagibig] = useState(true); // Always true - mandatory
  const [preparedBy, setPreparedBy] = useState("Melanie R. Sapinoso");
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [adjustmentRows, setAdjustmentRows] = useState<AdjustmentRow[]>(() =>
    createDefaultAdjustmentRows()
  );
  /** Fixed types (Vale, Uniform, PPE, Gasul); amounts summed into weekly manual deductions */
  const [otherDeductionRows, setOtherDeductionRows] = useState<
    OtherDeductionRow[]
  >(() => createDefaultOtherDeductionRows());
  /** Same calendar month **and BIR semi-month half** as period end (Tue): saved gross+adj from other weeks in that half; prior WH in that half */
  const [semiMonthlyRollupForTax, setSemiMonthlyRollupForTax] = useState<{
    grossFromSavedOtherWeeksInSemiMonth: number;
    taxWithheldPriorExcludingCurrentInSemiMonth: number;
  } | null>(null);
  /** Distinct work days (Manila) month-to-date through period end Tue — for statutory proration vs 26. */
  const [mtdWorkDaysForStatutory, setMtdWorkDaysForStatutory] = useState<
    number | null
  >(null);
  // Saved payslip for this employee + period (when exists, we display DB values and lock edits)
  const [savedPayslip, setSavedPayslip] = useState<{
    id: string;
    gross_pay: number;
    total_deductions: number;
    net_pay: number;
    adjustment_amount: number;
    adjustment_reason: string | null;
    deductions_breakdown: Record<string, unknown>;
    sss_amount: number;
    philhealth_amount: number;
    pagibig_amount: number;
    withholding_tax?: number;
  } | null>(null);
  const [showSavePayslipConfirm, setShowSavePayslipConfirm] = useState(false);
  const [showUpdatePayslipConfirm, setShowUpdatePayslipConfirm] = useState(false);

  const parseNumberInput = (value: string): number | null => {
    if (value.trim() === "") return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    return Math.round(Math.max(0, parsed) * 100) / 100;
  };

  function handlePrintPayslip() {
    // Find the payslip container
    const payslipContainer = document.getElementById("payslip-print-content");
    if (!payslipContainer) {
      toast.error("Payslip content not found");
      return;
    }

    // Create a new window for printing
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Please allow popups to print payslip");
      return;
    }

    // Get the payslip HTML content
    const payslipHTML = payslipContainer.outerHTML;

    // Write the HTML document with print styles
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Payslip - ${selectedEmployee?.full_name || "Employee"}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            html, body {
              width: 100%;
              height: 100%;
              margin: 0;
              padding: 0;
              background: white;
              color: black;
              font-family: Arial, sans-serif;
            }
            .payslip-container {
              width: 8.5in;
              padding: 0.5in;
              margin: 0 auto;
              background: white;
              color: black;
            }
            @media print {
              @page {
                size: letter portrait;
                margin: 0.5in;
              }
              html, body {
                margin: 0;
                padding: 0;
                background: white;
              }
              .payslip-container {
                margin: 0 auto;
                page-break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          ${payslipHTML}
          <script>
            // Auto-print when window loads
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 250);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    if (selectedEmployeeId) {
      const emp = employees.find((e) => e.id === selectedEmployeeId);
      setSelectedEmployee(emp || null);
      // Reset adjustments so they don't carry over when switching employees
      setAdjustmentRows(createDefaultAdjustmentRows());
      // Reset manual government contribution edits for the new context.
      setGovContributionOverrides({
        sssReg: null,
        sssWisp: null,
        phil: null,
        pagibig: null,
        tax: null,
      });
      // Only load attendance if employee is found in the list
      if (emp) {
        loadAttendanceAndDeductions();
      } else if (employees.length > 0) {
        // Employee not found in list - might be a stale selection
        console.warn(
          `Employee ${selectedEmployeeId} not found in employees list`
        );
      }
    }
  }, [selectedEmployeeId, periodStart, employees, payrollRunId]);

  useEffect(() => {
    if (!selectedEmployee?.id) {
      setSemiMonthlyRollupForTax(null);
      return;
    }
    const end = new Date(periodStart);
    end.setDate(end.getDate() + 6);
    end.setHours(0, 0, 0, 0);
    const curEnd = format(end, "yyyy-MM-dd");
    const half = semiMonthlyPeriodIndex(end);
    const startM = startOfMonth(end);
    const endM = endOfMonth(end);
    let cancelled = false;
    supabase
      .from("payslips")
      .select("gross_pay, adjustment_amount, period_end, deductions_breakdown")
      .eq("employee_id", selectedEmployee.id)
      .gte("period_end", format(startM, "yyyy-MM-dd"))
      .lte("period_end", format(endM, "yyyy-MM-dd"))
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setSemiMonthlyRollupForTax(null);
          return;
        }
        let grossOther = 0;
        let taxPrior = 0;
        for (const row of data || []) {
          if (row.period_end === curEnd) continue;
          const [py, pm, pd] = (row.period_end || "").split("-").map(Number);
          if (!py || !pm || !pd) continue;
          const rowEnd = new Date(py, pm - 1, pd);
          if (semiMonthlyPeriodIndex(rowEnd) !== half) continue;
          grossOther += (row.gross_pay ?? 0) + (row.adjustment_amount ?? 0);
          const br = row.deductions_breakdown as { tax?: number } | undefined;
          taxPrior += typeof br?.tax === "number" ? br.tax : 0;
        }
        setSemiMonthlyRollupForTax({
          grossFromSavedOtherWeeksInSemiMonth: Math.round(grossOther * 100) / 100,
          taxWithheldPriorExcludingCurrentInSemiMonth:
            Math.round(taxPrior * 100) / 100,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [selectedEmployee?.id, periodStart, supabase]);

  useEffect(() => {
    if (!selectedEmployee?.id) {
      setMtdWorkDaysForStatutory(null);
      return;
    }
    const end = new Date(periodStart);
    end.setDate(end.getDate() + 6);
    end.setHours(0, 0, 0, 0);
    const ids = [
      selectedEmployee.id,
      selectedEmployee.transferred_from_employee_id,
    ].filter(Boolean) as string[];
    let cancelled = false;
    fetchDistinctWorkDaysMonthToDate(supabase, ids, end)
      .then((n) => {
        if (!cancelled) setMtdWorkDaysForStatutory(n);
      })
      .catch(() => {
        if (!cancelled) {
          setMtdWorkDaysForStatutory(STATUTORY_PRORATION_REFERENCE_DAYS);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    selectedEmployee?.id,
    selectedEmployee?.transferred_from_employee_id,
    periodStart,
    supabase,
  ]);

  async function loadEmployees() {
    try {
      console.log("Loading employees for payslip generation...");
      const { data, error } = await supabase
        .from("employees")
        .select(
          "id, company_id_no, employee_code, first_name, middle_name, last_name, employment_status, salary_basis, base_rate, position, hire_date, employment_type, job_level, transferred_from_employee_id"
        )
        .order("last_name", { ascending: true, nullsFirst: false })
        .order("first_name", { ascending: true, nullsFirst: false });

      if (error) {
        console.error("Error loading employees:", error);
        console.error("Error details:", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        throw error;
      }

      const activeEmployees = (data || []).filter(
        (emp: any) => normalizeValue(emp?.employment_status) === "active"
      );
      console.log(`Loaded ${activeEmployees.length} active employees`);
      if (activeEmployees.length > 0) {
        console.log("Sample employee:", activeEmployees[0]);
        const mappedEmployees = activeEmployees.map((emp: any) => {
          const full_name = [emp.first_name, emp.middle_name, emp.last_name].filter(Boolean).join(" ").trim() || "—";
          const employee_id = emp.company_id_no ?? emp.employee_code ?? emp.id;
          const monthly_rate = emp.salary_basis === "monthly" ? Number(emp.base_rate ?? 0) : Number(emp.base_rate ?? 0) * 26;
          const per_day = emp.salary_basis === "daily" ? Number(emp.base_rate ?? 0) : monthly_rate / 26;
          const rate_per_day = per_day;
          const rate_per_hour = rate_per_day ? rate_per_day / 8 : undefined;
          return {
            ...emp,
            employee_id,
            full_name,
            employee_type: emp.employment_type ?? null,
            monthly_rate: monthly_rate || null,
            per_day: per_day || null,
            rate_per_day: rate_per_day || undefined,
            rate_per_hour: rate_per_hour ?? undefined,
          };
        });
        setEmployees(mappedEmployees);
      } else {
        console.warn(
          "No active employees found. Checking if there are any employees at all..."
        );
        const { data: allEmployees, error: allEmpError } = await supabase
          .from("employees")
          .select("id, company_id_no, employee_code, employment_status")
          .limit(10);

        if (allEmpError) {
          console.error("Error checking for all employees:", allEmpError);
        } else {
          console.log(
            "Total employees in database:",
            allEmployees?.length || 0
          );
          if (allEmployees && allEmployees.length > 0) {
          const activeCount = (allEmployees as any[]).filter(
              (e: any) => normalizeValue(e?.employment_status) === "active"
            ).length;
            console.log(
              `Found ${activeCount} active and ${(allEmployees?.length ?? 0) - activeCount} inactive employees`
            );
          } else {
            console.warn(
              "No employees found in database at all. Please create employees first."
            );
          }
        }
      }
    } catch (error) {
      console.error("Error loading employees:", error);
      toast.error("Failed to load employees");
      // Set empty array so UI doesn't break
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadAttendanceAndDeductions() {
    if (!selectedEmployeeId) return;

    // Validate employee_id is a valid UUID
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(selectedEmployeeId)) {
      console.error("Invalid employee ID format:", selectedEmployeeId);
      toast.error("Invalid employee selected. Please select a valid employee.");
      return;
    }

    try {
      const periodStartStr = format(periodStart, "yyyy-MM-dd");
      const periodEndDate = new Date(periodStart);
      periodEndDate.setDate(periodEndDate.getDate() + 6);
      const periodEndStr = format(periodEndDate, "yyyy-MM-dd");

      console.log("Loading attendance for employee:", {
        employeeId: selectedEmployeeId,
        periodStart: periodStartStr,
        periodEnd: periodEndStr,
        periodStartDate: periodStart.toISOString(),
        periodEndDate: periodEnd.toISOString(),
      });

      // Load saved payslip for this employee + period (if any). When present, we display DB values and lock edits.
      let existingPayslipQuery = supabase
        .from("payslips")
        .select("id, gross_pay, total_deductions, net_pay, adjustment_amount, adjustment_reason, deductions_breakdown, sss_amount, philhealth_amount, pagibig_amount, earnings_breakdown")
        .eq("employee_id", selectedEmployeeId)
        .eq("period_start", periodStartStr)
        .eq("period_end", periodEndStr)
        .order("created_at", { ascending: false })
        .limit(1);
      if (payrollRunId) {
        existingPayslipQuery = existingPayslipQuery.eq("payroll_run_id", payrollRunId);
      }
      const { data: existingPayslipRows } = await existingPayslipQuery;
      const existingPayslipRow = Array.isArray(existingPayslipRows) ? existingPayslipRows[0] : null;

      if (existingPayslipRow) {
        const ded = (existingPayslipRow.deductions_breakdown as Record<string, unknown>) || {};
        setSavedPayslip({
          id: existingPayslipRow.id,
          gross_pay: existingPayslipRow.gross_pay,
          total_deductions: existingPayslipRow.total_deductions ?? 0,
          net_pay: existingPayslipRow.net_pay,
          adjustment_amount: existingPayslipRow.adjustment_amount ?? 0,
          adjustment_reason: existingPayslipRow.adjustment_reason,
          deductions_breakdown: ded,
          sss_amount: existingPayslipRow.sss_amount ?? 0,
          philhealth_amount: existingPayslipRow.philhealth_amount ?? 0,
          pagibig_amount: existingPayslipRow.pagibig_amount ?? 0,
          withholding_tax: typeof ded.tax === "number" ? ded.tax : 0,
        });
        setAdjustmentRows(
          mergeAdjustmentRowsFromSaved(
            existingPayslipRow.adjustment_amount ?? 0,
            existingPayslipRow.adjustment_reason,
            ded
          )
        );
      } else {
        setSavedPayslip(null);
        setAdjustmentRows(createDefaultAdjustmentRows());
      }

      // Prefer saved payslip attendance (source of truth for generated payroll runs).
      // Fallback to regenerated sessions only when saved breakdown is unavailable.
      let attData = null as any;
      if (existingPayslipRow) {
        const earnings = existingPayslipRow.earnings_breakdown as any;
        const savedAttendanceDays = Array.isArray(earnings)
          ? earnings
          : Array.isArray(earnings?.attendance_data)
          ? earnings.attendance_data
          : [];
        if (savedAttendanceDays.length > 0) {
          const totalRegular =
            Math.round(
              savedAttendanceDays.reduce(
                (sum: number, day: any) =>
                  sum +
                  creditWorkHoursHalfHour(
                    Math.round(Number(day?.regularHours || 0) * 100) / 100
                  ),
                0
              ) * 100
            ) / 100;
          const totalOvertime =
            Math.round(
              savedAttendanceDays.reduce(
                (sum: number, day: any) => sum + Number(day?.overtimeHours || 0),
                0
              ) * 100
            ) / 100;
          const totalNightDiff =
            Math.round(
              savedAttendanceDays.reduce(
                (sum: number, day: any) =>
                  sum +
                  creditNightDiffHours(
                    Math.round(Number(day?.nightDiffHours || 0) * 100) / 100
                  ),
                0
              ) * 100
            ) / 100;

          attData = {
            id: `saved-${existingPayslipRow.id}`,
            employee_id: selectedEmployeeId,
            period_start: periodStartStr,
            period_end: periodEndStr,
            period_type: "weekly",
            attendance_data: savedAttendanceDays,
            total_regular_hours: totalRegular,
            total_overtime_hours: totalOvertime,
            total_night_diff_hours: totalNightDiff,
            gross_pay: Number(existingPayslipRow.gross_pay || 0),
            status: "draft",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: null,
          };
        }
      }

      // Load leave requests for the period (needed for both existing and new attendance)
      const { data: leaveData, error: leaveError } = await supabase
        .from("leave_requests")
        .select("id, leave_type, start_date, end_date, status")
        .eq("employee_id", selectedEmployeeId)
        .lte("start_date", periodEndStr)
        .gte("end_date", periodStartStr)
        .in("status", ["approved", "approved_by_manager", "approved_by_hr"]);

      if (leaveError) {
        console.warn("Error loading leave requests:", leaveError);
      }

      // Create a map of leave dates with their leave types and half-day status
      // Prioritize SIL over other leave types when multiple leaves exist on the same date
      const leaveDatesMap = new Map<
        string,
        { leaveType: string; status: string; isHalfDay?: boolean }
      >();
      if (leaveData) {
        leaveData.forEach((leave: any) => {
          // Get half-day dates from the leave request
          const halfDayDatesSet = new Set<string>();
          if (leave.half_day_dates && Array.isArray(leave.half_day_dates)) {
            leave.half_day_dates.forEach((dateStr: string) => {
              halfDayDatesSet.add(dateStr);
            });
          }

          // Use date range (start_date to end_date) — selected_dates not in schema
          {
            const startDate = new Date(leave.start_date);
            const endDate = new Date(leave.end_date);
            let currentDate = new Date(startDate);
            while (currentDate <= endDate) {
              const dateStr = format(currentDate, "yyyy-MM-dd");
              if (dateStr >= periodStartStr && dateStr <= periodEndStr) {
                const existing = leaveDatesMap.get(dateStr);
                // Prioritize SIL over other leave types
                if (!existing || leave.leave_type === "SIL") {
                  leaveDatesMap.set(dateStr, {
                    leaveType: leave.leave_type,
                    status: leave.status,
                    isHalfDay: halfDayDatesSet.has(dateStr),
                  });
                }
              }
              currentDate.setDate(currentDate.getDate() + 1);
            }
          }
        });
      }

      console.log("Leave dates map:", Array.from(leaveDatesMap.entries()));

      if (!attData) {
        console.log(
          "Generating payslip from time_entries (matching timesheet)..."
        );
      try {
          const periodStartDate = new Date(periodStart);
          periodStartDate.setHours(0, 0, 0, 0);
          periodStartDate.setDate(periodStartDate.getDate() - 1);

          const periodEndDate = new Date(periodEnd);
          periodEndDate.setHours(23, 59, 59, 999);
          periodEndDate.setDate(periodEndDate.getDate() + 1);

          const getDateInManila = (iso: string) => {
            const d = new Date(iso);
            const formatter = new Intl.DateTimeFormat("en-US", {
              timeZone: "Asia/Manila",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            });
            const parts = formatter.formatToParts(d);
            return `${parts.find((p) => p.type === "year")?.value}-${
              parts.find((p) => p.type === "month")?.value
            }-${parts.find((p) => p.type === "day")?.value}`;
          };
          const [mainSessions, projectSessions] = await Promise.all([
            fetchSessionsForEmployee(supabase, selectedEmployeeId, periodStartDate.toISOString(), periodEndDate.toISOString(), getDateInManila),
            fetchProjectTimeSessionsForEmployee(supabase, selectedEmployeeId, periodStartDate.toISOString(), periodEndDate.toISOString(), getDateInManila),
          ]);
          const clockEntries = [...(mainSessions || []), ...(projectSessions || [])];

          // Merge approved FTL pairs (IN + OUT) as synthetic complete sessions,
          // so Payslip Generation matches Time Attendance behavior.
          const transferredFromIdForFtl = selectedEmployee?.transferred_from_employee_id ?? null;
          const employeeIdsToLoadFtl = transferredFromIdForFtl
            ? [selectedEmployeeId, transferredFromIdForFtl]
            : [selectedEmployeeId];

          const { data: approvedFtlRows, error: approvedFtlError } = await supabase
            .from("failure_to_log")
            .select(
              "id, employee_id, missed_date, actual_clock_in_time, actual_clock_out_time, entry_type, status"
            )
            .in("employee_id", employeeIdsToLoadFtl)
            .gte("missed_date", periodStartStr)
            .lte("missed_date", periodEndStr);
          if (approvedFtlError) {
            console.warn("Error loading approved FTL rows for payslip generation:", approvedFtlError);
          } else {
            const pairedByDate = new Map<
              string,
              { inTime: string | null; outTime: string | null; sourceId: string }
            >();
            (approvedFtlRows || []).forEach((row: any) => {
              if (normalizeValue(row.status) !== "approved") return;
              if (!row.missed_date) return;
              const dateKey = String(row.missed_date).split("T")[0];
              const pair = pairedByDate.get(dateKey) || {
                inTime: null,
                outTime: null,
                sourceId: row.id,
              };
              if (
                (row.entry_type === "in" || row.entry_type === "both") &&
                row.actual_clock_in_time
              ) {
                pair.inTime = row.actual_clock_in_time;
              }
              if (
                (row.entry_type === "out" || row.entry_type === "both") &&
                row.actual_clock_out_time
              ) {
                pair.outTime = row.actual_clock_out_time;
              }
              pairedByDate.set(dateKey, pair);
            });

            const bundyDatesForFtl = manilaDatesWithCompleteBundySession(
              mainSessions || [],
              getDateInManila
            );
            pairedByDate.forEach((pair, dateKey) => {
              if (!pair.inTime || !pair.outTime) return;
              if (new Date(pair.outTime) <= new Date(pair.inTime)) return;
              if (
                bundyDatesForFtl.has(dateKey) ||
                bundyDatesForFtl.has(getDateInManila(pair.inTime))
              ) {
                return;
              }
              clockEntries.push({
                id: `ftl-${pair.sourceId}`,
                employee_id: selectedEmployeeId,
                clock_in_time: pair.inTime,
                clock_out_time: pair.outTime,
                status: "approved",
                total_hours:
                  Math.round(
                    ((new Date(pair.outTime).getTime() - new Date(pair.inTime).getTime()) /
                      (1000 * 60 * 60)) *
                      100
                  ) / 100,
                regular_hours: null,
                overtime_hours: 0,
                total_night_diff_hours: 0,
              } as any);
            });
          }

          if (!clockEntries || clockEntries.length === 0) {
            console.log("No time entries found for this period");
            // Set attendance to null - will show "No Attendance Data" message
            setAttendance(null);
            return;
          }

          // Filter entries by date in Asia/Manila timezone like timesheet page does
          const filteredClockEntries = (clockEntries || []).filter(
            (entry: any) => {
              const entryDate = new Date(entry.clock_in_time);
              // Convert to Asia/Manila timezone for date comparison
              const entryDatePH = new Date(
                entryDate.toLocaleString("en-US", { timeZone: "Asia/Manila" })
              );
              const entryDateStr = format(entryDatePH, "yyyy-MM-dd");
              // Check if entry date falls within the period
              return (
                entryDateStr >= periodStartStr && entryDateStr <= periodEndStr
              );
            }
          );

          if (filteredClockEntries.length === 0) {
            console.log(
              "No time entries found after filtering for period"
            );
            setAttendance(null);
            return;
          }

          console.log(
            `Found ${clockEntries.length} time entries, ${filteredClockEntries.length} within period`
          );

          const holidaysNormalized = await fetchHolidaysRange(supabase as any, {
            start: periodStartStr,
            end: periodEndStr,
            lookbackDays: 7,
          });
          const holidaysForPeriod: Array<{ holiday_date: string; holiday_type?: string }> =
            holidaysNormalized.map((h) => ({
              holiday_date: h.date,
              holiday_type: h.type,
            }));
          setHolidays(holidaysForPeriod);

          const restDaysMap = new Map<string, boolean>();
          setRestDaysMap(restDaysMap);

          // eligible_for_ot controls whether employee can FILE new OT; approved OT always shows on payslip
          const isEligibleForOT = selectedEmployee?.eligible_for_ot !== false;
          const includeApprovedOTInPayslip = true; // Always merge approved OT into payslip so it displays

          // Night differential: all employees (10PM–6AM overlap with approved OT).
          const isEligibleForNightDiff = true;
          const ndNightStartHour = 22; // 10PM – 6AM Philippine time

          // Fetch approved overtime requests for this period
          // Always load approved OT (same as Time Attendance). Merge all approved OT into payslip
          // so already-approved OT always shows; eligible_for_ot only controls filing new OT requests.
          let approvedOTByDate = new Map<string, number>();
          let approvedNDByDate = new Map<string, number>();
          // Load OT for current employee and, if transferred, for predecessor so OT is not lost
          const transferredFromId = selectedEmployee?.transferred_from_employee_id ?? null;
          const employeeIdsToLoad = transferredFromId
            ? [selectedEmployeeId, transferredFromId]
            : [selectedEmployeeId];
          const { data: otRequests, error: otError } = await supabase
            .from("overtime_requests")
            .select("ot_date, end_date, start_time, end_time, total_hours, status")
            .in("employee_id", employeeIdsToLoad)
            .gte("ot_date", periodStartStr)
            .lte("ot_date", periodEndStr);

          // Log each OT request and whether it falls 10PM–6AM Philippine (for ND check)
          const otRequestNDCheck: Array<{ ot_date: string; start_time: string; end_time: string; total_hours: number; ndHours: number; overlaps10pm6am: boolean }> = [];

          if (otError) {
            console.warn("Error loading OT requests:", otError);
          } else if (otRequests) {
            // Group OT hours and calculate ND by date
            otRequests.forEach((ot: any) => {
                const status = normalizeValue(ot?.status);
                if (!["approved", "approved_by_manager", "approved_by_hr"].includes(status)) return;
                const dateStr =
                  typeof ot.ot_date === "string"
                    ? ot.ot_date.split("T")[0]
                    : format(new Date(ot.ot_date), "yyyy-MM-dd");

                // Add OT hours (credited: min 1h, then 0.5 increments)
                const existingOT = approvedOTByDate.get(dateStr) || 0;
                const credited = creditOvertimeHours(Number(ot.total_hours || 0));
                const newOT = existingOT + credited;
                approvedOTByDate.set(dateStr, newOT);

                let ndHours = 0;
                // Calculate night differential from OT request: ND only when OT overlaps 10PM–6AM Philippine time
                if (isEligibleForNightDiff && ot.start_time && ot.end_time) {
                  const startTime = ot.start_time.includes("T")
                    ? ot.start_time.split("T")[1].substring(0, 8)
                    : ot.start_time.substring(0, 8);
                  const endTime = ot.end_time.includes("T")
                    ? ot.end_time.split("T")[1].substring(0, 8)
                    : ot.end_time.substring(0, 8);

                  const startHour = parseInt(startTime.split(":")[0]);
                  const startMin = parseInt(startTime.split(":")[1]);
                  const endHour = parseInt(endTime.split(":")[0]);
                  const endMin = parseInt(endTime.split(":")[1]);

                  // Check if end_date is different from ot_date (OT spans midnight)
                  const endDateStr = ot.end_date
                    ? typeof ot.end_date === "string"
                      ? ot.end_date.split("T")[0]
                      : format(new Date(ot.end_date), "yyyy-MM-dd")
                    : dateStr;
                  const spansMidnight = endDateStr !== dateStr;

                  const nightStart = ndNightStartHour; // 10PM – 6AM Philippine time
                  const nightEnd = 6; // 6AM

                  // Convert times to minutes for easier calculation
                  const startTotalMin = startHour * 60 + startMin;
                  const endTotalMin = endHour * 60 + endMin;
                  const nightStartMin = nightStart * 60;
                  const nightEndMin = nightEnd * 60; // 6AM = 360 minutes

                  if (spansMidnight) {
                    // OT spans midnight: ND from max(start, nightStart) to midnight + midnight to min(end, 6AM)
                    const ndStartMin = Math.max(startTotalMin, nightStartMin);
                    const hoursToMidnight = (24 * 60 - ndStartMin) / 60;

                    let hoursFromMidnight = 0;
                    if (endTotalMin <= nightEndMin) {
                      hoursFromMidnight = endTotalMin / 60;
                    } else {
                      hoursFromMidnight = nightEndMin / 60;
                    }

                    ndHours = hoursToMidnight + hoursFromMidnight;
                  } else {
                    // OT on same day
                    if (startTotalMin >= nightStartMin) {
                      ndHours = (endTotalMin - startTotalMin) / 60;
                    } else if (endTotalMin >= nightStartMin) {
                      ndHours = (endTotalMin - nightStartMin) / 60;
                    }
                  }

                  // Cap ND hours at total_hours (can't exceed OT hours) and ensure non-negative
                  // Cap ND hours at credited OT hours (can't exceed OT credit)
                  ndHours = Math.min(Math.max(0, ndHours), credited);
                  // Credit ND: minimum 1h, then 0.5h steps (see creditNightDiffHours)
                  ndHours = creditNightDiffHours(ndHours);

                  if (ndHours > 0) {
                    console.log(
                      `Night Differential calculated for ${dateStr}:`,
                      {
                        ot_date: dateStr,
                        start_time: ot.start_time,
                        end_time: ot.end_time,
                        end_date: ot.end_date,
                        total_hours: ot.total_hours,
                        nd_hours: ndHours,
                        spansMidnight,
                      }
                    );
                  }

                  const existingND = approvedNDByDate.get(dateStr) || 0;
                  approvedNDByDate.set(dateStr, existingND + ndHours);
                }

                // Record for ND check log (all OT requests, with or without ND)
                otRequestNDCheck.push({
                  ot_date: dateStr,
                  start_time: ot.start_time ?? "",
                  end_time: ot.end_time ?? "",
                  total_hours: ot.total_hours ?? 0,
                  ndHours,
                  overlaps10pm6am: ndHours > 0,
                });
            });
            console.log("Approved OT requests by date:", approvedOTByDate);
            console.log("Approved ND by date:", approvedNDByDate);
          }

          // Map clock entries to match the generator function's expected format.
          // Keep regular/session-derived ND so night regular shifts are counted.
          // OT hours still come from approved OT requests map below.
          const mappedClockEntries = filteredClockEntries.map((entry: any) => {
            return {
              ...entry,
              // OT should come from approved OT requests (avoid double-counting from raw entries).
              overtime_hours: 0, // Reset to 0 - generator will use approvedOTByDate
              // Keep night hours from punch sessions to support night regular shifts
              // (e.g. 5PM–2AM regular shift with no OT filing).
              total_night_diff_hours:
                typeof entry.total_night_diff_hours === "number"
                  ? entry.total_night_diff_hours
                  : 0,
            };
          });

          // Generate attendance data from mapped clock entries with rest days
          // Note: leaveDatesMap is already created above for existing attendance records
          const isClientBasedAccountSupervisor =
            selectedEmployee?.employee_type === "client-based" &&
            (selectedEmployee?.position?.toUpperCase().includes("ACCOUNT SUPERVISOR") || false);
          const isClientBased = selectedEmployee?.employee_type === "client-based" || false;

          const holidaysForTimesheet = (holidaysForPeriod.length > 0 ? holidaysForPeriod : holidays).map((h: any) => ({
            holiday_date: h.holiday_date,
            holiday_type: h.holiday_type ?? "regular",
          }));
          const timesheetData = generateTimesheetFromClockEntries(
            mappedClockEntries as any,
            periodStart,
            periodEnd,
            holidaysForTimesheet,
            restDaysMap,
            true, // Always include approved OT on payslip (eligible_for_ot only gates filing new OT)
            isEligibleForNightDiff,
            isClientBasedAccountSupervisor,
            approvedOTByDate, // Pass approved OT hours map
            approvedNDByDate, // Pass approved ND hours map
            isClientBased // Pass general client-based flag for Saturday/Sunday logic
          );

          // Update attendance_data to include leave days
          // Only SIL (Sick Leave) counts as a working day (8 hours for full-day, 4 hours for half-day)
          // All other leaves are not paid and not recorded as a working day
          timesheetData.attendance_data = timesheetData.attendance_data.map(
            (day: any) => {
              const leaveInfo = leaveDatesMap.get(day.date);
              if (leaveInfo) {
                // If this day has an approved leave request
                if (leaveInfo.leaveType === "SIL") {
                  // SIL (Sick Leave) counts as working day
                  // Full-day: 8 hours, Half-day: 4 hours
                  const silHours = leaveInfo.isHalfDay ? 4 : 8;
                  // Set regularHours and dayType to "regular" for SIL leaves
                  // This ensures they count as working days even if there are no clock entries
                  return {
                    ...day,
                    regularHours: silHours, // 8 hours for full-day, 4 hours for half-day
                    dayType: "regular", // Set dayType to "regular" so it counts in basic earnings
                  };
                }
                // All other leave types (LWOP, CTO, OB, etc.) - do not count as working day
                // Return day as-is (no hours added)
              }
              return day;
            }
          );

          // Recalculate totals after updating leave days
          timesheetData.total_regular_hours =
            Math.round(
              timesheetData.attendance_data.reduce(
                (sum: number, day: any) => sum + day.regularHours,
                0
              ) * 100
            ) / 100;

          // Calculate gross pay - try to get from employee's monthly_rate or per_day
          let grossPay = 0;
          const selectedEmp = employees.find(
            (e) => e.id === selectedEmployeeId
          );
          if (selectedEmp && timesheetData.attendance_data.length > 0) {
            let ratePerHour = 0;
            const workingDaysPerMonth = 26;

            if (selectedEmp.monthly_rate) {
              ratePerHour =
                selectedEmp.monthly_rate / (workingDaysPerMonth * 8);
            } else if (selectedEmp.per_day) {
              ratePerHour = selectedEmp.per_day / 8;
            }

            if (ratePerHour > 0) {
              try {
                const payrollResult = calculateWeeklyPayroll(
                  timesheetData.attendance_data,
                  ratePerHour
                );
                grossPay = Math.round(payrollResult.grossPay * 100) / 100;
              } catch (calcError) {
                console.error("Error calculating payroll:", calcError);
                // Fallback: estimate from hours
                grossPay =
                  Math.round(
                    timesheetData.total_regular_hours * ratePerHour * 100
                  ) / 100;
              }
            }
          }

          // Create attendance object from clock entries data
          attData = {
            id: `temp-${selectedEmployeeId}-${periodStartStr}`,
            employee_id: selectedEmployeeId,
            period_start: periodStartStr,
            period_end: periodEndStr,
            period_type: "weekly",
            attendance_data: timesheetData.attendance_data,
            total_regular_hours: timesheetData.total_regular_hours,
            total_overtime_hours: timesheetData.total_overtime_hours,
            total_night_diff_hours: timesheetData.total_night_diff_hours,
            gross_pay: grossPay,
            status: "draft",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: null,
          } as any;

          console.log("Generated attendance data from clock entries:", attData);
          toast.success("Attendance data generated from time clock entries");
        } catch (genError: any) {
          console.error(
            "Error generating attendance from clock entries:",
            genError
          );
          toast.error(
            `Failed to generate attendance data: ${
              genError.message || "Unknown error"
            }`
          );
          setAttendance(null);
          return;
        }
      }

      console.log("Attendance data loaded:", attData ? "Found" : "Not found");
      if (attData) {
        const att = attData as any;
        console.log("Attendance data:", {
          id: att.id,
          period_start: att.period_start,
          gross_pay: att.gross_pay,
          total_regular_hours: att.total_regular_hours,
          total_overtime_hours: att.total_overtime_hours,
          total_night_diff_hours: att.total_night_diff_hours,
          attendance_data_length: Array.isArray(att.attendance_data)
            ? att.attendance_data.length
            : "Not an array",
          sample_day:
            Array.isArray(att.attendance_data) && att.attendance_data.length > 0
              ? att.attendance_data[0]
              : "No days",
        });

        // Ensure attendance_data is an array
        if (!Array.isArray(att.attendance_data)) {
          console.warn(
            "attendance_data is not an array, setting to empty array"
          );
          att.attendance_data = [];
        }

        // Ensure totals are numbers
        att.total_regular_hours = att.total_regular_hours || 0;
        att.total_overtime_hours = att.total_overtime_hours || 0;
        att.total_night_diff_hours = att.total_night_diff_hours || 0;
      } else {
        console.warn(
          "No attendance record found after auto-generation attempt."
        );
        // Check if there are time_entries for this period
        const periodStartISO = new Date(
          `${periodStartStr}T00:00:00`
        ).toISOString();
        const periodEndISO = new Date(`${periodEndStr}T23:59:59`).toISOString();

        const getDateManila = (iso: string) => {
          const d = new Date(iso);
          const formatter = new Intl.DateTimeFormat("en-US", {
            timeZone: "Asia/Manila",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          });
          const parts = formatter.formatToParts(d);
          return `${parts.find((p) => p.type === "year")?.value}-${
            parts.find((p) => p.type === "month")?.value
          }-${parts.find((p) => p.type === "day")?.value}`;
        };
        const [checkMain, checkProject] = await Promise.all([
          fetchSessionsForEmployee(supabase, selectedEmployeeId, periodStartISO, periodEndISO, getDateManila),
          fetchProjectTimeSessionsForEmployee(supabase, selectedEmployeeId, periodStartISO, periodEndISO, getDateManila),
        ]);
        const checkSessions = [...(checkMain || []), ...(checkProject || [])];
        if (checkSessions.length === 0) {
          console.log("No time entries for this period");
        }
      }

      // Only set attendance if attData exists and has valid structure
      if (attData) {
        setAttendance(attData as any);
      } else {
        console.warn("No attendance data to set - attData is null/undefined");
        setAttendance(null);
      }

      // Load employee loans for this period
      try {
        // Clear loans first to prevent stale data
        setActiveLoans([]);
        setMonthlyLoans({
          sssLoan: 0,
          pagibigLoan: 0,
          companyLoan: 0,
          emergencyLoan: 0,
          otherLoan: 0,
        });

        const { data: loansData, error: loansError } = await supabase
          .from("employee_loans")
          .select("*")
          .eq("employee_id", selectedEmployeeId)
          .eq("is_active", true)
          .lte("effectivity_date", periodEndStr)
          .gt("current_balance", 0);

        if (loansError) {
          console.warn("Error loading loans:", loansError);
        }

        // Calculate loan deductions based on cutoff and effectivity date
        let companyLoanAmount = 0;
        let sssCalamityLoanAmount = 0;
        let pagibigCalamityLoanAmount = 0;
        let sssLoanAmount = 0;
        let pagibigLoanAmount = 0;
        let emergencyLoanAmount = 0;
        let otherLoanAmount = 0;

        const loanDetails: LoanDetail[] = [];

        if (loansData && loansData.length > 0) {
          const currentCutoff = isFirstCutoff() ? "first" : "second";

          console.log("Loan filtering:", {
            periodStart: periodStartStr,
            periodEnd: periodEndStr,
            currentCutoff,
            totalLoans: loansData.length,
          });

          loansData.forEach((loan: any) => {
            // Check if loan should be deducted in this cutoff
            // cutoff_assignment controls which cutoff(s) to deduct in:
            // - "first": deducts in first cutoff only (500 if monthly payment is 1,000)
            // - "second": deducts in second cutoff only (500 if monthly payment is 1,000)
            // - "both": deducts in both cutoffs (500 + 500 = 1,000/month total)
            // All loans are deducted bi-monthly (monthly_payment / 2 per cutoff)
            const shouldDeduct =
              loan.cutoff_assignment === "both" ||
              loan.cutoff_assignment === currentCutoff;

            console.log(`Loan ${loan.id} (${loan.loan_type}):`, {
              cutoff_assignment: loan.cutoff_assignment,
              currentCutoff,
              shouldDeduct,
              effectivity_date: loan.effectivity_date,
              periodEnd: periodEndStr,
            });

            if (shouldDeduct) {
              // Calculate payment amount based on deduct_bi_monthly flag
              // If deduct_bi_monthly is true: divide by 2 for bi-monthly deductions (e.g., 1,000/month = 500 per cutoff)
              // If deduct_bi_monthly is false: use full monthly payment per cutoff
              const paymentAmount = loan.deduct_bi_monthly !== false
                ? loan.monthly_payment / 2
                : loan.monthly_payment;

              // Store loan detail for display
              loanDetails.push({
                id: loan.id,
                loan_type: loan.loan_type,
                current_balance: parseFloat(loan.current_balance),
                monthly_payment: parseFloat(loan.monthly_payment),
                total_terms: loan.total_terms,
                remaining_terms: loan.remaining_terms,
                cutoff_assignment: loan.cutoff_assignment,
                deduction_amount: paymentAmount,
              });

              switch (loan.loan_type) {
                case "company":
                  companyLoanAmount += paymentAmount;
                  break;
                case "sss_calamity":
                  sssCalamityLoanAmount += paymentAmount;
                  break;
                case "pagibig_calamity":
                  pagibigCalamityLoanAmount += paymentAmount;
                  break;
                case "sss":
                  sssLoanAmount += paymentAmount;
                  break;
                case "pagibig":
                  pagibigLoanAmount += paymentAmount;
                  break;
                case "emergency":
                  emergencyLoanAmount += paymentAmount;
                  break;
                case "other":
                  otherLoanAmount += paymentAmount;
                  break;
              }
            }
          });
        }

        // Update active loans for display (only loans that should be deducted)
        setActiveLoans(loanDetails);

        console.log("Final loan details:", {
          loanDetailsCount: loanDetails.length,
          loanDetails: loanDetails.map((l) => ({
            type: l.loan_type,
            cutoff: l.cutoff_assignment,
            amount: l.deduction_amount,
          })),
        });

        // Update monthlyLoans state with calculated loan amounts (for calculations)
        setMonthlyLoans({
          sssLoan: sssLoanAmount + sssCalamityLoanAmount, // Combine SSS loans
          pagibigLoan: pagibigLoanAmount + pagibigCalamityLoanAmount, // Combine Pagibig loans
          companyLoan: companyLoanAmount,
          emergencyLoan: emergencyLoanAmount,
          otherLoan: otherLoanAmount,
        });

        console.log("Monthly loans calculated:", {
          companyLoan: companyLoanAmount,
          sssLoan: sssLoanAmount + sssCalamityLoanAmount,
          pagibigLoan: pagibigLoanAmount + pagibigCalamityLoanAmount,
        });
      } catch (loansError: any) {
        console.error("Error processing loans:", loansError);
      }

      // Load time clock entries for this period to get actual clock in/out times
      try {
        // Validate employee_id is a valid UUID before querying
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        if (!uuidRegex.test(selectedEmployeeId)) {
          console.error(
            "Invalid employee_id format for clock entries:",
            selectedEmployeeId
          );
          setClockEntries([]);
        } else {
          // Use ISO string format for date comparisons
          const periodStartISO = new Date(
            `${periodStartStr}T00:00:00`
          ).toISOString();
          const periodEndISO = new Date(
            `${periodEndStr}T23:59:59`
          ).toISOString();

          const periodStartDateWide = new Date(periodStart);
          periodStartDateWide.setHours(0, 0, 0, 0);
          periodStartDateWide.setDate(periodStartDateWide.getDate() - 1);

          const periodEndDateWide = new Date(periodEnd);
          periodEndDateWide.setHours(23, 59, 59, 999);
          periodEndDateWide.setDate(periodEndDateWide.getDate() + 1);

          const getDateInManila = (iso: string) => format(new Date(iso), "yyyy-MM-dd");
          const [mainSessions, projectSessions] = await Promise.all([
            fetchSessionsForEmployee(supabase, selectedEmployeeId, periodStartDateWide.toISOString(), periodEndDateWide.toISOString(), getDateInManila),
            fetchProjectTimeSessionsForEmployee(supabase, selectedEmployeeId, periodStartDateWide.toISOString(), periodEndDateWide.toISOString(), getDateInManila),
          ]);
          const clockData = [...(mainSessions || []), ...(projectSessions || [])];

          const filteredByDate = clockData.filter((entry: any) => {
            const entryDateStr = entry.clock_in_date_ph || format(new Date(entry.clock_in_time), "yyyy-MM-dd");
            return entryDateStr >= periodStartStr && entryDateStr <= periodEndStr;
          });
          const validStatuses = ["clocked_out", "approved", "auto_approved"];
          const filtered = filteredByDate.filter((entry: any) =>
            validStatuses.includes(entry.status)
          );
          setClockEntries(filtered);
        }
      } catch (clockErr) {
        console.error("Exception loading clock entries:", clockErr);
        setClockEntries([]);
      }

      try {
        // Load active deduction profile for this employee from employee_deductions
        const { data: dedRow, error: dedError } = await supabase
          .from("employee_deductions")
          .select(
            "vale_amount, sss_salary_loan, sss_calamity_loan, pagibig_salary_loan, pagibig_calamity_loan, sss_contribution, philhealth_contribution, pagibig_contribution, withholding_tax"
          )
          .eq("employee_id", selectedEmployeeId)
          .eq("is_active", true)
          .maybeSingle();

        if (dedError) {
          console.error("Error loading employee_deductions:", dedError);
        }

        setDeductions({
          vale_amount: dedRow?.vale_amount ?? 0,
          sss_salary_loan: dedRow?.sss_salary_loan ?? 0,
          sss_calamity_loan: dedRow?.sss_calamity_loan ?? 0,
          pagibig_salary_loan: dedRow?.pagibig_salary_loan ?? 0,
          pagibig_calamity_loan: dedRow?.pagibig_calamity_loan ?? 0,
          sss_contribution: dedRow?.sss_contribution ?? 0,
          philhealth_contribution: dedRow?.philhealth_contribution ?? 0,
          pagibig_contribution: dedRow?.pagibig_contribution ?? 0,
          withholding_tax: dedRow?.withholding_tax ?? 0,
        });

        const savedBr = existingPayslipRow?.deductions_breakdown as
          | Record<string, unknown>
          | undefined;
        const savedLines = savedBr?.other_deduction_lines;
        if (Array.isArray(savedLines) && savedLines.length > 0) {
          setOtherDeductionRows(
            mergeOtherDeductionRowsFromSaved(savedLines, dedRow?.vale_amount ?? 0)
          );
        } else {
          setOtherDeductionRows(
            mergeOtherDeductionRowsFromSaved(undefined, dedRow?.vale_amount ?? 0)
          );
        }
      } catch (dedErr) {
        console.error("Exception loading deductions:", dedErr);
        setDeductions({
          vale_amount: 0,
          sss_salary_loan: 0,
          sss_calamity_loan: 0,
          pagibig_salary_loan: 0,
          pagibig_calamity_loan: 0,
          sss_contribution: 0,
          philhealth_contribution: 0,
          pagibig_contribution: 0,
          withholding_tax: 0,
        });
        setOtherDeductionRows(createDefaultOtherDeductionRows());
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load attendance/deductions");
    }
  }

  function changePeriod(direction: "prev" | "next") {
    setPeriodStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + (direction === "prev" ? -7 : 7));
      d.setHours(0, 0, 0, 0);
      return d;
    });
  }

  // Function to update loan balances and terms after payslip is saved
  async function updateLoanBalancesAndTerms(
    periodStart: Date,
    periodEnd: Date
  ) {
    if (!selectedEmployeeId) {
      console.log("No employee selected, skipping loan update");
      return;
    }

    const currentCutoff = isFirstCutoff() ? "first" : "second";
    const periodStartStr = format(periodStart, "yyyy-MM-dd");
    const periodEndStr = format(periodEnd, "yyyy-MM-dd");

    console.log("Updating loan balances for period:", {
      periodStart: periodStartStr,
      periodEnd: periodEndStr,
      currentCutoff,
      employeeId: selectedEmployeeId,
    });

    try {
      // Reload loans from database to ensure we have the latest data
      // Only get loans that should be deducted in this cutoff
      const { data: loansData, error: loansError } = await supabase
        .from("employee_loans")
        .select("*")
        .eq("employee_id", selectedEmployeeId)
        .eq("is_active", true)
        .lte("effectivity_date", periodEndStr)
        .gt("current_balance", 0)
        .or(`cutoff_assignment.eq.both,cutoff_assignment.eq.${currentCutoff}`);

      if (loansError) {
        console.error("Error loading loans for update:", loansError);
        return;
      }

      if (!loansData || loansData.length === 0) {
        console.log("No active loans found for this period and cutoff");
        return;
      }

      console.log(`Found ${loansData.length} loan(s) to update`);

      // Update each loan that should be deducted in this cutoff
      for (const loanRecord of loansData) {
        // Verify cutoff assignment matches (already filtered in query, but double-check)
        // @ts-ignore - employee_loans table type may not be in generated types
        const shouldDeduct =
          (loanRecord as any).cutoff_assignment === "both" ||
          (loanRecord as any).cutoff_assignment === currentCutoff;

        if (!shouldDeduct) {
          console.log(
            `Loan ${(loanRecord as any).id} cutoff assignment (${
              (loanRecord as any).cutoff_assignment
            }) doesn't match current cutoff (${currentCutoff}), skipping`
          );
          continue;
        }

        // Calculate deduction amount based on deduct_bi_monthly flag
        // If deduct_bi_monthly is true: divide by 2 for bi-monthly deductions (e.g., 1,000/month = 500 per cutoff)
        // If deduct_bi_monthly is false: use full monthly payment per cutoff
        const deductBiMonthly = (loanRecord as any).deduct_bi_monthly !== false;
        const deductionAmount = deductBiMonthly
          ? parseFloat((loanRecord as any).monthly_payment) / 2
          : parseFloat((loanRecord as any).monthly_payment);

        console.log(`Processing loan ${(loanRecord as any).id}:`, {
          loan_type: (loanRecord as any).loan_type,
          current_balance: (loanRecord as any).current_balance,
          remaining_terms: (loanRecord as any).remaining_terms,
          deduction_amount: deductionAmount,
          cutoff_assignment: (loanRecord as any).cutoff_assignment,
        });

        // Get current values as numbers
        const currentBalance = parseFloat((loanRecord as any).current_balance);
        const currentRemainingTerms = parseInt(
          (loanRecord as any).remaining_terms
        );

        // Calculate new balance (ensure it doesn't go below 0)
        const newBalance = Math.max(0, currentBalance - deductionAmount);

        // Calculate terms reduction based on deduct_bi_monthly flag
        // If deduct_bi_monthly is true: reduce by 0.5 terms per cutoff (full term completed after both cutoffs)
        // If deduct_bi_monthly is false: reduce by 1.0 term per cutoff (full term completed in one cutoff)
        const termsReduction = deductBiMonthly ? 0.5 : 1.0;
        const newRemainingTerms = Math.max(
          0,
          currentRemainingTerms - termsReduction
        );

        // If balance reaches 0 or terms reach 0, mark loan as inactive
        const shouldDeactivate =
          newBalance <= 0.01 || Math.ceil(newRemainingTerms) <= 0;

        // Update loan record
        const updateData: any = {
          current_balance: Math.round(newBalance * 100) / 100, // Round to 2 decimal places
          remaining_terms: Math.ceil(newRemainingTerms), // Round up to nearest integer
          updated_at: new Date().toISOString(),
        };

        if (shouldDeactivate) {
          updateData.is_active = false;
          updateData.current_balance = 0; // Ensure balance is exactly 0
          updateData.remaining_terms = 0; // Ensure terms is exactly 0
        }

        const { error: updateError } = await supabase
          // @ts-ignore - employee_loans table type may not be in generated types
          .from("employee_loans")
          // @ts-ignore - employee_loans table type may not be in generated types
          .update(updateData)
          .eq("id", (loanRecord as any).id);

        if (updateError) {
          console.error(
            `Error updating loan ${(loanRecord as any).id}:`,
            updateError
          );
          toast.error(
            `Failed to update loan ${(loanRecord as any).loan_type}: ${
              updateError.message
            }`
          );
        } else {
          console.log(
            `✅ Loan ${(loanRecord as any).id} (${
              (loanRecord as any).loan_type
            }) updated:`,
            `Balance ₱${currentBalance} -> ₱${updateData.current_balance},`,
            `Terms ${currentRemainingTerms} -> ${updateData.remaining_terms}`,
            shouldDeactivate ? "(deactivated)" : ""
          );
        }
      }
    } catch (error: any) {
      console.error("Error updating loan balances:", error);
      // Don't throw - we don't want to fail payslip generation if loan update fails
      toast.error("Warning: Loan balances may not have been updated correctly");
    }
  }

  async function generatePayslip() {
    if (!selectedEmployee || !attendance) {
      toast.error("Missing attendance data");
      return;
    }

    // Note: rate_per_day was removed from employees table
    // Gross pay is already calculated in weekly_attendance table
    // Government contributions will need to be calculated differently
    // For now, we'll proceed without rate validation

    setGenerating(true);

    try {
      // Calculate gross pay from attendance data if not already calculated
      let grossPay = attendance.gross_pay || 0;

      // If gross_pay is 0 or missing, calculate it from attendance_data
      if (
        grossPay === 0 &&
        attendance.attendance_data &&
        Array.isArray(attendance.attendance_data)
      ) {
        const ratePerHour =
          selectedEmployee.rate_per_hour ||
          (selectedEmployee.monthly_rate
            ? selectedEmployee.monthly_rate / 26 / 8
            : selectedEmployee.per_day
            ? selectedEmployee.per_day / 8
            : selectedEmployee.rate_per_day
            ? selectedEmployee.rate_per_day / 8
            : 0);
        if (ratePerHour > 0) {
          const payrollResult = calculateWeeklyPayroll(
            attendance.attendance_data,
            ratePerHour
          );
          grossPay = Math.round(payrollResult.grossPay * 100) / 100;
        }
      }

      // Gross = basic + OT + ND + adjustment. Tax uses calendar-month gross (saved other weeks + this period).
      const adjustment = Math.round(
        adjustmentRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0) *
          100
      ) / 100;
      const periodGross = grossPay + adjustment;
      const periodEndTuesday = new Date(periodStart);
      periodEndTuesday.setDate(periodEndTuesday.getDate() + 6);
      periodEndTuesday.setHours(0, 0, 0, 0);

      // Monthly salary from rate only (per day × 26). For statutory and 13th month.
      const workingDaysPerMonth = 26;
      let monthlyBasicSalary = 0;
      if (selectedEmployee.monthly_rate) {
        monthlyBasicSalary = selectedEmployee.monthly_rate;
      } else if (selectedEmployee.per_day) {
        monthlyBasicSalary = calculateMonthlySalary(
          selectedEmployee.per_day,
          workingDaysPerMonth
        );
      } else if (selectedEmployee.rate_per_day) {
        monthlyBasicSalary = calculateMonthlySalary(
          selectedEmployee.rate_per_day,
          workingDaysPerMonth
        );
      }

      // Statutory (SSS, PhilHealth, Pag-IBIG) based on monthly salary only, not gross pay
      const validMonthlySalary =
        monthlyBasicSalary && monthlyBasicSalary > 0 ? monthlyBasicSalary : 0;

      const sssContribution = calculateSSS(validMonthlySalary);
      const philhealthContribution = calculatePhilHealth(validMonthlySalary);
      const pagibigContribution = calculatePagIBIG(validMonthlySalary);

      let mtdWorkDaysForSave = 0;
      let prorationFactorSave = 1;
      try {
        const clockIds = [
          selectedEmployee.id,
          selectedEmployee.transferred_from_employee_id,
        ].filter(Boolean) as string[];
        mtdWorkDaysForSave = await fetchDistinctWorkDaysMonthToDate(
          supabase,
          clockIds,
          periodEndTuesday
        );
        prorationFactorSave = statutoryProrationFactorFromDays(
          mtdWorkDaysForSave
        );
      } catch {
        mtdWorkDaysForSave = STATUTORY_PRORATION_REFERENCE_DAYS;
        prorationFactorSave = 1;
      }

      const takeStatutory = isFourthStatutoryWeeklyPay(periodEndTuesday);

      // Full monthly employee shares on statutory week, × min(1, MTD work days / 26).
      const sssRegularAmountAuto =
        takeStatutory &&
        validMonthlySalary > 0 &&
        !isNaN(sssContribution?.regularEmployeeShare)
          ? applyStatutoryProration(
              Math.round(sssContribution.regularEmployeeShare * 100) / 100,
              prorationFactorSave
            )
          : 0;
      const sssWispAmountAuto =
        takeStatutory &&
        validMonthlySalary > 0 &&
        (sssContribution?.wispEmployeeShare ?? 0) > 0
          ? applyStatutoryProration(
              Math.round((sssContribution.wispEmployeeShare ?? 0) * 100) / 100,
              prorationFactorSave
            )
          : 0;
      const philhealthAmountAuto =
        takeStatutory &&
        validMonthlySalary > 0 &&
        !isNaN(philhealthContribution?.employeeShare)
          ? applyStatutoryProration(
              Math.round(philhealthContribution.employeeShare * 100) / 100,
              prorationFactorSave
            )
          : 0;
      const pagibigAmountAuto =
        takeStatutory &&
        validMonthlySalary > 0 &&
        !isNaN(pagibigContribution?.employeeShare)
          ? applyStatutoryProration(
              Math.round(pagibigContribution.employeeShare * 100) / 100,
              prorationFactorSave
            )
          : 0;

      const manualOtherDeductionTotal = otherDeductionRows.reduce(
        (s, r) => s + (parseFloat(r.amount) || 0),
        0
      );

      // Weekly deductions (always applied) - default to 0 if no deduction record
      // Loan deductions are now calculated from employee_loans table based on effectivity date and cutoff
      let totalDeductions =
        manualOtherDeductionTotal +
        (deductions?.sss_salary_loan || 0) +
        (deductions?.sss_calamity_loan || 0) +
        (deductions?.pagibig_salary_loan || 0) +
        (deductions?.pagibig_calamity_loan || 0) +
        // Add loan deductions based on cutoff assignment
        (isFirstCutoff()
          ? (monthlyLoans.sssLoan || 0) +
            (monthlyLoans.pagibigLoan || 0) +
            (monthlyLoans.companyLoan || 0) +
            (monthlyLoans.emergencyLoan || 0) +
            (monthlyLoans.otherLoan || 0)
          : isSecondCutoff()
          ? (monthlyLoans.pagibigLoan || 0) + // Only loans assigned to "both" or "second" cutoff
            (monthlyLoans.companyLoan || 0)
          : 0);

      // Full-month government contributions only on statutory week (4th Tue / last if <4)
      let sssRegularAmount = sssRegularAmountAuto;
      let sssWispAmount = sssWispAmountAuto;
      let philhealthAmount = philhealthAmountAuto;
      let pagibigAmount = pagibigAmountAuto;
      if (govContributionOverrides.sssReg !== null)
        sssRegularAmount = govContributionOverrides.sssReg;
      if (govContributionOverrides.sssWisp !== null)
        sssWispAmount = govContributionOverrides.sssWisp;
      if (govContributionOverrides.phil !== null)
        philhealthAmount = govContributionOverrides.phil;
      if (govContributionOverrides.pagibig !== null)
        pagibigAmount = govContributionOverrides.pagibig;
      const sssAmount = Math.round((sssRegularAmount + sssWispAmount) * 100) / 100;
      totalDeductions += sssAmount + philhealthAmount + pagibigAmount;

      let withholdingTax = 0;
      const takeSemiMonthTax = isLastWeeklyPayOfSemiMonth(periodEndTuesday);
      if (periodGross > 0 || validMonthlySalary > 0) {
        const whOverride = deductions?.withholding_tax || 0;
        if (whOverride !== 0) {
          withholdingTax = Math.round(whOverride * 100) / 100;
        } else if (takeSemiMonthTax) {
          const monthlyContributionsFull =
            sssContribution.employeeShare +
            philhealthContribution.employeeShare +
            pagibigContribution.employeeShare;
          const monthlyContributions = applyStatutoryProration(
            Math.round(monthlyContributionsFull * 100) / 100,
            prorationFactorSave
          );
          const halfMonthlyContrib = Math.round((monthlyContributions / 2) * 100) / 100;

          const curEndStr = format(periodEndTuesday, "yyyy-MM-dd");
          const startM = startOfMonth(periodEndTuesday);
          const endM = endOfMonth(periodEndTuesday);
          const half = semiMonthlyPeriodIndex(periodEndTuesday);
          const { data: monthRows } = await supabase
            .from("payslips")
            .select("gross_pay, adjustment_amount, period_end, deductions_breakdown")
            .eq("employee_id", selectedEmployee.id)
            .gte("period_end", format(startM, "yyyy-MM-dd"))
            .lte("period_end", format(endM, "yyyy-MM-dd"));

          let grossOther = 0;
          let taxPrior = 0;
          for (const row of monthRows || []) {
            if (row.period_end === curEndStr) continue;
            const [py, pm, pd] = (row.period_end || "").split("-").map(Number);
            if (!py || !pm || !pd) continue;
            const rowEnd = new Date(py, pm - 1, pd);
            if (semiMonthlyPeriodIndex(rowEnd) !== half) continue;
            grossOther += (row.gross_pay ?? 0) + (row.adjustment_amount ?? 0);
            const br = row.deductions_breakdown as { tax?: number } | undefined;
            taxPrior += typeof br?.tax === "number" ? br.tax : 0;
          }
          grossOther = Math.round(grossOther * 100) / 100;
          taxPrior = Math.round(taxPrior * 100) / 100;

          const nSemiWeeks = countWeeklyPaysInSemiMonth(periodEndTuesday);
          const actualSemiGross =
            monthRows != null
              ? Math.round((grossOther + periodGross) * 100) / 100
              : Math.round(periodGross * nSemiWeeks * 100) / 100;

          const semiTaxableIncome = Math.max(
            0,
            actualSemiGross - halfMonthlyContrib
          );
          const semiTaxDue = calculateSemiMonthlyWithholdingTax(semiTaxableIncome);
          withholdingTax = Math.max(
            0,
            Math.round((semiTaxDue - taxPrior) * 100) / 100
          );

          console.log("Withholding tax (BIR semi-monthly):", {
            grossOther,
            periodGross,
            actualSemiGross,
            halfMonthlyContrib,
            semiTaxableIncome,
            semiTaxDue,
            taxPrior,
            withholdingTax,
            semiMonthHalf: half,
          });
        }
      }
      if (govContributionOverrides.tax !== null) {
        withholdingTax = govContributionOverrides.tax;
      }
      totalDeductions += withholdingTax;

      const allowance = 0;

      // Net pay = (Gross + adjustment) - total deductions; adjustment already in periodGross above
      const netPay = periodGross - totalDeductions;

      // Create deductions breakdown - default all to 0 if no deduction record
      const deductionsBreakdown: any = {
        weekly: {
          vale: manualOtherDeductionTotal,
          sss_loan: deductions?.sss_salary_loan || 0,
          sss_calamity: deductions?.sss_calamity_loan || 0,
          pagibig_loan: deductions?.pagibig_salary_loan || 0,
          pagibig_calamity: deductions?.pagibig_calamity_loan || 0,
          monthly_loans: isFirstCutoff()
            ? {
                sssLoan: monthlyLoans.sssLoan || 0,
                pagibigLoan: monthlyLoans.pagibigLoan || 0,
                companyLoan: monthlyLoans.companyLoan || 0,
                emergencyLoan: monthlyLoans.emergencyLoan || 0,
                otherLoan: monthlyLoans.otherLoan || 0,
              }
            : undefined, // Monthly loans only for 1st cutoff
        },
        tax: withholdingTax,
        other_deduction_lines: otherDeductionRows.map((r) => ({
          type: r.type.trim(),
          amount: parseFloat(r.amount) || 0,
        })),
        adjustment_lines: adjustmentRows.map((r) => ({
          description: r.description.trim(),
          amount: parseFloat(r.amount) || 0,
        })),
      };

      // Mandatory government contributions (always included)
      deductionsBreakdown.sss = sssRegularAmount; // Regular SSS only (MSC up to PHP 20,000)
      deductionsBreakdown.sss_wisp = sssWispAmount; // WISP shown separately if applicable
      deductionsBreakdown.philhealth = philhealthAmount;
      deductionsBreakdown.pagibig = pagibigAmount;
      deductionsBreakdown.statutory_mtd_work_days = mtdWorkDaysForSave;
      deductionsBreakdown.statutory_proration_factor = prorationFactorSave;
      deductionsBreakdown.statutory_reference_days =
        STATUTORY_PRORATION_REFERENCE_DAYS;

      // Generate payslip number
      const year = periodStart.getFullYear();
      const periodNumber = Math.ceil(
        (periodStart.getDate() +
          (periodStart.getDay() === 0 ? 7 : periodStart.getDay() - 1)) /
          14
      );
      const payslipNumber = generatePayslipNumber(
        selectedEmployee.employee_id,
        periodNumber,
        year
      );

      const periodEnd = periodEndTuesday;

      // Validate required fields before creating payslip data
      if (!attendance.attendance_data) {
        throw new Error(
          "Attendance data is missing. Please load attendance first."
        );
      }

      if (!deductionsBreakdown) {
        throw new Error("Deductions breakdown is missing.");
      }

      // Ensure all required numeric fields are valid
      if (isNaN(grossPay) || grossPay === null || grossPay === undefined) {
        throw new Error("Gross pay is invalid. Please recalculate.");
      }

      if (isNaN(netPay) || netPay === null || netPay === undefined) {
        throw new Error("Net pay is invalid. Please recalculate.");
      }

      if (
        isNaN(totalDeductions) ||
        totalDeductions === null ||
        totalDeductions === undefined
      ) {
        totalDeductions = 0; // Default to 0 if invalid
      }

      // Calculate 13th month pay
      // In the Philippines, 13th month pay = 1/12 of basic salary per month worked
      // Per DOLE ruling (COCLA vs San Miguel), SIL (Service Incentive Leave) should NOT be included
      // Usually paid in December, but can be prorated throughout the year
      let thirteenthMonthPay = 0;
      const currentMonth = periodStart.getMonth(); // 0-11 (Jan = 0, Dec = 11)
      const currentYear = periodStart.getFullYear();

      // Check if this is December (month 11) or if HR wants to include it
      // For now, auto-calculate only in December
      if (currentMonth === 11) { // December
        // Calculate months worked in the current year
        const hireDate = selectedEmployee.hire_date
          ? new Date(selectedEmployee.hire_date)
          : null;

        let monthsWorked = 12; // Default to full year

        if (hireDate) {
          const hireYear = hireDate.getFullYear();
          const hireMonth = hireDate.getMonth();

          if (hireYear === currentYear) {
            // Employee started this year - prorate from hire month
            monthsWorked = 12 - hireMonth; // Months from hire month to December (inclusive)
          } else if (hireYear < currentYear) {
            // Employee started in a previous year - full year
            monthsWorked = 12;
          } else {
            // Future hire date (shouldn't happen)
            monthsWorked = 0;
          }
        }

        // Calculate 13th month pay based on monthly basic salary, excluding SIL days
        // Per DOLE ruling COCLA vs San Miguel: SIL should NOT be included in 13th month calculation
        if (validMonthlySalary > 0 && monthsWorked > 0) {
          // Get all approved SIL leave requests for the current year
          const yearStart = startOfYear(new Date(currentYear, 0, 1));
          const yearEnd = endOfYear(new Date(currentYear, 11, 31));

          const { data: yearLeaves } = await supabase
            .from("leave_requests")
            .select("start_date, end_date, total_days, half_day_dates, leave_type, status")
            .eq("employee_id", selectedEmployee.id)
            .in("status", ["approved", "approved_by_manager", "approved_by_hr"])
            .eq("leave_type", "SIL")
            .gte("start_date", format(yearStart, "yyyy-MM-dd"))
            .lte("end_date", format(yearEnd, "yyyy-MM-dd"));

          // Count total SIL days used in the year (only count days within the year)
          // Half-day leaves count as 0.5 days, full-day leaves count as 1.0 day
          let totalSILDays = 0;
          if (yearLeaves && yearLeaves.length > 0) {
            yearLeaves.forEach((leave: any) => {
              // Get half-day dates set
              const halfDayDatesSet = new Set<string>();
              if (leave.half_day_dates && Array.isArray(leave.half_day_dates)) {
                leave.half_day_dates.forEach((dateStr: string) => {
                  halfDayDatesSet.add(dateStr);
                });
              }

              if (leave.start_date && leave.end_date) {
                // Count days within the year range, accounting for half-day
                const start = parseISO(leave.start_date);
                const end = parseISO(leave.end_date);
                const actualStart = start > yearStart ? start : yearStart;
                const actualEnd = end < yearEnd ? end : yearEnd;
                if (actualStart <= actualEnd) {
                  let currentDate = new Date(actualStart);
                  while (currentDate <= actualEnd) {
                    const dateStr = format(currentDate, "yyyy-MM-dd");
                    if (halfDayDatesSet.has(dateStr)) {
                      totalSILDays += 0.5;
                    } else {
                      totalSILDays += 1.0;
                    }
                    currentDate.setDate(currentDate.getDate() + 1);
                  }
                }
              } else if (leave.total_days) {
                // Fallback: use total_days if available (already accounts for half-day)
                totalSILDays += Number(leave.total_days);
              }
            });
          }

          // Calculate daily rate (monthly salary was computed with 26 days)
          const workingDaysPerMonth = 26;
          const dailyRate = validMonthlySalary / workingDaysPerMonth;

          // Calculate 13th month pay
          // Formula: (monthly basic salary / 12) × months worked - (SIL days × daily rate / 12)
          // This excludes SIL from 13th month calculation per DOLE ruling
          const baseThirteenthMonth = (validMonthlySalary / 12) * monthsWorked;
          const silDeduction = (totalSILDays * dailyRate) / 12;
          thirteenthMonthPay = Math.max(0, baseThirteenthMonth - silDeduction);

          // Round to 2 decimal places
          thirteenthMonthPay = Math.round(thirteenthMonthPay * 100) / 100;
        }
      }

      const payslipData = {
        employee_id: selectedEmployee.id,
        payslip_number: payslipNumber,
        week_number: periodNumber,
        period_start: format(periodStart, "yyyy-MM-dd"),
        period_end: format(periodEnd, "yyyy-MM-dd"),
        period_type: "weekly",
        earnings_breakdown: attendance.attendance_data || [], // Ensure it's never null
        gross_pay: grossPay,
        deductions_breakdown: deductionsBreakdown || {}, // Ensure it's never null
        total_deductions: totalDeductions,
        apply_sss: applySss,
        apply_philhealth: applyPhilhealth,
        apply_pagibig: applyPagibig,
        // Ensure all amounts are valid numbers (not NaN or undefined)
        sss_amount: isNaN(sssAmount) ? 0 : sssAmount,
        philhealth_amount: isNaN(philhealthAmount) ? 0 : philhealthAmount,
        pagibig_amount: isNaN(pagibigAmount) ? 0 : pagibigAmount,
        thirteenth_month_pay: thirteenthMonthPay,
        adjustment_amount: adjustment,
        adjustment_reason: combineAdjustmentReasonForDb(adjustmentRows),
        allowance_amount: 0,
        net_pay: netPay,
        status: "draft",
        created_by: null, // Set to null initially to avoid RLS issues
        ...(payrollRunId ? { payroll_run_id: payrollRunId } : {}),
      };

      console.log("Saving payslip to database:", {
        payslipNumber,
        employee: selectedEmployee.full_name,
        grossPay,
        netPay,
        totalDeductions,
      });

      // Check authentication status before querying
      // Use safe session utility to prevent rate limits
      let authSession = null;
      try {
        authSession = await getSessionSafe();

        // Only attempt refresh if no session (safe utility handles rate limits)
        if (!authSession) {
          console.warn("⚠️ No session found, attempting to refresh...");
          authSession = await refreshSessionSafe();
        }
      } catch (error: any) {
        // Handle errors gracefully (safe utilities already handle rate limits)
        console.error("Session check error:", error?.message || error);
      }

      console.log("🔐 Payslip Save - Auth Status:", {
        hasSession: !!authSession,
        userId: authSession?.user?.id || null,
        userEmail: authSession?.user?.email || null,
      });

      // Verify user role
      if (authSession?.user?.id) {
        const { data: userRoleData, error: roleError } = await supabase
          .from("profiles")
          .select("role, is_active")
          .eq("id", authSession.user.id)
          .single();

        const roleData = userRoleData as {
          role: string;
          is_active: boolean;
        } | null;

        console.log("👤 User Role Check:", {
          userId: authSession.user.id,
          role: roleData?.role || null,
          isActive: roleData?.is_active || null,
          roleError: roleError?.message || null,
        });
      }

      const isMissingPayslipColumn = (
        errorLike: unknown,
        column: string
      ) => {
        const message = String((errorLike as any)?.message || "");
        return (
          message.includes(`column payslips.${column} does not exist`) ||
          message.includes(`column "${column}" of relation "payslips" does not exist`)
        );
      };
      const isAnyKnownOptionalPayslipColumnMissing = (errorLike: unknown) => {
        const optionalColumns = [
          "payslip_number",
          "adjustment_amount",
          "adjustment_reason",
          "week_number",
          "period_type",
          "created_by",
          "apply_sss",
          "apply_philhealth",
          "apply_pagibig",
          "sss_amount",
          "philhealth_amount",
          "pagibig_amount",
          "allowance_amount",
          "thirteenth_month_pay",
        ];
        return optionalColumns.some((column) =>
          isMissingPayslipColumn(errorLike, column)
        );
      };

      // Check if payslip already exists.
      // If we came from a payroll run, ALWAYS target that run's payslip row to avoid
      // inserting a duplicate (unique: payroll_run_id + employee_id).
      let existing: any = null;
      let checkError: any = null;
      if (payrollRunId) {
        const byRun = await supabase
          .from("payslips")
          .select("id, payslip_number, adjustment_amount, adjustment_reason")
          .eq("payroll_run_id", payrollRunId)
          .eq("employee_id", selectedEmployee.id)
          .order("created_at", { ascending: false })
          .limit(1);
        existing = Array.isArray(byRun.data) ? byRun.data[0] : null;
        checkError = byRun.error;
      } else {
        const byNumber = await supabase
          .from("payslips")
          .select("id, payslip_number, adjustment_amount, adjustment_reason")
          .eq("payslip_number", payslipNumber)
          .maybeSingle();
        existing = byNumber.data;
        checkError = byNumber.error;
      }

      if (
        checkError &&
        isAnyKnownOptionalPayslipColumnMissing(checkError)
      ) {
        let byPeriodQuery = supabase
          .from("payslips")
          .select("id")
          .eq("employee_id", selectedEmployee.id)
          .eq("period_start", format(periodStart, "yyyy-MM-dd"))
          .eq("period_end", format(periodEnd, "yyyy-MM-dd"));
        if (payrollRunId) {
          byPeriodQuery = byPeriodQuery.eq("payroll_run_id", payrollRunId);
        }
        const byPeriod = await byPeriodQuery.maybeSingle();
        existing = byPeriod.data;
        checkError = byPeriod.error;
      }

      if (checkError) {
        console.error("❌ Error checking for existing payslip:", {
          error: checkError,
          code: checkError.code,
          message: checkError.message,
          details: checkError.details,
          hint: checkError.hint,
          authSession: !!authSession,
          userId: authSession?.user?.id || null,
        });
        throw checkError;
      }

      const existingPayslip = existing as {
        id: string;
        payslip_number?: string;
        adjustment_amount?: number | null;
        adjustment_reason?: string | null;
      } | null;

      // Reload merges adjustment_lines from DB via loadAttendanceAndDeductions
      if (existingPayslip) {
        console.log("Updating existing payslip:", existingPayslip.id);
        // Update
        let updatePayload: Record<string, unknown> = { ...payslipData };
        let { error, data: updatedData } = await (
          supabase.from("payslips") as any
        )
          .update(updatePayload)
          .eq("id", existingPayslip.id)
          .select()
          .single();

        if (
          error &&
          isAnyKnownOptionalPayslipColumnMissing(error)
        ) {
          const {
            payslip_number: _dropPayslipNumber,
            adjustment_amount: _dropAdjustmentAmount,
            adjustment_reason: _dropAdjustmentReason,
            week_number: _dropWeekNumber,
            period_type: _dropPeriodType,
            created_by: _dropCreatedBy,
            apply_sss: _dropApplySss,
            apply_philhealth: _dropApplyPhilhealth,
            apply_pagibig: _dropApplyPagibig,
            sss_amount: _dropSssAmount,
            philhealth_amount: _dropPhilhealthAmount,
            pagibig_amount: _dropPagibigAmount,
            allowance_amount: _dropAllowanceAmount,
            thirteenth_month_pay: _dropThirteenthMonthPay,
            ...fallbackPayload
          } = updatePayload as any;
          updatePayload = fallbackPayload;
          const retry = await (supabase.from("payslips") as any)
            .update(updatePayload)
            .eq("id", existingPayslip.id)
            .select()
            .single();
          error = retry.error;
          updatedData = retry.data;
        }

        if (error) {
          console.error("Error updating payslip:", error);
          throw error;
        }
        console.log("Payslip updated successfully:", updatedData);

        // Update loan balances and terms after payslip is saved
        await updateLoanBalancesAndTerms(periodStart, periodEnd);

        // Reload attendance and loans to refresh UI with updated balances
        await loadAttendanceAndDeductions();

        toast.success("Payslip updated successfully");
      } else {
        console.log("Creating new payslip...");
        // Create
        let insertPayload: Record<string, unknown> = { ...payslipData };
        let { error, data: insertedData } = await (
          supabase.from("payslips") as any
        )
          .insert([insertPayload])
          .select()
          .single();

        if (
          error &&
          isAnyKnownOptionalPayslipColumnMissing(error)
        ) {
          const {
            payslip_number: _dropPayslipNumber,
            adjustment_amount: _dropAdjustmentAmount,
            adjustment_reason: _dropAdjustmentReason,
            week_number: _dropWeekNumber,
            period_type: _dropPeriodType,
            created_by: _dropCreatedBy,
            apply_sss: _dropApplySss,
            apply_philhealth: _dropApplyPhilhealth,
            apply_pagibig: _dropApplyPagibig,
            sss_amount: _dropSssAmount,
            philhealth_amount: _dropPhilhealthAmount,
            pagibig_amount: _dropPagibigAmount,
            allowance_amount: _dropAllowanceAmount,
            thirteenth_month_pay: _dropThirteenthMonthPay,
            ...fallbackPayload
          } = insertPayload as any;
          insertPayload = fallbackPayload;
          const retry = await (supabase.from("payslips") as any)
            .insert([insertPayload])
            .select()
            .single();
          error = retry.error;
          insertedData = retry.data;
        }

        if (error) {
          console.error("❌ Error creating payslip:", {
            error: error,
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
            payslipData: {
              ...payslipData,
              earnings_breakdown: Array.isArray(payslipData.earnings_breakdown)
                ? `Array with ${payslipData.earnings_breakdown.length} items`
                : typeof payslipData.earnings_breakdown,
              deductions_breakdown: typeof payslipData.deductions_breakdown,
            },
            authSession: !!authSession,
            userId: authSession?.user?.id || null,
          });
          throw error;
        }
        console.log("Payslip created successfully:", insertedData);

        // Update loan balances and terms after payslip is saved
        await updateLoanBalancesAndTerms(periodStart, periodEnd);

        // Reload attendance and loans to refresh UI with updated balances
        await loadAttendanceAndDeductions();

        toast.success("Payslip generated and saved successfully");
      }
    } catch (error: any) {
      console.error("Error generating payslip:", error);
      toast.error(error.message || "Failed to generate payslip");
    } finally {
      setGenerating(false);
    }
  }

  // Memoize periodEnd calculation
  const periodEnd = useMemo(() => {
    const d = new Date(periodStart);
    d.setDate(d.getDate() + 6);
    return d;
  }, [periodStart]);

  // Memoize working days calculation to ensure it recalculates when holidays are loaded
  // This fixes the issue where on first load, holidays might be empty [], causing incorrect calculation
  // The calculation will automatically re-run when holidays state updates
  // IMPORTANT: This hook MUST be called before any conditional returns to follow React Rules of Hooks
  const workingDays = useMemo(() => {
    if (!attendance || !attendance.attendance_data || !selectedEmployee) return 0;
    const days = attendance.attendance_data as any[];

    // Weekly cutoff base hours (scheduled days × 8 − absences×8), same as timesheet / PayslipDetailedBreakdown

    try {
      // Extract clock entries from attendance data
      const clockEntries = days
        .filter((day) => day.clockInTime && day.clockOutTime)
        .map((day) => ({
          clock_in_time: day.clockInTime!,
          clock_out_time: day.clockOutTime!,
        }));

      // Get rest days and holidays - use state restDaysMap if available, otherwise create empty map
      const restDaysForCalculation = restDaysMap.size > 0 ? restDaysMap : new Map<string, boolean>();
      const holidaysList = holidays.map((h) => ({ holiday_date: h.holiday_date }));

      // Calculate base pay using the same method as PayslipDetailedBreakdown
      const basePayResult = calculateBasePay({
        periodStart,
        periodEnd: periodEnd,
        clockEntries,
        restDays: restDaysForCalculation,
        holidays: holidaysList,
        isClientBased: selectedEmployee.employee_type === "client-based" || false,
        hireDate: selectedEmployee.hire_date ? parseISO(selectedEmployee.hire_date) : undefined,
        terminationDate: undefined, // termination_date doesn't exist in employees table
      });

      // Days Work = finalBaseHours / 8
      return basePayResult.finalBaseHours / 8;
    } catch (error) {
      console.error("Error calculating working days:", error);
      // Fallback: return 0 if calculation fails
      return 0;
    }
  }, [attendance, selectedEmployee, periodStart, periodEnd, holidays, restDaysMap]);

  // Memoize expensive gross pay calculation
  const grossPay = useMemo(() => {
    let calculatedGrossPay = attendance?.gross_pay || 0;

    // If we have attendance_data, recalculate to ensure accuracy (especially for AS/Office-based)
    if (
      attendance?.attendance_data &&
      Array.isArray(attendance.attendance_data) &&
      selectedEmployee
    ) {
      const ratePerHour =
        selectedEmployee.rate_per_hour ||
        (selectedEmployee.per_day
          ? selectedEmployee.per_day / 8
          : selectedEmployee.rate_per_day
          ? selectedEmployee.rate_per_day / 8
          : 0);

      if (ratePerHour > 0) {
        try {
          // Use calculateWeeklyPayroll as base calculation
          const payrollResult = calculateWeeklyPayroll(
            attendance.attendance_data,
            ratePerHour
          );

          // Check if employee is Account Supervisor or eligible for allowances
          const isAccountSupervisor =
            selectedEmployee.position
              ?.toUpperCase()
              .includes("ACCOUNT SUPERVISOR") || false;
          const isClientBased = selectedEmployee.employee_type === "client-based";
          const supervisoryPositions = [
            "PAYROLL SUPERVISOR",
            "ACCOUNT RECEIVABLE SUPERVISOR",
            "HR OPERATIONS SUPERVISOR",
            "HR SUPERVISOR - LABOR RELATIONS/EMPLOYEE ENGAGEMENT",
            "HR SUPERVISOR - LABOR RELATIONS",
            "HR SUPERVISOR-LABOR RELATIONS", // Also match without spaces around hyphen
            "HR SUPERVISOR - EMPLOYEE ENGAGEMENT",
            "HR SUPERVISOR-EMPLOYEE ENGAGEMENT", // Also match without spaces around hyphen
          ];
          const isSupervisory =
            selectedEmployee.employee_type === "office-based" &&
            supervisoryPositions.some((pos) =>
              selectedEmployee.position?.toUpperCase().includes(pos.toUpperCase())
            );
          const isManagerial =
            selectedEmployee.employee_type === "office-based" &&
            selectedEmployee.job_level?.toUpperCase() === "MANAGERIAL";
          const isSupervisoryByJobLevel =
            selectedEmployee.employee_type === "office-based" &&
            selectedEmployee.job_level?.toUpperCase() === "SUPERVISORY";
          const isEligibleForAllowances =
            isAccountSupervisor || isSupervisory || isSupervisoryByJobLevel || isManagerial;
          const useFixedAllowances = isClientBased || isEligibleForAllowances;

          // Calculate base gross pay from standard calculations
          let grossPayValue = Math.round(payrollResult.grossPay * 100) / 100;

          // For Account Supervisors/Office-based employees, add fixed allowances
          if (useFixedAllowances) {
            let totalFixedAllowances = 0;

            // Calculate fixed allowances from attendance data
            attendance.attendance_data.forEach((day: any) => {
              const dayType = day.dayType || "regular";
              const overtimeHours =
                typeof day.overtimeHours === "string"
                  ? parseFloat(day.overtimeHours)
                  : day.overtimeHours || 0;

              // Regular OT allowance
              if (dayType === "regular" && overtimeHours > 0) {
                // Client-based employees and Office-based Supervisory/Managerial: First 2 hours = ₱200, then ₱100 per succeeding hour
                if (isClientBased || isAccountSupervisor || isEligibleForAllowances) {
                  if (overtimeHours >= 2) {
                    // First 2 hours = ₱200, then ₱100 per succeeding hour
                    const allowance = 200 + Math.max(0, overtimeHours - 2) * 100;
                    totalFixedAllowances += allowance;
                  }
                }
              }

              // Holiday/Rest Day OT allowance
              const isHolidayOrRestDay =
                dayType === "sunday" ||
                dayType === "regular-holiday" ||
                dayType === "non-working-holiday" ||
                dayType === "sunday-special-holiday" ||
                dayType === "sunday-regular-holiday";

              if (isHolidayOrRestDay && overtimeHours > 0) {
                if (overtimeHours >= 8) {
                  totalFixedAllowances += 700;
                } else if (overtimeHours >= 4) {
                  totalFixedAllowances += 350;
                }
              }

              // Holiday/Rest Day allowance for REGULAR HOURS worked (not OT)
              // This applies if employee worked regular hours on holiday/rest day
              const regularHours = creditWorkHoursHalfHour(
                Math.round(Number(day.regularHours || 0) * 100) / 100
              );
              const hasCompleteLog = Boolean(day.clockInTime && day.clockOutTime);
              if (isHolidayOrRestDay && hasCompleteLog && regularHours > 0) {
                // Allowance for regular hours worked on holiday/rest day: ₱700 for ≥8 hours, ₱350 for ≥4 hours
                if (regularHours >= 8) {
                  totalFixedAllowances += 700;
                } else if (regularHours >= 4) {
                  totalFixedAllowances += 350;
                }
              }
            });

            // Calculate basic pay (regular days only, excluding holidays)
            let basicPay = 0;
            let holidayRestDayPay = 0;
            attendance.attendance_data.forEach((day: any) => {
              const dayType = day.dayType || "regular";
              const regularHours = creditWorkHoursHalfHour(
                Math.round(Number(day.regularHours || 0) * 100) / 100
              );
              const date = day.date || "";
              const ratePerHour =
                selectedEmployee.rate_per_hour ||
                (selectedEmployee.per_day
                  ? selectedEmployee.per_day / 8
                  : selectedEmployee.rate_per_day
                  ? selectedEmployee.rate_per_day / 8
                  : 0);

              if (dayType === "regular") {
                // Regular days: pay based on actual regular hours worked (including Saturdays).
                basicPay += regularHours * ratePerHour;
              } else if (
                dayType === "regular-holiday" ||
                dayType === "non-working-holiday"
              ) {
                // For holidays: Check "1 Day Before" rule
                const eligibleForHolidayPay = isEligibleForHolidayPayRule(
                  date,
                  regularHours,
                  attendance.attendance_data
                );

                if (eligibleForHolidayPay) {
                  const hasCompleteLog = Boolean(day.clockInTime && day.clockOutTime);
                  const hoursToPay = hasCompleteLog ? regularHours : HOLIDAY_UNWORKED_CREDIT_HOURS;
                  // Policy: eligible holiday pay always uses statutory multipliers,
                  // even if credited hours (no complete log).
                  holidayRestDayPay +=
                    hoursToPay *
                    ratePerHour *
                    (dayType === "regular-holiday"
                      ? 2.0
                      : 1.3);
                }
              } else if (
                dayType === "sunday" ||
                dayType === "sunday-special-holiday" ||
                dayType === "sunday-regular-holiday"
              ) {
                // For Rest Days (Sunday is the designated rest day for office-based employees):
                // Account Supervisors/Supervisory: Only pay if they actually worked on rest day (no automatic 8 hours)
                if (regularHours > 0) {
                  // Rest day pay multiplier
                  holidayRestDayPay += regularHours * ratePerHour * 1.3;
                }
              }
            });

            // Gross Pay = Basic Pay (regular days) + Holiday/Rest Day Pay (at 1.0x) + Fixed Allowances
            grossPayValue = basicPay + holidayRestDayPay + totalFixedAllowances;
          }

          calculatedGrossPay = Math.round(grossPayValue * 100) / 100;

          // If the recalculated value differs significantly from stored value, use recalculated
          // This handles cases where attendance.gross_pay might be stale
          if (
            attendance.gross_pay &&
            Math.abs(calculatedGrossPay - attendance.gross_pay) > 0.01
          ) {
            // Use recalculated value if it's more accurate
            calculatedGrossPay = Math.round(grossPayValue * 100) / 100;
          }
        } catch (calcError) {
          console.error("Error recalculating gross pay:", calcError);
          // Fallback to stored value
          calculatedGrossPay = attendance?.gross_pay || 0;
        }
      }
    }

    return calculatedGrossPay;
  }, [attendance, selectedEmployee]);

  /** Prefer page-level gross (attendance + calculateWeeklyPayroll / AS rules); fallback to breakdown callback. Keeps summary in sync with preview. */
  const earningsBaseForPeriod = useMemo(() => {
    // Prefer the detailed breakdown gross when available (it reflects the on-screen earnings table).
    if (calculatedTotalGrossPay !== null && calculatedTotalGrossPay >= 0) {
      return calculatedTotalGrossPay;
    }
    if (grossPay > 0) return grossPay;
    return 0;
  }, [grossPay, calculatedTotalGrossPay]);

  const otherManualDeductionSum = useMemo(
    () =>
      otherDeductionRows.reduce(
        (s, r) => s + (parseFloat(r.amount) || 0),
        0
      ),
    [otherDeductionRows]
  );

  const adjustment = useMemo(
    () =>
      Math.round(
        adjustmentRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0) *
          100
      ) / 100,
    [adjustmentRows]
  );

  const adjustmentReasonForPrint = useMemo(
    () => combineAdjustmentReasonForDb(adjustmentRows) ?? undefined,
    [adjustmentRows]
  );

  // Memoize deductions calculations
  const weeklyDed = useMemo(() => {
    return (
      otherManualDeductionSum +
      (deductions?.sss_salary_loan || 0) +
      (deductions?.sss_calamity_loan || 0) +
      (deductions?.pagibig_salary_loan || 0) +
      (deductions?.pagibig_calamity_loan || 0) +
      // Include loans for both cutoffs based on their cutoff_assignment
      (isFirstCutoff()
        ? (monthlyLoans.sssLoan || 0) +
          (monthlyLoans.pagibigLoan || 0) +
          (monthlyLoans.companyLoan || 0) +
          (monthlyLoans.emergencyLoan || 0) +
          (monthlyLoans.otherLoan || 0)
        : isSecondCutoff()
        ? (monthlyLoans.pagibigLoan || 0) +
          (monthlyLoans.companyLoan || 0) +
          (monthlyLoans.emergencyLoan || 0) +
          (monthlyLoans.otherLoan || 0) +
          (monthlyLoans.sssLoan || 0)
        : 0)
    );
  }, [deductions, monthlyLoans, periodStart, otherManualDeductionSum]);

  // Monthly salary from employee rate only (for statutory: SSS, PhilHealth, Pag-IBIG). Per day × 26.
  const monthlySalary = useMemo(() => {
    const workingDaysPerMonth = 26;
    if (selectedEmployee?.monthly_rate) return selectedEmployee.monthly_rate;
    if (selectedEmployee?.per_day)
      return calculateMonthlySalary(selectedEmployee.per_day, workingDaysPerMonth);
    if (selectedEmployee?.rate_per_day)
      return calculateMonthlySalary(selectedEmployee.rate_per_day, workingDaysPerMonth);
    return 0;
  }, [selectedEmployee?.monthly_rate, selectedEmployee?.per_day, selectedEmployee?.rate_per_day]);

  const statutoryProrationFactorPreview = useMemo(() => {
    if (mtdWorkDaysForStatutory === null) return 1;
    return statutoryProrationFactorFromDays(mtdWorkDaysForStatutory);
  }, [mtdWorkDaysForStatutory]);

  /** Full monthly SSS (regular + WISP), PhilHealth, Pag-IBIG — 4th weekly pay only; × min(1, MTD days / 26). */
  const weeklyStatutoryAuto = useMemo(() => {
    if (monthlySalary <= 0 || !isFourthStatutoryWeeklyPay(periodEnd)) {
      return { sssReg: 0, sssWisp: 0, phil: 0, pagibig: 0, total: 0 };
    }
    const sssCalc = calculateSSS(monthlySalary);
    const phCalc = calculatePhilHealth(monthlySalary);
    const piCalc = calculatePagIBIG(monthlySalary);
    const f = statutoryProrationFactorPreview;
    const sssReg = !isNaN(sssCalc.regularEmployeeShare)
      ? applyStatutoryProration(
          Math.round(sssCalc.regularEmployeeShare * 100) / 100,
          f
        )
      : 0;
    const sssWisp =
      (sssCalc.wispEmployeeShare ?? 0) > 0
        ? applyStatutoryProration(
            Math.round((sssCalc.wispEmployeeShare ?? 0) * 100) / 100,
            f
          )
        : 0;
    const phil = !isNaN(phCalc.employeeShare)
      ? applyStatutoryProration(
          Math.round(phCalc.employeeShare * 100) / 100,
          f
        )
      : 0;
    const pagibig = !isNaN(piCalc.employeeShare)
      ? applyStatutoryProration(
          Math.round(piCalc.employeeShare * 100) / 100,
          f
        )
      : 0;
    const total =
      Math.round((sssReg + sssWisp + phil + pagibig) * 100) / 100;
    return { sssReg, sssWisp, phil, pagibig, total };
  }, [monthlySalary, periodEnd, statutoryProrationFactorPreview]);

  const weeklyStatutory = useMemo(() => {
    const sssReg =
      govContributionOverrides.sssReg ?? weeklyStatutoryAuto.sssReg;
    const sssWisp =
      govContributionOverrides.sssWisp ?? weeklyStatutoryAuto.sssWisp;
    const phil = govContributionOverrides.phil ?? weeklyStatutoryAuto.phil;
    const pagibig =
      govContributionOverrides.pagibig ?? weeklyStatutoryAuto.pagibig;
    const total = Math.round((sssReg + sssWisp + phil + pagibig) * 100) / 100;
    return { sssReg, sssWisp, phil, pagibig, total };
  }, [govContributionOverrides, weeklyStatutoryAuto]);

  const govDed = weeklyStatutory.total;

  const taxAuto = useMemo(() => {
    const whOverride = deductions?.withholding_tax || 0;
    if (whOverride !== 0) return Math.round(whOverride * 100) / 100;
    if (!isLastWeeklyPayOfSemiMonth(periodEnd)) return 0;

    const periodGross = earningsBaseForPeriod + adjustment;
    const nSemiWeeks = countWeeklyPaysInSemiMonth(periodEnd);
    const grossOther =
      semiMonthlyRollupForTax?.grossFromSavedOtherWeeksInSemiMonth ?? 0;
    const actualSemiGross =
      semiMonthlyRollupForTax != null
        ? Math.round((grossOther + periodGross) * 100) / 100
        : Math.round(periodGross * nSemiWeeks * 100) / 100;

    if (actualSemiGross <= 0) return 0;

    const sss = calculateSSS(monthlySalary);
    const philhealth = calculatePhilHealth(monthlySalary);
    const pagibig = calculatePagIBIG(monthlySalary);
    const monthlyContributionsFull =
      sss.employeeShare + philhealth.employeeShare + pagibig.employeeShare;
    const monthlyContributions = applyStatutoryProration(
      Math.round(monthlyContributionsFull * 100) / 100,
      statutoryProrationFactorPreview
    );
    const halfMonthlyContrib = Math.round((monthlyContributions / 2) * 100) / 100;
    const semiTaxableIncome = Math.max(
      0,
      actualSemiGross - halfMonthlyContrib
    );
    const semiTaxDue = calculateSemiMonthlyWithholdingTax(semiTaxableIncome);
    const taxPrior =
      semiMonthlyRollupForTax?.taxWithheldPriorExcludingCurrentInSemiMonth ??
      0;
    return Math.max(
      0,
      Math.round((semiTaxDue - taxPrior) * 100) / 100
    );
  }, [
    earningsBaseForPeriod,
    adjustment,
    monthlySalary,
    deductions?.withholding_tax,
    periodEnd,
    semiMonthlyRollupForTax,
    statutoryProrationFactorPreview,
  ]);

  const tax = useMemo(
    () => govContributionOverrides.tax ?? taxAuto,
    [govContributionOverrides.tax, taxAuto]
  );

  const allowance = 0;

  // Memoize total deductions
  const totalDed = useMemo(() => {
    return weeklyDed + govDed + tax;
  }, [weeklyDed, govDed, tax]);

  // Gross pay = earnings + adjustment (adjustment included in gross)
  const finalGrossPay = useMemo(() => {
    return earningsBaseForPeriod + adjustment;
  }, [earningsBaseForPeriod, adjustment]);

  // Net pay = gross (incl. adjustment) − total deductions
  const netPay = useMemo(() => {
    return finalGrossPay - totalDed;
  }, [finalGrossPay, totalDed]);

  const isSavedPayslip = savedPayslip !== null;
  const isRunFinalized = payrollRunId ? payrollRunStatus === "finalized" : false;
  const isLocked = isSavedPayslip && !(payrollRunId && !isRunFinalized);

  // When locked, show DB values; otherwise show live computed values (even if already saved).
  const displayGrossPay =
    isLocked && savedPayslip ? savedPayslip.gross_pay : finalGrossPay;
  const displayTotalDed =
    isLocked && savedPayslip ? savedPayslip.total_deductions : totalDed;
  const displayNetPay =
    isLocked && savedPayslip ? savedPayslip.net_pay : netPay;

  // Show loading or access denied - MUST be after all hooks
  if (roleLoading || permissionsLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Icon
            name="ArrowsClockwise"
            size={IconSizes.lg}
            className="animate-spin text-muted-foreground"
          />
        </div>
      </DashboardLayout>
    );
  }

  // Show access denied message if user doesn't have permission
  if (!hasPayslipsAccess) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Card className="max-w-md">
            <CardContent className="pt-6">
              <VStack gap="4" align="center">
                <Icon
                  name="Lock"
                  size={IconSizes.xl}
                  className="text-destructive"
                />
                <H3>Access Denied</H3>
                <BodySmall className="text-center text-muted-foreground">
                  You do not have permission to access the payslip management
                  page. Please contact your administrator if you need access.
                </BodySmall>
                <Button onClick={() => router.push("/dashboard")}>
                  Return to Dashboard
                </Button>
              </VStack>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // Debug: Log finalGrossPay calculation
  console.log('[PayslipsPage] finalGrossPay calculation:', {
    calculatedTotalGrossPay,
    finalGrossPay,
    totalDed,
    netPay: finalGrossPay - totalDed,
  });

  // Helper function to calculate earnings breakdown from attendance data
  function calculateEarningsBreakdown() {
    // Return empty breakdown since rates are removed
    return {
      regularPay: 0,
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
      grossIncome: attendance?.gross_pay || 0,
    };
  }

  // Show access denied message if user doesn't have permission - MUST be after all hooks
  if (!hasPayslipsAccess) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Card className="max-w-md">
            <CardContent className="pt-6">
              <VStack gap="4" align="center">
                <Icon
                  name="Lock"
                  size={IconSizes.xl}
                  className="text-destructive"
                />
                <H3>Access Denied</H3>
                <BodySmall className="text-center text-muted-foreground">
                  You do not have permission to access the payslip management
                  page. Please contact your administrator if you need access.
                </BodySmall>
                <Button onClick={() => router.push("/dashboard")}>
                  Go to Dashboard
                </Button>
              </VStack>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <>
      <DashboardLayout>
        <VStack gap="3" className="w-full print:hidden pb-24">
          <H1 className="text-xl">Payslip Generation</H1>

          <CardSection className="py-3">
            <HStack gap="4" align="start" className="flex-wrap">
              {/* Period Navigation */}
              <VStack gap="1" align="start">
                <Label className="text-xs text-muted-foreground">
                  Select Cut-off Period
                </Label>
                <HStack gap="1" align="center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => changePeriod("prev")}
                  >
                    <Icon name="CaretLeft" size={IconSizes.sm} />
                  </Button>
                  <span className="font-medium text-sm min-w-[160px] text-center">
                    {`${format(periodStart, "MMM d")} – ${format(
                      periodEnd,
                      "MMM d, yyyy"
                    )}`}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => changePeriod("next")}
                  >
                    <Icon name="CaretRight" size={IconSizes.sm} />
                  </Button>
                </HStack>
              </VStack>

              {/* Employee Selection - search by name or employee ID */}
              <VStack gap="1" align="start">
                <Label className="text-xs text-muted-foreground">
                  Employee
                </Label>
                {employees.length === 0 ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => (window.location.href = "/employees")}
                  >
                    <Icon name="UsersThree" size={IconSizes.sm} />
                    Go to Employees
                  </Button>
                ) : (
                  <EmployeeSearchSelect
                    employees={employees.map((e) => ({
                      id: e.id,
                      employee_id: e.employee_id,
                      full_name: e.full_name ?? "",
                      first_name: e.first_name,
                      last_name: e.last_name,
                    }))}
                    value={selectedEmployeeId}
                    onValueChange={setSelectedEmployeeId}
                    showAllOption={false}
                    placeholder="Search by name or employee ID..."
                    triggerClassName="h-8 w-[200px]"
                  />
                )}
                <Caption className="text-muted-foreground">
                  {employees.length === 0
                    ? "No employees loaded. Open Employees to manage your roster."
                    : "Search and select an employee to view or generate their payslip."}
                </Caption>
              </VStack>
            </HStack>
          </CardSection>

          {/* Missing Data Messages */}
          {selectedEmployee && !attendance && (
            <CardSection
              title={
                <HStack gap="2" align="center">
                  <Icon
                    name="WarningCircle"
                    size={IconSizes.md}
                    className="text-yellow-600"
                  />
                  <span>No Attendance Data</span>
                </HStack>
              }
            >
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <BodySmall className="text-yellow-800 font-medium text-xs">
                  No time attendance data found for {selectedEmployee.full_name}{" "}
                  for the period {format(periodStart, "MMM d")} –{" "}
                  {format(periodEnd, "MMM d, yyyy")}
                </BodySmall>
                <BodySmall className="text-yellow-700 mt-1 text-xs">
                  The system attempted to generate attendance data from time
                  clock entries. If no data was found, check the
                  <strong> Time Entries</strong> page to verify records.
                </BodySmall>
              </div>
            </CardSection>
          )}

          {/* Earnings and Deductions Side-by-Side */}
          {selectedEmployee && (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {/* Detailed Earnings Breakdown - Left Side (60% width on large screens, 66% on medium) */}
              {selectedEmployee &&
                attendance &&
                Array.isArray(attendance.attendance_data) &&
                attendance.attendance_data.length > 0 &&
                (selectedEmployee.per_day || selectedEmployee.rate_per_day) &&
                (selectedEmployee.rate_per_hour || selectedEmployee.per_day) && (
                  <CardSection
                    title="Earnings Breakdown"
                    className="compact md:col-span-2 lg:col-span-3"
                  >
                    <div className="max-h-[500px] md:max-h-[600px] lg:max-h-[700px] overflow-y-auto">
                      <PayslipDetailedBreakdown
                        employee={{
                          employee_id: selectedEmployee.employee_id,
                          full_name: selectedEmployee.full_name,
                          rate_per_day:
                            selectedEmployee.monthly_rate
                              ? selectedEmployee.monthly_rate / 26
                              : selectedEmployee.per_day ||
                                selectedEmployee.rate_per_day ||
                                0,
                          rate_per_hour:
                            selectedEmployee.rate_per_hour ||
                            (selectedEmployee.monthly_rate
                              ? selectedEmployee.monthly_rate / 26 / 8
                              : selectedEmployee.per_day
                              ? selectedEmployee.per_day / 8
                              : 0),
                          position: selectedEmployee.position || null,
                          assigned_hotel:
                            selectedEmployee.assigned_hotel || null,
                          employee_type: selectedEmployee.employee_type ?? null,
                          job_level: selectedEmployee.job_level ?? null,
                          hire_date: (selectedEmployee as any).hire_date || null,
                          termination_date: (selectedEmployee as any).termination_date || null,
                        }}
                        periodStart={periodStart}
                        periodEnd={periodEnd}
                        restDays={restDaysMap}
                        holidays={holidays}
                        onTotalGrossPayChange={(value) => {
                          console.log('[PayslipsPage] onTotalGrossPayChange callback called with:', value);
                          setCalculatedTotalGrossPay(value);
                        }}
                        attendanceData={Array.isArray(attendance.attendance_data)
                          ? (attendance.attendance_data as any[]).map((day: any) => {
                              const dayDate =
                                day.date || day.clock_in_time?.split("T")[0] || "";

                              // Find matching clock entry for this date (use Asia/Manila timezone)
                              const matchingEntry = clockEntries.find((entry) => {
                                if (!entry.clock_in_time) return false;
                                const entryDateUTC = new Date(entry.clock_in_time);
                                const formatter = new Intl.DateTimeFormat("en-US", {
                                  timeZone: "Asia/Manila",
                                  year: "numeric",
                                  month: "2-digit",
                                  day: "2-digit",
                                });
                                const parts = formatter.formatToParts(entryDateUTC);
                                const entryDateStr = `${parts.find((p) => p.type === "year")!.value}-${
                                  parts.find((p) => p.type === "month")!.value
                                }-${parts.find((p) => p.type === "day")!.value}`;
                                return entryDateStr === dayDate;
                              });

                              // If day.regularHours is >= 8, it's likely a leave day - prioritize it over clock entry hours
                              const isLeaveDayWithFullHours =
                                (day.regularHours || 0) >= 8;
                              const regularHours = creditWorkHoursHalfHour(
                                Math.round(
                                  Number(
                                    isLeaveDayWithFullHours
                                      ? day.regularHours
                                      : matchingEntry?.regular_hours ||
                                        day.regularHours ||
                                        0
                                  ) * 100
                                ) / 100
                              );

                              // ND when OT overlaps 10PM–6AM (from approved OT). Do not use matchingEntry.total_night_diff_hours for payslip.
                              return {
                                date: dayDate,
                                dayType: day.dayType || "regular",
                                regularHours: regularHours,
                                overtimeHours: day.overtimeHours || 0,
                                nightDiffHours: day.nightDiffHours || 0,
                                clockInTime:
                                  matchingEntry?.clock_in_time ||
                                  day.clockInTime ||
                                  day.clock_in_time,
                                clockOutTime:
                                  matchingEntry?.clock_out_time ||
                                  day.clockOutTime ||
                                  day.clock_out_time,
                              };
                            })
                          : []}
                      />
                    </div>
                  </CardSection>
                )}

              {/* Deductions Breakdown - Right Side (40% width on large screens, 33% on medium) */}
              <CardSection
                title="Deductions"
                className="md:col-span-1 lg:col-span-2"
              >
                <VStack gap="3">
                  {/* Other Deductions full width; Adjustments stacked below */}
                  <VStack align="stretch" gap="4" className="w-full">
                    <VStack gap="1" align="start" className="w-full min-w-0">
                      <H4 className="text-sm font-medium text-muted-foreground">
                        Other Deductions
                      </H4>
                      <VStack
                        gap="2"
                        className="h-full w-full rounded-xl border border-border/80 bg-muted/40 p-3"
                      >
                        <div className="w-full overflow-x-auto rounded-lg border border-border/80 bg-background">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border/70 bg-muted/50 text-left">
                                <th className="px-2 py-1.5 font-medium text-xs uppercase text-muted-foreground">
                                  Type
                                </th>
                                <th className="px-2 py-1.5 font-medium text-xs uppercase text-muted-foreground text-right w-[140px]">
                                  Amount
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {otherDeductionRows.map((row) => (
                                <tr key={row.id} className="border-b border-border/60 last:border-0">
                                  <td className="px-2 py-1 align-middle">
                                    <Select
                                      value={row.type}
                                      disabled={isLocked}
                                      onValueChange={(newType) => {
                                        const t = newType as OtherDeductionType;
                                        setOtherDeductionRows((prev) => {
                                          const i = prev.findIndex((r) => r.id === row.id);
                                          if (i < 0) return prev;
                                          const j = prev.findIndex(
                                            (r) => r.type === t && r.id !== row.id
                                          );
                                          const next = prev.map((r) => ({ ...r }));
                                          if (j >= 0) {
                                            const tmpType = next[i].type;
                                            const tmpAmt = next[i].amount;
                                            next[i] = {
                                              ...next[i],
                                              type: t,
                                              amount: next[j].amount,
                                            };
                                            next[j] = {
                                              ...next[j],
                                              type: tmpType,
                                              amount: tmpAmt,
                                            };
                                          } else {
                                            next[i] = { ...next[i], type: t };
                                          }
                                          return next;
                                        });
                                      }}
                                    >
                                      <SelectTrigger className="h-8 text-sm">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {OTHER_DEDUCTION_TYPES.map((opt) => (
                                          <SelectItem key={opt} value={opt}>
                                            {opt}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </td>
                                  <td className="px-2 py-1 align-middle">
                                    <Input
                                      type="number"
                                      step="0.01"
                                      placeholder="0"
                                      value={row.amount}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        setOtherDeductionRows((prev) =>
                                          prev.map((r) =>
                                            r.id === row.id ? { ...r, amount: v } : r
                                          )
                                        );
                                      }}
                                      disabled={isLocked}
                                      className="h-8 text-sm text-right"
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </VStack>
                    </VStack>

                    {/* Adjustments */}
                    <VStack gap="2" align="start" className="w-full min-w-0">
                      <H4 className="text-sm font-medium text-muted-foreground">
                        Adjustments
                      </H4>
                      <VStack
                        gap="2"
                        className="h-full w-full rounded-xl border border-border/80 bg-muted/40 p-3"
                      >
                        <div className="w-full overflow-x-auto rounded-lg border border-border/80 bg-background">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border/70 bg-muted/50 text-left">
                                <th className="px-2 py-1.5 font-medium text-xs uppercase text-muted-foreground">
                                  Description
                                </th>
                                <th className="px-2 py-1.5 font-medium text-xs uppercase text-muted-foreground text-right w-[140px]">
                                  Amount
                                </th>
                                {!isLocked && (
                                  <th className="w-10 px-1 py-1.5" aria-label="Remove row" />
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {adjustmentRows.map((row) => (
                                <tr
                                  key={row.id}
                                  className="border-b border-border/60 last:border-0"
                                >
                                  <td className="px-2 py-2 align-top">
                                    <Label className="sr-only">Description</Label>
                                    <Input
                                      type="text"
                                      value={row.description}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        setAdjustmentRows((prev) =>
                                          prev.map((r) =>
                                            r.id === row.id ? { ...r, description: v } : r
                                          )
                                        );
                                      }}
                                      placeholder="e.g. Correction, bonus"
                                      readOnly={isLocked}
                                      disabled={isLocked}
                                      className="text-sm"
                                    />
                                  </td>
                                  <td className="px-2 py-2 align-top">
                                    <Label className="sr-only">Amount</Label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={row.amount}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        setAdjustmentRows((prev) =>
                                          prev.map((r) =>
                                            r.id === row.id ? { ...r, amount: v } : r
                                          )
                                        );
                                      }}
                                      placeholder="0.00"
                                      readOnly={isLocked}
                                      disabled={isLocked}
                                      className="text-sm text-right"
                                    />
                                  </td>
                                  {!isLocked && (
                                    <td className="px-1 py-2 align-middle text-center">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 text-destructive"
                                        disabled={adjustmentRows.length <= 1}
                                        onClick={() =>
                                          setAdjustmentRows((prev) =>
                                            prev.filter((r) => r.id !== row.id)
                                          )
                                        }
                                        aria-label="Remove adjustment row"
                                      >
                                        <Icon name="Trash" size={IconSizes.sm} />
                                      </Button>
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {!isLocked && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full sm:w-auto"
                            onClick={() =>
                              setAdjustmentRows((prev) => [
                                ...prev,
                                {
                                  id: `adj-${crypto.randomUUID()}`,
                                  description: "",
                                  amount: "0",
                                },
                              ])
                            }
                          >
                            <Icon name="Plus" size={IconSizes.sm} className="mr-1" />
                            Add adjustment row
                          </Button>
                        )}
                        <Caption className="text-xs text-muted-foreground">
                          Positive adds to net pay; negative deducts from net pay.
                        </Caption>
                        {adjustment !== 0 && (
                          <div className="border-t pt-2 mt-2 w-full">
                            <HStack
                              justify="between"
                              align="center"
                              className="w-full"
                            >
                              <BodySmall className="font-medium">
                                Total adjustments:
                              </BodySmall>
                              <span
                                className={`font-semibold text-sm ${
                                  adjustment >= 0
                                    ? "text-primary"
                                    : "text-destructive"
                                }`}
                              >
                                {formatCurrency(adjustment)}
                              </span>
                            </HStack>
                          </div>
                        )}
                      </VStack>
                    </VStack>
                  </VStack>

                  {/* Loan deductions & weekly subtotal — full width below */}
                  <VStack gap="2" className="w-full">
                    <VStack
                      gap="2"
                      className="w-full rounded-xl border border-border/80 bg-muted/40 p-3"
                    >
                      {(deductions?.sss_salary_loan || 0) > 0 && (
                        <HStack
                          justify="between"
                          align="center"
                          className="w-full"
                        >
                          <BodySmall>SSS Salary Loan:</BodySmall>
                          <span className="font-semibold">
                            {formatCurrency(deductions?.sss_salary_loan || 0)}
                          </span>
                        </HStack>
                      )}
                      {(deductions?.sss_calamity_loan || 0) > 0 && (
                        <HStack
                          justify="between"
                          align="center"
                          className="w-full"
                        >
                          <BodySmall>SSS Calamity Loan:</BodySmall>
                          <span className="font-semibold">
                            {formatCurrency(deductions?.sss_calamity_loan || 0)}
                          </span>
                        </HStack>
                      )}
                      {(deductions?.pagibig_salary_loan || 0) > 0 && (
                        <HStack
                          justify="between"
                          align="center"
                          className="w-full"
                        >
                          <BodySmall>Pag-IBIG Salary Loan:</BodySmall>
                          <span className="font-semibold">
                            {formatCurrency(
                              deductions?.pagibig_salary_loan || 0
                            )}
                          </span>
                        </HStack>
                      )}
                      {(deductions?.pagibig_calamity_loan || 0) > 0 && (
                        <HStack
                          justify="between"
                          align="center"
                          className="w-full"
                        >
                          <BodySmall>Pag-IBIG Calamity Loan:</BodySmall>
                          <span className="font-semibold">
                            {formatCurrency(
                              deductions?.pagibig_calamity_loan || 0
                            )}
                          </span>
                        </HStack>
                      )}
                      {/* Monthly Loans - Auto-loaded from active loans (shows for both cutoffs) */}
                      {activeLoans.length > 0 && (
                        <div className="w-full border-t border-border pt-2">
                          <BodySmall className="font-medium mb-2 block">
                            Monthly Loans:
                          </BodySmall>
                          <VStack gap="3" className="w-full">
                            {activeLoans.map((loan) => {
                              const loanTypeLabel =
                                loan.loan_type === "company"
                                  ? "Company Loan"
                                  : loan.loan_type === "sss_calamity"
                                  ? "SSS Calamity Loan"
                                  : loan.loan_type === "pagibig_calamity"
                                  ? "Pagibig Calamity Loan"
                                  : loan.loan_type === "sss"
                                  ? "SSS Loan"
                                  : loan.loan_type === "pagibig"
                                  ? "Pag-IBIG Loan"
                                  : loan.loan_type === "emergency"
                                  ? "Emergency Loan"
                                  : "Other Loan";

                              const termsPaid =
                                loan.total_terms - loan.remaining_terms;

                              return (
                                <div
                                  key={loan.id}
                                  className="w-full rounded-lg border border-border bg-muted/40 p-2"
                                >
                                  <HStack
                                    justify="between"
                                    align="start"
                                    className="w-full mb-1"
                                  >
                                    <BodySmall className="font-medium text-foreground">
                                      {loanTypeLabel}:
                                    </BodySmall>
                                    <div className="text-right">
                                      <span className="text-sm font-semibold text-destructive">
                                        {formatCurrency(loan.deduction_amount)}
                                      </span>
                                    </div>
                                  </HStack>
                                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                    <div>
                                      <span className="text-muted-foreground/80">
                                        Remaining Balance:
                                      </span>
                                      <span className="ml-1 font-medium">
                                        {formatCurrency(loan.current_balance)}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground/80">
                                        Terms Paid:
                                      </span>
                                      <span className="ml-1 font-medium">
                                        {termsPaid} / {loan.total_terms}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </VStack>
                        </div>
                      )}
                      <div className="border-t pt-1.5 mt-1.5 w-full">
                        <HStack
                          justify="between"
                          align="center"
                          className="w-full"
                        >
                          <span className="font-semibold text-sm">
                            Subtotal:
                          </span>
                          <span className="font-semibold text-sm">
                            {formatCurrency(weeklyDed)}
                          </span>
                        </HStack>
                      </div>
                    </VStack>
                  </VStack>

                  {/* Government Contributions */}
                  <VStack gap="2" align="start">
                    <H4 className="text-sm font-medium text-muted-foreground">
                      Government Contributions
                    </H4>
                    {/* Use grid layout for side-by-side cards - 2 columns on larger screens */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 w-full">
                      {monthlySalary > 0 ? (
                          <>
                            <div className="p-2 border rounded-lg bg-emerald-50 border-emerald-200 col-span-2">
                              <BodySmall className="text-emerald-700 text-xs">
                                Based on monthly salary {formatCurrency(monthlySalary)}: SSS, PhilHealth, and Pag-IBIG are applied on the statutory deduction week only, while other weeks show ₱0.
                                {mtdWorkDaysForStatutory !== null ? (
                                  <>
                                    {" "}Proration preview:{" "}
                                    <strong>{mtdWorkDaysForStatutory}</strong> day
                                    {mtdWorkDaysForStatutory === 1 ? "" : "s"} MTD
                                    (factor ≈ {(statutoryProrationFactorPreview * 100).toFixed(2)}%).
                                  </>
                                ) : null}
                              </BodySmall>
                            </div>
                            <HStack
                              justify="between"
                              align="center"
                              className="rounded-lg border border-border bg-muted/40 p-2.5"
                            >
                              <span className="font-medium text-sm">
                                SSS (Regular)
                              </span>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={weeklyStatutory.sssReg}
                                onChange={(e) =>
                                  setGovContributionOverrides((prev) => ({
                                    ...prev,
                                    sssReg: parseNumberInput(e.target.value),
                                  }))
                                }
                                className="h-9 w-full max-w-[170px] text-right"
                              />
                            </HStack>
                            <HStack
                              justify="between"
                              align="center"
                              className="rounded-lg border border-border bg-muted/40 p-2.5"
                            >
                              <span className="font-medium text-sm">
                                SSS WISP
                              </span>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={weeklyStatutory.sssWisp}
                                onChange={(e) =>
                                  setGovContributionOverrides((prev) => ({
                                    ...prev,
                                    sssWisp: parseNumberInput(e.target.value),
                                  }))
                                }
                                className="h-9 w-full max-w-[170px] text-right"
                              />
                            </HStack>
                            <HStack
                              justify="between"
                              align="center"
                              className="rounded-lg border border-border bg-muted/40 p-2.5"
                            >
                              <span className="font-medium text-sm">
                                PhilHealth
                              </span>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={weeklyStatutory.phil}
                                onChange={(e) =>
                                  setGovContributionOverrides((prev) => ({
                                    ...prev,
                                    phil: parseNumberInput(e.target.value),
                                  }))
                                }
                                className="h-9 w-full max-w-[170px] text-right"
                              />
                            </HStack>
                            <HStack
                              justify="between"
                              align="center"
                              className="rounded-lg border border-border bg-muted/40 p-2.5"
                            >
                              <span className="font-medium text-sm">
                                Pag-IBIG
                              </span>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={weeklyStatutory.pagibig}
                                onChange={(e) =>
                                  setGovContributionOverrides((prev) => ({
                                    ...prev,
                                    pagibig: parseNumberInput(e.target.value),
                                  }))
                                }
                                className="h-9 w-full max-w-[170px] text-right"
                              />
                            </HStack>
                          </>
                        ) : null}

                      {(() => {
                        const adj = adjustment;
                        const periodGross = earningsBaseForPeriod + adj;
                        if (periodGross <= 0 && monthlySalary <= 0) return null;

                        const nSemiWeeks = countWeeklyPaysInSemiMonth(periodEnd);
                        const grossOther =
                          semiMonthlyRollupForTax?.grossFromSavedOtherWeeksInSemiMonth ??
                          0;
                        const actualSemiGross =
                          semiMonthlyRollupForTax != null
                            ? Math.round((grossOther + periodGross) * 100) / 100
                            : Math.round(periodGross * nSemiWeeks * 100) / 100;

                        const sss = calculateSSS(monthlySalary);
                        const philhealth = calculatePhilHealth(monthlySalary);
                        const pagibig = calculatePagIBIG(monthlySalary);
                        const monthlyContributionsFull =
                          sss.employeeShare +
                          philhealth.employeeShare +
                          pagibig.employeeShare;
                        const monthlyContributionsUsed =
                          applyStatutoryProration(
                            Math.round(monthlyContributionsFull * 100) / 100,
                            statutoryProrationFactorPreview
                          );
                        const halfMonthlyContrib =
                          Math.round((monthlyContributionsUsed / 2) * 100) / 100;
                        const semiTaxableIncome =
                          actualSemiGross > 0
                            ? Math.max(0, actualSemiGross - halfMonthlyContrib)
                            : 0;
                        const monthlyEquivTaxable = semiTaxableIncome * 2;
                        const taxBreakdown =
                          semiTaxableIncome > 0
                            ? getWithholdingTaxBreakdown(monthlyEquivTaxable)
                            : null;
                        const semiTaxDue = calculateSemiMonthlyWithholdingTax(
                          semiTaxableIncome
                        );
                        const taxPrior =
                          semiMonthlyRollupForTax?.taxWithheldPriorExcludingCurrentInSemiMonth ??
                          0;
                        const semiHalfLabel =
                          semiMonthlyPeriodIndex(periodEnd) === 1
                            ? "1st (days 1–15)"
                            : "2nd (days 16–end)";

                        return (
                          <VStack gap="1" className="rounded-lg border border-border bg-muted/40 p-2.5">
                            <HStack justify="between" align="center" className="w-full">
                              <span className="font-medium text-sm">Tax</span>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={tax}
                                onChange={(e) =>
                                  setGovContributionOverrides((prev) => ({
                                    ...prev,
                                    tax: parseNumberInput(e.target.value),
                                  }))
                                }
                                className="h-9 w-full max-w-[170px] text-right"
                              />
                            </HStack>
                          </VStack>
                        );
                      })()}
                    </div>
                  </VStack>
                </VStack>
              </CardSection>
            </div>
          )}

          {/* Payslip Summary - Below Both Sections (uses saved values when payslip already saved) */}
          {selectedEmployee && attendance && (
            <CardSection title="Payslip Summary">
              {isSavedPayslip && (
                <>
                  <div className="mb-2 rounded border border-primary/25 bg-primary/10 px-2 py-1.5 text-xs text-primary">
                    {isLocked
                      ? "This payslip has been saved. Values below are from the database. Adjustments cannot be edited."
                      : "This payslip has been saved. You can still edit it until the payroll run is finalized."}
                  </div>
                  {savedPayslip && (() => {
                    const earnings = earningsBaseForPeriod;
                    const savedAdj = savedPayslip.adjustment_amount;
                    const impliedDiff = Math.round((savedPayslip.gross_pay - earnings - savedAdj) * 100) / 100;
                    const showImplied = Math.abs(impliedDiff) > 0.01;
                    return (
                      <div className="mb-2 space-y-1 rounded border border-border/80 bg-muted/40 px-2 py-1.5 text-xs text-foreground">
                        <div className="font-medium text-foreground">Why is Gross Pay {formatCurrency(displayGrossPay)}?</div>
                        <div className="flex flex-col gap-0.5">
                          <div className="flex justify-between">
                            <span>Earnings (this period):</span>
                            <span>{formatCurrency(earnings)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Adjustment (saved in DB):</span>
                            <span className={savedAdj >= 0 ? "text-primary" : "text-destructive"}>
                              {savedAdj >= 0 ? "+" : ""}{formatCurrency(savedAdj)}
                            </span>
                          </div>
                          {showImplied && (
                            <div className="flex justify-between text-primary/80">
                              <span>Difference (included in saved gross):</span>
                              <span>{impliedDiff >= 0 ? "+" : ""}{formatCurrency(impliedDiff)}</span>
                            </div>
                          )}
                          <div className="flex justify-between border-t border-border pt-1 font-medium">
                            <span>Gross pay (saved):</span>
                            <span>{formatCurrency(earnings + savedAdj + (showImplied ? impliedDiff : 0))}</span>
                          </div>
                        </div>
                        {showImplied && (
                          <div className="mt-1 text-[10px] text-primary/80">
                            {impliedDiff > 0
                              ? `The saved gross is ${formatCurrency(impliedDiff)} more than Earnings + Adjustment. This may have been saved as part of gross when the payslip was created.`
                              : `The saved gross is ${formatCurrency(Math.abs(impliedDiff))} less than Earnings + Adjustment (${formatCurrency(earnings)}). If the second cutoff gross should match current earnings, the saved value may need to be corrected.`}
                          </div>
                        )}
                        {(() => {
                          const lines = savedPayslip.deductions_breakdown
                            ?.adjustment_lines;
                          if (Array.isArray(lines) && lines.length > 0) {
                            return (
                              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
                                {lines.map((line: unknown, i: number) => {
                                  const L = line as {
                                    description?: string;
                                    amount?: number;
                                  };
                                  const amt = Number(L?.amount) || 0;
                                  return (
                                    <li key={i}>
                                      {(L?.description || "").trim() ||
                                        "Adjustment"}
                                      : {formatCurrency(amt)}
                                    </li>
                                  );
                                })}
                              </ul>
                            );
                          }
                          if (savedPayslip.adjustment_reason) {
                            return (
                              <div className="mt-1 text-muted-foreground">
                                Reason: {savedPayslip.adjustment_reason}
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    );
                  })()}
                </>
              )}
              <VStack gap="2">
                <HStack
                  justify="between"
                  align="center"
                  className="w-full rounded-lg bg-muted/40 p-2 text-sm"
                >
                  <span className="font-medium">Gross Pay:</span>
                  <span className="font-semibold">
                    {formatCurrency(displayGrossPay)}
                  </span>
                </HStack>
                <HStack
                  justify="between"
                  align="center"
                  className="w-full rounded-lg bg-muted/40 p-2 text-sm text-destructive"
                >
                  <span className="font-medium">Total Deductions:</span>
                  <span className="font-semibold">
                    ({formatCurrency(displayTotalDed)})
                  </span>
                </HStack>
                {adjustment !== 0 && (
                  <HStack
                    justify="between"
                    align="center"
                    className={`w-full rounded-lg bg-muted/40 p-2 text-sm ${
                      adjustment >= 0
                        ? "text-primary"
                        : "text-destructive"
                    }`}
                  >
                    <span className="font-medium">Adjustments:</span>
                    <span className="font-semibold">
                      {formatCurrency(adjustment)}
                    </span>
                  </HStack>
                )}
                <div className="border-t-2 pt-2 w-full">
                  <HStack
                    justify="between"
                    align="center"
                    className="text-lg w-full"
                  >
                    <span className="font-bold">NET PAY:</span>
                    <span className="font-bold text-primary-700">
                      {formatCurrency(displayNetPay)}
                    </span>
                  </HStack>
                </div>
              </VStack>

              <HStack justify="end" gap="2" className="mt-3">
                <Button
                  onClick={() => setShowPrintModal(true)}
                  variant="secondary"
                >
                  <Icon name="Eye" size={IconSizes.sm} />
                  Preview & Print Payslip
                </Button>
                {canAccessSalaryInfo && (
                  isSavedPayslip ? (
                    <HStack gap="2">
                      {payrollRunId && (
                        <Button
                          variant="outline"
                          onClick={() =>
                            router.push(
                              `/payroll?run_id=${encodeURIComponent(payrollRunId)}`
                            )
                          }
                        >
                          <Icon name="ArrowLeft" size={IconSizes.sm} />
                          Back to Payroll Run
                        </Button>
                      )}
                      <Button disabled className="opacity-80" variant="secondary">
                        <Icon name="CheckCircle" size={IconSizes.sm} />
                        Payslip saved
                      </Button>
                      {((canUpdatePayslip && !isLocked) ||
                        (payrollRunId && !isRunFinalized)) && (
                        <Button
                          onClick={() => setShowUpdatePayslipConfirm(true)}
                          disabled={generating}
                          variant="default"
                        >
                          <Icon name="FloppyDisk" size={IconSizes.sm} />
                          Update payslip
                        </Button>
                      )}
                    </HStack>
                  ) : (
                    <Button onClick={() => setShowSavePayslipConfirm(true)} disabled={generating}>
                      <Icon name="FileText" size={IconSizes.sm} />
                      Save Payslip to Database
                    </Button>
                  )
                )}
              </HStack>
            </CardSection>
          )}

          {selectedEmployee && !attendance && (
            <Card>
              <CardContent className="text-center py-6">
                <VStack gap="2" align="center">
                  <Icon
                    name="FileText"
                    size={IconSizes.lg}
                    className="text-muted-foreground"
                  />
                  <H3 className="text-lg">No Attendance Record Found</H3>
                  <BodySmall className="text-xs">
                    The system attempted to generate attendance data from time
                    clock entries, but no data was found for this period.
                  </BodySmall>
                  <ul className="list-disc list-inside text-left text-xs text-muted-foreground space-y-0.5 mt-1">
                    <li>No time clock entries exist for this period</li>
                    <li>Time entries are incomplete (missing clock out)</li>
                    <li>Time entries need approval before they can be used</li>
                  </ul>
                  <BodySmall className="mt-2 text-xs">
                    Please check the Time Entries page to verify time attendance
                    records.
                  </BodySmall>
                  <HStack gap="2" justify="center" className="mt-2">
                    <Button
                      variant="secondary"
                      onClick={() => (window.location.href = "/time-entries")}
                    >
                      View Time Entries
                    </Button>
                  </HStack>
                </VStack>
              </CardContent>
            </Card>
          )}

          {/* Print Modal */}
          <Dialog open={showPrintModal} onOpenChange={setShowPrintModal}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              {selectedEmployee && attendance && (
                <>
                  <DialogHeader>
                    <DialogTitle>Payslip Preview</DialogTitle>
                  </DialogHeader>
                  <VStack gap="4">
                    <PayslipPrint
                      employee={{
                        employee_id: selectedEmployee.employee_id,
                        full_name: selectedEmployee.full_name,
                        rate_per_day:
                          selectedEmployee.per_day ||
                          selectedEmployee.rate_per_day ||
                          0,
                        rate_per_hour:
                          selectedEmployee.rate_per_hour ||
                          (selectedEmployee.per_day
                            ? selectedEmployee.per_day / 8
                            : 0),
                        position: selectedEmployee.position || null,
                        assigned_hotel: selectedEmployee.assigned_hotel || null,
                        employee_type: selectedEmployee.employee_type ?? null,
                        job_level: selectedEmployee.job_level ?? null,
                      }}
                      weekStart={periodStart}
                      weekEnd={periodEnd}
                      attendance={attendance}
                      earnings={calculateEarningsBreakdown()}
                      deductions={{
                        vale: deductions?.vale_amount || 0,
                        sssLoan: deductions?.sss_salary_loan || 0,
                        sssCalamityLoan: deductions?.sss_calamity_loan || 0,
                        pagibigLoan: deductions?.pagibig_salary_loan || 0,
                        pagibigCalamityLoan:
                          deductions?.pagibig_calamity_loan || 0,
                        monthlyLoan: isFirstCutoff()
                          ? (monthlyLoans.sssLoan || 0) +
                            (monthlyLoans.pagibigLoan || 0) +
                            (monthlyLoans.companyLoan || 0) +
                            (monthlyLoans.emergencyLoan || 0) +
                            (monthlyLoans.otherLoan || 0)
                          : 0,
                        monthlyLoans: isFirstCutoff()
                          ? {
                              sssLoan: monthlyLoans.sssLoan || 0,
                              pagibigLoan: monthlyLoans.pagibigLoan || 0,
                              companyLoan: monthlyLoans.companyLoan || 0,
                              emergencyLoan: monthlyLoans.emergencyLoan || 0,
                              otherLoan: monthlyLoans.otherLoan || 0,
                            }
                          : undefined,
                        sssContribution: weeklyStatutory.sssReg,
                        sssWisp: weeklyStatutory.sssWisp,
                        philhealthContribution: weeklyStatutory.phil,
                        pagibigContribution: weeklyStatutory.pagibig,
                        withholdingTax: tax,
                        totalDeductions: displayTotalDed,
                      }}
                      adjustment={adjustment}
                      adjustmentReason={adjustmentReasonForPrint}
                      netPay={displayNetPay}
                      workingDays={workingDays}
                      absentDays={0}
                      preparedBy={preparedBy}
                    />
                    <DialogFooter className="print:hidden">
                      <Button
                        variant="secondary"
                        onClick={() => setShowPrintModal(false)}
                      >
                        Close
                      </Button>
                      <Button onClick={handlePrintPayslip}>
                        <Icon name="Printer" size={IconSizes.sm} />
                        Print Payslip
                      </Button>
                    </DialogFooter>
                  </VStack>
                </>
              )}
            </DialogContent>
          </Dialog>

          {/* Save payslip confirmation */}
          <AlertDialog open={showSavePayslipConfirm} onOpenChange={setShowSavePayslipConfirm}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Save payslip?</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to save the payslip for{" "}
                  <strong>{selectedEmployee?.full_name ?? "this employee"}</strong> for the cut-off period{" "}
                  <strong>{periodStart ? format(periodStart, "MMM d") : ""} – {periodEnd ? format(periodEnd, "MMM d, yyyy") : ""}</strong>?
                  {payrollRunId
                    ? "You can continue editing until the payroll run is finalized."
                    : "Once saved, adjustments cannot be edited for this period."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={generating}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    setShowSavePayslipConfirm(false);
                    generatePayslip();
                  }}
                  disabled={generating}
                >
                  {generating ? "Saving…" : "Yes, save payslip"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Update payslip confirmation (re-save with current calculation) */}
          <AlertDialog open={showUpdatePayslipConfirm} onOpenChange={setShowUpdatePayslipConfirm}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Update saved payslip?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will overwrite the saved payslip for{" "}
                  <strong>{selectedEmployee?.full_name ?? "this employee"}</strong> for{" "}
                  <strong>{periodStart ? format(periodStart, "MMM d") : ""} – {periodEnd ? format(periodEnd, "MMM d, yyyy") : ""}</strong> with the
                  current calculation (earnings, deductions, and saved adjustment). Use this to correct the gross pay or other values. Continue?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={generating}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    setShowUpdatePayslipConfirm(false);
                    generatePayslip();
                  }}
                  disabled={generating}
                >
                  {generating ? "Updating…" : "Yes, update payslip"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </VStack>
      </DashboardLayout>
    </>
  );
}