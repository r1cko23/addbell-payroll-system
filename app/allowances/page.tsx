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
import { format } from "date-fns";
import {
  getBiMonthlyPeriodStart,
  getBiMonthlyPeriodEnd,
  formatBiMonthlyPeriod,
} from "@/utils/bimonthly";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { useRouter } from "next/navigation";

interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
  last_name?: string | null;
  first_name?: string | null;
}

interface CutoffAllowance {
  id?: string;
  employee_id: string;
  period_start: string;
  period_end: string;
  transpo_allowance: number;
  load_allowance: number;
  allowance: number;
  refund: number;
}

export default function AllowancesPage() {
  const router = useRouter();
  const { canAccessSalaryInfo, loading: roleLoading } = useUserRole();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [periodStart, setPeriodStart] = useState<Date>(() =>
    getBiMonthlyPeriodStart(new Date())
  );
  const [allowance, setAllowance] = useState<CutoffAllowance | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    transpo_allowance: "0",
    load_allowance: "0",
    allowance: "0",
    refund: "0",
  });

  const supabase = createClient();

  // Redirect HR users without salary access
  useEffect(() => {
    if (!roleLoading && !canAccessSalaryInfo) {
      toast.error("You do not have permission to access this page.");
      router.push("/dashboard");
    }
  }, [canAccessSalaryInfo, roleLoading, router]);

  useEffect(() => {
    if (!roleLoading && canAccessSalaryInfo) {
      loadEmployees();
    }
  }, [roleLoading, canAccessSalaryInfo]);

  useEffect(() => {
    if (selectedEmployeeId && !roleLoading && canAccessSalaryInfo) {
      loadAllowance();
    }
  }, [selectedEmployeeId, periodStart, roleLoading, canAccessSalaryInfo]);

  async function loadEmployees() {
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("id, employee_id, full_name, last_name, first_name")
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

  async function loadAllowance() {
    try {
      const periodStartStr = format(periodStart, "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("cutoff_allowances")
        .select("*")
        .eq("employee_id", selectedEmployeeId)
        .eq("period_start", periodStartStr)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setAllowance(data);
        setFormData({
          transpo_allowance: (data.transpo_allowance || 0).toString(),
          load_allowance: (data.load_allowance || 0).toString(),
          allowance: (data.allowance || 0).toString(),
          refund: (data.refund || 0).toString(),
        });
      } else {
        setAllowance(null);
        resetForm();
      }
    } catch (error) {
      console.error("Error loading allowance:", error);
      toast.error("Failed to load allowance");
    }
  }

  function resetForm() {
    setFormData({
      transpo_allowance: "0",
      load_allowance: "0",
      allowance: "0",
      refund: "0",
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

      const allowanceData = {
        employee_id: selectedEmployeeId,
        period_start: periodStartStr,
        period_end: periodEndStr,
        transpo_allowance: roundTo2Decimals(parseFloat(formData.transpo_allowance) || 0),
        load_allowance: roundTo2Decimals(parseFloat(formData.load_allowance) || 0),
        allowance: roundTo2Decimals(parseFloat(formData.allowance) || 0),
        refund: roundTo2Decimals(parseFloat(formData.refund) || 0),
      };

      if (allowance?.id) {
        // Update existing
        const { error } = await supabase
          .from("cutoff_allowances")
          .update(allowanceData)
          .eq("id", allowance.id);

        if (error) throw error;
        toast.success("Allowance updated successfully");
      } else {
        // Insert new
        const { error } = await supabase
          .from("cutoff_allowances")
          .insert(allowanceData);

        if (error) throw error;
        toast.success("Allowance saved successfully");
      }

      await loadAllowance();
    } catch (error: any) {
      console.error("Error saving allowance:", error);
      toast.error("Failed to save allowance: " + error.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading || roleLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <BodySmall>Loading...</BodySmall>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <VStack gap="8">
        <H1>Cutoff Allowances</H1>
        <BodySmall>
          Manage manual allowances per employee per cutoff period. These
          allowances will be included in the payroll report.
        </BodySmall>

        <CardSection>
          <VStack gap="4">
            <div className="grid grid-cols-2 gap-4">
              <VStack gap="2" align="start">
                <Label>Employee</Label>
                <Select
                  value={selectedEmployeeId}
                  onValueChange={setSelectedEmployeeId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
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

              <VStack gap="2" align="start">
                <Label>Cutoff Period</Label>
                <Input
                  type="date"
                  value={format(periodStart, "yyyy-MM-dd")}
                  onChange={(e) => {
                    const date = new Date(e.target.value);
                    setPeriodStart(getBiMonthlyPeriodStart(date));
                  }}
                />
                <Caption>{formatBiMonthlyPeriod(periodStart, getBiMonthlyPeriodEnd(periodStart))}</Caption>
              </VStack>
            </div>

            {selectedEmployeeId && (
              <>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <VStack gap="2" align="start">
                    <Label>Transportation Allowance</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.transpo_allowance}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          transpo_allowance: e.target.value,
                        })
                      }
                    />
                    <Caption>Transportation allowance for this cutoff</Caption>
                  </VStack>

                  <VStack gap="2" align="start">
                    <Label>Load Allowance</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.load_allowance}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          load_allowance: e.target.value,
                        })
                      }
                    />
                    <Caption>Load allowance for this cutoff</Caption>
                  </VStack>

                  <VStack gap="2" align="start">
                    <Label>General Allowance</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.allowance}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          allowance: e.target.value,
                        })
                      }
                    />
                    <Caption>General allowance for this cutoff</Caption>
                  </VStack>

                  <VStack gap="2" align="start">
                    <Label>Refund</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.refund}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          refund: e.target.value,
                        })
                      }
                    />
                    <Caption>Refund amount for this cutoff</Caption>
                  </VStack>
                </div>

                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <HStack justify="between" align="center">
                    <span className="font-semibold text-blue-700">
                      Total Allowances:
                    </span>
                    <span className="text-xl font-bold text-blue-900">
                      {formatCurrency(
                        Math.round(
                          (parseFloat(formData.transpo_allowance || "0") +
                            parseFloat(formData.load_allowance || "0") +
                            parseFloat(formData.allowance || "0") +
                            parseFloat(formData.refund || "0")) *
                            100
                        ) / 100
                      )}
                    </span>
                  </HStack>
                </div>

                <HStack justify="end" gap="3">
                  <Button variant="secondary" onClick={resetForm}>
                    Reset
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? "Saving..." : "Save Allowances"}
                  </Button>
                </HStack>
              </>
            )}
          </VStack>
        </CardSection>
      </VStack>
    </DashboardLayout>
  );
}