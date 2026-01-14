"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { useAssignedGroups } from "@/lib/hooks/useAssignedGroups";
import { CardSection } from "@/components/ui/card-section";
import { H1, BodySmall } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { format, parseISO, getDay, startOfMonth, endOfMonth } from "date-fns";
import {
  determineDayType,
  getDayName,
  formatDateShort,
} from "@/utils/holidays";
import type { Holiday } from "@/utils/holidays";
import { normalizeHolidays } from "@/utils/holidays";
import {
  getBiMonthlyPeriodStart,
  getBiMonthlyPeriodEnd,
  getBiMonthlyWorkingDays,
} from "@/utils/bimonthly";
import { calculateBasePay } from "@/utils/base-pay-calculator";

interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
  last_name?: string | null;
  first_name?: string | null;
  eligible_for_ot?: boolean | null;
  position?: string | null;
  employee_type?: "office-based" | "client-based" | null;
  hire_date?: string | null;
  termination_date?: string | null;
}

interface ClockEntry {
  id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  regular_hours: number | null;
  total_hours: number | null;
  total_night_diff_hours: number | null;
  status: string;
}

interface Schedule {
  schedule_date: string;
  start_time: string;
  end_time: string;
  day_off?: boolean;
}

interface LeaveRequest {
  id: string;
  leave_type: string; // SIL, LWOP, CTO, OB, etc.
  start_date: string;
  end_date: string;
  status: string; // approved_by_hr, approved_by_manager, etc.
  selected_dates?: string[] | null;
}

interface OvertimeRequest {
  id: string;
  ot_date: string;
  end_date?: string | null;
  start_time: string;
  end_time: string;
  total_hours: number;
  status: string; // approved, pending, rejected
}

interface AttendanceDay {
  date: string;
  dayName: string;
  dayType: string;
  status: string; // LOG, CTO, LWOP, LEAVE, ABSENT, INC, OT, OB, -, etc.
  timeIn: string | null;
  timeOut: string | null;
  schedIn: string | null;
  schedOut: string | null;
  bh: number; // Basic Hours
  ot: number; // Overtime Hours (from approved OT filings)
  lt: number; // Late (minutes)
  ut: number; // Undertime (minutes)
  nd: number; // Night Differential
}

export default function TimesheetPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null
  );
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [cutoffPeriod, setCutoffPeriod] = useState<"first" | "second">("first");
  const [attendanceDays, setAttendanceDays] = useState<AttendanceDay[]>([]);
  const [clockEntries, setClockEntries] = useState<ClockEntry[]>([]);
  const [schedules, setSchedules] = useState<Map<string, Schedule>>(new Map());
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [otRequests, setOtRequests] = useState<OvertimeRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();
  const { isAdmin, isHR, loading: roleLoading } = useUserRole();
  const { groupIds: assignedGroupIds, loading: groupsLoading } = useAssignedGroups();

  // Calculate period start/end based on month and cutoff
  const periodStart =
    cutoffPeriod === "first"
      ? new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1)
      : new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 16);
  const periodEnd = getBiMonthlyPeriodEnd(periodStart);

  useEffect(() => {
    if (!groupsLoading && !roleLoading) {
      loadInitialData();
    }
  }, [selectedMonth, assignedGroupIds, groupsLoading, roleLoading, isAdmin]); // Reload holidays when month changes

  useEffect(() => {
    if (selectedEmployee) {
      // First ensure timesheet exists, then load data
      // Don't wait for holidays - they're not critical for attendance display
      ensureTimesheetExists().then(() => {
        loadAttendanceData();
      });
    }
  }, [selectedEmployee, selectedMonth, cutoffPeriod]);

  async function ensureTimesheetExists() {
    if (!selectedEmployee) return;

    try {
      const periodStartStr = format(periodStart, "yyyy-MM-dd");
      const periodEndStr = format(periodEnd, "yyyy-MM-dd");

      // Check if timesheet exists
      const { data: existingTimesheet } = await supabase
        .from("weekly_attendance")
        .select("id")
        .eq("employee_id", selectedEmployee.id)
        .eq("period_start", periodStartStr)
        .maybeSingle();

      // If no timesheet exists, auto-generate it
      if (!existingTimesheet) {
        const response = await fetch("/api/timesheet/auto-generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            period_start: periodStartStr,
            period_end: periodEndStr,
            employee_ids: [selectedEmployee.id],
            overwrite_existing: false,
          }),
        });

        if (!response.ok) {
          console.warn("Failed to auto-generate timesheet");
        }
      }
    } catch (error) {
      console.error("Error ensuring timesheet exists:", error);
    }
  }

  async function loadInitialData() {
    try {
      // Load employees with filtering by assigned groups for approvers/viewers
      let query = supabase
        .from("employees")
        .select("id, employee_id, full_name, eligible_for_ot, position, employee_type, hire_date, overtime_group_id, last_name, first_name")
        .eq("is_active", true)
        .order("last_name", { ascending: true, nullsFirst: false })
        .order("first_name", { ascending: true, nullsFirst: false });

      // Filter by assigned groups if user is approver/viewer (not admin or HR)
      // Admin and HR should see all employees
      if (!isAdmin && !isHR && assignedGroupIds.length > 0) {
        query = query.in("overtime_group_id", assignedGroupIds);
      }

      const { data: empData, error: empError } = await query;

      if (empError) throw empError;
      setEmployees(empData || []);

      // Load holidays for the selected month
      const monthStart = startOfMonth(selectedMonth);
      const monthEnd = endOfMonth(selectedMonth);
      const monthStartStr = format(monthStart, "yyyy-MM-dd");
      const monthEndStr = format(monthEnd, "yyyy-MM-dd");

      const { data: holidayData, error: holidayError } = await supabase
        .from("holidays")
        .select("holiday_date, name, is_regular")
        .gte("holiday_date", monthStartStr)
        .lte("holiday_date", monthEndStr);

      if (holidayError) {
        console.warn("Error loading holidays (non-critical):", holidayError);
        // Don't throw - holidays are not critical for attendance display
      }

      const holidaysArray = holidayData as Array<{
        holiday_date: string;
        name: string;
        is_regular: boolean;
      }> | null;

      // Normalize holidays to ensure consistent date format
      const formattedHolidays: Holiday[] = normalizeHolidays(
        (holidaysArray || []).map((h) => ({
          date: h.holiday_date,
          name: h.name,
          type: h.is_regular ? "regular" : "non-working",
        }))
      );

      setHolidays(formattedHolidays);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  async function loadAttendanceData() {
    if (!selectedEmployee) {
      console.log("No employee selected");
      return;
    }

    try {
      const periodStartStr = format(periodStart, "yyyy-MM-dd");
      const periodEndStr = format(periodEnd, "yyyy-MM-dd");

      // Create date range - use a wider range to account for timezone differences
      // Query from 1 day before period start to 1 day after period end to ensure we catch all records
      // Then filter by date in application layer using Asia/Manila timezone
      const periodStartDate = new Date(periodStart);
      periodStartDate.setHours(0, 0, 0, 0);
      periodStartDate.setDate(periodStartDate.getDate() - 1); // Start 1 day earlier

      const periodEndDate = new Date(periodEnd);
      periodEndDate.setHours(23, 59, 59, 999);
      periodEndDate.setDate(periodEndDate.getDate() + 1); // End 1 day later

      console.log("Loading attendance data:", {
        employee: selectedEmployee.full_name,
        periodStart: periodStartStr,
        periodEnd: periodEndStr,
        queryStart: periodStartDate.toISOString(),
        queryEnd: periodEndDate.toISOString(),
      });

      // Load ALL clock entries (both complete and incomplete) for the period
      // Use wider date range to account for timezone differences, then filter by date in app
      const { data: clockData, error: clockError } = await supabase
        .from("time_clock_entries")
        .select(
          "id, clock_in_time, clock_out_time, regular_hours, total_hours, total_night_diff_hours, status"
        )
        .eq("employee_id", selectedEmployee.id)
        .gte("clock_in_time", periodStartDate.toISOString())
        .lte("clock_in_time", periodEndDate.toISOString())
        .order("clock_in_time", { ascending: true });

      if (clockError) {
        console.error("Error loading clock entries:", clockError);
        console.error("Error details:", {
          message: clockError.message,
          code: clockError.code,
          details: clockError.details,
          hint: clockError.hint,
        });
        toast.error(
          `Failed to load time entries: ${
            clockError.message || "Unknown error"
          }`
        );
        // Don't throw - continue with empty data so user can see the interface
        setClockEntries([]);
        setAttendanceDays([]);
        return;
      }

      // Filter entries by date in Asia/Manila timezone to ensure accuracy
      const filteredClockData = (clockData || []).filter((entry: any) => {
        const entryDate = new Date(entry.clock_in_time);
        // Convert to Asia/Manila timezone for date comparison
        const entryDatePH = new Date(
          entryDate.toLocaleString("en-US", { timeZone: "Asia/Manila" })
        );
        const entryDateStr = format(entryDatePH, "yyyy-MM-dd");
        // Check if entry date falls within the period
        return entryDateStr >= periodStartStr && entryDateStr <= periodEndStr;
      });

      // Filter to only include entries with valid status (exclude rejected and pending)
      // Include all statuses that indicate the entry is valid: auto_approved, approved, clocked_out, clocked_in
      // This matches the employee portal logic to ensure consistent data
      const validEntries = filteredClockData.filter(
        (e: any) =>
          e.status !== "rejected" &&
          e.status !== "pending" &&
          (e.status === "auto_approved" ||
            e.status === "approved" ||
            e.status === "clocked_out" ||
            e.status === "clocked_in")
      );

      console.log("Loaded ALL clock entries:", clockData?.length || 0);
      console.log(
        "Filtered clock entries (within period):",
        filteredClockData.length
      );

      if (filteredClockData && filteredClockData.length > 0) {
        console.log("Sample clock entry:", filteredClockData[0]);
        // Log all dates found to help debug missing records
        const datesFound = filteredClockData.map((entry: any) => {
          const entryDate = new Date(entry.clock_in_time);
          const entryDatePH = new Date(
            entryDate.toLocaleString("en-US", { timeZone: "Asia/Manila" })
          );
          const date = format(entryDatePH, "yyyy-MM-dd");
          return {
            date,
            clock_in_time: entry.clock_in_time,
            status: entry.status,
          };
        });
        console.log(
          "Dates found in clock entries (Asia/Manila timezone):",
          datesFound
        );

        // Check specifically for Dec 16
        const dec16Entries = filteredClockData.filter((entry: any) => {
          const entryDate = new Date(entry.clock_in_time);
          const entryDatePH = new Date(
            entryDate.toLocaleString("en-US", { timeZone: "Asia/Manila" })
          );
          const date = format(entryDatePH, "yyyy-MM-dd");
          return date === "2025-12-16";
        });
        if (dec16Entries.length > 0) {
          console.log("Found Dec 16 entries:", dec16Entries);
        } else {
          console.warn(
            "No entries found for 2025-12-16. Checking all entries around that date..."
          );
          const nearbyEntries = filteredClockData.filter((entry: any) => {
            const entryDate = new Date(entry.clock_in_time);
            const entryDatePH = new Date(
              entryDate.toLocaleString("en-US", { timeZone: "Asia/Manila" })
            );
            const dec16 = new Date("2025-12-16");
            const diffDays = Math.abs(
              (entryDatePH.getTime() - dec16.getTime()) / (1000 * 60 * 60 * 24)
            );
            return diffDays <= 2; // Within 2 days
          });
          console.log("Entries within 2 days of Dec 16:", nearbyEntries);
        }
      } else {
        console.warn(
          "No clock entries found for period. Checking if employee has any entries..."
        );
        // Fallback: Check if employee has ANY entries to verify query is working
        const { data: anyEntries } = await supabase
          .from("time_clock_entries")
          .select("clock_in_time")
          .eq("employee_id", selectedEmployee.id)
          .limit(5)
          .order("clock_in_time", { ascending: false });
        console.log("Recent entries for employee (any date):", anyEntries);

        // Also check raw data before filtering
        if (clockData && clockData.length > 0) {
          console.warn(
            `Found ${clockData.length} entries before filtering, but ${filteredClockData.length} after filtering.`
          );
          console.log(
            "Raw entries (first 5):",
            clockData.slice(0, 5).map((e: any) => ({
              clock_in_time: e.clock_in_time,
              date_utc: format(parseISO(e.clock_in_time), "yyyy-MM-dd"),
              date_ph: format(
                new Date(
                  new Date(e.clock_in_time).toLocaleString("en-US", {
                    timeZone: "Asia/Manila",
                  })
                ),
                "yyyy-MM-dd"
              ),
            }))
          );
        }
      }
      setClockEntries(validEntries || []);

      // Separate complete and incomplete entries from valid clock entries only
      const completeEntries = validEntries.filter(
        (entry: any) => entry.clock_out_time !== null
      );
      const incompleteEntries = validEntries.filter(
        (entry: any) => entry.clock_out_time === null
      );

      console.log("Loaded complete entries:", completeEntries.length);
      console.log("Loaded incomplete entries:", incompleteEntries.length);

      // Load leave requests for the period
      // Leave requests overlap if: start_date <= periodEnd AND end_date >= periodStart
      const { data: leaveData, error: leaveError } = await supabase
        .from("leave_requests")
        .select("id, leave_type, start_date, end_date, status, selected_dates")
        .eq("employee_id", selectedEmployee.id)
        .lte("start_date", periodEndStr)
        .gte("end_date", periodStartStr)
        .in("status", ["approved_by_manager", "approved_by_hr"]);

      if (leaveError) {
        console.warn("Error loading leave requests:", leaveError);
        // Continue without leave data
      }

      if (leaveError) {
        console.warn("Error loading leave requests:", leaveError);
      }

      console.log("Loaded leave requests:", leaveData?.length || 0);
      if (leaveData && leaveData.length > 0) {
        console.log("Sample leave request:", leaveData[0]);
      }
      setLeaveRequests(leaveData || []);

      // Load OT requests for the period
      // IMPORTANT: Always fetch approved OT requests for display purposes, regardless of eligible_for_ot flag
      // The eligible_for_ot flag controls whether employees can FILE new OT requests, not whether
      // existing approved OT requests should be displayed in time attendance
      const { data: otRequests, error: otError } = await supabase
        .from("overtime_requests")
        .select(
          "id, ot_date, end_date, start_time, end_time, total_hours, status"
        )
        .eq("employee_id", selectedEmployee.id)
        .gte("ot_date", periodStartStr)
        .lte("ot_date", periodEndStr)
        .in("status", ["approved", "approved_by_manager", "approved_by_hr"]);

      let otData: any[] = [];
      if (otError) {
        console.warn("Error loading OT requests:", otError);
      } else {
        otData = otRequests || [];
      }

      console.log("Loaded OT requests:", otData.length);
      if (otData.length > 0) {
        console.log("Sample OT request:", otData[0]);
      }
      setOtRequests(otData);

      // Load schedules from employee_week_schedules (including day_off for rest day detection)
      const { data: scheduleData, error: scheduleError } = await supabase
        .from("employee_week_schedules")
        .select("schedule_date, start_time, end_time, day_off")
        .eq("employee_id", selectedEmployee.id)
        .gte("schedule_date", periodStartStr)
        .lte("schedule_date", periodEndStr);

      if (scheduleError) {
        console.warn("Error loading week schedules:", scheduleError);
      }

      console.log("Loaded schedules:", scheduleData?.length || 0);
      if (scheduleData && scheduleData.length > 0) {
        console.log("Sample schedule:", scheduleData[0]);
      }

      // Also try loading from employee_schedules (fallback for day-of-week based schedules)
      let scheduleMap = new Map<string, Schedule>();

      if (scheduleData && scheduleData.length > 0) {
        scheduleData.forEach((s: any) => {
          scheduleMap.set(s.schedule_date, {
            schedule_date: s.schedule_date,
            start_time: s.start_time,
            end_time: s.end_time,
            day_off: s.day_off || false,
          });
        });
      } else {
        // Fallback: Load from employee_schedules table (day-of-week based)
        const { data: dayOfWeekSchedules } = await supabase
          .from("employee_schedules")
          .select("day_of_week, shift_start_time, shift_end_time")
          .eq("employee_id", selectedEmployee.id)
          .eq("is_active", true);

        if (dayOfWeekSchedules && dayOfWeekSchedules.length > 0) {
          // Map day-of-week schedules to specific dates
          const workingDays = getBiMonthlyWorkingDays(periodStart);
          workingDays.forEach((date) => {
            const dayOfWeek = getDay(date);
            const schedule = dayOfWeekSchedules.find(
              (s: any) => s.day_of_week === dayOfWeek
            );
            if (schedule) {
              const dateStr = format(date, "yyyy-MM-dd");
              scheduleMap.set(dateStr, {
                schedule_date: dateStr,
                start_time: (schedule as any).shift_start_time,
                end_time: (schedule as any).shift_end_time,
              });
            }
          });
        }
      }

      setSchedules(scheduleMap);
      generateAttendanceDays(
        completeEntries,
        incompleteEntries,
        leaveData || [],
        otData || [],
        scheduleMap,
        selectedEmployee?.employee_type
      );
    } catch (error: any) {
      console.error("Error loading attendance data:", error);
      console.error("Error details:", {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
      });
      toast.error(
        `Failed to load attendance data: ${error?.message || "Unknown error"}`
      );
      // Set empty arrays so UI doesn't break
      setClockEntries([]);
      setLeaveRequests([]);
      setOtRequests([]);
      setAttendanceDays([]);
    }
  }

  function generateAttendanceDays(
    entries: ClockEntry[],
    incompleteEntries: ClockEntry[],
    leaveRequests: LeaveRequest[],
    otRequests: OvertimeRequest[],
    scheduleMap: Map<string, Schedule>,
    employeeType?: "office-based" | "client-based" | null
  ) {
    const workingDays = getBiMonthlyWorkingDays(periodStart);
    const days: AttendanceDay[] = [];

    console.log("Generating attendance days:", {
      workingDaysCount: workingDays.length,
      entriesCount: entries.length,
      schedulesCount: scheduleMap.size,
    });

    // Group entries by date (using Asia/Manila timezone for accurate date grouping)
    const entriesByDate = new Map<string, ClockEntry[]>();
    entries.forEach((entry) => {
      if (!entry.clock_out_time) return;
      const entryDate = new Date(entry.clock_in_time);
      // Convert to Asia/Manila timezone for date grouping
      const entryDatePH = new Date(
        entryDate.toLocaleString("en-US", { timeZone: "Asia/Manila" })
      );
      const dateStr = format(entryDatePH, "yyyy-MM-dd");
      if (!entriesByDate.has(dateStr)) {
        entriesByDate.set(dateStr, []);
      }
      entriesByDate.get(dateStr)!.push(entry);
    });

    // Group incomplete entries by date (using Asia/Manila timezone)
    const incompleteByDate = new Map<string, ClockEntry[]>();
    incompleteEntries.forEach((entry) => {
      const entryDate = new Date(entry.clock_in_time);
      // Convert to Asia/Manila timezone for date grouping
      const entryDatePH = new Date(
        entryDate.toLocaleString("en-US", { timeZone: "Asia/Manila" })
      );
      const dateStr = format(entryDatePH, "yyyy-MM-dd");
      if (!incompleteByDate.has(dateStr)) {
        incompleteByDate.set(dateStr, []);
      }
      incompleteByDate.get(dateStr)!.push(entry);
    });

    // Group leave requests by date
    const leavesByDate = new Map<string, LeaveRequest[]>();
    leaveRequests.forEach((leave) => {
      const startDate = new Date(leave.start_date);
      const endDate = new Date(leave.end_date);
      let currentDate = new Date(startDate);

      // Use selected_dates if available, otherwise use date range
      if (leave.selected_dates && leave.selected_dates.length > 0) {
        leave.selected_dates.forEach((dateStr: string) => {
          if (!leavesByDate.has(dateStr)) {
            leavesByDate.set(dateStr, []);
          }
          leavesByDate.get(dateStr)!.push(leave);
        });
      } else {
        // Use date range
        while (currentDate <= endDate) {
          const dateStr = format(currentDate, "yyyy-MM-dd");
          if (!leavesByDate.has(dateStr)) {
            leavesByDate.set(dateStr, []);
          }
          leavesByDate.get(dateStr)!.push(leave);
          currentDate = new Date(currentDate);
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }
    });

    // Group OT requests by date
    const otByDate = new Map<string, OvertimeRequest[]>();
    otRequests.forEach((ot) => {
      // Normalize ot_date to just the date part (yyyy-MM-dd) to match dateStr format used in workingDays loop
      // ot_date might be a full timestamp (e.g., "2026-01-02T00:00:00") or just a date string
      const otDateStr = typeof ot.ot_date === "string"
        ? ot.ot_date.split("T")[0]
        : format(new Date(ot.ot_date), "yyyy-MM-dd");
      if (!otByDate.has(otDateStr)) {
        otByDate.set(otDateStr, []);
      }
      otByDate.get(otDateStr)!.push(ot);
    });

    console.log("Entries grouped by date:", entriesByDate.size);
    console.log("Incomplete entries:", incompleteByDate.size);
    console.log("Leave requests by date:", leavesByDate.size);
    console.log("OT requests by date:", otByDate.size);

    workingDays.forEach((date) => {
      const dateStr = format(date, "yyyy-MM-dd");
      const schedule = scheduleMap.get(dateStr);
      // Check if this is a rest day from employee schedule (day_off flag)
      // For Account Supervisors and others with custom rest days
      const isRestDay = schedule?.day_off === true;
      // Pass isClientBased so Sunday is not automatically treated as rest day for client-based employees
      const isClientBased = employeeType === "client-based";
      const dayType = determineDayType(dateStr, holidays, isRestDay, isClientBased);
      const dayOfWeek = getDay(date);
      const dayEntries = entriesByDate.get(dateStr) || [];
      const incompleteDayEntries = incompleteByDate.get(dateStr) || [];
      const dayLeaves = leavesByDate.get(dateStr) || [];
      const dayOTs = otByDate.get(dateStr) || [];

      // Check if this date is a holiday by checking the holidays array directly
      // This is a fallback in case determineDayType doesn't detect it
      const holidayForDate = holidays.find(h => {
        const normalizedHolidayDate = h.date.split('T')[0]; // Remove time if present
        return normalizedHolidayDate === dateStr;
      });

      // Debug logging for Dec 30-31
      if (dateStr === "2025-12-30" || dateStr === "2025-12-31") {
        console.log(`[Timesheet] Processing ${dateStr}:`, {
          dayType,
          holidaysCount: holidays.length,
          holidaysForDate: holidays.filter(h => h.date === dateStr || h.date.split('T')[0] === dateStr),
          holidayForDate,
          dayEntries: dayEntries.length,
          dayLeaves: dayLeaves.length,
        });
      }

      // Determine status based on priority:
      // 1. Holidays (check FIRST - before everything else)
      // 2. Leave requests (LWOP, LEAVE, CTO, OB)
      // 3. OT requests
      // 4. Complete time entries (LOG)
      // 5. Incomplete time entries (INC)
      // 6. Rest days (Sunday)
      // 7. Saturday (regular work day - paid 6 days/week)
      // 8. No entry = ABSENT
      let status = "-";
      let bh = 0; // Basic Hours

      // Check for holidays FIRST (before everything else) to ensure they're always detected
      // This is critical - holidays should be detected even if there are no clock entries
      // Check both dayType and direct holiday lookup
      const isHoliday = holidayForDate !== undefined ||
                       dayType === "regular-holiday" ||
                       dayType === "non-working-holiday" ||
                       dayType === "sunday-regular-holiday" ||
                       dayType === "sunday-special-holiday" ||
                       dayType.includes("holiday");

      if (isHoliday) {
        // Holiday - check BEFORE checking entries to ensure holidays are always detected
        // Even if employee didn't work, it's still a holiday (not ABSENT)
        // Determine if regular or special holiday
        const isRegularHoliday = holidayForDate?.type === "regular" ||
                                 dayType.includes("regular") ||
                                 dayType === "regular-holiday" ||
                                 dayType === "sunday-regular-holiday";
        status = isRegularHoliday ? "RH" : "SH";
        // Check if employee is eligible for holiday pay (worked day before)
        // Search up to 7 days back to find the last regular working day
        let eligibleForHoliday = false;
        for (let i = 1; i <= 7; i++) {
          const checkDate = new Date(date);
          checkDate.setDate(checkDate.getDate() - i);
          const checkDateStr = format(checkDate, "yyyy-MM-dd");
          const checkDayEntries = entriesByDate.get(checkDateStr) || [];
          const isClientBased = employeeType === "client-based";
          const checkDayType = determineDayType(checkDateStr, holidays, scheduleMap.get(checkDateStr)?.day_off === true, isClientBased);

          // Only check regular working days (skip holidays and rest days)
          if (checkDayType === "regular" && checkDayEntries.length > 0) {
            // Check if employee worked 8+ hours on this regular working day
            const workedHours = checkDayEntries.reduce((sum, e) => sum + (e.regular_hours || 0), 0);
            if (workedHours >= 8) {
              eligibleForHoliday = true;
              break;
            }
          }
        }
        // BH will be set based on eligibility (8 if eligible, 0 if not)
        // For consecutive holidays, if previous holiday was eligible, this one is too
        if (!eligibleForHoliday && days.length > 0) {
          const prevDay = days[days.length - 1];
          if ((prevDay.status === "RH" || prevDay.status === "SH") && prevDay.bh >= 8) {
            eligibleForHoliday = true;
          }
        }
        bh = eligibleForHoliday ? 8 : 0;
      } else if (dayLeaves.length > 0) {
        // Check leave requests (but holidays take priority)
        const leave = dayLeaves[0];
        if (leave.leave_type === "LWOP") {
          status = "LWOP";
          bh = 0;
        } else if (leave.leave_type === "CTO") {
          status = "CTO";
          bh = 8; // CTO typically counts as 8 hours
        } else if (
          leave.leave_type === "OB" ||
          leave.leave_type === "Official Business"
        ) {
          status = "OB";
          bh = 8;
        } else {
          // SIL or other leave types
          status = "LEAVE";
          bh = 8;
        }
      } else if (dayOTs.length > 0) {
        // OT request exists
        status = "OT";
        // BH will be calculated from time entries if they exist
      } else if (dayEntries.length > 0) {
        // Complete time entries exist
        status = "LOG";
      } else if (incompleteDayEntries.length > 0) {
        // Incomplete entry (clock_in but no clock_out)
        status = "INC";
      } else if (dayType === "sunday" || isRestDay) {
        // Rest day (Sunday is the designated rest day for office-based employees)
        // OR rest day from employee schedule (for Account Supervisors: Mon/Tue/Wed, or any day marked as rest day)
        // If no work, still show as rest day (paid)
        // If worked, show as LOG with rest day pay
        if (dayEntries.length > 0 || incompleteDayEntries.length > 0) {
          status = "LOG"; // Worked on rest day
        } else {
          status = "RD"; // Rest day - paid even if not worked
        }
      } else if (dayOfWeek === 6) {
        // Saturday - regular work day (paid 6 days/week per law)
        // Only applies if Saturday is NOT marked as a rest day in employee schedule
        // Employees are paid for Saturday even if they don't work (regular rate, not rest day premium)
        if (dayEntries.length > 0 || incompleteDayEntries.length > 0) {
          status = "LOG"; // Worked on Saturday
        } else {
          status = "LOG"; // Saturday - paid as regular work day even if not worked
        }
      } else if (dayOfWeek === 0) {
        // Sunday fallback (should be caught by dayType === "sunday" or isRestDay above)
        status = "RD"; // Rest day
      } else {
        // Check if the date is in the future (hasn't occurred yet)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const currentDate = new Date(date);
        currentDate.setHours(0, 0, 0, 0);

        if (currentDate > today) {
          // Future date - don't mark as ABSENT, just show "-"
          status = "-";
        } else {
          // Past or today date with no entry = ABSENT
          status = "ABSENT";
        }
      }

      // Get clock times (use first entry for the day, or incomplete entry)
      // For LWOP and LEAVE, don't show clock times
      const firstEntry = dayEntries[0] || incompleteDayEntries[0];
      const timeIn =
        status === "LWOP" || status === "LEAVE"
          ? null
          : firstEntry
          ? format(parseISO(firstEntry.clock_in_time), "hh:mm a")
          : null;
      const timeOut =
        status === "LWOP" || status === "LEAVE"
          ? null
          : firstEntry?.clock_out_time
          ? format(parseISO(firstEntry.clock_out_time), "hh:mm a")
          : null;

      // Get scheduled times
      let schedIn: string | null = null;
      let schedOut: string | null = null;
      if (schedule && schedule.start_time && schedule.end_time) {
        try {
          // Handle TIME format (HH:mm:ss) or full timestamp
          const startTimeStr = schedule.start_time.includes("T")
            ? schedule.start_time.split("T")[1].split(".")[0]
            : schedule.start_time;
          const endTimeStr = schedule.end_time.includes("T")
            ? schedule.end_time.split("T")[1].split(".")[0]
            : schedule.end_time;
          schedIn = format(parseISO(`2000-01-01T${startTimeStr}`), "hh:mm a");
          schedOut = format(parseISO(`2000-01-01T${endTimeStr}`), "hh:mm a");
        } catch (e) {
          console.warn("Error formatting schedule times:", e);
        }
      }

      // Calculate OT hours from approved OT filings
      // This should include ALL approved OT requests for this date, regardless of clock entries
      let otHours = 0;
      if (dayOTs.length > 0) {
        // Sum all approved OT hours for this date
        // Filter to only approved requests (status = "approved", "approved_by_manager", or "approved_by_hr")
        const approvedOTs = dayOTs.filter(ot =>
          ot.status === "approved" ||
          ot.status === "approved_by_manager" ||
          ot.status === "approved_by_hr"
        );
        otHours = approvedOTs.reduce((sum, ot) => sum + (ot.total_hours || 0), 0);
      }

      // Calculate ND (Night Differential) from approved OT requests
      // ND should come from overtime_requests, not from clock entries
      const isAccountSupervisor =
        selectedEmployee?.position
          ?.toUpperCase()
          .includes("ACCOUNT SUPERVISOR") || false;
      let ndHours = 0;

      if (!isAccountSupervisor && dayOTs.length > 0) {
        // Calculate ND from each approved OT request's start_time and end_time
        // Only process approved OT requests
        const approvedOTs = dayOTs.filter(ot =>
          ot.status === "approved" ||
          ot.status === "approved_by_manager" ||
          ot.status === "approved_by_hr"
        );
        approvedOTs.forEach((ot) => {
          if (ot.start_time && ot.end_time) {
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
            const otDateStr =
              typeof ot.ot_date === "string"
                ? ot.ot_date.split("T")[0]
                : format(new Date(ot.ot_date), "yyyy-MM-dd");
            const endDateStr = ot.end_date
              ? typeof ot.end_date === "string"
                ? ot.end_date.split("T")[0]
                : format(new Date(ot.end_date), "yyyy-MM-dd")
              : otDateStr;
            const spansMidnight = endDateStr !== otDateStr;

            let ndFromThisOT = 0;
            const nightStart = 17; // 5PM
            const nightEnd = 6; // 6AM

            // Convert times to minutes for easier calculation
            const startTotalMin = startHour * 60 + startMin;
            const endTotalMin = endHour * 60 + endMin;
            const nightStartMin = nightStart * 60; // 5PM = 1020 minutes
            const nightEndMin = nightEnd * 60; // 6AM = 360 minutes

            if (spansMidnight) {
              // OT spans midnight
              // Calculate ND from max(start_time, 5PM) to midnight, plus midnight to min(end_time, 6AM)
              const ndStartMin = Math.max(startTotalMin, nightStartMin);
              const hoursToMidnight = (24 * 60 - ndStartMin) / 60;

              let hoursFromMidnight = 0;
              if (endTotalMin <= nightEndMin) {
                // Ends before or at 6AM
                hoursFromMidnight = endTotalMin / 60;
              } else {
                // Ends after 6AM, cap at 6AM
                hoursFromMidnight = nightEndMin / 60;
              }

              ndFromThisOT = hoursToMidnight + hoursFromMidnight;
            } else {
              // OT on same day
              if (startTotalMin >= nightStartMin) {
                // Starts at or after 5PM
                ndFromThisOT = (endTotalMin - startTotalMin) / 60;
              } else if (endTotalMin >= nightStartMin) {
                // Starts before 5PM, ends after 5PM
                ndFromThisOT = (endTotalMin - nightStartMin) / 60;
              }
              // If both start and end are before 5PM, ND = 0
            }

            // Cap ND hours at total_hours (can't exceed OT hours) and ensure non-negative
            ndFromThisOT = Math.min(
              Math.max(0, ndFromThisOT),
              ot.total_hours || 0
            );
            ndHours += ndFromThisOT;
          }
        });
      }

      // Calculate BH (Basic Hours)
      // If status is already set from leave (CTO, LEAVE, OB), use that value
      // Otherwise, sum regular hours from complete entries
      // BH should always show regular hours (8), not OT hours
      if (bh === 0) {
        if (dayEntries.length > 0) {
          bh = dayEntries.reduce((sum, e) => sum + (e.regular_hours || 0), 0);
        } else if (
          status === "OT" &&
          dayOTs.length > 0 &&
          dayEntries.length === 0
        ) {
          // If OT status but no clock entries, BH can be 0 or 8 depending on context
          // For pure OT days without clock entries, BH is typically 0
          bh = 0;
        }
      }

      // SPECIAL CASE: January 1, 2026 - Set BH = 8 if no time log entries exist
      // This is because employees started using the system on January 6, 2026
      // So January 1 should have BH = 8 unless they actually logged time
      if (dateStr === "2026-01-01" && bh === 0 && dayEntries.length === 0) {
        bh = 8;
      }

      // Saturday Regular Work Day: Set BH = 8 even if employee didn't work
      // Per Philippine labor law, employees are paid 6 days/week (Mon-Sat)
      // Saturday is a regular work day - paid even if not worked, and counts towards days worked and total hours
      // This matches the payslip calculation logic in timesheet-auto-generator.ts
      // dayOfWeek from getDay(): 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      if (dayType === "regular" && bh === 0 && dayEntries.length === 0 && dayOfWeek === 6) {
        bh = 8; // Regular work day: 8 hours even if not worked (paid 6 days/week)
      }

      // IMPORTANT: BH is set based on:
      // 1. Actual completed time log entries (regular_hours from clock entries)
      // 2. Saturday company benefit (8 BH even if not worked) - matches payslip calculation
      // 3. Leave types (CTO, SIL, etc.) - handled above
      // The payslip calculation uses the same logic, ensuring consistency between timesheet and payslip

      // LT (Late) - Not applicable for flexible hours, always 0
      const lt = 0;

      // Calculate UT (Undertime) - only if BH < 8 hours
      // If employee already worked 8 hours (BH >= 8), there's no undertime
      let ut = 0;
      if (bh < 8 && firstEntry?.clock_out_time && schedule && schedule.end_time) {
        try {
          const endTimeStr = schedule.end_time.includes("T")
            ? schedule.end_time.split("T")[1].split(".")[0]
            : schedule.end_time;
          const scheduledOut = parseISO(`2000-01-01T${endTimeStr}`);
          const actualOut = parseISO(firstEntry.clock_out_time);
          const scheduledMinutes =
            scheduledOut.getHours() * 60 + scheduledOut.getMinutes();
          const actualMinutes =
            actualOut.getHours() * 60 + actualOut.getMinutes();
          const diffMinutes = scheduledMinutes - actualMinutes;
          ut = diffMinutes > 0 ? diffMinutes : 0;
        } catch (e) {
          console.warn("Error calculating undertime:", e);
        }
      }
      // If BH >= 8, UT is automatically 0 (no undertime if they completed required hours)

      // ND is already calculated from overtime_requests above
      // No need to calculate from clock entries - ND must come from approved OT requests only

      days.push({
        date: dateStr,
        dayName: getDayName(dateStr),
        dayType,
        status,
        timeIn,
        timeOut,
        schedIn,
        schedOut,
        bh: Math.round(bh * 100) / 100,
        ot: Math.round(otHours * 100) / 100,
        lt,
        ut,
        nd: Math.round(ndHours * 100) / 100,
      });
    });

    console.log("Generated attendance days:", days.length);
    if (days.length > 0) {
      console.log("Sample day:", days[0]);
      console.log(
        "Days with LOG status:",
        days.filter((d) => d.status === "LOG").length
      );
      console.log(
        "Days with ABSENT status:",
        days.filter((d) => d.status === "ABSENT").length
      );
      console.log(
        "Days with LEAVE status:",
        days.filter((d) => d.status === "LEAVE").length
      );
      console.log(
        "Days with LWOP status:",
        days.filter((d) => d.status === "LWOP").length
      );
      console.log(
        "Days with INC status:",
        days.filter((d) => d.status === "INC").length
      );
      console.log(
        "Days with OT status:",
        days.filter((d) => d.status === "OT").length
      );
    } else {
      console.warn(
        "No attendance days generated! Check period calculation and data loading."
      );
    }
    setAttendanceDays(days);
  }

  function handlePrint() {
    window.print();
  }

  const cutoffLabel =
    cutoffPeriod === "first"
      ? `First Cut Off 1 to 15`
      : `Second Cut Off 16 to ${format(periodEnd, "d")}`;

  // Calculate base pay using simplified 104-hour method (if employee data is available)
  // This applies to both client-based and office-based employees
  let basePayHours = 0;
  let absences = 0;
  let useBasePayMethod = false;

  if (selectedEmployee && clockEntries.length > 0 && schedules.size > 0 && holidays.length > 0) {
    // Create rest days map from schedules
    const restDaysMap = new Map<string, boolean>();
    schedules.forEach((schedule, dateStr) => {
      if (schedule.day_off) {
        restDaysMap.set(dateStr, true);
      }
    });

    // Extract clock entries for base pay calculation
    const clockEntriesForBasePay = clockEntries
      .filter((entry) => entry.clock_out_time !== null)
      .map((entry) => ({
        clock_in_time: entry.clock_in_time,
        clock_out_time: entry.clock_out_time!,
      }));

    // Calculate base pay
    const basePayResult = calculateBasePay({
      periodStart,
      periodEnd,
      clockEntries: clockEntriesForBasePay,
      restDays: restDaysMap,
      holidays: holidays.map((h) => ({ holiday_date: h.date })),
      isClientBased: selectedEmployee.employee_type === "client-based" || false,
      hireDate: selectedEmployee.hire_date ? parseISO(selectedEmployee.hire_date) : undefined,
      terminationDate: selectedEmployee.termination_date
        ? parseISO(selectedEmployee.termination_date)
        : undefined,
    });

    basePayHours = basePayResult.finalBaseHours;
    absences = basePayResult.absences;
    useBasePayMethod = true;
  }

  // Calculate "Days Work" - count regular working days AND eligible holidays
  // Days Work = days where:
  // 1. Date is today or earlier (not future dates)
  // 2. For regular days: Employee has completed logging (has both clock_in_time AND clock_out_time) AND BH > 0
  // 3. For holidays: BH > 0 (eligible holidays get 8 BH even without clock entries)
  // 4. Exclude non-working leave types (LWOP, CTO, OB)
  const todayForDaysWork = new Date();
  todayForDaysWork.setHours(0, 0, 0, 0);

  // Calculate "Days Work" using base pay method: (104 hours - absences × 8) / 8
  // This matches the payslip calculation exactly
  // Base logic: 104 hours per cutoff (13 days × 8 hours), then subtract absences
  let totalBH = 0;
  let daysWorked = 0;

  if (useBasePayMethod) {
    // Use base pay method: 104 hours - (absences × 8)
    // This matches payslip calculation
    // However, we need to count actual BH including holidays with BH > 0
    // Base pay method gives us the minimum, but holidays with BH should also count

    // Calculate total BH from actual attendance data (includes holidays with BH > 0)
    const actualTotalBH = attendanceDays.reduce((sum, d) => {
      const dayDate = new Date(d.date);
      dayDate.setHours(0, 0, 0, 0);

      // Only count days that are today or earlier
      if (dayDate > todayForDaysWork) {
        return sum;
      }

      // Exclude non-working leave types
      if (d.status === "LWOP" || d.status === "CTO" || d.status === "OB") {
        return sum;
      }

      // Rest days: Only exclude if NOT worked
      // If employee works on rest day, it counts toward Days Work AND they get rest day premium pay
      // Days Work can exceed 13 if employee works on rest days (e.g., 13 regular days + 2 rest days = 15 days)
      // Office-based: Sunday is rest day (dayType === "sunday" or status === "RD")
      // Account Supervisors: Rest days are Mon/Tue/Wed (from schedule day_off flag)
      const isRestDay = d.dayType === "sunday" || d.status === "RD";
      if (isRestDay) {
        // If rest day was worked (has BH > 0), count it toward Days Work
        // If rest day was NOT worked (BH === 0), exclude it (paid separately as rest day pay for rank/file)
        if (d.bh > 0) {
          // Rest day was worked - count it toward Days Work (no cap, can exceed 13 days)
          return sum + d.bh;
        } else {
          // Rest day was NOT worked - exclude from Days Work (paid separately)
          return sum;
        }
      }

      // Check if this is a holiday (RH, SH, or non-working holiday)
      const isHoliday = d.status === "RH" || d.status === "SH" || d.dayType === "regular-holiday" || d.dayType === "non-working-holiday";

      if (isHoliday) {
        // For holidays: count if BH > 0 (eligible holidays get 8 BH even without clock entries)
        // Holidays count toward the 13 days (they're included in the 104-hour base)
        if (d.bh > 0) {
          return sum + d.bh;
        }
      } else {
        // For regular days: count if BH > 0
        // This matches payslip calculation which counts regular days with regularHours > 0
        // Saturday (regular work day per law) gets 8 BH even if not worked, so it will be counted
        // Regular days (Mon-Fri) with BH > 0 are also counted (whether from clock entries or other sources)
        // Note: BH can come from clock entries, approved OT requests, or other sources
        if (d.bh > 0) {
          // Regular day with BH > 0 counts toward the 13 days
          // This matches payslip logic: dayType === "regular" && regularHours > 0
          return sum + d.bh;
        }
      }

      return sum;
    }, 0);

    // Use the maximum of basePayHours and actualTotalBH to ensure holidays with BH are counted
    totalBH = Math.max(basePayHours, actualTotalBH);
    daysWorked = totalBH / 8;
    // NOTE: Days Work can exceed 13 if employee works on rest days
    // Rest day work counts toward Days Work AND gets premium pay separately
    // Maximum is not capped at 13 to allow for rest day work
  } else {
    // Fallback: sum BH from attendance days (for display purposes)
    // But Days Work should still match base pay method if possible
    totalBH = attendanceDays.reduce((sum, d) => {
      const dayDate = new Date(d.date);
      dayDate.setHours(0, 0, 0, 0);

      // Only count days that are today or earlier
      if (dayDate > todayForDaysWork) {
        return sum;
      }

      // Exclude non-working leave types
      if (d.status === "LWOP" || d.status === "CTO" || d.status === "OB") {
        return sum;
      }

      // Rest days: Only exclude if NOT worked
      // If employee works on rest day, it counts toward Days Work AND they get rest day premium pay
      // Days Work can exceed 13 if employee works on rest days (e.g., 13 regular days + 2 rest days = 15 days)
      // Office-based: Sunday is rest day (dayType === "sunday" or status === "RD")
      // Account Supervisors: Rest days are Mon/Tue/Wed (from schedule day_off flag)
      const isRestDay = d.dayType === "sunday" || d.status === "RD";
      if (isRestDay) {
        // If rest day was worked (has BH > 0), count it toward Days Work
        // If rest day was NOT worked (BH === 0), exclude it (paid separately as rest day pay for rank/file)
        if (d.bh > 0) {
          // Rest day was worked - count it toward Days Work (no cap, can exceed 13 days)
          return sum + d.bh;
        } else {
          // Rest day was NOT worked - exclude from Days Work (paid separately)
          return sum;
        }
      }

      // Check if this is a holiday (RH, SH, or non-working holiday)
      const isHoliday = d.status === "RH" || d.status === "SH" || d.dayType === "regular-holiday" || d.dayType === "non-working-holiday";

      if (isHoliday) {
        // For holidays: count if BH > 0 (eligible holidays get 8 BH even without clock entries)
        // Holidays count toward the 13 days (they're included in the 104-hour base)
        if (d.bh > 0) {
          return sum + d.bh;
        }
      } else {
        // For regular days: count if BH > 0
        // This matches payslip calculation which counts regular days with regularHours > 0
        // Saturday (regular work day per law) gets 8 BH even if not worked, so it will be counted
        // Regular days (Mon-Fri) with BH > 0 are also counted (whether from clock entries or other sources)
        // Note: BH can come from clock entries, approved OT requests, or other sources
        if (d.bh > 0) {
          // Regular day with BH > 0 counts toward the 13 days
          // This matches payslip logic: dayType === "regular" && regularHours > 0
          return sum + d.bh;
        }
      }

      return sum;
    }, 0);
    daysWorked = totalBH / 8;
  }
  const totalOT = attendanceDays.reduce((sum, d) => sum + d.ot, 0);
  const totalUT = attendanceDays.reduce((sum, d) => sum + d.ut, 0);
  const totalND = attendanceDays.reduce((sum, d) => sum + d.nd, 0);

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
        {/* Header with Title and Controls */}
        <div className="flex items-center justify-between w-full">
          <H1>TIME ATTENDANCE</H1>
          <HStack gap="3" align="center">
            {/* Year Selector */}
            <Select
              value={selectedMonth.getFullYear().toString()}
              onValueChange={(value) => {
                const year = parseInt(value, 10);
                setSelectedMonth(new Date(year, selectedMonth.getMonth(), 1));
              }}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 2 }, (_, i) => {
                  const year = today.getFullYear() - i;
                  return (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            {/* Month Selector */}
            <Select
              value={format(selectedMonth, "yyyy-MM")}
              onValueChange={(value) => {
                const [year, month] = value.split("-").map(Number);
                setSelectedMonth(new Date(year, month - 1, 1));
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => {
                  const date = new Date(selectedMonth.getFullYear(), i, 1);
                  return (
                    <SelectItem key={i} value={format(date, "yyyy-MM")}>
                      {format(date, "MMMM yyyy")}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            {/* Cutoff Period Selector */}
            <Select
              value={cutoffPeriod}
              onValueChange={(value) =>
                setCutoffPeriod(value as "first" | "second")
              }
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="first">First Cut Off 1 to 15</SelectItem>
                <SelectItem value="second">
                  Second Cut Off 16 to {format(periodEnd, "d")}
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Print Button */}
            <Button onClick={handlePrint} variant="outline">
              <Icon name="Printer" size={IconSizes.sm} />
              Print
            </Button>
          </HStack>
        </div>

        {/* Status Legend */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span>OT / RD</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded"></div>
            <span>OB</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-500 rounded"></div>
            <span>LEAVE</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <span>ABSENT / LWOP / INC</span>
          </div>
        </div>

        {/* Employee Selection */}
        <CardSection>
          <VStack gap="2" align="start">
            <label className="text-sm font-medium">Select Employee</label>
            <Select
              value={selectedEmployee?.id || ""}
              onValueChange={(value) => {
                const emp = employees.find((emp) => emp.id === value);
                setSelectedEmployee(emp || null);
              }}
            >
              <SelectTrigger className="w-64">
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
        </CardSection>

        {/* Attendance Table */}
        {selectedEmployee && (
          <CardSection>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase">
                      DATE
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase">
                      DAY
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase">
                      STATUS
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase">
                      TIME IN
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase">
                      TIME OUT
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase">
                      BH
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase">
                      OT
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase">
                      UT (hrs)
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase">
                      ND
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceDays.map((day) => {
                    const isWeekend =
                      day.dayName === "Sat" || day.dayName === "Sun";

                    // Get status color classes based on legend
                    const getStatusColor = (status: string) => {
                      switch (status) {
                        case "LOG":
                        case "OT":
                        case "RD":
                          return "bg-green-100 text-green-700 border-green-200";
                        case "OB":
                          return "bg-blue-100 text-blue-700 border-blue-200";
                        case "LEAVE":
                        case "CTO":
                          return "bg-orange-100 text-orange-700 border-orange-200";
                        case "ABSENT":
                        case "LWOP":
                        case "INC":
                          return "bg-red-100 text-red-700 border-red-200";
                        case "RH":
                        case "SH":
                          return "bg-purple-100 text-purple-700 border-purple-200";
                        default:
                          return "bg-gray-100 text-gray-600 border-gray-200";
                      }
                    };

                    return (
                      <tr
                        key={day.date}
                        className={`border-b ${isWeekend ? "bg-green-50" : ""}`}
                      >
                        <td className="px-4 py-2 text-sm">
                          {format(parseISO(day.date), "MMM dd")}
                        </td>
                        <td className="px-4 py-2 text-sm">{day.dayName}</td>
                        <td className="px-4 py-2">
                          <span
                            className={`inline-block px-2 py-1 rounded text-xs font-semibold border ${getStatusColor(
                              day.status
                            )}`}
                          >
                            {day.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm">
                          {day.status === "LWOP" || day.status === "LEAVE"
                            ? "-"
                            : day.timeIn || "-"}
                        </td>
                        <td className="px-4 py-2 text-sm">
                          {day.status === "LWOP" || day.status === "LEAVE"
                            ? "-"
                            : day.timeOut || "-"}
                        </td>
                        <td className="px-4 py-2 text-sm text-right">
                          {day.status === "LWOP"
                            ? "-"
                            : day.status === "LEAVE"
                            ? "8"
                            : day.bh > 0
                            ? day.bh
                            : "-"}
                        </td>
                        <td className="px-4 py-2 text-sm text-right">
                          {day.ot > 0 ? day.ot.toFixed(2) : "-"}
                        </td>
                        <td className="px-4 py-2 text-sm text-right">
                          {day.ut > 0 ? (day.ut / 60).toFixed(2) : "0"}
                        </td>
                        <td className="px-4 py-2 text-sm text-right">
                          {day.nd > 0 ? day.nd.toFixed(2) : "0"}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Summary Row */}
                  <tr className="border-t-2 font-semibold">
                    <td colSpan={5} className="px-4 py-2 text-sm">
                      Days Work : {daysWorked.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-sm text-right">
                      {totalBH > 0 ? totalBH.toFixed(1) : "0"}
                    </td>
                    <td className="px-4 py-2 text-sm text-right">
                      {totalOT > 0 ? totalOT.toFixed(2) : "0"}
                    </td>
                    <td className="px-4 py-2 text-sm text-right">{totalUT}</td>
                    <td className="px-4 py-2 text-sm text-right">
                      {totalND > 0 ? totalND.toFixed(2) : "0"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardSection>
        )}
      </VStack>
    </DashboardLayout>
  );
}