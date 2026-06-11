"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PayslipPrint } from "@/components/PayslipPrint";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  buildPayrollRunFormFromWeekStart,
  formatWeeklyPeriod,
  getDefaultPayrollRunWeek,
  getNextWeeklyPeriod,
  getPreviousWeeklyPeriod,
  getWeeklyCutoffEndDate,
  getWeeklyPeriodStart,
} from "@/utils/weekly";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { H1, BodySmall, Caption } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { CardSection } from "@/components/ui/card-section";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { DbDesktopBlock, DbMobileBlock } from "@/components/dashboard/DashboardViewport";
import { DashboardMobileField } from "@/components/dashboard/DashboardMobileField";
import { dbHeaderActions, dbPageWrapper, dbTableShell } from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { generatePayrollRunTemplatePDF } from "@/utils/payroll-run-pdf";
import type { PayrollEntrySummary } from "@/lib/ph-payroll/payroll-entry-validation";

interface PayrollRun {
  id: string;
  company_id: string | null;
  cutoff_start: string;
  cutoff_end: string;
  pay_date: string | null;
  status: string;
  created_at: string;
  payslip_count?: number;
  total_gross?: number;
  total_net?: number;
  selected_employee_ids?: string[] | null;
}

interface Employee {
  id: string;
  company_id_no: string;
  employee_code: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  bank_account_name?: string | null;
  bank_account_number?: string | null;
  employment_status: string;
  salary_basis: string;
  base_rate: number;
  departments: { name: string } | null;
  positions: { name: string } | null;
}

interface RunSelectableEmployee {
  id: string;
  company_id_no: string;
  employee_code: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  employment_status: string;
}

interface Payslip {
  id: string;
  employee_id: string;
  period_start?: string;
  period_end?: string;
  gross_pay: number;
  total_deductions: number;
  net_pay: number;
  earnings_breakdown: any;
  deductions_breakdown: any;
  sss_amount?: number;
  philhealth_amount?: number;
  pagibig_amount?: number;
  adjustment_amount?: number;
  adjustment_reason?: string | null;
  created_at?: string;
  updated_at?: string;
  employee?: Employee;
}

const statusStyles: Record<string, string> = {
  draft: "border-border bg-muted/70 text-foreground",
  processing: "border-primary/25 bg-primary/10 text-primary",
  finalized: "border-primary/25 bg-primary/10 text-primary",
  cancelled: "border-destructive/30 bg-destructive/10 text-destructive",
};

export default function PayrollPage() {
  const supabase = createClient();
  const { isManagement, isHR, isAdmin, canAccessSalaryInfo } = useUserRole();
  const searchParams = useSearchParams();
  const runIdFromQuery = searchParams.get("run_id");

  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewRunDialog, setShowNewRunDialog] = useState(false);
  const [newRunForm, setNewRunForm] = useState(() =>
    buildPayrollRunFormFromWeekStart(getDefaultPayrollRunWeek().weekStart)
  );
  const [newRunWeekStart, setNewRunWeekStart] = useState<Date>(() =>
    getDefaultPayrollRunWeek().weekStart
  );
  const [creating, setCreating] = useState(false);
  const [activeEmployeesForRun, setActiveEmployeesForRun] = useState<RunSelectableEmployee[]>([]);
  const [selectedEmployeeIdsForRun, setSelectedEmployeeIdsForRun] = useState<string[]>([]);
  const [employeeScopeQuery, setEmployeeScopeQuery] = useState("");
  const [copyFromRunId, setCopyFromRunId] = useState("");
  const [loadingRunScope, setLoadingRunScope] = useState(false);

  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loadingPayslips, setLoadingPayslips] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [payrollValidation, setPayrollValidation] =
    useState<PayrollEntrySummary | null>(null);
  const [loadingValidation, setLoadingValidation] = useState(false);
  const [printPayslip, setPrintPayslip] = useState<Payslip | null>(null);
  const [printPayload, setPrintPayload] = useState<{
    employee: any;
    attendance: { attendance_data: any[]; gross_pay: number };
    gross_pay: number;
    net_pay: number;
    adjustment_amount: number;
    adjustment_reason: string | null;
    deductions: any;
  } | null>(null);

  function runScopeCount(run: PayrollRun) {
    if (Array.isArray(run.selected_employee_ids) && run.selected_employee_ids.length > 0) {
      return run.selected_employee_ids.length;
    }
    if (activeEmployeesForRun.length > 0) return activeEmployeesForRun.length;
    return null;
  }

  function getPayslipAttendanceData(ps: Payslip) {
    const breakdown = ps.earnings_breakdown;
    if (Array.isArray(breakdown)) return breakdown;
    if (Array.isArray(breakdown?.attendance_data)) return breakdown.attendance_data;
    return [];
  }

  function triggerPrintFromContainer(container: HTMLElement, title: string) {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Please allow popups to download payslip");
      return;
    }
    const payslipHTML = container.outerHTML;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title}</title>
          <style>
            html, body { margin: 0; padding: 0; background: white; }
            .payslip-container { width: 8.5in; padding: 0.5in; margin: 0 auto; }
            @media print {
              @page { size: letter portrait; margin: 0.5in; }
              .payslip-container { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          ${payslipHTML}
          <script>
            window.onload = function() { setTimeout(function() { window.print(); }, 250); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  async function handleDownloadPayslip(ps: Payslip) {
    try {
      const res = await fetch(
        `/api/payroll-runs/payslip-print?payslip_id=${encodeURIComponent(ps.id)}`
      );
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || "Failed to load payslip print data");
      }
      setPrintPayload(payload);
      setPrintPayslip(ps);
      window.setTimeout(() => {
        const el = document.getElementById("payslip-print-content");
        if (!el) {
          toast.error("Payslip print layout is not ready.");
          return;
        }
        const label = ps.employee?.company_id_no || ps.employee_id || "Employee";
        triggerPrintFromContainer(el, `Payslip - ${label}`);
      }, 50);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to print payslip";
      toast.error(message);
    }
  }

  useEffect(() => {
    fetchPayrollRuns();
    loadActiveEmployeesForRun();
  }, []);

  // If navigated back from payslip editing, auto-open the payroll run.
  useEffect(() => {
    if (!runIdFromQuery) return;
    if (selectedRun?.id === runIdFromQuery) return;
    const match = payrollRuns.find((r) => r.id === runIdFromQuery);
    if (match) {
      openRunDetail(match);
    }
  }, [runIdFromQuery, payrollRuns, selectedRun?.id]);

  async function loadActiveEmployeesForRun() {
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("id, company_id_no, employee_code, first_name, middle_name, last_name, employment_status")
        .eq("employment_status", "active")
        .order("last_name", { ascending: true });
      if (error) throw error;
      setActiveEmployeesForRun((data || []) as RunSelectableEmployee[]);
    } catch (error: any) {
      toast.error(error.message || "Failed to load active employees");
      setActiveEmployeesForRun([]);
    }
  }

  function getRunEmployeeName(emp: RunSelectableEmployee) {
    const middleInitial = emp.middle_name?.trim()
      ? ` ${emp.middle_name.trim().charAt(0)}.`
      : "";
    return `${emp.last_name}, ${emp.first_name}${middleInitial}`;
  }

  function matchesRunEmployee(emp: RunSelectableEmployee, query: string) {
    const q = query.toLowerCase().trim();
    if (!q) return false;
    const name = getRunEmployeeName(emp).toLowerCase();
    const code = String(emp.employee_code || emp.company_id_no || "").toLowerCase();
    return (
      name.includes(q) ||
      emp.first_name.toLowerCase().includes(q) ||
      emp.last_name.toLowerCase().includes(q) ||
      code.includes(q)
    );
  }

  const filteredEmployeesForRun = useMemo(() => {
    const q = employeeScopeQuery.trim();
    if (!q) return [];
    return activeEmployeesForRun.filter((emp) => matchesRunEmployee(emp, q));
  }, [activeEmployeesForRun, employeeScopeQuery]);

  const selectedEmployeesForRun = useMemo(
    () =>
      selectedEmployeeIdsForRun
        .map((id) => activeEmployeesForRun.find((emp) => emp.id === id))
        .filter((emp): emp is RunSelectableEmployee => Boolean(emp)),
    [activeEmployeesForRun, selectedEmployeeIdsForRun]
  );

  const previousRunsForScope = useMemo(
    () => payrollRuns.filter((run) => String(run.status) !== "cancelled"),
    [payrollRuns]
  );

  const copyFromRun = useMemo(
    () => previousRunsForScope.find((run) => run.id === copyFromRunId) ?? null,
    [copyFromRunId, previousRunsForScope]
  );

  async function loadEmployeesFromPayrollRun(
    runId: string,
    options?: { silent?: boolean }
  ) {
    const run = payrollRuns.find((item) => item.id === runId);
    if (!run) return 0;

    setLoadingRunScope(true);
    try {
      let ids: string[] = [];
      if (Array.isArray(run.selected_employee_ids) && run.selected_employee_ids.length > 0) {
        ids = run.selected_employee_ids.map((id) => String(id));
      } else {
        const { data: slips, error } = await supabase
          .from("payslips")
          .select("employee_id")
          .eq("payroll_run_id", runId);
        if (error) throw error;
        if (slips && slips.length > 0) {
          ids = [...new Set(slips.map((slip) => String(slip.employee_id)))];
        } else {
          ids = activeEmployeesForRun.map((emp) => emp.id);
        }
      }

      const activeIds = new Set(activeEmployeesForRun.map((emp) => emp.id));
      const validIds = ids.filter((id) => activeIds.has(id));

      setSelectedEmployeeIdsForRun(validIds);

      if (!options?.silent) {
        toast.success(
          `Loaded ${validIds.length} employee(s) from ${format(
            new Date(run.cutoff_start),
            "MMM d"
          )} – ${format(new Date(run.cutoff_end), "MMM d, yyyy")}.`
        );
      }

      return validIds.length;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to load employees from payroll run";
      toast.error(message);
      return 0;
    } finally {
      setLoadingRunScope(false);
    }
  }

  async function initNewRunEmployeeScope() {
    const latest = previousRunsForScope[0];
    if (!latest) {
      setCopyFromRunId("");
      setSelectedEmployeeIdsForRun([]);
      return;
    }
    setCopyFromRunId(latest.id);
    await loadEmployeesFromPayrollRun(latest.id, { silent: true });
  }

  function applyPayrollWeekStart(weekStart: Date) {
    const normalized = new Date(
      weekStart.getFullYear(),
      weekStart.getMonth(),
      weekStart.getDate()
    );
    setNewRunWeekStart(normalized);
    setNewRunForm(buildPayrollRunFormFromWeekStart(normalized));
  }

  function openNewRunDialog() {
    setShowNewRunDialog(true);
  }

  function shiftPayrollWeek(direction: -1 | 1) {
    const nextStart =
      direction === -1
        ? getPreviousWeeklyPeriod(newRunWeekStart)
        : getNextWeeklyPeriod(newRunWeekStart);
    applyPayrollWeekStart(nextStart);
  }

  async function fetchPayrollRuns() {
    setLoading(true);
    try {
      const { data: runs, error } = await supabase
        .from("payroll_runs")
        .select("*")
        .order("cutoff_start", { ascending: false });
      if (error) throw error;

      const runsWithCounts = await Promise.all(
        (runs || [])
          .filter((run: PayrollRun) => String(run.status) !== "cancelled")
          .map(async (run: PayrollRun) => {
          const { data: slips } = await supabase
            .from("payslips")
            .select("gross_pay, net_pay")
            .eq("payroll_run_id", run.id);
          return {
            ...run,
            payslip_count: slips?.length || 0,
            total_gross: slips?.reduce((s, p) => s + Number(p.gross_pay), 0) || 0,
            total_net: slips?.reduce((s, p) => s + Number(p.net_pay), 0) || 0,
          };
        })
      );

      setPayrollRuns(runsWithCounts);
    } catch (error: any) {
      toast.error(error.message || "Failed to load payroll runs");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateRun(e: React.FormEvent) {
    e.preventDefault();
    if (!newRunForm.cutoff_start || !newRunForm.cutoff_end) {
      toast.error("Cutoff start and end dates are required.");
      return;
    }
    setCreating(true);
    try {
      const { data: companyData } = await supabase.from("companies").select("id").limit(1).single();
      const payloadWithScope = {
        company_id: companyData?.id,
        cutoff_start: newRunForm.cutoff_start,
        cutoff_end: newRunForm.cutoff_end,
        pay_date: newRunForm.pay_date || null,
        status: "draft",
        selected_employee_ids:
          selectedEmployeeIdsForRun.length > 0 ? selectedEmployeeIdsForRun : null,
      } as never;

      let { data, error } = await supabase
        .from("payroll_runs")
        .insert([payloadWithScope])
        .select()
        .single();

      // Backward-compatible fallback for environments where migration is not yet applied.
      if (error && String(error.message || "").includes("selected_employee_ids")) {
        const payloadWithoutScope = {
          company_id: companyData?.id,
          cutoff_start: newRunForm.cutoff_start,
          cutoff_end: newRunForm.cutoff_end,
          pay_date: newRunForm.pay_date || null,
          status: "draft",
        } as never;
        const retry = await supabase
          .from("payroll_runs")
          .insert([payloadWithoutScope])
          .select()
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error) throw error;
      toast.success("Payroll run created.");
      setShowNewRunDialog(false);
      setNewRunForm({ cutoff_start: "", cutoff_end: "", pay_date: "" });
      setSelectedEmployeeIdsForRun([]);
      setEmployeeScopeQuery("");
      fetchPayrollRuns();
    } catch (error: any) {
      toast.error(error.message || "Failed to create payroll run");
    } finally {
      setCreating(false);
    }
  }

  async function loadPayrollValidation(run: PayrollRun) {
    setLoadingValidation(true);
    try {
      const res = await fetch(
        `/api/payroll-runs/validate?payroll_run_id=${run.id}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load validation");
      setPayrollValidation(json as PayrollEntrySummary);
    } catch {
      setPayrollValidation(null);
    } finally {
      setLoadingValidation(false);
    }
  }

  async function openRunDetail(run: PayrollRun) {
    setSelectedRun(run);
    setLoadingPayslips(true);
    void loadPayrollValidation(run);
    try {
      const { data, error } = await supabase
        .from("payslips")
        .select("*, employees:employee_id ( id, company_id_no, employee_code, first_name, middle_name, last_name, bank_account_name, bank_account_number, salary_basis, base_rate, departments:department_id ( name ), positions:position_id ( name ) )")
        .eq("payroll_run_id", run.id)
        .order("created_at");
      if (error) throw error;
      const mapped = (data || []).map((p: any) => ({ ...p, employee: p.employees }));
      setPayslips(mapped);
    } catch (error: any) {
      toast.error(error.message || "Failed to load payslips");
    } finally {
      setLoadingPayslips(false);
    }
  }

  async function generatePayslips(options?: { skipWarningsConfirm?: boolean }) {
    if (!selectedRun) return;

    if (payrollValidation && payrollValidation.blocked > 0) {
      toast.error(
        `${payrollValidation.blocked} employee(s) blocked. Fix issues or export blocked list.`
      );
      return;
    }

    if (
      payrollValidation &&
      payrollValidation.warning > 0 &&
      !options?.skipWarningsConfirm
    ) {
      const ok = window.confirm(
        `${payrollValidation.warning} employee(s) have warnings (pending approvals, absences, etc.). Continue generating?`
      );
      if (!ok) return;
    }

    setProcessing(true);
    setPayslips([]);
    try {
      const res = await fetch("/api/payroll-runs/generate-payslips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payroll_run_id: selectedRun.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Failed to generate payslips");
      }
      console.log("generate-payslips response:", json);

      await supabase
        .from("payroll_runs")
        .update({ status: "processing" } as never)
        .eq("id", selectedRun.id);

      const skipped = Array.isArray(json?.skipped) ? json.skipped : [];

      toast.success(
        `Generated ${json?.generated ?? 0} draft payslip(s). Skipped ${skipped.length}.${json?.generator_version ? ` [${json.generator_version}]` : ""}`
      );

      openRunDetail({ ...selectedRun, status: "processing" });
      void loadPayrollValidation({ ...selectedRun, status: "processing" });
      fetchPayrollRuns();
    } catch (error: any) {
      toast.error(error.message || "Failed to generate payslips");
    } finally {
      setProcessing(false);
    }
  }

  async function finalizeRun() {
    if (!selectedRun) return;
    try {
      const { error } = await supabase.from("payroll_runs").update({ status: "finalized" } as never).eq("id", selectedRun.id);
      if (error) throw error;
      toast.success("Payroll run finalized.");
      setSelectedRun({ ...selectedRun, status: "finalized" });
      fetchPayrollRuns();
    } catch (error: any) {
      toast.error(error.message || "Failed to finalize");
    }
  }

  async function cancelRun() {
    if (!selectedRun) return;
    try {
      const { error } = await supabase.from("payroll_runs").update({ status: "cancelled" } as never).eq("id", selectedRun.id);
      if (error) throw error;
      toast.success("Payroll run cancelled.");
      setSelectedRun({ ...selectedRun, status: "cancelled" });
      fetchPayrollRuns();
    } catch (error: any) {
      toast.error(error.message || "Failed to cancel");
    }
  }

  function empName(emp?: Employee) {
    if (!emp) return "Unknown";
    return [emp.first_name, emp.last_name].filter(Boolean).join(" ");
  }

  function exportBankPayrollFile() {
    if (!selectedRun) return;
    if (selectedRun.status !== "finalized") {
      toast.error("Finalize the payroll run before exporting bank details.");
      return;
    }
    if (payslips.length === 0) {
      toast.error("No payslips found for this run.");
      return;
    }

    const rows = payslips.map((ps) => {
      const accountNumber = String(ps.employee?.bank_account_number || "").trim();
      const preferredName = String(ps.employee?.bank_account_name || "").trim();
      const fallbackName = empName(ps.employee);
      const name = preferredName || fallbackName;
      const amount = Number(ps.net_pay || 0);
      return { accountNumber, amount, name };
    });

    const missingAccounts = rows.filter((r) => !r.accountNumber).length;
    const header = ["ACCOUNT #", "AMOUNT", "NAME"];
    const csvLines = [
      header.join(","),
      ...rows.map((r) =>
        [
          `"${r.accountNumber.replace(/"/g, '""')}"`,
          r.amount.toFixed(2),
          `"${r.name.replace(/"/g, '""')}"`,
        ].join(",")
      ),
    ];

    const cutoffLabel = `${selectedRun.cutoff_start}_to_${selectedRun.cutoff_end}`;
    const fileName = `bank_payroll_${cutoffLabel}.csv`;
    const csv = `\uFEFF${csvLines.join("\r\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (missingAccounts > 0) {
      toast.warning(
        `Exported with ${missingAccounts} employee(s) missing bank account number.`
      );
    } else {
      toast.success("Bank payroll file exported.");
    }
  }

  async function exportPayrollExcel() {
    if (!selectedRun) return;
    if (selectedRun.status !== "finalized") {
      toast.error("Finalize the payroll run before exporting payroll excel.");
      return;
    }
    try {
      const res = await fetch("/api/payroll-runs/export-payroll-excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payroll_run_id: selectedRun.id }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || "Failed to export payroll excel");
      }
      const blob = await res.blob();
      const cutoffLabel = `${selectedRun.cutoff_start}_to_${selectedRun.cutoff_end}`;
      const fileName = `payroll_${cutoffLabel}.xlsx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Payroll excel exported.");
    } catch (error: any) {
      toast.error(error.message || "Failed to export payroll excel");
    }
  }

  async function exportPayrollPdf() {
    if (!selectedRun) return;
    if (selectedRun.status !== "finalized") {
      toast.error("Finalize the payroll run before exporting payroll pdf.");
      return;
    }

    try {
      const res = await fetch("/api/payroll-runs/export-payroll-table", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payroll_run_id: selectedRun.id }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || "Failed to prepare payroll pdf data");
      }
      const table = json?.table;
      if (!table) throw new Error("Missing payroll table in response");

      const doc = generatePayrollRunTemplatePDF({
        title: table.title,
        subtitle: table.subtitle,
        columns: table.columns,
        headerRows: table.headerRows,
        dataRows: table.dataRows,
        colorGroups: table.colorGroups,
      });
      const fileName = `payroll_${selectedRun.cutoff_start}_to_${selectedRun.cutoff_end}.pdf`;
      doc.save(fileName);
      toast.success("Payroll PDF exported.");
    } catch (error: any) {
      toast.error(error.message || "Failed to export payroll pdf");
    }
  }

  if (selectedRun) {
    return (
      <DashboardLayout>
        <div className={cn("mx-auto w-full max-w-6xl", dbPageWrapper)}>
          <HStack justify="between" align="start" className="w-full flex-col gap-4 sm:flex-row">
            <VStack gap="1" align="start">
              <Button variant="ghost" size="sm" onClick={() => setSelectedRun(null)} className="mb-1">
                <Icon name="ArrowLeft" size={IconSizes.sm} className="mr-2" />
                Back to Payroll Runs
              </Button>
              <H1>
                Payroll: {format(new Date(selectedRun.cutoff_start), "MMM d")} – {format(new Date(selectedRun.cutoff_end), "MMM d, yyyy")}
              </H1>
              <HStack gap="2" align="center" className="flex-wrap">
                <Badge variant="outline" className={`capitalize ${statusStyles[selectedRun.status] || ""}`}>
                  {selectedRun.status}
                </Badge>
                {selectedRun.pay_date && <Caption>Pay Date: {format(new Date(selectedRun.pay_date), "MMM d, yyyy")}</Caption>}
                <Caption>
                  Scope:{" "}
                  {selectedRun.selected_employee_ids?.length
                    ? `${selectedRun.selected_employee_ids.length} selected employee(s)`
                    : "All active employees"}
                </Caption>
              </HStack>
            </VStack>
            <HStack gap="2" className="w-full flex-wrap sm:ml-auto sm:w-auto sm:justify-end">
              {selectedRun.status === "draft" && (
                <>
                  <Button onClick={() => generatePayslips()} disabled={processing}>
                  <Icon name="ArrowsClockwise" size={IconSizes.sm} className={processing ? "animate-spin mr-2" : "mr-2"} />
                  {processing ? "Generating..." : "Generate Payslips"}
                </Button>
                </>
              )}
              {selectedRun.status === "processing" && (
                <>
                  <Button onClick={() => generatePayslips()} variant="outline" disabled={processing}>
                    <Icon name="ArrowsClockwise" size={IconSizes.sm} className="mr-2" />
                    Regenerate
                  </Button>
                  <Button onClick={finalizeRun}>
                    <Icon name="Check" size={IconSizes.sm} className="mr-2" />
                    Finalize
                  </Button>
                </>
              )}
              {(selectedRun.status === "draft" || selectedRun.status === "processing") && (
                <Button variant="destructive" onClick={cancelRun}>Cancel Run</Button>
              )}
              {selectedRun.status === "finalized" && (
                <>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline">
                        <Icon name="Download" size={IconSizes.sm} className="mr-2" />
                        Export Payroll
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={exportPayrollPdf}>Download PDF</DropdownMenuItem>
                      <DropdownMenuItem onClick={exportPayrollExcel}>Download Excel</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button variant="outline" onClick={exportBankPayrollFile}>
                    <Icon name="Download" size={IconSizes.sm} className="mr-2" />
                    Export Bank File
                  </Button>
                </>
              )}
            </HStack>
          </HStack>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <BodySmall className="text-muted-foreground">Employees</BodySmall>
                <p className="text-2xl font-bold mt-1">
                  {payslips.length > 0
                    ? payslips.length
                    : runScopeCount(selectedRun) ?? 0}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <BodySmall className="text-muted-foreground">Total Gross Pay</BodySmall>
                <p className="text-2xl font-bold mt-1">₱{payslips.reduce((s, p) => s + Number(p.gross_pay), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <BodySmall className="text-muted-foreground">Total Deductions</BodySmall>
                <p className="text-2xl font-bold mt-1 text-destructive">₱{payslips.reduce((s, p) => s + Number(p.total_deductions), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <BodySmall className="text-muted-foreground">Total Net Pay</BodySmall>
                <p className="text-2xl font-bold mt-1 text-primary">₱{payslips.reduce((s, p) => s + Number(p.net_pay), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </CardContent>
            </Card>
          </div>

          {/* Payslips Table */}
          <CardSection title="Payslips" description={`${payslips.length} employee payslips for this period.`}>
            {loadingPayslips ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
              </div>
            ) : payslips.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                {selectedRun.status === "draft"
                  ? "Click \"Generate Payslips\" to compute payroll for all active employees."
                  : "No payslips found for this run."}
              </div>
            ) : (
              <>
              <DbMobileBlock>
                <div className="space-y-2">
                  {payslips.map((ps) => (
                    <div
                      key={ps.id}
                      className="rounded-lg border border-border/80 bg-card p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          {ps.employee ? (
                            <Link
                              href={`/employees/${ps.employee.id}`}
                              className="text-sm font-medium text-primary hover:underline"
                            >
                              {empName(ps.employee)}
                            </Link>
                          ) : (
                            <span className="text-sm font-medium">Unknown</span>
                          )}
                          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                            {ps.employee?.company_id_no || "—"}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-bold text-primary">
                          ₱{Number(ps.net_pay).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="mt-2 space-y-1">
                        <DashboardMobileField
                          label="Department"
                          value={(ps.employee as any)?.departments?.name || "—"}
                        />
                        <DashboardMobileField
                          label="Gross pay"
                          value={`₱${Number(ps.gross_pay).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                        />
                        <DashboardMobileField
                          label="Deductions"
                          value={`₱${Number(ps.total_deductions).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                          valueClassName="text-destructive"
                        />
                      </div>
                      <HStack gap="2" justify="end" className="mt-3">
                        <Link
                          href={`/payslips?employee_id=${encodeURIComponent(
                            ps.employee?.id || ps.employee_id
                          )}&period_start=${encodeURIComponent(
                            selectedRun.cutoff_start
                          )}&payroll_run_id=${encodeURIComponent(selectedRun.id)}`}
                        >
                          <Button size="sm" variant="secondary">
                            <Icon name="PencilSimple" size={IconSizes.sm} className="mr-1" />
                            Edit
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownloadPayslip(ps)}
                        >
                          <Icon name="Download" size={IconSizes.sm} className="mr-1" />
                          Payslip
                        </Button>
                      </HStack>
                    </div>
                  ))}
                </div>
              </DbMobileBlock>
              <DbDesktopBlock className={dbTableShell}>
                <Table className="w-full min-w-[980px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company ID</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead className="text-right">Gross Pay</TableHead>
                      <TableHead className="text-right">SSS</TableHead>
                      <TableHead className="text-right">PhilHealth</TableHead>
                      <TableHead className="text-right">Pag-IBIG</TableHead>
                      <TableHead className="text-right">Tax</TableHead>
                      <TableHead className="text-right">Net Pay</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payslips.map((ps) => (
                      <TableRow key={ps.id}>
                        <TableCell className="font-mono text-sm">{ps.employee?.company_id_no || "—"}</TableCell>
                        <TableCell>
                          {ps.employee ? (
                            <HStack gap="2" align="center">
                              <Link href={`/employees/${ps.employee.id}`} className="text-primary hover:underline text-sm">
                                {empName(ps.employee)}
                              </Link>
                              {ps.created_at && ps.updated_at && ps.updated_at !== ps.created_at && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">
                                  Edited
                                </Badge>
                              )}
                            </HStack>
                          ) : "Unknown"}
                        </TableCell>
                        <TableCell className="text-sm">{(ps.employee as any)?.departments?.name || "—"}</TableCell>
                        <TableCell className="text-right font-medium">₱{Number(ps.gross_pay).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right text-sm text-destructive">{Number(ps.deductions_breakdown?.sss || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right text-sm text-destructive">{Number(ps.deductions_breakdown?.philhealth || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right text-sm text-destructive">{Number(ps.deductions_breakdown?.pagibig || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right text-sm text-destructive">{Number(ps.deductions_breakdown?.withholding_tax || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right font-bold text-primary">₱{Number(ps.net_pay).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right">
                          <HStack gap="2" justify="end">
                            <Link
                              href={`/payslips?employee_id=${encodeURIComponent(
                                ps.employee?.id || ps.employee_id
                              )}&period_start=${encodeURIComponent(
                                selectedRun.cutoff_start
                              )}&payroll_run_id=${encodeURIComponent(
                                selectedRun.id
                              )}`}
                            >
                              <Button size="sm" variant="secondary">
                                <Icon name="PencilSimple" size={IconSizes.sm} className="mr-1" />
                                Edit
                              </Button>
                            </Link>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDownloadPayslip(ps)}
                            >
                              <Icon name="Download" size={IconSizes.sm} className="mr-1" />
                              Payslip
                            </Button>
                          </HStack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </DbDesktopBlock>
              </>
            )}
          </CardSection>

          {printPayslip && printPayload && (
            <div className="hidden">
              <PayslipPrint
                employee={printPayload.employee}
                weekStart={new Date(
                  printPayslip.period_start || selectedRun?.cutoff_start || new Date()
                )}
                weekEnd={new Date(
                  printPayslip.period_end || selectedRun?.cutoff_end || new Date()
                )}
                attendance={printPayload.attendance}
                earnings={{
                  regularPay: printPayload.gross_pay,
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
                  grossIncome: printPayload.gross_pay,
                }}
                deductions={printPayload.deductions}
                adjustment={printPayload.adjustment_amount}
                adjustmentReason={printPayload.adjustment_reason}
                netPay={printPayload.net_pay}
                summaryGrossPay={printPayload.gross_pay}
                summaryNetPay={printPayload.net_pay}
                workingDays={(printPayload.attendance.attendance_data || []).filter(
                  (d: any) => Number(d?.regularHours || 0) > 0
                ).length}
                absentDays={0}
                preparedBy="HR"
              />
            </div>
          )}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className={cn("mx-auto w-full max-w-6xl", dbPageWrapper)}>
        <HStack justify="between" align="center" className="w-full flex-col gap-3 sm:flex-row">
          <H1>Payroll</H1>
          {(isManagement || isHR) && (
            <div className={dbHeaderActions}>
              <Button onClick={openNewRunDialog} className="col-span-2 sm:col-span-1">
                <Icon name="Plus" size={IconSizes.sm} />
                New Payroll Run
              </Button>
            </div>
          )}
        </HStack>

        <CardSection title="Payroll runs" description="Most recent first.">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
            </div>
          ) : payrollRuns.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              No payroll runs yet.
            </div>
          ) : (
            <>
            <DbMobileBlock>
              <div className="space-y-2">
                {payrollRuns.map((run) => (
                  <div
                    key={run.id}
                    className="rounded-lg border border-border/80 bg-card p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">
                        {format(new Date(run.cutoff_start), "MMM d")} –{" "}
                        {format(new Date(run.cutoff_end), "MMM d, yyyy")}
                      </p>
                      <Badge
                        variant="outline"
                        className={`shrink-0 capitalize ${statusStyles[run.status] || ""}`}
                      >
                        {run.status}
                      </Badge>
                    </div>
                    <div className="mt-2 space-y-1">
                      <DashboardMobileField
                        label="Pay date"
                        value={
                          run.pay_date
                            ? format(new Date(run.pay_date), "MMM d, yyyy")
                            : "—"
                        }
                      />
                      <DashboardMobileField
                        label="Employees"
                        value={
                          run.payslip_count && run.payslip_count > 0
                            ? run.payslip_count
                            : runScopeCount(run) ?? 0
                        }
                      />
                      <DashboardMobileField
                        label="Total gross"
                        value={`₱${(run.total_gross || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                      />
                      <DashboardMobileField
                        label="Total net"
                        value={`₱${(run.total_net || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                        valueClassName="text-primary"
                      />
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button size="sm" variant="ghost" onClick={() => openRunDetail(run)}>
                        <Icon name="Eye" size={IconSizes.sm} className="mr-1" />
                        View
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </DbMobileBlock>
            <DbDesktopBlock className={dbTableShell}>
              <Table className="w-full min-w-[760px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Cutoff Period</TableHead>
                    <TableHead>Pay Date</TableHead>
                    <TableHead className="text-center">Employees</TableHead>
                    <TableHead className="text-right">Total Gross</TableHead>
                    <TableHead className="text-right">Total Net</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrollRuns.map((run) => (
                    <TableRow key={run.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">
                        {format(new Date(run.cutoff_start), "MMM d")} – {format(new Date(run.cutoff_end), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>{run.pay_date ? format(new Date(run.pay_date), "MMM d, yyyy") : "—"}</TableCell>
                      <TableCell className="text-center">
                        {run.payslip_count && run.payslip_count > 0
                          ? run.payslip_count
                          : runScopeCount(run) ?? 0}
                      </TableCell>
                      <TableCell className="text-right">₱{(run.total_gross || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right font-medium text-primary">₱{(run.total_net || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`capitalize ${statusStyles[run.status] || ""}`}>{run.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => openRunDetail(run)}>
                          <Icon name="Eye" size={IconSizes.sm} className="mr-1" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DbDesktopBlock>
            </>
          )}
        </CardSection>
      </div>

      {/* New Payroll Run Dialog */}
      <Dialog
        open={showNewRunDialog}
        onOpenChange={(open) => {
          setShowNewRunDialog(open);
          if (open) {
            applyPayrollWeekStart(getDefaultPayrollRunWeek().weekStart);
            setEmployeeScopeQuery("");
            void initNewRunEmployeeScope();
          }
        }}
      >
        <DialogContent className="max-w-xl sm:max-w-2xl max-h-[min(90vh,800px)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Payroll Run</DialogTitle>
            <DialogDescription>
              Weekly cutoff Wed–Tue. Dates are prefilled — adjust if needed.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateRun} className="space-y-4">
            <div className="space-y-2">
              <Label>Cutoff week</Label>
              <HStack gap="2" align="center">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => shiftPayrollWeek(-1)}
                  aria-label="Previous week"
                >
                  <Icon name="CaretLeft" size={IconSizes.sm} />
                </Button>
                <BodySmall className="flex-1 text-center font-medium">
                  {formatWeeklyPeriod(
                    newRunWeekStart,
                    getWeeklyCutoffEndDate(newRunWeekStart)
                  )}
                </BodySmall>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => shiftPayrollWeek(1)}
                  aria-label="Next week"
                >
                  <Icon name="CaretRight" size={IconSizes.sm} />
                </Button>
              </HStack>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="cutoff-start">Cutoff Start *</Label>
                <Input
                  id="cutoff-start"
                  type="date"
                  required
                  value={newRunForm.cutoff_start}
                  onChange={(e) => {
                    const value = e.target.value;
                    setNewRunForm((prev) => ({ ...prev, cutoff_start: value }));
                    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
                      setNewRunWeekStart(getWeeklyPeriodStart(new Date(`${value}T12:00:00`)));
                    }
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cutoff-end">Cutoff End *</Label>
                <Input
                  id="cutoff-end"
                  type="date"
                  required
                  value={newRunForm.cutoff_end}
                  onChange={(e) =>
                    setNewRunForm((prev) => ({ ...prev, cutoff_end: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pay-date">Pay Date</Label>
                <Input
                  id="pay-date"
                  type="date"
                  value={newRunForm.pay_date}
                  onChange={(e) =>
                    setNewRunForm((prev) => ({ ...prev, pay_date: e.target.value }))
                  }
                />
              </div>
            </div>
            <Caption>Suggested pay date: Friday after cutoff. Edit anytime.</Caption>
            <div className="space-y-3">
              {previousRunsForScope.length > 0 && (
                <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                  <Label htmlFor="copy-from-run">Start from previous run</Label>
                  <HStack gap="2" align="end" className="flex-col sm:flex-row">
                    <Select
                      value={copyFromRunId || undefined}
                      onValueChange={(runId) => {
                        setCopyFromRunId(runId);
                        void loadEmployeesFromPayrollRun(runId);
                      }}
                      disabled={loadingRunScope}
                    >
                      <SelectTrigger id="copy-from-run" className="w-full sm:flex-1">
                        <SelectValue placeholder="Select payroll run" />
                      </SelectTrigger>
                      <SelectContent>
                        {previousRunsForScope.map((run) => (
                          <SelectItem key={run.id} value={run.id}>
                            {format(new Date(run.cutoff_start), "MMM d")} –{" "}
                            {format(new Date(run.cutoff_end), "MMM d, yyyy")}
                            {run.payslip_count ? ` · ${run.payslip_count} payslips` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto"
                      disabled={!copyFromRunId || loadingRunScope}
                      onClick={() => {
                        if (copyFromRunId) {
                          void loadEmployeesFromPayrollRun(copyFromRunId);
                        }
                      }}
                    >
                      {loadingRunScope ? "Loading..." : "Reload list"}
                    </Button>
                  </HStack>
                  {copyFromRun && selectedEmployeeIdsForRun.length > 0 && (
                    <Caption>
                      {selectedEmployeeIdsForRun.length} loaded from{" "}
                      {format(new Date(copyFromRun.cutoff_start), "MMM d")} –{" "}
                      {format(new Date(copyFromRun.cutoff_end), "MMM d, yyyy")}. Search below to
                      add more.
                    </Caption>
                  )}
                </div>
              )}
              <HStack justify="between" align="center">
                <Label htmlFor="employee-scope-search">Employee scope (optional)</Label>
                <HStack gap="1">
                  {selectedEmployeeIdsForRun.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedEmployeeIdsForRun([])}
                    >
                      Clear ({selectedEmployeeIdsForRun.length})
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setSelectedEmployeeIdsForRun(activeEmployeesForRun.map((emp) => emp.id))
                    }
                  >
                    Select all
                  </Button>
                </HStack>
              </HStack>
              <div className="relative">
                <Icon
                  name="MagnifyingGlass"
                  size={IconSizes.sm}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                />
                <Input
                  id="employee-scope-search"
                  type="search"
                  placeholder="Search by name or employee ID..."
                  value={employeeScopeQuery}
                  onChange={(e) => setEmployeeScopeQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              {selectedEmployeesForRun.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedEmployeesForRun.map((emp) => (
                    <Badge key={emp.id} variant="secondary" className="gap-1 pr-1 font-normal">
                      {getRunEmployeeName(emp)}
                      <button
                        type="button"
                        className="rounded-sm p-0.5 hover:bg-muted"
                        aria-label={`Remove ${getRunEmployeeName(emp)}`}
                        onClick={() =>
                          setSelectedEmployeeIdsForRun((prev) =>
                            prev.filter((id) => id !== emp.id)
                          )
                        }
                      >
                        <Icon name="X" size={IconSizes.xs} />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              {employeeScopeQuery.trim() ? (
                <div className="max-h-44 overflow-y-auto rounded-md border">
                  {filteredEmployeesForRun.length === 0 ? (
                    <BodySmall className="p-3 text-muted-foreground">No matches.</BodySmall>
                  ) : (
                    filteredEmployeesForRun.map((emp) => (
                      <label
                        key={emp.id}
                        className="flex cursor-pointer items-center gap-2 border-b px-3 py-2 text-sm last:border-b-0 hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={selectedEmployeeIdsForRun.includes(emp.id)}
                          onCheckedChange={(checked) => {
                            const isChecked = checked === true;
                            setSelectedEmployeeIdsForRun((prev) =>
                              isChecked
                                ? prev.includes(emp.id)
                                  ? prev
                                  : [...prev, emp.id]
                                : prev.filter((id) => id !== emp.id)
                            );
                          }}
                        />
                        <span>
                          {getRunEmployeeName(emp)} (
                          {emp.employee_code || emp.company_id_no || "No ID"})
                        </span>
                      </label>
                    ))
                  )}
                </div>
              ) : (
                <BodySmall className="text-muted-foreground">
                  {selectedEmployeeIdsForRun.length > 0
                    ? "Search to add more employees."
                    : "Search to add employees, or leave empty to run payroll for all active employees."}
                </BodySmall>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowNewRunDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={creating}>{creating ? "Creating..." : "Create Run"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
