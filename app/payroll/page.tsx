"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
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
import {
  calculateSSS,
  calculatePhilHealth,
  calculatePagIBIG,
  calculateWithholdingTax,
} from "@/utils/ph-deductions";

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

interface Payslip {
  id: string;
  employee_id: string;
  gross_pay: number;
  total_deductions: number;
  net_pay: number;
  earnings_breakdown: Record<string, number>;
  deductions_breakdown: Record<string, number>;
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

  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loadingPayslips, setLoadingPayslips] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchPayrollRuns();
  }, []);

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
      const { data, error } = await supabase.from("payroll_runs").insert([{
        company_id: companyData?.id,
        cutoff_start: newRunForm.cutoff_start,
        cutoff_end: newRunForm.cutoff_end,
        pay_date: newRunForm.pay_date || null,
        status: "draft",
      } as never]).select().single();
      if (error) throw error;
      toast.success("Payroll run created.");
      setShowNewRunDialog(false);
      setNewRunForm({ cutoff_start: "", cutoff_end: "", pay_date: "" });
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
      const { data: employees, error: empErr } = await supabase
        .from("employees")
        .select("id, company_id_no, employee_code, first_name, last_name, salary_basis, base_rate, employment_status")
        .eq("employment_status", "active");
      if (empErr) throw empErr;

      if (!employees || employees.length === 0) {
        toast.error("No active employees found.");
        setProcessing(false);
        return;
      }

      const cutoffStart = new Date(selectedRun.cutoff_start);
      const cutoffEnd = new Date(selectedRun.cutoff_end);
      const daysInPeriod = Math.ceil((cutoffEnd.getTime() - cutoffStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      const payslipInserts = employees.map((emp) => {
        const monthlyRate = emp.salary_basis === "monthly"
          ? Number(emp.base_rate)
          : Number(emp.base_rate) * 26;

        const basicPay = emp.salary_basis === "monthly"
          ? monthlyRate / 2
          : Number(emp.base_rate) * Math.min(daysInPeriod, 13);

        const sss = calculateSSS(monthlyRate);
        const philhealth = calculatePhilHealth(monthlyRate);
        const pagibig = calculatePagIBIG(monthlyRate);
        const totalGovtDeductions = (sss.employeeShare + philhealth.employeeShare + pagibig.employeeShare) / 2;

        const taxableIncome = basicPay - totalGovtDeductions;
        const withholdingTax = calculateWithholdingTax(taxableIncome * 2) / 2;

        const grossPay = basicPay;
        const totalDeductions = totalGovtDeductions + Math.max(0, withholdingTax);
        const netPay = grossPay - totalDeductions;

        return {
          payroll_run_id: selectedRun.id,
          employee_id: emp.id,
          gross_pay: Math.round(grossPay * 100) / 100,
          total_deductions: Math.round(totalDeductions * 100) / 100,
          net_pay: Math.round(netPay * 100) / 100,
          earnings_breakdown: {
            basic_pay: Math.round(basicPay * 100) / 100,
          },
          deductions_breakdown: {
            sss: Math.round((sss.employeeShare / 2) * 100) / 100,
            philhealth: Math.round((philhealth.employeeShare / 2) * 100) / 100,
            pagibig: Math.round((pagibig.employeeShare / 2) * 100) / 100,
            withholding_tax: Math.round(Math.max(0, withholdingTax) * 100) / 100,
          },
        };
      });

      await supabase.from("payslips").delete().eq("payroll_run_id", selectedRun.id);

      const { error: insertErr } = await supabase.from("payslips").insert(payslipInserts as never[]);
      if (insertErr) throw insertErr;

      await supabase.from("payroll_runs").update({ status: "processing" } as never).eq("id", selectedRun.id);

      toast.success(`Generated ${payslipInserts.length} payslips.`);
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
                <p className="text-2xl font-bold mt-1">{payslips.length}</p>
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardSection>
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
            <Button onClick={() => setShowNewRunDialog(true)}>
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
                      <TableCell className="text-center">{run.payslip_count || 0}</TableCell>
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
