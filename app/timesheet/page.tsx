"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { creditNightDiffHours, creditOvertimeHours, creditWorkHoursHalfHour } from "@/utils/overtime";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { useAssignedGroups } from "@/lib/hooks/useAssignedGroups";
import { CardSection } from "@/components/ui/card-section";
import { H1, BodySmall } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { format, parseISO, getDay } from "date-fns";
import {
  determineDayType,
  formatDateShort,
  getDayName,
  HOLIDAY_DE_MINIMIS_HOURS,
  HOLIDAY_UNWORKED_CREDIT_HOURS,
  normalizeHolidays,
} from "@/utils/holidays";
import type { Holiday } from "@/utils/holidays";
import { fetchHolidaysRange } from "@/lib/holidays/fetchHolidays";
import { getBiMonthlyPeriodStart, getBiMonthlyPeriodEnd } from "@/utils/bimonthly";
import { calculateBasePay } from "@/utils/base-pay-calculator";
import {
  calculateLateHours,
  getBusinessDayPolicyByDay,
  getManilaHourMinute,
  halfDayRequiredHoursByDay,
  regularHoursFromBundyClockPair,
} from "@/utils/business-hours";
import {
  fetchSessionsForEmployee,
  fetchProjectTimeSessionsForEmployee,
  mergeBundyAndFtlClockSessions,
  type TimeEntrySession,
} from "@/lib/timeEntries";
import {
  syntheticClockOutFromApprovedOt,
  normalizeApprovedFtlClockPair,
} from "@/lib/ftl-ot-synthesis";

interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
  last_name?: string | null;
  first_name?: string | null;
  eligible_for_ot?: boolean | null;
  position?: string | null;
  /** Legacy DB values: `client-based` = site rest-day map; otherwise default Sunday rest + compressed-week rules */
  employee_type?: "office-based" | "client-based" | null;
  hire_date?: string | null;
  termination_date?: string | null;
  transferred_from_employee_id?: string | null; // When transferred (new record), previous employees.id so OT is still loaded
  shift_start_time?: string | null;
  shift_end_time?: string | null;
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

function clockEntryFromSession(s: TimeEntrySession): ClockEntry {
  return {
    id: s.id,
    clock_in_time: s.clock_in_time,
    clock_out_time: s.clock_out_time,
    regular_hours: s.regular_hours ?? null,
    total_hours: s.total_hours ?? null,
    total_night_diff_hours: s.total_night_diff_hours ?? null,
    status: s.status,
  };
}

function clockEntryFromApprovedFtl(ftl: FailureToLogRequest): ClockEntry | null {
  if (!ftl.actual_clock_in_time || !ftl.actual_clock_out_time) return null;
  const { clockInIso, clockOutIso } = normalizeApprovedFtlClockPair(
    ftl.actual_clock_in_time,
    ftl.actual_clock_out_time
  );
  const inTime = parseISO(clockInIso);
  const outTime = parseISO(clockOutIso);
  if (Number.isNaN(inTime.getTime()) || Number.isNaN(outTime.getTime())) return null;
  if (outTime <= inTime) return null;

  const totalHours =
    Math.round((((outTime.getTime() - inTime.getTime()) / (1000 * 60 * 60)) * 100)) /
    100;

  return {
    id: `ftl-${ftl.id}`,
    clock_in_time: clockInIso,
    clock_out_time: clockOutIso,
    regular_hours: totalHours,
    total_hours: totalHours,
    total_night_diff_hours: 0,
    status: "approved",
  };
}

function buildClockEntriesFromApprovedFtl(
  approvedFtlRequests: FailureToLogRequest[],
  otRequests?: OvertimeRequest[]
): ClockEntry[] {
  const byDate = new Map<
    string,
    { inTime: string | null; outTime: string | null; sourceId: string }
  >();

  approvedFtlRequests.forEach((ftl) => {
    if (!ftl.missed_date) return;
    const dateKey =
      typeof ftl.missed_date === "string"
        ? ftl.missed_date.split("T")[0]
        : format(new Date(ftl.missed_date), "yyyy-MM-dd");
    const existing = byDate.get(dateKey) || {
      inTime: null,
      outTime: null,
      sourceId: ftl.id,
    };

    if (
      (ftl.entry_type === "in" || ftl.entry_type === "both") &&
      ftl.actual_clock_in_time
    ) {
      existing.inTime = ftl.actual_clock_in_time;
    }
    if (
      (ftl.entry_type === "out" || ftl.entry_type === "both") &&
      ftl.actual_clock_out_time
    ) {
      existing.outTime = ftl.actual_clock_out_time;
    }
    existing.sourceId = existing.sourceId || ftl.id;
    byDate.set(dateKey, existing);
  });

  const rows: ClockEntry[] = [];
  byDate.forEach((pair, dateKey) => {
    let { inTime, outTime } = pair;
    if (inTime && !outTime && otRequests?.length) {
      const syntheticOut = syntheticClockOutFromApprovedOt(
        inTime,
        dateKey,
        otRequests
      );
      if (syntheticOut) outTime = syntheticOut;
    }
    if (!inTime || !outTime) return;
    const synthesized = clockEntryFromApprovedFtl({
      id: pair.sourceId,
      missed_date: dateKey,
      actual_clock_in_time: inTime,
      actual_clock_out_time: outTime,
      entry_type: "both",
      status: "approved",
    });
    if (synthesized) rows.push(synthesized);
  });

  return rows;
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
  half_day_dates?: string[] | null;
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

interface FailureToLogRequest {
  id: string;
  missed_date: string | null;
  actual_clock_in_time: string | null;
  actual_clock_out_time: string | null;
  entry_type: "in" | "out" | "both";
  status: string;
}

interface AttendanceDay {
  date: string;
  dayName: string;
  dayType: string;
  status: string; // LOG, CTO, LWOP, LEAVE, ABSENT, INC, OT, OB, -, etc.
  isHalfDayLeave?: boolean;
  timeIn: string | null;
  timeOut: string | null;
  schedIn: string | null;
  schedOut: string | null;
  bh: number; // Basic Hours
  ot: number; // Overtime Hours (from approved OT filings)
  lt: number; // Late (hours, rounded up; after 15-min grace)
  ut: number; // Undertime (hours; based on required business hours)
  nd: number; // Night Differential
  clockEntryIds?: string[]; // ids from time_entries (in + out punch ids for this day, for admin/HR remove)
}

export default function TimesheetPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null
  );
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const today = new Date();
  // Month/week filter for weekly cutoff (Wednesday–Tuesday)
  const [filterMonth, setFilterMonth] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedWeekKey, setSelectedWeekKey] = useState<string>("");
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    // Company weekly cutoff: Wednesday to Tuesday. Find current week's Wednesday.
    while (d.getDay() !== 3) {
      d.setDate(d.getDate() - 1);
    }
    return d;
  });

  const weekOptions = useMemo(() => {
    const year = filterMonth.getFullYear();
    const month = filterMonth.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    firstOfMonth.setHours(0, 0, 0, 0);
    let start = new Date(firstOfMonth);
    // Align to Wednesday
    while (start.getDay() !== 3) {
      start.setDate(start.getDate() - 1);
    }
    const endOfMonth = new Date(year, month + 1, 0);
    endOfMonth.setHours(0, 0, 0, 0);
    const options: { key: string; label: string; start: Date; end: Date }[] = [];
    let weekIndex = 1;
    while (start <= endOfMonth) {
      const ws = new Date(start);
      const we = new Date(start);
      we.setDate(we.getDate() + 6);
      options.push({
        key: ws.toISOString(),
        label: `Week ${weekIndex} (${format(ws, "MMM d")} – ${format(
          we,
          "MMM d"
        )})`,
        start: ws,
        end: we,
      });
      weekIndex += 1;
      start.setDate(start.getDate() + 7);
    }
    return options;
  }, [filterMonth]);

  // Keep selectedWeekStart and week dropdown in sync
  useEffect(() => {
    if (weekOptions.length === 0) return;
    // Try to match current selectedWeekStart to one of the options
    const matchByStart = weekOptions.find((opt) => {
      const d = new Date(opt.start);
      const s = new Date(selectedWeekStart);
      d.setHours(0, 0, 0, 0);
      s.setHours(0, 0, 0, 0);
      return d.getTime() === s.getTime();
    });
    if (matchByStart) {
      setSelectedWeekKey(matchByStart.key);
      return;
    }
    // If no exact match, find week that contains selectedWeekStart
    const inRange = weekOptions.find(
      (opt) =>
        selectedWeekStart >= opt.start && selectedWeekStart <= opt.end
    );
    const chosen = inRange ?? weekOptions[0];
    setSelectedWeekKey(chosen.key);
    setSelectedWeekStart(chosen.start);
  }, [weekOptions, selectedWeekStart]);
  const [attendanceDays, setAttendanceDays] = useState<AttendanceDay[]>([]);
  const [clockEntries, setClockEntries] = useState<ClockEntry[]>([]);
  const [schedules, setSchedules] = useState<Map<string, Schedule>>(new Map());
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [otRequests, setOtRequests] = useState<OvertimeRequest[]>([]);
  const [failureToLogRequests, setFailureToLogRequests] = useState<FailureToLogRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();
  const { isAdmin, isHR, loading: roleLoading } = useUserRole();
  const { groupIds: assignedGroupIds, loading: groupsLoading } = useAssignedGroups();

  // Weekly cutoff: Wednesday to Tuesday
  const periodStart = selectedWeekStart;
  const periodEnd = (() => {
    const d = new Date(selectedWeekStart);
    d.setDate(d.getDate() + 6); // Wed + 6 = Tue
    return d;
  })();

  useEffect(() => {
    if (!groupsLoading && !roleLoading) {
      loadInitialData();
    }
  }, [assignedGroupIds, groupsLoading, roleLoading, isAdmin]);

  useEffect(() => {
    if (selectedEmployee) {
      // First ensure timesheet exists, then load data
      // Don't wait for holidays - they're not critical for attendance display
      ensureTimesheetExists().then(() => {
        loadAttendanceData();
      });
    }
  }, [selectedEmployee, selectedWeekStart, filterMonth]);

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
      // Load employees (schema: employment_type, no overtime_group_id)
      const { data: empData, error: empError } = await supabase
        .from("employees")
        .select("id, employee_id, full_name, eligible_for_ot, position, employment_type, job_level, hire_date, last_name, first_name, transferred_from_employee_id, shift_start_time, shift_end_time")
        .eq("is_active", true)
        .order("last_name", { ascending: true, nullsFirst: false })
        .order("first_name", { ascending: true, nullsFirst: false });

      if (empError) throw empError;
      // Map employment_type → employee_type for UI
      const mapped = (empData || []).map((e: any) => ({
        ...e,
        employee_type: e.employment_type ?? null,
      }));
      setEmployees(mapped);

      // Load holidays for the selected month
      // Schema does not include holidays table — use empty list
      const formattedHolidays: Holiday[] = [];

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

      // Wider fetch: 7 days before cutoff so holiday eligibility can see prior regular workdays.
      const periodStartDate = new Date(periodStart);
      periodStartDate.setHours(0, 0, 0, 0);
      periodStartDate.setDate(periodStartDate.getDate() - 7);

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

      const getDateInManila = (iso: string) => {
        const d = new Date(iso);
        const formatter = new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Manila",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        });
        const parts = formatter.formatToParts(d);
        return `${parts.find((p) => p.type === "year")!.value}-${
          parts.find((p) => p.type === "month")!.value
        }-${parts.find((p) => p.type === "day")!.value}`;
      };

      const [mainSessions, projectSessions] = await Promise.all([
        fetchSessionsForEmployee(
          supabase,
          selectedEmployee.id,
          periodStartDate.toISOString(),
          periodEndDate.toISOString(),
          getDateInManila
        ),
        fetchProjectTimeSessionsForEmployee(
          supabase,
          selectedEmployee.id,
          periodStartDate.toISOString(),
          periodEndDate.toISOString(),
          getDateInManila
        ),
      ]);

      const { data: ftlData, error: ftlError } = await supabase
        .from("failure_to_log")
        .select(
          "id, missed_date, actual_clock_in_time, actual_clock_out_time, entry_type, status"
        )
        .eq("employee_id", selectedEmployee.id)
        .gte("missed_date", periodStartStr)
        .lte("missed_date", periodEndStr)
        .eq("status", "approved");

      if (ftlError) {
        console.warn("Error loading approved failure-to-log requests:", ftlError);
      }
      const approvedFtlData = (ftlData || []) as FailureToLogRequest[];
      setFailureToLogRequests(approvedFtlData);

      const transferredFromId = selectedEmployee?.transferred_from_employee_id ?? null;
      const employeeIdsToLoad = transferredFromId
        ? [selectedEmployee.id, transferredFromId]
        : [selectedEmployee.id];
      const { data: otRequests, error: otError } = await supabase
        .from("overtime_requests")
        .select(
          "id, ot_date, end_date, start_time, end_time, total_hours, status"
        )
        .in("employee_id", employeeIdsToLoad)
        .gte("ot_date", periodStartStr)
        .lte("ot_date", periodEndStr)
        .in("status", ["approved", "approved_by_manager", "approved_by_hr"]);

      let otData: any[] = [];
      if (otError) {
        console.warn("Error loading OT requests:", otError);
      } else {
        otData = otRequests || [];
      }
      setOtRequests(otData);

      const ftlAsSessions = buildClockEntriesFromApprovedFtl(
        approvedFtlData,
        otData
      ) as unknown as TimeEntrySession[];

      // One logical session per day: drop duplicate FTL when Bundy is complete; merge FTL into incomplete Bundy
      const clockData = mergeBundyAndFtlClockSessions(
        mainSessions || [],
        ftlAsSessions,
        getDateInManila,
        projectSessions || []
      );

      // Filter entries by date in Asia/Manila timezone to ensure accuracy
      const filteredClockData = (clockData || []).filter((entry: any) => {
        const entryDateUTC = parseISO(entry.clock_in_time);
        // Use Intl.DateTimeFormat to get date parts in Asia/Manila timezone (same as timesheet generator)
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
        // Check if entry date falls within the period
        return entryDateStr >= periodStartStr && entryDateStr <= periodEndStr;
      });

      // Filter to only include entries with valid status (exclude rejected and pending)
      // Include all statuses that indicate the entry is valid: auto_approved, approved, clocked_out, clocked_in
      // This matches the employee portal logic to ensure consistent data
      const validEntriesInPeriod = filteredClockData.filter(
        (e: any) =>
          e.status !== "rejected" &&
          e.status !== "pending" &&
          (e.status === "auto_approved" ||
            e.status === "approved" ||
            e.status === "clocked_out" ||
            e.status === "clocked_in")
      );

      // Keep sessions up to 7 days before the week for holiday pay eligibility (not shown in the grid).
      const validEntries = (clockData || []).filter(
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

      } else {
        console.warn(
          "No clock entries found for period. Checking if employee has any entries..."
        );
        // Fallback: Check if employee has ANY punches to verify query is working
        const { data: anyPunches } = await supabase
          .from("time_entries")
          .select("punched_at")
          .eq("employee_id", selectedEmployee.id)
          .limit(5)
          .order("punched_at", { ascending: false });
        console.log("Recent punches for employee (any date):", anyPunches);

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
      // Load leave requests for the period
      // Leave requests overlap if: start_date <= periodEnd AND end_date >= periodStart
      const { data: leaveData, error: leaveError } = await supabase
        .from("leave_requests")
        .select("id, leave_type, start_date, end_date, status, half_day_dates")
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

      const validClockEntries = (validEntries as TimeEntrySession[]).map(
        clockEntryFromSession
      );
      setClockEntries(validClockEntries);

      const completeEntries = validClockEntries.filter(
        (entry) => entry.clock_out_time !== null
      );
      const incompleteEntries = validClockEntries.filter(
        (entry) => entry.clock_out_time === null
      );

      console.log("Loaded complete entries:", completeEntries.length);
      console.log("Loaded incomplete entries:", incompleteEntries.length);

      const formattedHolidays: Holiday[] = await fetchHolidaysRange(supabase as any, {
        start: periodStartStr,
        end: periodEndStr,
        lookbackDays: 7,
      });
      setHolidays(formattedHolidays);
      const holidaysForCalc = formattedHolidays;

      const scheduleMap = new Map<string, Schedule>();
      if (selectedEmployee?.shift_start_time && selectedEmployee?.shift_end_time) {
        const cursor = new Date(periodStart);
        cursor.setHours(0, 0, 0, 0);
        const rangeEnd = new Date(periodEnd);
        rangeEnd.setHours(0, 0, 0, 0);
        while (cursor <= rangeEnd) {
          const policy = getBusinessDayPolicyByDay(getDay(cursor));
          if (policy.requiresOffice) {
            const key = format(cursor, "yyyy-MM-dd");
            scheduleMap.set(key, {
              schedule_date: key,
              day_off: false,
              start_time: selectedEmployee.shift_start_time,
              end_time: selectedEmployee.shift_end_time,
            });
          }
          cursor.setDate(cursor.getDate() + 1);
        }
      }

      setSchedules(scheduleMap);
      generateAttendanceDays(
        completeEntries,
        incompleteEntries,
        leaveData || [],
        otData || [],
        approvedFtlData,
        scheduleMap,
        selectedEmployee?.employee_type,
        formattedHolidays
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
      setFailureToLogRequests([]);
      setAttendanceDays([]);
    }
  }

  function generateAttendanceDays(
    entries: ClockEntry[],
    incompleteEntries: ClockEntry[],
    leaveRequests: LeaveRequest[],
    otRequests: OvertimeRequest[],
    approvedFailureToLogs: FailureToLogRequest[],
    scheduleMap: Map<string, Schedule>,
    employeeType?: "office-based" | "client-based" | null,
    holidaysForCalc?: Holiday[]
  ) {
    // Check if employee is account supervisor (for ND eligibility)
    const isAccountSupervisor = selectedEmployee?.position
      ?.toUpperCase()
      .includes("ACCOUNT SUPERVISOR") || false;
    // ND only when OT request overlaps 10PM–6AM Philippine time (all employees)
    const ndNightStartHour = 22; // 10PM – 6AM; 0 ND if OT is outside this window
    // For weekly cutoff, working days are simply all calendar days between periodStart and periodEnd (inclusive)
    const workingDays: Date[] = [];
    {
      const d = new Date(periodStart);
      d.setHours(0, 0, 0, 0);
      const end = new Date(periodEnd);
      end.setHours(0, 0, 0, 0);
      while (d <= end) {
        workingDays.push(new Date(d));
        d.setDate(d.getDate() + 1);
      }
    }
    const days: AttendanceDay[] = [];

    // Debug: ND discrepancy (payslip shows ND, timesheet shows 0)
    const ndDebug = {
      employeeName: selectedEmployee?.full_name,
      isAccountSupervisor,
      ndNightStartHour,
      otRequestsCount: otRequests.length,
      sampleOt: otRequests[0]
        ? {
            ot_date: otRequests[0].ot_date,
            start_time: otRequests[0].start_time,
            end_time: otRequests[0].end_time,
            status: otRequests[0].status,
          }
        : null,
    };
    console.log("Timesheet ND debug (generateAttendanceDays):", ndDebug);
    try {
      fetch("http://127.0.0.1:7243/ingest/baf212a9-0048-4497-b30f-a8a72fba0d2d", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: "timesheet/page.tsx:ND-debug-start",
          message: "Timesheet ND calculation context",
          data: ndDebug,
          hypothesisId: "ND-timesheet",
          timestamp: Date.now(),
          sessionId: "debug-session",
        }),
      }).catch(() => {});
    } catch (_) {}

    console.log("Generating attendance days:", {
      workingDaysCount: workingDays.length,
      entriesCount: entries.length,
      schedulesCount: scheduleMap.size,
    });

    // Group entries by date (using Asia/Manila timezone for accurate date grouping)
    const entriesByDate = new Map<string, ClockEntry[]>();
    entries.forEach((entry) => {
      if (!entry.clock_out_time) return;
      const entryDateUTC = parseISO(entry.clock_in_time);
      // Use Intl.DateTimeFormat to get date parts in Asia/Manila timezone (same as timesheet generator)
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      const parts = formatter.formatToParts(entryDateUTC);
      const dateStr = `${parts.find((p) => p.type === "year")!.value}-${
        parts.find((p) => p.type === "month")!.value
      }-${parts.find((p) => p.type === "day")!.value}`;

      if (!entriesByDate.has(dateStr)) {
        entriesByDate.set(dateStr, []);
      }
      entriesByDate.get(dateStr)!.push(entry);
    });

    // Group incomplete entries by date (using Asia/Manila timezone)
    const incompleteByDate = new Map<string, ClockEntry[]>();
    incompleteEntries.forEach((entry) => {
      const entryDateUTC = parseISO(entry.clock_in_time);
      // Use Intl.DateTimeFormat to get date parts in Asia/Manila timezone (same as timesheet generator)
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      const parts = formatter.formatToParts(entryDateUTC);
      const dateStr = `${parts.find((p) => p.type === "year")!.value}-${
        parts.find((p) => p.type === "month")!.value
      }-${parts.find((p) => p.type === "day")!.value}`;

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

      // Schema has no selected_dates — use start_date/end_date only
      while (currentDate <= endDate) {
        const dateStr = format(currentDate, "yyyy-MM-dd");
        if (!leavesByDate.has(dateStr)) {
          leavesByDate.set(dateStr, []);
        }
        leavesByDate.get(dateStr)!.push(leave);
        currentDate = new Date(currentDate);
        currentDate.setDate(currentDate.getDate() + 1);
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

    // Group approved failure-to-log requests by missed_date
    const approvedFailureToLogByDate = new Map<string, FailureToLogRequest[]>();
    approvedFailureToLogs.forEach((ftl) => {
      if (!ftl.missed_date) return;
      const dateStr =
        typeof ftl.missed_date === "string"
          ? ftl.missed_date.split("T")[0]
          : format(new Date(ftl.missed_date), "yyyy-MM-dd");
      if (!approvedFailureToLogByDate.has(dateStr)) {
        approvedFailureToLogByDate.set(dateStr, []);
      }
      approvedFailureToLogByDate.get(dateStr)!.push(ftl);
    });

    console.log("Entries grouped by date:", entriesByDate.size);
    console.log("Incomplete entries:", incompleteByDate.size);
    console.log("Leave requests by date:", leavesByDate.size);
    console.log("OT requests by date:", otByDate.size);

    // Debug: ND key mismatch (otByDate keys vs working day dates)
    const otByDateKeys = Array.from(otByDate.keys()).sort();
    const workingDayDateStrs = workingDays.map((d) => format(d, "yyyy-MM-dd"));
    console.log("Timesheet ND otByDate keys:", otByDateKeys);
    console.log("Timesheet ND workingDay dateStrs (sample):", workingDayDateStrs.slice(0, 5), "...", workingDayDateStrs.slice(-3));
    try {
      fetch("http://127.0.0.1:7243/ingest/baf212a9-0048-4497-b30f-a8a72fba0d2d", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: "timesheet/page.tsx:ND-otByDate-keys",
          message: "OT by date keys vs working days",
          data: { otByDateKeys, workingDayDateStrsSample: workingDayDateStrs.slice(0, 5), workingDayDateStrsEnd: workingDayDateStrs.slice(-3) },
          hypothesisId: "ND-timesheet",
          timestamp: Date.now(),
          sessionId: "debug-session",
        }),
      }).catch(() => {});
    } catch (_) {}

    workingDays.forEach((date) => {
      const dateStr = format(date, "yyyy-MM-dd");
      const schedule = scheduleMap.get(dateStr);
      // Check if this is a rest day from employee schedule (day_off flag)
      // For Account Supervisors and others with custom rest days
      const isRestDay = schedule?.day_off === true;
      // Pass isClientBased so Sunday is not automatically treated as rest day for client-based employees
      const isClientBased = employeeType === "client-based";
      const isClientBasedAccountSupervisor = isAccountSupervisor && isClientBased;
      const holidayList = holidaysForCalc ?? holidays;
      const dayType = determineDayType(dateStr, holidayList, isRestDay, isClientBased);
      const dayOfWeek = getDay(date);
      const dayEntries = entriesByDate.get(dateStr) || [];
      const incompleteDayEntries = incompleteByDate.get(dateStr) || [];
      const dayLeaves = leavesByDate.get(dateStr) || [];
      const dayOTs = otByDate.get(dateStr) || [];
      const dayApprovedFtl = approvedFailureToLogByDate.get(dateStr) || [];
      let eligibleForHolidayCredit = false;

      // Check if this date is a holiday by checking the holidays array directly
      // This is a fallback in case determineDayType doesn't detect it
      const holidayForDate = holidayList.find(h => {
        const normalizedHolidayDate = h.date.split('T')[0]; // Remove time if present
        return normalizedHolidayDate === dateStr;
      });


      // Determine status based on priority:
      // 1. Holidays (check FIRST - before everything else)
      // 2. Leave requests (LWOP, LEAVE, CTO, OB)
      // 3. OT requests
      // 4. Complete time entries (LOG)
      // 5. Incomplete time entries (INC)
      // 6. Rest days (Sunday + Saturday policy)
      // 7. Saturday (non-absence day; worked hours can still be OT)
      // 8. No entry = ABSENT
      let status = "-";
      let bh = 0; // Basic Hours
      let isHalfDayLeave = false;

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
          const checkDayType = determineDayType(checkDateStr, holidayList, scheduleMap.get(checkDateStr)?.day_off === true, isClientBased);

          // Only check regular working days (skip holidays and rest days)
          if (checkDayType === "regular" && checkDayEntries.length > 0) {
            // Check if employee worked 8+ hours on this regular working day (main + project time)
            const workedHours = checkDayEntries.reduce((sum, e) => {
              if (e.clock_in_time && e.clock_out_time) {
                try {
                  return (
                    sum +
                    regularHoursFromBundyClockPair(
                      e.clock_in_time,
                      e.clock_out_time
                    )
                  );
                } catch {
                  /* fall through */
                }
              }
              return sum + (e.regular_hours ?? e.total_hours ?? 0);
            }, 0);
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
          if (
            (prevDay.status === "RH" || prevDay.status === "SH") &&
            prevDay.bh >= HOLIDAY_UNWORKED_CREDIT_HOURS
          ) {
            eligibleForHoliday = true;
          }
        }
        eligibleForHolidayCredit = eligibleForHoliday;
        bh = 0;
      } else if (dayLeaves.length > 0) {
        // Check leave requests (but holidays take priority)
        const leave = dayLeaves[0];
        isHalfDayLeave =
          Array.isArray(leave.half_day_dates) &&
          leave.half_day_dates.includes(dateStr);
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
        // If there are also clock entries, STATUS should remain LOG/INC.
        // OT affects the OT column/hours only; it should not replace the LOG badge.
        if (dayEntries.length > 0) {
          status = "LOG";
        } else if (incompleteDayEntries.length > 0) {
          // Match incomplete-only path: approved FTL documents the day → LOG, not INC.
          status = dayApprovedFtl.length > 0 ? "LOG" : "INC";
        } else {
          status = "OT"; // OT-only day (no clock entries)
        }
        // BH will be calculated from time entries if they exist.
      } else if (dayEntries.length > 0) {
        // Complete time entries exist
        status = "LOG";
      } else if (incompleteDayEntries.length > 0) {
        // Incomplete entry (clock_in but no clock_out)
        status = dayApprovedFtl.length > 0 ? "LOG" : "INC";
      } else if (dayType === "sunday" || isRestDay) {
        // Rest day (Sunday is the fixed weekly rest for the default schedule; client-site uses schedule map)
        // OR rest day from employee schedule (for Account Supervisors: Mon/Tue/Wed, or any day marked as rest day)
        // If no work, still show as rest day (paid)
        // If worked, show as LOG with rest day pay
        if (dayEntries.length > 0 || incompleteDayEntries.length > 0) {
          status = "LOG"; // Worked on rest day
        } else {
          status = "RD"; // Rest day - paid even if not worked
        }
      } else if (dayOfWeek === 6) {
        // Saturday handling:
        // Saturday is not treated as an absence day.
        // For compressed-workweek records (Mon-Thu >= 10h and Fri >= 8h),
        // treat Saturday as LOG even without a Saturday punch.
        const saturdayDate = parseISO(dateStr);
        const mondayDate = new Date(saturdayDate);
        mondayDate.setDate(
          saturdayDate.getDate() - ((getDay(saturdayDate) + 6) % 7)
        );
        const compressedWeekHours = Array.from({ length: 5 }, (_, idx) => {
          const workDate = new Date(mondayDate);
          workDate.setDate(mondayDate.getDate() + idx);
          const workDateStr = format(workDate, "yyyy-MM-dd");
          const entries = entriesByDate.get(workDateStr) || [];
          return entries.reduce(
            (sum, entry) => sum + (entry.regular_hours ?? entry.total_hours ?? 0),
            0
          );
        });
        const hasCompletedCompressedWeek =
          compressedWeekHours.slice(0, 4).every((hrs) => hrs >= 10) &&
          compressedWeekHours[4] >= 8;

        if (dayEntries.length > 0 || incompleteDayEntries.length > 0) {
          status = "LOG"; // Worked on Saturday
        } else if (hasCompletedCompressedWeek) {
          status = "LOG";
        } else {
          status = "LOG";
        }
      } else if (dayOfWeek === 0) {
        // Sunday handling:
        // - Default schedule: Sunday is rest day (handled above)
        // - Client-based: Sunday is a normal workday if NOT their rest day - shows ABSENT if no logs
        if (isClientBased) {
          const isSundayRestDay = isRestDay; // Already checked above
          if (isSundayRestDay) {
            // Sunday IS their rest day - already handled above (should show RD)
            status = "RD";
          } else {
            // Sunday is NOT their rest day - it's a normal workday, must have logs or be ABSENT
            if (dayEntries.length > 0 || incompleteDayEntries.length > 0) {
              status = "LOG"; // Worked on Sunday
            } else {
              // No logs = ABSENT
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const currentDate = new Date(date);
              currentDate.setHours(0, 0, 0, 0);
              status = currentDate > today ? "-" : "ABSENT";
            }
          }
        } else {
          // Default schedule: Sunday is rest day (already handled above, but fallback)
          status = "RD";
        }
      } else {
        // Monday-Friday: Normal workdays
        // - Default schedule: must have logs or be ABSENT
        // - Client-based: Must have logs or be ABSENT (unless it's their rest day, which is handled above)
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
      // Only show times if there are actual clock entries
      // For LWOP and LEAVE, don't show clock times
      // For OT-only days (no clock entries), don't show clock times
      // For Saturday LOG (default schedule, no entries), don't show clock times
      const firstEntry = dayEntries[0] || incompleteDayEntries[0];
      const hasActualClockEntry = firstEntry !== undefined && firstEntry !== null;

      const hideClockForFullDayLeave =
        (status === "LWOP" || status === "LEAVE") && !isHalfDayLeave;
      const timeIn =
        hideClockForFullDayLeave
          ? null
          : hasActualClockEntry && firstEntry?.clock_in_time
          ? format(parseISO(firstEntry.clock_in_time), "hh:mm a")
          : null;
      const timeOut =
        hideClockForFullDayLeave
          ? null
          : hasActualClockEntry && firstEntry?.clock_out_time
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
        // Normalize legacy OT rows: apply min 1h, then 0.5 increments.
        otHours = approvedOTs.reduce(
          (sum, ot) => sum + creditOvertimeHours(Number(ot.total_hours || 0)),
          0
        );
      }

      // Calculate ND (Night Differential)
      // Policy: ND is counted ONLY when there is approved OT filing.
      // (Ignore any ND that might exist on clock/attendance rows.)
      let ndHours = 0;
      let ndFromApprovedOT = 0;

      if (dayOTs.length > 0) {
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

              ndFromThisOT = hoursToMidnight + hoursFromMidnight;
            } else {
              // OT on same day
              if (startTotalMin >= nightStartMin) {
                ndFromThisOT = (endTotalMin - startTotalMin) / 60;
              } else if (endTotalMin >= nightStartMin) {
                ndFromThisOT = (endTotalMin - nightStartMin) / 60;
              }
            }

            // Cap ND hours at credited OT hours (can't exceed OT credit) and ensure non-negative
            ndFromThisOT = Math.min(
              Math.max(0, ndFromThisOT),
              creditOvertimeHours(Number(ot.total_hours || 0))
            );
            ndFromApprovedOT += ndFromThisOT;
          }
        });
      }

      ndHours = creditNightDiffHours(ndFromApprovedOT);

      // Calculate BH (Basic Hours): sum of all sessions (main Bundy + project time) for this day
      // One day can have multiple project sessions (e.g. 3h + 2h + 3h = 8h) — single BH for HRIS
      if (bh === 0) {
        if (dayEntries.length > 0) {
          const bhFromBusinessWindows = dayEntries.reduce((sum, entry) => {
            if (!entry.clock_in_time || !entry.clock_out_time) {
              return sum + (entry.regular_hours ?? entry.total_hours ?? 0);
            }
            try {
              return (
                sum +
                regularHoursFromBundyClockPair(
                  entry.clock_in_time,
                  entry.clock_out_time
                )
              );
            } catch {
              return sum + (entry.regular_hours ?? entry.total_hours ?? 0);
            }
          }, 0);
          const credited = creditWorkHoursHalfHour(
            Math.round(bhFromBusinessWindows * 100) / 100
          );
          if (dayOfWeek === 6) {
            // Saturday is not part of the compressed Mon–Fri base schedule; worked time is OT
            // (matches lib/timesheet-auto-generator.ts: isSaturday → overtimeHours, not regularHours).
            bh = 0;
            let saturdayOt = credited;
            if (saturdayOt <= 0 && dayEntries.length > 0) {
              saturdayOt = dayEntries.reduce((sum, entry) => {
                if (!entry.clock_in_time || !entry.clock_out_time) {
                  return sum + (entry.regular_hours ?? entry.total_hours ?? 0);
                }
                try {
                  const cin = parseISO(entry.clock_in_time);
                  const cout = parseISO(entry.clock_out_time);
                  if (cout <= cin) {
                    return sum + (entry.regular_hours ?? entry.total_hours ?? 0);
                  }
                  const rawH =
                    (cout.getTime() - cin.getTime()) / (1000 * 60 * 60);
                  return (
                    sum +
                    creditWorkHoursHalfHour(Math.round(Math.min(24, rawH) * 100) / 100)
                  );
                } catch {
                  return sum + (entry.regular_hours ?? entry.total_hours ?? 0);
                }
              }, 0);
            }
            otHours = Math.round(Math.max(otHours, saturdayOt) * 100) / 100;
          } else {
            bh = credited;
          }
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

      // Holiday credit (4h) applies only when there is NO complete time log on the holiday.
      // If they have a complete time in/out, they are considered to have worked and premiums apply downstream.
      const hasCompleteTimeLog =
        dayEntries.some((e) => e.clock_in_time && e.clock_out_time) ||
        incompleteDayEntries.some((e) => e.clock_in_time && e.clock_out_time);

      if (eligibleForHolidayCredit && !hasCompleteTimeLog && bh < HOLIDAY_DE_MINIMIS_HOURS) {
        bh = HOLIDAY_UNWORKED_CREDIT_HOURS;
      }

      // Note: Employees do NOT get automatic BH for Saturday or Sunday.
      // They must log time on scheduled workdays or be marked as ABSENT/rest day.

      // IMPORTANT: BH is set based on:
      // 1. Actual completed time log entries (business-window overlap Mon–Fri)
      // 2. Saturday: worked overlap is OT, not BH (compressed work week; matches timesheet-auto-generator)
      // 3. Leave types (CTO, SIL, etc.) — handled above
      // Payslip uses generateTimesheetFromClockEntries with the same Saturday rule.

      // LT/UT priority: employee schedule first, then business-hours fallback.
      const businessPolicy = getBusinessDayPolicyByDay(getDay(parseISO(dateStr)));
      const businessStartMinutes =
        businessPolicy.windows.length > 0
          ? businessPolicy.windows[0].startHour * 60
          : null;
      const businessEndMinutes =
        businessPolicy.windows.length > 0
          ? businessPolicy.windows[businessPolicy.windows.length - 1].endHour * 60
          : null;
      const parseScheduleMinutes = (timeValue?: string | null): number | null => {
        if (!timeValue) return null;
        const raw = timeValue.includes("T")
          ? timeValue.split("T")[1].split(".")[0]
          : timeValue;
        const [h, m] = raw.split(":");
        const hour = Number(h);
        const minute = Number(m);
        if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
        return hour * 60 + minute;
      };
      const scheduleStartMinutes = parseScheduleMinutes(schedule?.start_time);
      const scheduleEndMinutes = parseScheduleMinutes(schedule?.end_time);
      const hasScheduleWindow =
        schedule?.day_off !== true &&
        scheduleStartMinutes !== null &&
        scheduleEndMinutes !== null;
      const resolvedStartMinutes = hasScheduleWindow
        ? scheduleStartMinutes
        : businessPolicy.requiresOffice
        ? businessStartMinutes
        : null;
      const resolvedEndMinutes = hasScheduleWindow
        ? scheduleEndMinutes
        : businessPolicy.requiresOffice
        ? businessEndMinutes
        : null;

      let lt = 0;
      if (firstEntry?.clock_in_time && resolvedStartMinutes !== null) {
        try {
          const { hour, minute } = getManilaHourMinute(firstEntry.clock_in_time);
          const actualInMinutes = hour * 60 + minute;
          lt = calculateLateHours(resolvedStartMinutes, actualInMinutes);
        } catch (e) {
          console.warn("Error calculating late minutes:", e);
        }
      }

      // Calculate UT (Undertime)
      // Policy: UT is based on REQUIRED business hours for that day:
      // - Mon–Thu: 10 hours (07–12, 13–18)
      // - Fri: 8 hours (07–12, 13–16)
      // - Uses employee schedule window when present; otherwise business-hours windows.
      const requiredHoursFromWindows = (windows: Array<{ startHour: number; endHour: number }>) =>
        windows.reduce((s, w) => s + Math.max(0, (w.endHour - w.startHour)), 0);

      let requiredHours = businessPolicy.requiresOffice
        ? requiredHoursFromWindows(businessPolicy.windows)
        : 0;

      if (hasScheduleWindow && resolvedStartMinutes !== null && resolvedEndMinutes !== null) {
        requiredHours = Math.max(0, (resolvedEndMinutes - resolvedStartMinutes) / 60);
      }

      // Half-day approved leave: UT vs first business window only (7AM–12NN = 5h); BH = actual worked.
      if (isHalfDayLeave) {
        const halfRequired = halfDayRequiredHoursByDay(dayOfWeek);
        if (halfRequired > 0) {
          requiredHours = halfRequired;
        }
      }

      // Undertime is the missing required hours after credited BH (BH already uses business windows).
      // Policy: UT is rounded up to the next FULL hour.
      const rawDeficit = Math.max(0, requiredHours - bh);
      let ut = rawDeficit > 0 ? Math.ceil(rawDeficit) : 0;

      // ND now includes night-shift work from actual punches, with OT-derived ND used as source-of-truth
      // when it is greater than punch-derived ND.

      days.push({
        date: dateStr,
        dayName: getDayName(dateStr),
        dayType,
        status,
        isHalfDayLeave,
        timeIn,
        timeOut,
        schedIn,
        schedOut,
        bh: creditWorkHoursHalfHour(Math.round(bh * 100) / 100),
        ot: Math.round(otHours * 100) / 100,
        lt,
        ut,
        nd: Math.round(ndHours * 100) / 100,
        clockEntryIds: dayEntries.flatMap((e: any) => (e.out_punch_id ? [e.id, e.out_punch_id] : [e.id])),
      });
    });

    const totalND = days.reduce((sum, d) => sum + d.nd, 0);
    const daysWithND = days.filter((d) => d.nd > 0);
    const ndResultDebug = {
      employeeName: selectedEmployee?.full_name,
      totalND,
      daysWithNDCount: daysWithND.length,
      daysWithND: daysWithND.map((d) => ({ date: d.date, nd: d.nd })),
    };
    console.log("Timesheet ND result:", ndResultDebug);
    try {
      fetch("http://127.0.0.1:7243/ingest/baf212a9-0048-4497-b30f-a8a72fba0d2d", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: "timesheet/page.tsx:ND-debug-result",
          message: "Timesheet ND result",
          data: ndResultDebug,
          hypothesisId: "ND-timesheet",
          timestamp: Date.now(),
          sessionId: "debug-session",
        }),
      }).catch(() => {});
    } catch (_) {}

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

  async function handleRemoveTimeEntry(entryIds: string[], dateLabel: string) {
    if (!isAdmin) {
      toast.error("Only administrators can remove time entries");
      return;
    }
    if (!entryIds.length) return;
    if (!confirm(`Remove time entry for ${dateLabel}? This cannot be undone.`)) return;
    for (const id of entryIds) {
      const { error } = await supabase.from("time_entries").delete().eq("id", id);
      if (error) {
        console.error("Error deleting time entry:", error);
        toast.error("Failed to remove time entry");
        return;
      }
    }
    toast.success("Time entry removed");
    loadAttendanceData();
  }

  const cutoffLabel = `Weekly Cutoff ${format(periodStart, "MMM d")} to ${format(
    periodEnd,
    "MMM d"
  )}`;

  // Base pay hours for the weekly cutoff window (calculateBasePay — scheduled days × 8 − absences)
  let basePayHours = 0;
  let absences = 0;
  let useBasePayMethod = false;

  if (selectedEmployee) {
    const restDaysMap = new Map<string, boolean>();
    schedules.forEach((schedule, dateStr) => {
      if (schedule.day_off) {
        restDaysMap.set(dateStr, true);
      }
    });

    const clockEntriesForBasePay = clockEntries
      .filter((entry) => entry.clock_out_time !== null)
      .map((entry) => ({
        clock_in_time: entry.clock_in_time,
        clock_out_time: entry.clock_out_time!,
      }));

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

  // When base pay is available: footer still shows summed daily BH/OT columns; basePayHours is slot-based reference.
  // actualTotalBH below matches payslip regular-hour rollup (holidays, RD worked).
  let totalBH = 0;
  let daysWorked = 0;

  if (useBasePayMethod) {
    // Base pay hours from weekly window; attendance BH rollup still reflects holidays / RD worked.
    const actualTotalBH = attendanceDays.reduce((sum, d) => {
      const dayDate = new Date(d.date);
      dayDate.setHours(0, 0, 0, 0);

      // Only count days that are today or earlier
      if (dayDate > todayForDaysWork) {
        return sum;
      }

      // Exclude full-day non-working leave; half-day LWOP still credits worked BH.
      if (
        (d.status === "LWOP" && !d.isHalfDayLeave) ||
        d.status === "CTO" ||
        d.status === "OB"
      ) {
        return sum;
      }

      // Rest days: Only exclude if NOT worked
      // If employee works on rest day, it counts toward Days Work AND they get rest day premium pay
      // Days Work can exceed scheduled window if employee works on rest days.
      // Default schedule: Sunday is rest day (dayType === "sunday" or status === "RD")
      // Account Supervisors: Rest days are Mon/Tue/Wed (from schedule day_off flag)
      const isRestDay = d.dayType === "sunday" || d.status === "RD";
      if (isRestDay) {
        // If rest day was worked (has BH > 0), count it toward Days Work
        // If rest day was NOT worked (BH === 0), exclude it (paid separately as rest day pay for rank/file)
        if (d.bh > 0) {
          // Rest day was worked — count toward actual BH rollup.
          return sum + d.bh;
        } else {
          // Rest day was NOT worked - exclude from Days Work (paid separately)
          return sum;
        }
      }

      // Check if this is a holiday (RH, SH, or non-working holiday)
      const isHoliday = d.status === "RH" || d.status === "SH" || d.dayType === "regular-holiday" || d.dayType === "non-working-holiday";

      if (isHoliday) {
        // Eligible holidays with BH > 0 count in attendance rollup.
        if (d.bh > 0) {
          return sum + d.bh;
        }
      } else {
        // For regular days: count if BH > 0 (Saturday work is OT, not BH — see generateAttendanceDays)
        if (d.bh > 0) {
          // Regular day with BH > 0 counts in attendance rollup.
          return sum + d.bh;
        }
      }

      return sum;
    }, 0);

    // Footer Total BH = sum of daily BH (matches payslip "Hours Work (Regular)" from attendance).
    // basePayHours stays available via calculateBasePay for scheduled-slot diagnostics only.
    totalBH = actualTotalBH;
    daysWorked = totalBH > 0 ? totalBH / 8 : 0;
    // #region agent log
    if (attendanceDays.some((d) => d.date === "2026-01-01") || (format(periodStart, "yyyy-MM-dd") <= "2026-01-15" && format(periodEnd, "yyyy-MM-dd") >= "2026-01-01")) {
      const jan1 = attendanceDays.find((d) => d.date === "2026-01-01");
      fetch("http://127.0.0.1:7243/ingest/baf212a9-0048-4497-b30f-a8a72fba0d2d", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "timesheet/page.tsx:DaysWork", message: "Timesheet Days Work", data: { periodStart: format(periodStart, "yyyy-MM-dd"), periodEnd: format(periodEnd, "yyyy-MM-dd"), employeeName: selectedEmployee?.full_name, jan1: jan1 ? { date: jan1.date, status: jan1.status, bh: jan1.bh, dayType: jan1.dayType } : null, basePayHours, actualTotalBH, totalBH, daysWorked }, hypothesisId: "H1", timestamp: Date.now(), sessionId: "debug-session" }) }).catch(() => {});
    }
    // #endregion
    // Footer totals use summed daily BH (actualTotalBH); basePayHours remains for diagnostics.
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

      // Exclude full-day non-working leave; half-day LWOP still credits worked BH.
      if (
        (d.status === "LWOP" && !d.isHalfDayLeave) ||
        d.status === "CTO" ||
        d.status === "OB"
      ) {
        return sum;
      }

      // Rest days: Only exclude if NOT worked
      // If employee works on rest day, it counts toward Days Work AND they get rest day premium pay
      // Days Work can exceed scheduled window if employee works on rest days.
      // Default schedule: Sunday is rest day (dayType === "sunday" or status === "RD")
      // Account Supervisors: Rest days are Mon/Tue/Wed (from schedule day_off flag)
      const isRestDay = d.dayType === "sunday" || d.status === "RD";
      if (isRestDay) {
        // If rest day was worked (has BH > 0), count it toward Days Work
        // If rest day was NOT worked (BH === 0), exclude it (paid separately as rest day pay for rank/file)
        if (d.bh > 0) {
          // Rest day was worked — count toward actual BH rollup.
          return sum + d.bh;
        } else {
          // Rest day was NOT worked - exclude from Days Work (paid separately)
          return sum;
        }
      }

      // Check if this is a holiday (RH, SH, or non-working holiday)
      const isHoliday = d.status === "RH" || d.status === "SH" || d.dayType === "regular-holiday" || d.dayType === "non-working-holiday";

      if (isHoliday) {
        // Eligible holidays with BH > 0 count in attendance rollup.
        if (d.bh > 0) {
          return sum + d.bh;
        }
      } else {
        // For regular days: count if BH > 0 (Saturday work is OT, not BH — see generateAttendanceDays)
        if (d.bh > 0) {
          // Regular day with BH > 0 counts in attendance rollup.
          return sum + d.bh;
        }
      }

      return sum;
    }, 0);
    daysWorked = totalBH / 8;
  }
  const totalOT = attendanceDays.reduce((sum, d) => sum + d.ot, 0);
  const totalLTHours = attendanceDays.reduce((sum, d) => sum + (d.lt || 0), 0);
  const totalUTHours = attendanceDays.reduce((sum, d) => sum + (d.ut || 0), 0);
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
        <div className="flex items-start justify-between w-full flex-col gap-4 md:flex-row">
          <VStack gap="2" align="start">
            <H1>Timesheet</H1>
            <BodySmall>Attendance by cutoff week.</BodySmall>
          </VStack>
          <HStack gap="3" align="center" className="flex-wrap justify-end">
            {/* Year Selector */}
            <Select
              value={filterMonth.getFullYear().toString()}
              onValueChange={(value) => {
                const year = parseInt(value, 10);
                setFilterMonth(
                  new Date(year, filterMonth.getMonth(), 1)
                );
              }}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 5 }, (_, i) => {
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
              value={format(filterMonth, "MM")}
              onValueChange={(value) => {
                const month = parseInt(value, 10) - 1;
                setFilterMonth(
                  new Date(filterMonth.getFullYear(), month, 1)
                );
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => {
                  const d = new Date(filterMonth.getFullYear(), i, 1);
                  return (
                    <SelectItem
                      key={i}
                      value={format(d, "MM")}
                    >
                      {format(d, "MMMM")}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            {/* Week-of-cutoff Selector */}
            <Select
              value={selectedWeekKey}
              onValueChange={(value) => {
                setSelectedWeekKey(value);
                const d = new Date(value);
                d.setHours(0, 0, 0, 0);
                setSelectedWeekStart(d);
              }}
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Select week" />
              </SelectTrigger>
              <SelectContent>
                {weekOptions.map((opt) => (
                  <SelectItem key={opt.key} value={opt.key}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Quick previous/next week buttons */}
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                setSelectedWeekStart((prev) => {
                  const d = new Date(prev);
                  d.setDate(d.getDate() - 7);
                  setFilterMonth(
                    new Date(d.getFullYear(), d.getMonth(), 1)
                  );
                  return d;
                })
              }
              aria-label="Previous week"
            >
              <Icon name="CaretLeft" size={IconSizes.sm} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                setSelectedWeekStart((prev) => {
                  const d = new Date(prev);
                  d.setDate(d.getDate() + 7);
                  setFilterMonth(
                    new Date(d.getFullYear(), d.getMonth(), 1)
                  );
                  return d;
                })
              }
              aria-label="Next week"
            >
              <Icon name="CaretRight" size={IconSizes.sm} />
            </Button>

            {/* Print Button */}
            <Button onClick={handlePrint} variant="outline">
              <Icon name="Printer" size={IconSizes.sm} />
              Print
            </Button>
          </HStack>
        </div>

        {/* Status Legend */}
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1">
            <div className="h-2.5 w-2.5 rounded-full bg-green-500"></div>
            <span>OT / RD</span>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1">
            <div className="h-2.5 w-2.5 rounded-full bg-blue-500"></div>
            <span>OB</span>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1">
            <div className="h-2.5 w-2.5 rounded-full bg-orange-500"></div>
            <span>LEAVE</span>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1">
            <div className="h-2.5 w-2.5 rounded-full bg-red-500"></div>
            <span>ABSENT / LWOP / INC</span>
          </div>
        </div>

        {/* Employee Selection */}
        <CardSection>
          <VStack gap="2" align="start">
            <label className="font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground">Select employee</label>
            <EmployeeSearchSelect
              employees={employees.map((e) => ({
                id: e.id,
                employee_id: e.employee_id,
                full_name: e.full_name ?? "",
                first_name: e.first_name,
                last_name: e.last_name,
              }))}
              value={selectedEmployee?.id || ""}
              onValueChange={(value) => {
                const emp = employees.find((e) => e.id === value);
                setSelectedEmployee(emp || null);
              }}
              showAllOption={false}
              placeholder="Search by name or employee ID..."
              className="w-64"
            />
          </VStack>
        </CardSection>

        {/* Attendance Table */}
        {selectedEmployee && (
          <CardSection>
            <div className="overflow-x-auto rounded-xl border border-border/80 bg-background/80">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide">
                      DATE
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide">
                      DAY
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide">
                      STATUS
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide">
                      BH
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide">
                      OT
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide">
                      LT (hrs)
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide">
                      UT (hrs)
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide">
                      ND
                    </th>
                    {isAdmin && (
                      <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide w-20">
                        Actions
                      </th>
                    )}
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
                        className={`border-b border-border/70 ${isWeekend ? "bg-primary/5" : ""}`}
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
                        <td className="px-4 py-2 text-sm text-right">
                          {day.status === "LWOP" && !day.isHalfDayLeave
                            ? "-"
                            : day.status === "LEAVE"
                            ? "8.0"
                            : day.bh > 0
                            ? day.bh.toFixed(1)
                            : "-"}
                        </td>
                        <td className="px-4 py-2 text-sm text-right">
                          {day.ot > 0 ? day.ot.toFixed(2) : "-"}
                        </td>
                        <td className="px-4 py-2 text-sm text-right">
                          {day.lt > 0 ? day.lt.toFixed(0) : "0"}
                        </td>
                        <td className="px-4 py-2 text-sm text-right">
                          {day.ut > 0 ? day.ut.toFixed(1) : "0"}
                        </td>
                        <td className="px-4 py-2 text-sm text-right">
                          {day.nd > 0 ? day.nd.toFixed(2) : "0"}
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-2 text-sm">
                            {day.clockEntryIds && day.clockEntryIds.length > 0 ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() =>
                                  handleRemoveTimeEntry(
                                    day.clockEntryIds!,
                                    format(parseISO(day.date), "MMM d, yyyy")
                                  )
                                }
                                title="Remove time entry"
                              >
                                <Icon name="TrashSimple" size={IconSizes.sm} />
                              </Button>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {/* Summary Row */}
                  <tr className="border-t-2 border-primary/30 bg-primary/5 font-semibold">
                    <td colSpan={3} className="px-4 py-2 text-sm">
                      <span title="Sum of daily BH for this week (same basis as payslip regular hours); OT is separate">
                        Days Work: {(daysWorked || 0).toFixed(2)}
                      </span>
                    </td>
                    <td
                      className="px-4 py-2 text-sm text-right"
                      title="Total BH = sum of daily BH (compressed Mon–Fri); Saturday shows in OT column"
                    >
                      {totalBH > 0 ? totalBH.toFixed(1) : "0"}
                    </td>
                    <td className="px-4 py-2 text-sm text-right">
                      {totalOT > 0 ? totalOT.toFixed(2) : "0"}
                    </td>
                    <td className="px-4 py-2 text-sm text-right">
                      {totalLTHours > 0 ? totalLTHours.toFixed(0) : "0"}
                    </td>
                    <td className="px-4 py-2 text-sm text-right">
                      {totalUTHours > 0 ? totalUTHours.toFixed(2) : "0"}
                    </td>
                    <td className="px-4 py-2 text-sm text-right">
                      {totalND > 0 ? totalND.toFixed(2) : "0"}
                    </td>
                    {isAdmin && <td className="px-4 py-2" />}
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