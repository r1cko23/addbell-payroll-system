"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSection } from "@/components/ui/card-section";
import { H1, H3, H4, BodySmall, Caption } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { format, addDays, parseISO } from "date-fns";
import {
  determineDayType,
  getDayName,
  formatDateShort,
} from "@/utils/holidays";
import { getDayTypeLabel } from "@/utils/payroll-calculator";
import type { Holiday } from "@/utils/holidays";
import type { DailyAttendance } from "@/utils/payroll-calculator";
import { generateWeeklySummary } from "@/lib/timekeeper";
// Overtime removed - not part of business process
import {
  getBiMonthlyPeriodStart,
  getBiMonthlyPeriodEnd,
  getBiMonthlyWorkingDays,
  getNextBiMonthlyPeriod,
  getPreviousBiMonthlyPeriod,
  formatBiMonthlyPeriod,
} from "@/utils/bimonthly";

interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
}

interface DayData {
  date: string;
  dayName: string;
  dayType: string;
  regularHours: number | string;
  overtimeHours: number | string;
  nightDiffHours: number | string;
}

export default function TimesheetPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null
  );
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [periodStart, setPeriodStart] = useState<Date>(
    getBiMonthlyPeriodStart(new Date()) // Bi-monthly period starts on Monday
  );
  const [periodDays, setPeriodDays] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (holidays.length > 0) {
      initializePeriodDays();
    }
  }, [periodStart, holidays]);

  async function loadInitialData() {
    try {
      // Load employees
      const { data: empData, error: empError } = await supabase
        .from("employees")
        .select("id, employee_id, full_name")
        .eq("is_active", true)
        .order("full_name");

      if (empError) throw empError;
      setEmployees(empData || []);

      // Load holidays
      const { data: holidayData, error: holidayError } = await supabase
        .from("holidays")
        .select("holiday_date, holiday_name, holiday_type")
        .eq("year", 2025)
        .eq("is_active", true);

      if (holidayError) throw holidayError;

      const formattedHolidays: Holiday[] = (holidayData || []).map((h) => ({
        date: h.holiday_date,
        name: h.holiday_name,
        type: h.holiday_type as "regular" | "non-working",
      }));

      setHolidays(formattedHolidays);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  function initializePeriodDays() {
    const workingDays = getBiMonthlyWorkingDays(periodStart);
    const days: DayData[] = [];

    workingDays.forEach((date) => {
      const dateString = format(date, "yyyy-MM-dd");
      const dayType = determineDayType(dateString, holidays);

      days.push({
        date: dateString,
        dayName: getDayName(dateString),
        dayType,
        regularHours: 0,
        overtimeHours: 0,
        nightDiffHours: 0,
      });
    });

    setPeriodDays(days);
  }

  function updateDayHours(index: number, field: string, value: string) {
    if (!selectedEmployee) return;

    // Store string as-is to allow smooth typing
    const updatedDays = [...periodDays];
    updatedDays[index] = {
      ...updatedDays[index],
      [field]: value,
    };

    setPeriodDays(updatedDays);
  }

  function changePeriod(direction: "prev" | "next") {
    if (direction === "prev") {
      setPeriodStart(getPreviousBiMonthlyPeriod(periodStart));
    } else {
      setPeriodStart(getNextBiMonthlyPeriod(periodStart));
    }
  }

  async function handleSave() {
    if (!selectedEmployee) {
      toast.error("Please select an employee");
      return;
    }

    // Convert string values to numbers for validation and saving
    const toNumber = (val: string | number) =>
      typeof val === "string" ? parseFloat(val) || 0 : val;

    const hasAnyHours = periodDays.some(
      (day) =>
        toNumber(day.regularHours) > 0 ||
        toNumber(day.overtimeHours) > 0 ||
        toNumber(day.nightDiffHours) > 0
    );

    if (!hasAnyHours) {
      toast.error("Please enter at least some hours");
      return;
    }

    setSaving(true);

    try {
      const attendanceData: DailyAttendance[] = periodDays.map((day) => ({
        date: day.date,
        dayType: day.dayType as any,
        regularHours: toNumber(day.regularHours),
        overtimeHours: toNumber(day.overtimeHours),
        nightDiffHours: toNumber(day.nightDiffHours),
      }));

      const totalRegularHours = periodDays.reduce(
        (sum, d) => sum + toNumber(d.regularHours),
        0
      );
      const totalOvertimeHours = periodDays.reduce(
        (sum, d) => sum + toNumber(d.overtimeHours),
        0
      );
      const totalNightDiffHours = periodDays.reduce(
        (sum, d) => sum + toNumber(d.nightDiffHours),
        0
      );
      const grossPay = 0; // Removed rate calculation

      const periodEnd = getBiMonthlyPeriodEnd(periodStart);

      // Check if attendance already exists
      const { data: existingData } = await supabase
        .from("weekly_attendance")
        .select("id")
        .eq("employee_id", selectedEmployee.id)
        .eq("period_start", format(periodStart, "yyyy-MM-dd"))
        .single();

      if (existingData) {
        // Update existing
        const { error } = await supabase
          .from("weekly_attendance")
          .update({
            attendance_data: attendanceData,
            total_regular_hours: totalRegularHours,
            total_overtime_hours: totalOvertimeHours,
            total_night_diff_hours: totalNightDiffHours,
            gross_pay: grossPay,
          })
          .eq("id", existingData.id);

        if (error) throw error;
        toast.success("Timesheet updated successfully!", {
          description: `Period: ${formatBiMonthlyPeriod(
            periodStart,
            periodEnd
          )}`,
        });
      } else {
        // Create new
        const { error } = await supabase.from("weekly_attendance").insert([
          {
            employee_id: selectedEmployee.id,
            period_start: format(periodStart, "yyyy-MM-dd"),
            period_end: format(periodEnd, "yyyy-MM-dd"),
            period_type: "bimonthly",
            attendance_data: attendanceData,
            total_regular_hours: totalRegularHours,
            total_overtime_hours: totalOvertimeHours,
            total_night_diff_hours: totalNightDiffHours,
            gross_pay: grossPay,
          },
        ]);

        if (error) throw error;
        toast.success("Timesheet saved successfully!", {
          description: `Period: ${formatBiMonthlyPeriod(
            periodStart,
            periodEnd
          )}`,
        });
      }

      // Clear form
      initializePeriodDays();
    } catch (error: any) {
      console.error("Error saving timesheet:", error);
      toast.error(error.message || "Failed to save timesheet");
    } finally {
      setSaving(false);
    }
  }

  async function copyLastPeriod() {
    if (!selectedEmployee) {
      toast.error("Please select an employee first");
      return;
    }

    const lastPeriodStart = getPreviousBiMonthlyPeriod(periodStart);

    try {
      const { data, error } = await supabase
        .from("weekly_attendance")
        .select("*")
        .eq("employee_id", selectedEmployee.id)
        .eq("period_start", format(lastPeriodStart, "yyyy-MM-dd"))
        .maybeSingle();

      if (error) throw error;

      if (!data || !data.attendance_data) {
        toast.error(
          `No timesheet found for period starting ${format(
            lastPeriodStart,
            "MMM d, yyyy"
          )}`
        );
        return;
      }

      // Map last period's data to current period
      const lastPeriodData = data.attendance_data as DailyAttendance[];
      const updatedDays = periodDays.map((currentDay, index) => {
        const lastPeriodDay = lastPeriodData[index];
        if (lastPeriodDay) {
          return {
            ...currentDay,
            regularHours: lastPeriodDay.regularHours,
            overtimeHours: lastPeriodDay.overtimeHours,
            nightDiffHours: lastPeriodDay.nightDiffHours,
          };
        }
        return currentDay;
      });

      setPeriodDays(updatedDays);
      toast.success("Copied last period's hours! Review and save when ready.");
    } catch (error) {
      console.error("Error copying last period:", error);
      toast.error("Failed to copy last period's data");
    }
  }

  async function checkForClockEntries() {
    if (!selectedEmployee) return;

    try {
      const periodEnd = getBiMonthlyPeriodEnd(periodStart);
      const summary = await generateWeeklySummary(
        selectedEmployee.id,
        periodStart
      );

      if (summary.totalHours > 0) {
        // Check if timesheet is already populated
        const hasData = periodDays.some(
          (day) =>
            (typeof day.regularHours === "number" && day.regularHours > 0) ||
            (typeof day.overtimeHours === "number" && day.overtimeHours > 0) ||
            (typeof day.nightDiffHours === "number" && day.nightDiffHours > 0)
        );

        if (!hasData) {
          // Auto-import if timesheet is empty
          await autoImportFromClockEntries(false);
        }
      }
    } catch (error) {
      console.error("Error checking clock entries:", error);
    }
  }

  async function autoImportFromClockEntries(showToast = true) {
    if (!selectedEmployee) {
      if (showToast) toast.error("Please select an employee first");
      return;
    }

    try {
      if (showToast) toast.loading("Importing clock entries...");

      const periodEnd = getBiMonthlyPeriodEnd(periodStart);
      const summary = await generateWeeklySummary(
        selectedEmployee.id,
        periodStart
      );

      if (summary.totalHours === 0) {
        if (showToast) {
          toast.dismiss();
          toast.error("No clock entries found for this period");
        }
        return;
      }

      // Map clock entries to timesheet days
      const updatedDays = periodDays.map((day) => {
        const dailySummary = summary.dailySummaries.get(day.date);

        // Regular hours from clock entries (already capped at 8h in database)
        const regularHours = dailySummary?.regularHours || 0;

        // Overtime not used - always 0
        const overtimeHours = 0;

        // Night diff from clock entries
        const nightDiffHours = dailySummary?.nightDiffHours || 0;

        return {
          ...day,
          regularHours: regularHours,
          overtimeHours: overtimeHours,
          nightDiffHours: nightDiffHours,
        };
      });

      setPeriodDays(updatedDays);
      if (showToast) {
        toast.dismiss();
        const totalReg = updatedDays.reduce(
          (sum, d) =>
            sum + (typeof d.regularHours === "number" ? d.regularHours : 0),
          0
        );
        const totalOT = updatedDays.reduce(
          (sum, d) =>
            sum + (typeof d.overtimeHours === "number" ? d.overtimeHours : 0),
          0
        );
        toast.success(`Imported ${totalReg.toFixed(1)}h regular hours`);
      }
    } catch (error) {
      console.error("Error importing clock entries:", error);
      if (showToast) {
        toast.dismiss();
        toast.error("Failed to import clock entries");
      }
    }
  }

  function applyStandardPeriod() {
    if (!selectedEmployee) {
      toast.error("Please select an employee first");
      return;
    }

    // Apply 8 hours to all working days (Monday-Friday)
    const updatedDays = periodDays.map((day) => {
      const dayOfWeek = new Date(day.date).getDay();
      const isWorkDay = dayOfWeek >= 1 && dayOfWeek <= 5; // Monday-Friday
      const regularHours = isWorkDay ? 8 : 0;

      return {
        ...day,
        regularHours,
        overtimeHours: 0,
        nightDiffHours: 0,
      };
    });

    setPeriodDays(updatedDays);
    toast.success("Applied standard bi-monthly period (8hrs Mon-Fri)");
  }

  async function loadExistingTimesheet() {
    if (!selectedEmployee) return;

    try {
      const { data, error } = await supabase
        .from("weekly_attendance")
        .select("*")
        .eq("employee_id", selectedEmployee.id)
        .eq("period_start", format(periodStart, "yyyy-MM-dd"))
        .maybeSingle();

      if (error) throw error;

      if (data && data.attendance_data) {
        const loadedData = data.attendance_data as any[];
        const updatedDays = periodDays.map((day, index) => {
          const savedDay = loadedData[index];
          if (savedDay) {
            const regularHours = savedDay.regularHours || 0;
            const overtimeHours = savedDay.overtimeHours || 0;
            const nightDiffHours = savedDay.nightDiffHours || 0;

            return {
              ...day,
              regularHours,
              overtimeHours,
              nightDiffHours,
            };
          }
          return day;
        });
        setPeriodDays(updatedDays);
        toast.success("Loaded existing timesheet");
      }
    } catch (error) {
      console.error("Error loading timesheet:", error);
    }
  }

  useEffect(() => {
    if (selectedEmployee && periodDays.length > 0) {
      loadExistingTimesheet();
      checkForClockEntries(); // Auto-check for clock entries
    }
  }, [selectedEmployee, periodStart]);

  // Helper to convert string or number to number
  const toNum = (val: string | number) =>
    typeof val === "string" ? parseFloat(val) || 0 : val;

  const totalRegular = periodDays.reduce(
    (sum, day) => sum + toNum(day.regularHours),
    0
  );
  const totalNightDiff = periodDays.reduce(
    (sum, day) => sum + toNum(day.nightDiffHours),
    0
  );

  // Validation warnings
  const warnings: string[] = [];
  periodDays.forEach((day) => {
    const reg = toNum(day.regularHours);
    const nd = toNum(day.nightDiffHours);
    const total = reg + nd;

    if (total > 16) {
      warnings.push(
        `${day.dayName} (${formatDateShort(
          day.date
        )}): ${total} total hours exceeds 16 (possible duplicate entry?)`
      );
    }
  });

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
      <VStack gap="8" className="w-full pb-24">
        <VStack gap="2" align="start">
          <H1>Timesheet Entry</H1>
          <BodySmall>
            Enter hours for the bi-monthly period (Monday-Friday, 2 weeks)
          </BodySmall>
        </VStack>

        <CardSection>
          <VStack gap="4">
            {/* Period Navigation */}
            <VStack gap="2" align="start">
              <Label className="text-sm font-medium">
                Select Bi-Monthly Period (Monday - Friday, 2 weeks)
              </Label>
              <HStack gap="3" align="center" className="w-full">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => changePeriod("prev")}
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
                  onClick={() => changePeriod("next")}
                >
                  <Icon name="CaretRight" size={IconSizes.sm} />
                </Button>
              </HStack>
            </VStack>

            {/* Employee Selection */}
            <VStack gap="2" align="start">
              <Label className="text-sm font-medium">Select Employee</Label>
              <Select
                value={selectedEmployee?.id || ""}
                onValueChange={(value) => {
                  const emp = employees.find((emp) => emp.id === value);
                  setSelectedEmployee(emp || null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="-- Select Employee --" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.employee_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </VStack>
          </VStack>
        </CardSection>

        {selectedEmployee && (
          <CardSection title="Hours Entry">
            {/* Validation Warnings */}
            {warnings.length > 0 && (
              <div className="mb-4 bg-yellow-50 border-l-4 border-yellow-400 p-4">
                <HStack gap="3" align="start">
                  <Icon
                    name="WarningCircle"
                    size={IconSizes.md}
                    className="text-yellow-400 flex-shrink-0"
                  />
                  <VStack gap="2" align="start">
                    <H3 className="text-sm font-medium text-yellow-800">
                      Validation Warnings ({warnings.length})
                    </H3>
                    <ul className="list-disc pl-5 space-y-1 text-sm text-yellow-700">
                      {warnings.map((warning, idx) => (
                        <li key={idx}>{warning}</li>
                      ))}
                    </ul>
                    <Caption className="text-yellow-600">
                      These are just warnings. Review the data and save if
                      correct.
                    </Caption>
                  </VStack>
                </HStack>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                      Day
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                      Day Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                      Regular Hrs
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                      Night Diff Hrs
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  {periodDays.map((day, index) => (
                    <tr key={day.date} className="hover:bg-muted/50">
                      <td className="px-4 py-3 text-sm font-medium text-foreground">
                        {day.dayName}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {formatDateShort(day.date)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            day.dayType === "regular-holiday" ||
                            day.dayType === "sunday-regular-holiday"
                              ? "bg-red-100 text-red-800"
                              : day.dayType === "non-working-holiday" ||
                                day.dayType === "sunday-special-holiday"
                              ? "bg-yellow-100 text-yellow-800"
                              : day.dayType === "sunday"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {getDayTypeLabel(day.dayType as any)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={day.regularHours || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            // Allow empty, numbers, and decimals
                            if (val === "" || /^\d*\.?\d*$/.test(val)) {
                              updateDayHours(index, "regularHours", val);
                            }
                          }}
                          placeholder="0"
                          className="w-24 px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent text-center"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={day.nightDiffHours || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            // Allow empty, numbers, and decimals
                            if (val === "" || /^\d*\.?\d*$/.test(val)) {
                              updateDayHours(index, "nightDiffHours", val);
                            }
                          }}
                          placeholder="0"
                          className="w-24 px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent text-center"
                        />
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-primary-50 font-bold">
                    <td colSpan={3} className="px-4 py-3 text-sm text-right">
                      BI-MONTHLY TOTALS →
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-foreground">
                      {totalRegular.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-foreground">
                      {totalNightDiff.toFixed(1)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Quick Fill Templates */}
            {/* Auto-Import Info Banner */}
            <div className="mt-4 p-4 bg-gradient-to-r from-emerald-50 to-emerald-100 rounded-lg border-2 border-emerald-200">
              <HStack gap="3" align="start">
                <Icon
                  name="Clock"
                  size={IconSizes.md}
                  className="text-purple-600 flex-shrink-0"
                />
                <VStack gap="2" align="start" className="flex-1">
                  <H4 className="text-sm font-bold text-purple-900">
                    🤖 Auto-Sync Enabled
                  </H4>
                  <BodySmall className="text-purple-800">
                    Hours automatically populate from approved employee clock
                    entries. You can still manually adjust any values below.
                  </BodySmall>
                  <HStack gap="2" align="center" className="flex-wrap">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        initializePeriodDays();
                        setTimeout(() => autoImportFromClockEntries(true), 100);
                      }}
                      className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
                    >
                      <Icon name="Clock" size={IconSizes.sm} />
                      Refresh from Clock
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={applyStandardPeriod}
                    >
                      Standard Period
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={copyLastPeriod}
                    >
                      Copy Last Period
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={initializePeriodDays}
                    >
                      Clear All
                    </Button>
                  </HStack>
                </VStack>
              </HStack>
            </div>

            {/* Save Actions */}
            <HStack justify="end" gap="3" className="mt-6">
              <Button onClick={handleSave} disabled={saving}>
                💾 Save Timesheet
              </Button>
            </HStack>
          </CardSection>
        )}
      </VStack>
    </DashboardLayout>
  );
}
