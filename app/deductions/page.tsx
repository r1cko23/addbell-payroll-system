"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { CardSection } from "@/components/ui/card-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { H1, H4, BodySmall, Label, Caption } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { toast } from "sonner";
import { formatCurrency } from "@/utils/format";
import { format, addDays } from "date-fns";
import {
  getBiMonthlyPeriodStart,
  getBiMonthlyPeriodEnd,
  getNextBiMonthlyPeriod,
  getPreviousBiMonthlyPeriod,
  formatBiMonthlyPeriod,
} from "@/utils/bimonthly";
import { calculateSSS, calculateMonthlySalary } from "@/utils/ph-deductions";

interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
  last_name?: string | null;
  first_name?: string | null;
  monthly_rate?: number | null;
  per_day?: number | null;
}

interface Deductions {
  id?: string;
  employee_id: string;
  period_start: string;
  period_end?: string;
  vale_amount: number;
  sss_salary_loan: number;
  sss_calamity_loan: number;
  pagibig_salary_loan: number;
  pagibig_calamity_loan: number;
  sss_contribution: number;
  philhealth_contribution: number;
  pagibig_contribution: number;
  withholding_tax: number;
  other_deduction: number;
  sss_pro: number;
}

export default function DeductionsPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [periodStart, setPeriodStart] = useState<Date>(() =>
    getBiMonthlyPeriodStart(new Date())
  );
  const [deductions, setDeductions] = useState<Deductions | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    vale_amount: "0",
    sss_salary_loan: "0",
    sss_calamity_loan: "0",
    pagibig_salary_loan: "0",
    pagibig_calamity_loan: "0",
    sss_contribution: "0",
    philhealth_contribution: "0",
    pagibig_contribution: "0",
    withholding_tax: "0",
    other_deduction: "0",
    sss_pro: "0",
  });

  const supabase = createClient();

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    if (selectedEmployeeId && employees.length > 0) {
      loadDeductions();
    }
  }, [selectedEmployeeId, periodStart, employees]);

  async function loadEmployees() {
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("id, employee_id, full_name, monthly_rate, per_day, last_name, first_name")
        .eq("is_active", true)
        .order("last_name", { ascending: true, nullsFirst: false })
        .order("first_name", { ascending: true, nullsFirst: false });

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error("Error loading employees:", error);
      toast.error("Failed to load employees");
    } finally {
      setLoading(false);
    }
  }

  // function autoCalculateContributions() {
  //   if (!selectedEmployeeId) return;
  //
  //   const employee = employees.find(emp => emp.id === selectedEmployeeId);
  //   if (!employee || !employee.rate_per_day) return;
  //
  //   // Calculate contributions based on daily rate
  //   const contributions = calculateAllContributions(employee.rate_per_day, 22); // 22 working days per month
  //
  //   // Update form data with calculated bi-monthly contributions
  //   setFormData(prev => ({
  //     ...prev,
  //     sss_contribution: contributions.biMonthly.sss.toFixed(2),
  //     philhealth_contribution: contributions.biMonthly.philhealth.toFixed(2),
  //     pagibig_contribution: contributions.biMonthly.pagibig.toFixed(2),
  //   }));
  // }

  async function loadDeductions() {
    try {
      const periodStartStr = format(periodStart, "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("employee_deductions")
        .select("*")
        .eq("employee_id", selectedEmployeeId)
        .eq("period_start", periodStartStr)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const deductionData = data as {
          vale_amount: number;
          sss_salary_loan: number;
          sss_calamity_loan: number;
          pagibig_salary_loan: number;
          pagibig_calamity_loan: number;
          sss_contribution: number;
          philhealth_contribution: number;
          pagibig_contribution: number;
          withholding_tax: number;
          other_deduction: number;
          sss_pro: number;
        };
        setDeductions(data);

        // Auto-calculate SSS PRO (WISP) if not set or 0
        let sssProValue = deductionData.sss_pro || 0;
        if (sssProValue === 0) {
          const employee = employees.find(emp => emp.id === selectedEmployeeId);
          if (employee) {
            let monthlySalary = 0;
            if (employee.monthly_rate) {
              monthlySalary = employee.monthly_rate;
            } else if (employee.per_day) {
              monthlySalary = calculateMonthlySalary(employee.per_day, 22);
            }

            if (monthlySalary > 0) {
              const sssCalculation = calculateSSS(monthlySalary);
              sssProValue = sssCalculation.wispEmployeeShare || 0;
            }
          }
        }

        setFormData({
          vale_amount: deductionData.vale_amount.toString(),
          sss_salary_loan: deductionData.sss_salary_loan.toString(),
          sss_calamity_loan: deductionData.sss_calamity_loan.toString(),
          pagibig_salary_loan: deductionData.pagibig_salary_loan.toString(),
          pagibig_calamity_loan: deductionData.pagibig_calamity_loan.toString(),
          sss_contribution: deductionData.sss_contribution.toString(),
          philhealth_contribution:
            deductionData.philhealth_contribution.toString(),
          pagibig_contribution: deductionData.pagibig_contribution.toString(),
          withholding_tax: deductionData.withholding_tax.toString(),
          other_deduction: (deductionData.other_deduction || 0).toString(),
          sss_pro: sssProValue.toString(),
        });
      } else {
        setDeductions(null);
        resetForm();

        // Auto-calculate SSS PRO (WISP) for new record
        const employee = employees.find(emp => emp.id === selectedEmployeeId);
        if (employee) {
          let monthlySalary = 0;
          if (employee.monthly_rate) {
            monthlySalary = employee.monthly_rate;
          } else if (employee.per_day) {
            monthlySalary = calculateMonthlySalary(employee.per_day, 22);
          }

          if (monthlySalary > 0) {
            const sssCalculation = calculateSSS(monthlySalary);
            const wispAmount = sssCalculation.wispEmployeeShare || 0;
            setFormData(prev => ({
              ...prev,
              sss_pro: wispAmount.toString(),
            }));
          }
        }
      }
    } catch (error) {
      console.error("Error loading deductions:", error);
      toast.error("Failed to load deductions");
    }
  }

  function resetForm() {
    setFormData({
      vale_amount: "0",
      sss_salary_loan: "0",
      sss_calamity_loan: "0",
      pagibig_salary_loan: "0",
      pagibig_calamity_loan: "0",
      sss_contribution: "0",
      philhealth_contribution: "0",
      pagibig_contribution: "0",
      withholding_tax: "0",
      other_deduction: "0",
      sss_pro: "0",
    });
  }

  async function handleSave() {
    if (!selectedEmployeeId) {
      toast.error("Please select an employee");
      return;
    }

    setSaving(true);

    try {
      const periodStartStr = format(periodStart, "yyyy-MM-dd");
      const periodEnd = getBiMonthlyPeriodEnd(periodStart);
      const periodEndStr = format(periodEnd, "yyyy-MM-dd");

      // Helper function to round to 2 decimal places
      const roundTo2Decimals = (value: number) => Math.round(value * 100) / 100;

      const deductionData = {
        employee_id: selectedEmployeeId,
        period_start: periodStartStr,
        period_end: periodEndStr,
        period_type: "bimonthly",
        vale_amount: roundTo2Decimals(parseFloat(formData.vale_amount) || 0),
        sss_salary_loan: roundTo2Decimals(parseFloat(formData.sss_salary_loan) || 0),
        sss_calamity_loan: roundTo2Decimals(parseFloat(formData.sss_calamity_loan) || 0),
        pagibig_salary_loan: roundTo2Decimals(parseFloat(formData.pagibig_salary_loan) || 0),
        pagibig_calamity_loan: roundTo2Decimals(parseFloat(formData.pagibig_calamity_loan) || 0),
        sss_contribution: roundTo2Decimals(parseFloat(formData.sss_contribution) || 0),
        philhealth_contribution: roundTo2Decimals(
          parseFloat(formData.philhealth_contribution) || 0
        ),
        pagibig_contribution: roundTo2Decimals(parseFloat(formData.pagibig_contribution) || 0),
        withholding_tax: roundTo2Decimals(parseFloat(formData.withholding_tax) || 0),
        other_deduction: roundTo2Decimals(parseFloat(formData.other_deduction) || 0),
        sss_pro: roundTo2Decimals(parseFloat(formData.sss_pro) || 0),
      };

      if (deductions?.id) {
        // Update existing
        const { error } = await (supabase.from("employee_deductions") as any)
          .update(deductionData)
          .eq("id", deductions.id);

        if (error) throw error;
        toast.success("Deductions updated successfully!", {
          description: `Period: ${formatBiMonthlyPeriod(
            periodStart,
            periodEnd
          )}`,
        });
      } else {
        // Create new
        const { error } = await (
          supabase.from("employee_deductions") as any
        ).insert([deductionData]);

        if (error) throw error;
        toast.success("Deductions saved successfully!", {
          description: `Period: ${formatBiMonthlyPeriod(
            periodStart,
            periodEnd
          )}`,
        });
      }

      loadDeductions();
    } catch (error: any) {
      console.error("Error saving deductions:", error);
      toast.error(error.message || "Failed to save deductions");
    } finally {
      setSaving(false);
    }
  }

  const weeklyTotal =
    parseFloat(formData.vale_amount || "0") +
    parseFloat(formData.sss_salary_loan || "0") +
    parseFloat(formData.sss_calamity_loan || "0") +
    parseFloat(formData.pagibig_salary_loan || "0") +
    parseFloat(formData.pagibig_calamity_loan || "0");

  const govTotal =
    parseFloat(formData.sss_contribution || "0") +
    parseFloat(formData.philhealth_contribution || "0") +
    parseFloat(formData.pagibig_contribution || "0");

  if (loading) {
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

  return (
    <DashboardLayout>
      <VStack gap="8" className="w-full">
        <VStack gap="2" align="start">
          <H1>Deductions Management</H1>
          <BodySmall>
            Configure bi-monthly deductions and government contributions per
            employee
          </BodySmall>
        </VStack>

        <CardSection>
          <VStack gap="4">
            {/* Period Navigation */}
            <VStack gap="2" align="start">
              <Label>Select Bi-Monthly Period (Monday - Friday, 2 weeks)</Label>
              <HStack gap="3" align="center" className="w-full">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setPeriodStart(getPreviousBiMonthlyPeriod(periodStart))
                  }
                >
                  <Icon name="CaretLeft" size={IconSizes.sm} />
                </Button>
                <VStack gap="0" align="center" className="flex-1">
                  <p className="font-semibold text-foreground">
                    {formatBiMonthlyPeriod(
                      periodStart,
                      getBiMonthlyPeriodEnd(periodStart)
                    )}
                  </p>
                  <BodySmall>
                    Period starting {format(periodStart, "MMMM d, yyyy")}
                  </BodySmall>
                </VStack>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setPeriodStart(getNextBiMonthlyPeriod(periodStart))
                  }
                >
                  <Icon name="CaretRight" size={IconSizes.sm} />
                </Button>
              </HStack>
            </VStack>

            {/* Employee Selection */}
            <VStack gap="2" align="start">
              <Label>Select Employee</Label>
              <Select
                value={selectedEmployeeId}
                onValueChange={(value) => setSelectedEmployeeId(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="-- Select Employee --" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => {
                    const nameParts = emp.full_name?.trim().split(/\s+/) || [];
                    const lastName = emp.last_name || (nameParts.length > 0 ? nameParts[nameParts.length - 1] : "");
                    const firstName = emp.first_name || (nameParts.length > 0 ? nameParts[0] : "");
                    const middleParts = nameParts.length > 2 ? nameParts.slice(1, -1) : [];
                    const displayName = lastName && firstName 
                      ? `${lastName.toUpperCase()}, ${firstName.toUpperCase()}${middleParts.length > 0 ? " " + middleParts.join(" ").toUpperCase() : ""}`
                      : emp.full_name || "";
                    return (
                      <SelectItem key={emp.id} value={emp.id}>
                        {displayName} ({emp.employee_id})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </VStack>
          </VStack>
        </CardSection>

        {selectedEmployeeId && (
          <>
            <CardSection
              title="Bi-Monthly Deductions"
              description={`For period ${formatBiMonthlyPeriod(
                periodStart,
                getBiMonthlyPeriodEnd(periodStart)
              )}`}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <VStack gap="2" align="start">
                  <Label>Vale</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.vale_amount}
                    onChange={(e) =>
                      setFormData({ ...formData, vale_amount: e.target.value })
                    }
                  />
                  <Caption>Cash advance deduction</Caption>
                </VStack>

                <VStack gap="2" align="start">
                  <Label>SSS Salary Loan</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.sss_salary_loan}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        sss_salary_loan: e.target.value,
                      })
                    }
                  />
                </VStack>

                <VStack gap="2" align="start">
                  <Label>SSS Calamity Loan</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.sss_calamity_loan}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        sss_calamity_loan: e.target.value,
                      })
                    }
                  />
                </VStack>

                <VStack gap="2" align="start">
                  <Label>Pag-IBIG Salary Loan</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.pagibig_salary_loan}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        pagibig_salary_loan: e.target.value,
                      })
                    }
                  />
                </VStack>

                <VStack gap="2" align="start">
                  <Label>Pag-IBIG Calamity Loan</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.pagibig_calamity_loan}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        pagibig_calamity_loan: e.target.value,
                      })
                    }
                  />
                </VStack>
              </div>

              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <HStack justify="between" align="center">
                  <span className="font-semibold text-foreground">
                    Total Bi-Monthly Deductions:
                  </span>
                  <span className="text-xl font-bold text-foreground">
                    {formatCurrency(weeklyTotal)}
                  </span>
                </HStack>
              </div>
            </CardSection>

            <CardSection
              title="Government Contributions"
              description="Manual entry required (rates removed)."
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <VStack gap="2" align="start">
                  <Label>SSS Contribution</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.sss_contribution}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        sss_contribution: e.target.value,
                      })
                    }
                  />
                  <Caption>Bi-monthly amount</Caption>
                </VStack>

                <VStack gap="2" align="start">
                  <Label>PhilHealth Contribution</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.philhealth_contribution}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        philhealth_contribution: e.target.value,
                      })
                    }
                  />
                  <Caption>Bi-monthly amount</Caption>
                </VStack>

                <VStack gap="2" align="start">
                  <Label>Pag-IBIG Contribution</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.pagibig_contribution}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        pagibig_contribution: e.target.value,
                      })
                    }
                  />
                  <Caption>Bi-monthly amount</Caption>
                </VStack>

                <VStack gap="2" align="start">
                  <Label>Withholding Tax</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.withholding_tax}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        withholding_tax: e.target.value,
                      })
                    }
                  />
                  <Caption>Income tax withheld</Caption>
                </VStack>

                <VStack gap="2" align="start">
                  <Label>SSS PRO (WISP - Workers' Investment and Savings Program)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.sss_pro}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        sss_pro: e.target.value,
                      })
                    }
                  />
                  <Caption>
                    WISP contribution (auto-calculated for MSC &gt; ₱20,000).
                    Mandatory for employees with monthly salary credit above ₱20,000.
                    You can manually override if needed.
                  </Caption>
                </VStack>

                <VStack gap="2" align="start">
                  <Label>Other Deduction</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.other_deduction}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        other_deduction: e.target.value,
                      })
                    }
                  />
                  <Caption>Other manual deductions for this cutoff</Caption>
                </VStack>
              </div>

              <div className="mt-4 p-4 bg-emerald-50 rounded-lg">
                <HStack justify="between" align="center">
                  <span className="font-semibold text-emerald-700">
                    Total Government Contributions:
                  </span>
                  <span className="text-xl font-bold text-emerald-900">
                    {formatCurrency(govTotal)}
                  </span>
                </HStack>
                <BodySmall className="text-emerald-600 mt-2">
                  These will be applied when you check the boxes in the payslip
                  (usually 3rd or 4th week)
                </BodySmall>
              </div>
            </CardSection>

            <HStack justify="end" gap="3">
              <Button variant="secondary" onClick={resetForm}>
                Reset
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                Save Deductions
              </Button>
            </HStack>
          </>
        )}
      </VStack>
    </DashboardLayout>
  );
}