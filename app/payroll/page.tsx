"use client";

import { useEffect, useState } from "react";
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
import Link from "next/link";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { H1, BodySmall, Caption } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { CardSection } from "@/components/ui/card-section";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";

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
  const { isAdmin, isHR, canAccessSalaryInfo } = useUserRole();

  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewRunDialog, setShowNewRunDialog] = useState(false);
  const [newRunForm, setNewRunForm] = useState({ cutoff_start: "", cutoff_end: "", pay_date: "" });
  const [creating, setCreating] = useState(false);
  const [activeEmployeesForRun, setActiveEmployeesForRun] = useState<RunSelectableEmployee[]>([]);
  const [selectedEmployeeIdsForRun, setSelectedEmployeeIdsForRun] = useState<string[]>([]);

  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loadingPayslips, setLoadingPayslips] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [printPayslip, setPrintPayslip] = useState<Payslip | null>(null);

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

  function handleDownloadPayslip(ps: Payslip) {
    setPrintPayslip(ps);
    window.setTimeout(() => {
      const el = document.getElementById("payslip-print-content");
      if (!el) {
        toast.error("Payslip print layout is not ready.");
        return;
      }
      const label = ps.employee?.company_id_no || ps.employee_id || "Employee";
      triggerPrintFromContainer(el, `Payslip - ${label}`);
    }, 30);
  }

  useEffect(() => {
    fetchPayrollRuns();
    loadActiveEmployeesForRun();
  }, []);

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

  async function fetchPayrollRuns() {
    setLoading(true);
    try {
      const { data: runs, error } = await supabase
        .from("payroll_runs")
        .select("*")
        .order("cutoff_start", { ascending: false });
      if (error) throw error;

      const runsWithCounts = await Promise.all(
        (runs || []).map(async (run: PayrollRun) => {
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
      fetchPayrollRuns();
    } catch (error: any) {
      toast.error(error.message || "Failed to create payroll run");
    } finally {
      setCreating(false);
    }
  }

  async function openRunDetail(run: PayrollRun) {
    setSelectedRun(run);
    setLoadingPayslips(true);
    try {
      const { data, error } = await supabase
        .from("payslips")
        .select("*, employees:employee_id ( id, company_id_no, employee_code, first_name, middle_name, last_name, salary_basis, base_rate, departments:department_id ( name ), positions:position_id ( name ) )")
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

  async function generatePayslips() {
    if (!selectedRun) return;
    setProcessing(true);
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

      await supabase
        .from("payroll_runs")
        .update({ status: "processing" } as never)
        .eq("id", selectedRun.id);

      toast.success(
        `Generated ${json?.generated ?? 0} draft payslip(s) for this run.`
      );
      openRunDetail({ ...selectedRun, status: "processing" });
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

  if (selectedRun) {
    return (
      <DashboardLayout>
        <VStack gap="6" className="w-full pb-16 max-w-6xl">
          <HStack justify="between" align="center">
            <VStack gap="1" align="start">
              <Button variant="ghost" size="sm" onClick={() => setSelectedRun(null)} className="mb-1">
                <Icon name="ArrowLeft" size={IconSizes.sm} className="mr-2" />
                Back to Payroll Runs
              </Button>
              <H1>
                Payroll: {format(new Date(selectedRun.cutoff_start), "MMM d")} – {format(new Date(selectedRun.cutoff_end), "MMM d, yyyy")}
              </H1>
              <HStack gap="2" align="center">
                <Badge variant="outline" className={statusStyles[selectedRun.status] || ""}>{selectedRun.status}</Badge>
                {selectedRun.pay_date && <Caption>Pay Date: {format(new Date(selectedRun.pay_date), "MMM d, yyyy")}</Caption>}
                <Caption>
                  Scope:{" "}
                  {selectedRun.selected_employee_ids?.length
                    ? `${selectedRun.selected_employee_ids.length} selected employee(s)`
                    : "All active employees"}
                </Caption>
              </HStack>
            </VStack>
            <HStack gap="2">
              {selectedRun.status === "draft" && (
                <Button onClick={generatePayslips} disabled={processing}>
                  <Icon name="ArrowsClockwise" size={IconSizes.sm} className={processing ? "animate-spin mr-2" : "mr-2"} />
                  {processing ? "Generating..." : "Generate Payslips"}
                </Button>
              )}
              {selectedRun.status === "processing" && (
                <>
                  <Button onClick={generatePayslips} variant="outline" disabled={processing}>
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
              <div className="w-full max-w-full overflow-x-auto rounded-lg border">
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
                            <Link href={`/employees/${ps.employee.id}`} className="text-primary hover:underline text-sm">
                              {empName(ps.employee)}
                            </Link>
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
              </div>
            )}
          </CardSection>

          {printPayslip && (
            <div className="hidden">
              <PayslipPrint
                employee={{
                  employee_id: printPayslip.employee?.company_id_no || printPayslip.employee_id,
                  full_name: [printPayslip.employee?.first_name, printPayslip.employee?.last_name]
                    .filter(Boolean)
                    .join(" ")
                    .trim() || "Employee",
                  rate_per_day:
                    printPayslip.employee?.salary_basis === "daily"
                      ? Number(printPayslip.employee?.base_rate || 0)
                      : Number(printPayslip.employee?.base_rate || 0) / 26,
                  rate_per_hour:
                    printPayslip.employee?.salary_basis === "daily"
                      ? Number(printPayslip.employee?.base_rate || 0) / 8
                      : Number(printPayslip.employee?.base_rate || 0) / 26 / 8,
                  position: printPayslip.employee?.positions?.name || null,
                  assigned_hotel: null,
                  employee_type: null,
                  job_level: null,
                }}
                weekStart={new Date(
                  printPayslip.period_start || selectedRun?.cutoff_start || new Date()
                )}
                weekEnd={new Date(
                  printPayslip.period_end || selectedRun?.cutoff_end || new Date()
                )}
                attendance={{ attendance_data: getPayslipAttendanceData(printPayslip) }}
                earnings={{
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
                  grossIncome: Number(printPayslip.gross_pay || 0),
                }}
                deductions={{
                  vale: Number(printPayslip.deductions_breakdown?.weekly?.vale || 0),
                  sssLoan: Number(printPayslip.deductions_breakdown?.weekly?.sss_loan || 0),
                  sssCalamityLoan: Number(
                    printPayslip.deductions_breakdown?.weekly?.sss_calamity || 0
                  ),
                  pagibigLoan: Number(
                    printPayslip.deductions_breakdown?.weekly?.pagibig_loan || 0
                  ),
                  pagibigCalamityLoan: Number(
                    printPayslip.deductions_breakdown?.weekly?.pagibig_calamity || 0
                  ),
                  monthlyLoans: printPayslip.deductions_breakdown?.weekly?.monthly_loans,
                  sssContribution: Number(printPayslip.deductions_breakdown?.sss || 0),
                  sssWisp: Number(printPayslip.deductions_breakdown?.sss_wisp || 0),
                  philhealthContribution: Number(
                    printPayslip.deductions_breakdown?.philhealth || 0
                  ),
                  pagibigContribution: Number(printPayslip.deductions_breakdown?.pagibig || 0),
                  withholdingTax: Number(
                    printPayslip.deductions_breakdown?.withholding_tax ||
                      printPayslip.deductions_breakdown?.tax ||
                      0
                  ),
                  totalDeductions: Number(printPayslip.total_deductions || 0),
                }}
                adjustment={Number(printPayslip.adjustment_amount || 0)}
                adjustmentReason={printPayslip.adjustment_reason || null}
                netPay={Number(printPayslip.net_pay || 0)}
                workingDays={getPayslipAttendanceData(printPayslip).filter(
                  (d: any) => Number(d?.regularHours || 0) > 0
                ).length}
                absentDays={0}
                preparedBy="HR"
              />
            </div>
          )}
        </VStack>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <VStack gap="8" className="w-full pb-24">
        <HStack justify="between" align="center" className="flex-col gap-4 sm:flex-row">
          <VStack gap="2" align="start">
            <H1>Payroll</H1>
            <BodySmall>Create payroll runs, generate payslips, and review totals before release.</BodySmall>
          </VStack>
          {(isAdmin || isHR) && (
            <Button
              onClick={() => {
                setSelectedEmployeeIdsForRun([]);
                setShowNewRunDialog(true);
              }}
            >
              <Icon name="Plus" size={IconSizes.sm} />
              New Payroll Run
            </Button>
          )}
        </HStack>

        <CardSection title="Payroll runs" description="All payroll runs sorted by most recent.">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
            </div>
          ) : payrollRuns.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              No payroll runs yet. Click "New Payroll Run" to get started.
            </div>
          ) : (
            <div className="w-full max-w-full overflow-x-auto rounded-lg border">
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
            </div>
          )}
        </CardSection>
      </VStack>

      {/* New Payroll Run Dialog */}
      <Dialog open={showNewRunDialog} onOpenChange={setShowNewRunDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Payroll Run</DialogTitle>
            <DialogDescription>Define the cutoff period and optional pay date for this run.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateRun} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cutoff-start">Cutoff Start *</Label>
              <Input id="cutoff-start" type="date" required value={newRunForm.cutoff_start}
                onChange={(e) => setNewRunForm({ ...newRunForm, cutoff_start: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cutoff-end">Cutoff End *</Label>
              <Input id="cutoff-end" type="date" required value={newRunForm.cutoff_end}
                onChange={(e) => setNewRunForm({ ...newRunForm, cutoff_end: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-date">Pay Date</Label>
              <Input id="pay-date" type="date" value={newRunForm.pay_date}
                onChange={(e) => setNewRunForm({ ...newRunForm, pay_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <HStack justify="between" align="center">
                <Label>Employee Scope (optional)</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setSelectedEmployeeIdsForRun((prev) =>
                      prev.length === activeEmployeesForRun.length
                        ? []
                        : activeEmployeesForRun.map((emp) => emp.id)
                    )
                  }
                >
                  {selectedEmployeeIdsForRun.length === activeEmployeesForRun.length
                    ? "Clear all"
                    : "Select all"}
                </Button>
              </HStack>
              <div className="max-h-52 overflow-auto rounded-md border p-2 space-y-2">
                {activeEmployeesForRun.length === 0 ? (
                  <BodySmall className="text-muted-foreground">
                    No active employees found.
                  </BodySmall>
                ) : (
                  activeEmployeesForRun.map((emp) => (
                    <label key={emp.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={selectedEmployeeIdsForRun.includes(emp.id)}
                        onCheckedChange={(checked) => {
                          const isChecked = checked === true;
                          setSelectedEmployeeIdsForRun((prev) =>
                            isChecked
                              ? [...prev, emp.id]
                              : prev.filter((id) => id !== emp.id)
                          );
                        }}
                      />
                      <span>
                        {getRunEmployeeName(emp)} ({emp.employee_code || emp.company_id_no || "No ID"})
                      </span>
                    </label>
                  ))
                )}
              </div>
              <Caption>
                Leave empty to run payroll for all active employees.
              </Caption>
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
