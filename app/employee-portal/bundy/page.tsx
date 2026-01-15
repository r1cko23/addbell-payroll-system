"use client";

import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useEmployeeSession } from "@/contexts/EmployeeSessionContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CardSection } from "@/components/ui/card-section";
import { H1, H3, BodySmall, Caption } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { LocationConfirmationModal } from "@/components/LocationConfirmationModal";
import {
  getBiMonthlyPeriodEnd,
  getBiMonthlyPeriodStart,
  getNextBiMonthlyPeriod,
  getPreviousBiMonthlyPeriod,
  formatBiMonthlyPeriod,
} from "@/utils/bimonthly";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format as formatDate,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
  parseISO,
  getDay,
} from "date-fns";

/**
 * Convert a UTC timestamp to Asia/Manila date string (YYYY-MM-DD)
 * This is more reliable than using toLocaleString which can cause date shifts
 */
function getDateInManilaTimezone(utcTimestamp: string | Date): string {
  const date =
    typeof utcTimestamp === "string" ? new Date(utcTimestamp) : utcTimestamp;
  // Use Intl.DateTimeFormat to get the date components in Asia/Manila timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return `${year}-${month}-${day}`;
}
import { determineDayType, getDayName } from "@/utils/holidays";
import type { Holiday } from "@/utils/holidays";
import { getBiMonthlyWorkingDays } from "@/utils/bimonthly";
import { useEmployeeLeaveCredits } from "@/lib/hooks/useEmployeeData";

interface TimeEntry {
  id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  clock_in_location: string | null;
  clock_out_location: string | null;
  total_hours: number | null;
  status: string;
  clock_in_date_ph?: string | null;
}

interface LocationStatus {
  isAllowed: boolean;
  nearestLocation: string | null;
  distance: number | null;
  error: string | null;
}

interface CalendarHoliday {
  date: string;
  name: string;
  type: "regular" | "non-working";
}

const PHILIPPINE_HOLIDAYS: Record<number, CalendarHoliday[]> = {
  2025: [
    { date: "2025-01-01", name: "New Year's Day", type: "regular" },
    { date: "2025-03-29", name: "Maundy Thursday", type: "regular" },
    { date: "2025-03-30", name: "Good Friday", type: "regular" },
    { date: "2025-04-09", name: "Araw ng Kagitingan", type: "regular" },
    { date: "2025-05-01", name: "Labor Day", type: "regular" },
    { date: "2025-06-12", name: "Independence Day", type: "regular" },
    { date: "2025-08-25", name: "National Heroes Day", type: "regular" },
    { date: "2025-11-30", name: "Bonifacio Day", type: "regular" },
    { date: "2025-12-25", name: "Christmas Day", type: "regular" },
    { date: "2025-12-30", name: "Rizal Day", type: "regular" },
    { date: "2025-02-09", name: "Chinese New Year", type: "non-working" },
    {
      date: "2025-02-25",
      name: "EDSA People Power Revolution Anniversary",
      type: "non-working",
    },
    { date: "2025-03-31", name: "Black Saturday", type: "non-working" },
    { date: "2025-08-21", name: "Ninoy Aquino Day", type: "non-working" },
    { date: "2025-11-01", name: "All Saints' Day", type: "non-working" },
    { date: "2025-11-02", name: "All Souls' Day", type: "non-working" },
    {
      date: "2025-12-08",
      name: "Feast of the Immaculate Conception",
      type: "non-working",
    },
    { date: "2025-12-24", name: "Christmas Eve", type: "non-working" },
    { date: "2025-12-26", name: "Additional Special Non-Working Day", type: "non-working" },
    { date: "2025-12-31", name: "New Year's Eve", type: "non-working" },
  ],
  2026: [
    { date: "2026-01-01", name: "New Year's Day", type: "regular" },
    { date: "2026-04-02", name: "Maundy Thursday", type: "regular" },
    { date: "2026-04-03", name: "Good Friday", type: "regular" },
    { date: "2026-04-09", name: "Araw ng Kagitingan", type: "regular" },
    { date: "2026-05-01", name: "Labor Day", type: "regular" },
    { date: "2026-06-12", name: "Independence Day", type: "regular" },
    { date: "2026-08-31", name: "National Heroes Day", type: "regular" },
    { date: "2026-11-30", name: "Bonifacio Day", type: "regular" },
    { date: "2026-12-25", name: "Christmas Day", type: "regular" },
    { date: "2026-12-30", name: "Rizal Day", type: "regular" },
    { date: "2026-02-17", name: "Chinese New Year", type: "non-working" },
    { date: "2026-02-25", name: "EDSA People Power Revolution Anniversary", type: "non-working" },
    { date: "2026-04-04", name: "Black Saturday", type: "non-working" },
    { date: "2026-08-21", name: "Ninoy Aquino Day", type: "non-working" },
    { date: "2026-11-01", name: "All Saints' Day", type: "non-working" },
    { date: "2026-11-02", name: "All Souls' Day", type: "non-working" },
    {
      date: "2026-12-08",
      name: "Feast of the Immaculate Conception",
      type: "non-working",
    },
    { date: "2026-12-24", name: "Christmas Eve", type: "non-working" },
    { date: "2026-12-26", name: "Additional Special Non-Working Day", type: "non-working" },
    { date: "2026-12-31", name: "New Year's Eve", type: "non-working" },
  ],
};

type CalendarEntryType = "time" | "leave" | "absent" | "inc" | "present";

interface CalendarEntry {
  date: string;
  type: CalendarEntryType;
  label: string;
  clock_in_time?: string;
  clock_out_time?: string | null;
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
  leave_type: string;
  start_date: string;
  end_date: string;
  status: string;
  selected_dates?: string[] | null;
}

interface OvertimeRequest {
  id: string;
  ot_date: string;
  end_date?: string | null;
  start_time: string;
  end_time: string;
  total_hours: number;
  status: string;
}

interface AttendanceDay {
  date: string;
  dayName: string;
  dayType: string;
  status: string;
  timeIn: string | null;
  timeOut: string | null;
  schedIn: string | null;
  schedOut: string | null;
  bh: number;
  ot: number;
  lt: number;
  ut: number;
  nd: number;
}

export default function BundyClockPage() {
  const { employee } = useEmployeeSession();
  const supabase = createClient();

  const [currentEntry, setCurrentEntry] = useState<TimeEntry | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [locationStatus, setLocationStatus] = useState<LocationStatus | null>(
    null
  );
  const [periodStart, setPeriodStart] = useState<Date>(() =>
    getBiMonthlyPeriodStart(new Date())
  );
  const periodEnd = useMemo(
    () => getBiMonthlyPeriodEnd(periodStart),
    [periodStart]
  );
  const [loading, setLoading] = useState(true);
  const [initialFetchComplete, setInitialFetchComplete] = useState(false);
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [calendarHolidays, setCalendarHolidays] = useState<CalendarHoliday[]>(
    []
  );
  const [calendarEntries, setCalendarEntries] = useState<CalendarEntry[]>([]);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [pendingClockAction, setPendingClockAction] = useState<
    "in" | "out" | null
  >(null);
  const [pendingFailureToLog, setPendingFailureToLog] = useState<Set<string>>(
    new Set()
  );
  const [lastLocationUpdate, setLastLocationUpdate] = useState<Date | null>(
    null
  );
  const [clientIp, setClientIp] = useState<string | null>(null);
  const serverTimeBaseRef = useRef<Date | null>(null);
  const serverPerfBaseRef = useRef<number | null>(null);
  const [timeSyncReady, setTimeSyncReady] = useState(false);

  // Attendance data for timesheet table
  const [attendanceDays, setAttendanceDays] = useState<AttendanceDay[]>([]);
  const [clockEntriesForAttendance, setClockEntriesForAttendance] = useState<
    ClockEntry[]
  >([]);
  const [schedules, setSchedules] = useState<Map<string, Schedule>>(new Map());
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [otRequests, setOtRequests] = useState<OvertimeRequest[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [employeePosition, setEmployeePosition] = useState<string | null>(null);
  const [isRestDayToday, setIsRestDayToday] = useState<boolean>(false);
  const [employeeType, setEmployeeType] = useState<string | null>(null);

  // Fetch employee position and type, and check if today is a rest day
  useEffect(() => {
    const fetchEmployeeInfo = async () => {
      if (!employee?.id) return;
      try {
        const { data, error } = await supabase
          .from("employees")
          .select("position, employee_type")
          .eq("id", employee.id)
          .maybeSingle<{ position: string | null; employee_type: string | null }>();

        if (error) {
          console.error("Failed to fetch employee info:", error);
          // Don't show toast here as this is a background fetch
          // The schedule page will handle its own errors
          return;
        }

        if (data) {
          setEmployeePosition(data.position);
          setEmployeeType(data.employee_type);

          // Check if today is a rest day
          const today = new Date();
          const todayStr = getDateInManilaTimezone(today);

          if (data.employee_type === "client-based") {
            // For client-based: Check employee_week_schedules for day_off flag
            const { data: scheduleData } = await supabase
              .from("employee_week_schedules")
              .select("day_off")
              .eq("employee_id", employee.id)
              .eq("schedule_date", todayStr)
              .maybeSingle();

            setIsRestDayToday(scheduleData?.day_off === true);
          } else {
            // For office-based: Sunday is the fixed rest day
            const dayOfWeek = getDay(today);
            setIsRestDayToday(dayOfWeek === 0); // 0 = Sunday
          }
        }
      } catch (err) {
        console.error("Failed to fetch employee info:", err);
      }
    };
    fetchEmployeeInfo();
  }, [employee?.id, supabase]);

  // Fetch client IP once for logging
  useEffect(() => {
    fetch("https://api.ipify.org?format=json")
      .then((res) => res.json())
      .then((data) => setClientIp(data.ip))
      .catch(() => setClientIp(null));
  }, []);

  // Sync with server time to avoid client clock tampering
  useEffect(() => {
    let cancelled = false;
    let tickTimer: NodeJS.Timeout | null = null;
    let syncTimer: NodeJS.Timeout | null = null;

    const startTicker = () => {
      const tick = () => {
        if (!serverTimeBaseRef.current || serverPerfBaseRef.current === null)
          return;
        const elapsed = performance.now() - serverPerfBaseRef.current;
        setCurrentTime(new Date(serverTimeBaseRef.current.getTime() + elapsed));
      };
      tick();
      tickTimer = setInterval(tick, 1000);
    };

    const syncServerTime = async () => {
      const { data, error } = await supabase.rpc("get_server_time");
      if (cancelled) return;
      if (error || !data) {
        setTimeSyncReady(false);
        // fallback to client time if server time unavailable
        serverTimeBaseRef.current = new Date();
        serverPerfBaseRef.current = performance.now();
        if (!tickTimer) startTicker();
        return;
      }
      serverTimeBaseRef.current = new Date(data as string);
      serverPerfBaseRef.current = performance.now();
      setTimeSyncReady(true);
      if (!tickTimer) startTicker();
    };

    syncServerTime();
    syncTimer = setInterval(syncServerTime, 60_000); // refresh every minute

    return () => {
      cancelled = true;
      if (syncTimer) clearInterval(syncTimer);
      if (tickTimer) clearInterval(tickTimer);
    };
  }, [supabase]);

  // Debounce location validation to avoid excessive API calls
  const locationValidationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const validateLocation = useCallback(
    async (lat: number, lng: number) => {
      // Clear any pending validation
      if (locationValidationTimeoutRef.current) {
        clearTimeout(locationValidationTimeoutRef.current);
      }

      // Debounce validation by 500ms
      locationValidationTimeoutRef.current = setTimeout(async () => {
        const { data, error } = await supabase.rpc(
          "is_employee_location_allowed",
          {
            p_employee_uuid: employee.id,
            p_latitude: lat,
            p_longitude: lng,
          } as any
        );

        if (error) {
          setLocationStatus({
            isAllowed: false,
            nearestLocation: null,
            distance: null,
            error: "Failed to validate location",
          });
          return;
        }

        if (data) {
          const dataArray = data as Array<{
            is_allowed: boolean;
            nearest_location_name: string | null;
            distance_meters: number | null;
            error_message: string | null;
          }>;

          if (dataArray.length > 0) {
            const result = dataArray[0];
            setLocationStatus({
              isAllowed: result.is_allowed,
              nearestLocation: result.nearest_location_name,
              distance: result.distance_meters
                ? Math.round(result.distance_meters)
                : null,
              error: result.error_message,
            });
          }
        }
      }, 500);
    },
    [employee.id, supabase]
  );

  const checkClockStatus = useCallback(async () => {
    const { data } = await supabase
      .from("time_clock_entries")
      .select("*")
      .eq("employee_id", employee.id)
      .eq("status", "clocked_in")
      .order("clock_in_time", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      // Check if the entry is from today (Asia/Manila timezone)
      const entryData = data as {
        clock_in_time: string;
        clock_out_time: string | null;
        id: string;
      };
      const entryDate = new Date(entryData.clock_in_time);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Convert to Asia/Manila timezone for accurate comparison using reliable method
      const entryDateStr = getDateInManilaTimezone(entryDate);
      const todayStr = getDateInManilaTimezone(today);

      // Only set current entry if it's from today
      // If entry is from a previous day, it should remain incomplete
      // and the database function will prevent clocking in until failure-to-log is filed
      if (entryDateStr === todayStr) {
        setCurrentEntry(entryData as any);
      } else {
        // Entry is from a previous day - don't set as current entry
        // User must file failure-to-log request before clocking in again
        setCurrentEntry(null);
      }
    } else {
      setCurrentEntry(null);
    }
  }, [employee.id, supabase]);

  const fetchEntries = useCallback(async () => {
    const { data } = await supabase
      .from("time_clock_entries")
      .select("*")
      .eq("employee_id", employee.id)
      .gte("clock_in_time", periodStart.toISOString())
      .lte("clock_in_time", periodEnd.toISOString())
      .order("clock_in_time", { ascending: false });

    setEntries(data || []);
  }, [employee.id, periodEnd, periodStart, supabase]);

  const fetchCalendarHolidays = useCallback(
    async (targetDate: Date) => {
      const gridStart = startOfWeek(startOfMonth(targetDate), {
        weekStartsOn: 0,
      });
      const gridEnd = endOfWeek(endOfMonth(targetDate), { weekStartsOn: 0 });
      const startISO = formatDate(gridStart, "yyyy-MM-dd");
      const endISO = formatDate(gridEnd, "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("holidays")
        .select("holiday_date, name, is_regular")
        .gte("holiday_date", startISO)
        .lte("holiday_date", endISO);

      if (error) {
        console.error("Failed to load calendar holidays", error);
      }

      const targetYear = targetDate.getFullYear();
      const holidaysData = data as Array<{
        holiday_date: string;
        name: string;
        is_regular: boolean;
      }> | null;

      const dbHolidays =
        (holidaysData || []).map((holiday) => ({
          date: holiday.holiday_date,
          name: holiday.name,
          type: holiday.is_regular
            ? ("regular" as const)
            : ("non-working" as const),
        })) || [];

      const fallbackHolidays =
        PHILIPPINE_HOLIDAYS[targetYear]?.filter(
          (holiday) => holiday.date >= startISO && holiday.date <= endISO
        ) || [];

      const merged = new Map<string, CalendarHoliday>();
      [...dbHolidays, ...fallbackHolidays].forEach((holiday) => {
        merged.set(holiday.date, holiday);
      });

      setCalendarHolidays(Array.from(merged.values()));
    },
    [supabase]
  );

  const fetchCalendarEntries = useCallback(
    async (targetDate: Date) => {
      const gridStart = startOfWeek(startOfMonth(targetDate), {
        weekStartsOn: 0,
      });
      const gridEnd = endOfWeek(endOfMonth(targetDate), { weekStartsOn: 0 });
      const startRange = gridStart.toISOString();
      const endRange = gridEnd.toISOString();
      const startDateStr = formatDate(gridStart, "yyyy-MM-dd");
      const endDateStr = formatDate(gridEnd, "yyyy-MM-dd");
      const holidaySet = new Set(calendarHolidays.map((h) => h.date));

      // Batch all queries in parallel for better performance
      const [timeResult, leaveResult, scheduleResult] = await Promise.all([
        supabase
          .from("time_clock_entries")
          .select("clock_in_time, clock_out_time, status, clock_in_date_ph")
          .eq("employee_id", employee.id)
          .gte("clock_in_time", startRange)
          .lte("clock_in_time", endRange)
          .order("clock_in_time", { ascending: true }),
        supabase
          .from("leave_requests")
          .select("leave_type, start_date, end_date, selected_dates, status")
          .eq("employee_id", employee.id)
          .in("status", ["approved_by_manager", "approved_by_hr"]),
        supabase
          .from("employee_week_schedules")
          .select("schedule_date, day_off")
          .eq("employee_id", employee.id)
          .gte("schedule_date", startDateStr)
          .lte("schedule_date", endDateStr),
      ]);

      const { data: timeData, error: timeError } = timeResult;
      const { data: leaveData, error: leaveError } = leaveResult;
      const { data: scheduleDays, error: scheduleError } = scheduleResult;

      if (timeError) {
        console.error("Failed to load calendar time entries", timeError);
        return;
      }

      if (leaveError) {
        console.error("Failed to load calendar leaves", leaveError);
      }

      if (scheduleError) {
        console.error("Failed to load schedule day-off flags", scheduleError);
      }

      const entries: CalendarEntry[] = [];

      const dayOffSet = new Set(
        (scheduleDays || [])
          .filter((d: any) => d.day_off)
          .map((d: any) => formatDate(new Date(d.schedule_date), "yyyy-MM-dd"))
      );

      // Time entries mapped to days
      const timeEntries = timeData as Array<{
        clock_in_time: string;
        clock_out_time: string | null;
        status: string;
        clock_in_date_ph?: string | null;
      }> | null;

      (timeEntries || []).forEach((entry) => {
        const dateIso =
          entry.clock_in_date_ph ||
          formatDate(new Date(entry.clock_in_time), "yyyy-MM-dd");
        entries.push({
          date: dateIso,
          type: entry.clock_out_time ? "time" : "inc",
          label: entry.clock_out_time ? "Present" : "Incomplete",
          clock_in_time: entry.clock_in_time,
          clock_out_time: entry.clock_out_time,
        });
      });

      // Leave entries - use selected_dates if available, otherwise use date range
      const leaveEntries = leaveData as Array<{
        leave_type: string;
        start_date: string;
        end_date: string;
        selected_dates?: string[] | null;
        status: string;
      }> | null;

      (leaveEntries || []).forEach((leave) => {
        let datesToProcess: Date[] = [];

        if (
          leave.selected_dates &&
          Array.isArray(leave.selected_dates) &&
          leave.selected_dates.length > 0
        ) {
          // Use selected dates
          datesToProcess = leave.selected_dates
            .map((dateStr: string) => new Date(dateStr))
            .filter((d: Date) => !isNaN(d.getTime()));
        } else {
          // Fallback to date range
          const start = new Date(leave.start_date);
          const end = new Date(leave.end_date);
          datesToProcess = eachDayOfInterval({ start, end });
        }

        datesToProcess.forEach((d) => {
          const iso = formatDate(d, "yyyy-MM-dd");
          // Only include days inside the grid range
          if (d >= gridStart && d <= gridEnd) {
            entries.push({
              date: iso,
              type: "leave",
              label: leave.leave_type,
            });
          }
        });
      });

      // Determine absent/present/inc per day (exclude days with leave)
      const dayMap = new Map<string, CalendarEntry[]>();
      entries.forEach((e) => {
        if (!dayMap.has(e.date)) dayMap.set(e.date, []);
        dayMap.get(e.date)!.push(e);
      });

      // Build absent/inc/present markers for each day in grid
      const today = new Date();
      eachDayOfInterval({ start: gridStart, end: gridEnd }).forEach((day) => {
        const iso = formatDate(day, "yyyy-MM-dd");
        const existing = dayMap.get(iso) || [];
        const hasLeave = existing.some((e) => e.type === "leave");
        if (hasLeave) return;
        const isWeekend = day.getDay() === 0 || day.getDay() === 6;
        const isHoliday = holidaySet.has(iso);
        const isDayOff = dayOffSet.has(iso);

        const timeEntries = existing.filter(
          (e) => e.type === "time" || e.type === "inc"
        );

        // Only mark absent/inc/present for dates up to today
        if (day > today) return;
        // Skip holidays and marked day-offs (weekends can be working days)
        if (isHoliday || isDayOff) return;

        if (timeEntries.length === 0) {
          existing.push({
            date: iso,
            type: "absent",
            label: "Absent",
          });
        } else {
          const hasIncomplete = timeEntries.some((e) => e.type === "inc");
          existing.push({
            date: iso,
            type: hasIncomplete ? "inc" : "present",
            label: hasIncomplete ? "INC" : "Present",
          });
        }

        dayMap.set(iso, existing);
      });

      setCalendarEntries(Array.from(dayMap.values()).flat());
    },
    [employee.id, supabase]
  );

  useEffect(() => {
    const fetchInitialData = async () => {
      await Promise.all([checkClockStatus(), fetchEntries()]);
      setLoading(false);
      setInitialFetchComplete(true);
    };
    fetchInitialData();
  }, [checkClockStatus, fetchEntries]);

  // Function to get fresh location
  const getFreshLocation = useCallback(async (): Promise<{
    lat: number;
    lng: number;
  } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          resolve(loc);
        },
        (error) => {
          console.log("Location not available:", error);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0, // Force fresh location, no caching
        }
      );
    });
  }, []);

  // Background auto-refresh of geolocation every 10s (no caching)
  useEffect(() => {
    if (!initialFetchComplete) return;
    const id = setInterval(() => {
      getFreshLocation().then((loc) => {
        if (loc) {
          setLocation(loc);
          validateLocation(loc.lat, loc.lng);
        }
      });
    }, 10000);
    return () => clearInterval(id);
  }, [initialFetchComplete, getFreshLocation, validateLocation]);

  // Initial location fetch
  useEffect(() => {
    if (!initialFetchComplete) return;

    getFreshLocation().then((loc) => {
      if (loc) {
        setLocation(loc);
        validateLocation(loc.lat, loc.lng);
      }
    });
  }, [initialFetchComplete, getFreshLocation, validateLocation]);

  // Refresh location when app becomes visible (user returns to app)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && initialFetchComplete) {
        getFreshLocation().then((loc) => {
          if (loc) {
            setLocation(loc);
            validateLocation(loc.lat, loc.lng);
          }
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [initialFetchComplete, getFreshLocation, validateLocation]);

  // Memoize calendar date string to avoid unnecessary re-fetches
  const calendarDateKey = useMemo(
    () => formatDate(calendarDate, "yyyy-MM"),
    [calendarDate]
  );

  useEffect(() => {
    fetchCalendarHolidays(calendarDate);
  }, [calendarDateKey, fetchCalendarHolidays]);

  useEffect(() => {
    // Only fetch entries when holidays are loaded to avoid race conditions
    if (calendarHolidays.length > 0 || calendarDateKey) {
      fetchCalendarEntries(calendarDate);
    }
  }, [calendarDate, calendarHolidays.length, fetchCalendarEntries]);

  const loadAttendanceData = useCallback(async () => {
    if (!employee) return;

    try {
      const periodStartStr = formatDate(periodStart, "yyyy-MM-dd");
      const periodEndStr = formatDate(periodEnd, "yyyy-MM-dd");

      // Batch all queries in parallel for better performance
      const periodStartDate = new Date(periodStart);
      periodStartDate.setHours(0, 0, 0, 0);
      periodStartDate.setDate(periodStartDate.getDate() - 1);
      const periodEndDate = new Date(periodEnd);
      periodEndDate.setHours(23, 59, 59, 999);
      periodEndDate.setDate(periodEndDate.getDate() + 1);

      // Debug: Log query parameters
      console.log("🔍 Employee Portal - Loading attendance data:", {
        employeeId: employee.id,
        employeeIdString: employee.employee_id,
        periodStart: periodStartStr,
        periodEnd: periodEndStr,
        queryStart: periodStartDate.toISOString(),
        queryEnd: periodEndDate.toISOString(),
      });

      const [
        holidaysResult,
        clockResult,
        leaveResult,
        otResult,
        scheduleResult,
      ] = await Promise.all([
        supabase
          .from("holidays")
          .select("holiday_date, name, is_regular")
          .gte("holiday_date", periodStartStr)
          .lte("holiday_date", periodEndStr),
        supabase
          .from("time_clock_entries")
          .select(
            "id, clock_in_time, clock_out_time, regular_hours, total_hours, total_night_diff_hours, status"
          )
          .eq("employee_id", employee.id)
          .gte("clock_in_time", periodStartDate.toISOString())
          .lte("clock_in_time", periodEndDate.toISOString())
          .order("clock_in_time", { ascending: true }),
        supabase
          .from("leave_requests")
          .select(
            "id, leave_type, start_date, end_date, status, selected_dates"
          )
          .eq("employee_id", employee.id)
          .lte("start_date", periodEndStr)
          .gte("end_date", periodStartStr)
          .in("status", ["approved_by_manager", "approved_by_hr"]),
        supabase
          .from("overtime_requests")
          .select("id, ot_date, start_time, end_time, total_hours, status")
          .eq("employee_id", employee.id)
          .gte("ot_date", periodStartStr)
          .lte("ot_date", periodEndStr)
          .in("status", ["approved", "approved_by_manager", "approved_by_hr"]),
        supabase
          .from("employee_week_schedules")
          .select("schedule_date, start_time, end_time, day_off")
          .eq("employee_id", employee.id)
          .gte("schedule_date", periodStartStr)
          .lte("schedule_date", periodEndStr),
      ]);

      const { data: holidaysData, error: holidaysError } = holidaysResult;
      const { data: clockData, error: clockError } = clockResult;
      const { data: leaveData, error: leaveError } = leaveResult;
      const { data: otData, error: otError } = otResult;
      const { data: scheduleData, error: scheduleError } = scheduleResult;

      // Debug: Check auth session
      const { data: authSession } = await supabase.auth.getSession();
      console.log("🔐 Employee Portal - Auth session:", {
        hasSession: !!authSession?.session,
        userId: authSession?.session?.user?.id || null,
        role: authSession?.session?.user?.role || "anon",
      });

      // Debug: Log query errors
      if (clockError) {
        console.error("❌ Employee Portal - Clock entries query error:", {
          error: clockError,
          errorCode: clockError.code,
          errorMessage: clockError.message,
          errorDetails: clockError.details,
          employeeId: employee.id,
          employeeIdString: employee.employee_id,
          queryStart: periodStartDate.toISOString(),
          queryEnd: periodEndDate.toISOString(),
        });
      }

      // Debug: Log query results
      console.log("📊 Employee Portal - Query results:", {
        employeeId: employee.id,
        employeeIdString: employee.employee_id,
        clockEntriesCount: clockData?.length || 0,
        clockError: clockError?.message || null,
        holidaysCount: holidaysData?.length || 0,
        leaveCount: leaveData?.length || 0,
        otCount: otData?.length || 0,
        scheduleCount: scheduleData?.length || 0,
      });

      // Debug: Log loaded entries for employee 23376
      if (employee?.id && clockData && clockData.length > 0) {
        console.log(
          `✅ Employee ${employee.id} - Loaded ${clockData.length} clock entries for period ${periodStartStr} to ${periodEndStr}:`,
          clockData.map((e: any) => {
            const entryDateStr = getDateInManilaTimezone(e.clock_in_time);
            return {
              id: e.id,
              clock_in: e.clock_in_time,
              clock_out: e.clock_out_time,
              status: e.status,
              date_in_manila: entryDateStr,
              in_period:
                entryDateStr >= periodStartStr && entryDateStr <= periodEndStr,
            };
          })
        );
      } else if (employee?.id && (!clockData || clockData.length === 0)) {
        console.warn(
          `⚠️ Employee ${employee.id} - No clock entries found for period ${periodStartStr} to ${periodEndStr}`,
          {
            clockData: clockData,
            clockError: clockError,
            queryStart: periodStartDate.toISOString(),
            queryEnd: periodEndDate.toISOString(),
          }
        );
      }

      const formattedHolidays: Holiday[] = (holidaysData || []).map(
        (h: any) => ({
          date: h.holiday_date,
          name: h.name,
          type: h.is_regular ? "regular" : "non-working",
        })
      );
      setHolidays(formattedHolidays);

      // Filter by date in Asia/Manila timezone
      type ClockEntry = {
        id: string;
        clock_in_time: string;
        clock_out_time: string | null;
        regular_hours: number | null;
        total_hours: number | null;
        total_night_diff_hours: number | null;
        status: string;
      };
      const filteredClockData = ((clockData || []) as ClockEntry[]).filter(
        (entry) => {
          const entryDateStr = getDateInManilaTimezone(entry.clock_in_time);
          return entryDateStr >= periodStartStr && entryDateStr <= periodEndStr;
        }
      );

      // Filter to only include entries with valid status (exclude rejected and pending)
      // Include all statuses that indicate the entry is valid: auto_approved, approved, clocked_out, clocked_in
      // This matches the admin/HR page logic
      const validEntries = filteredClockData.filter(
        (e) =>
          e.status !== "rejected" &&
          e.status !== "pending" &&
          (e.status === "auto_approved" ||
            e.status === "approved" ||
            e.status === "clocked_out" ||
            e.status === "clocked_in")
      );

      setClockEntriesForAttendance(validEntries || []);

      // Debug: Log filtered entries for employee 23376
      if (employee?.id && filteredClockData.length !== validEntries.length) {
        console.log(
          `Employee ${employee.id} - Filtered out ${
            filteredClockData.length - validEntries.length
          } entries:`,
          filteredClockData
            .filter(
              (e) =>
                e.status === "rejected" ||
                e.status === "pending" ||
                !(
                  e.status === "auto_approved" ||
                  e.status === "approved" ||
                  e.status === "clocked_out" ||
                  e.status === "clocked_in"
                )
            )
            .map((e) => ({
              id: e.id,
              clock_in: e.clock_in_time,
              status: e.status,
            }))
        );
      }

      const completeEntries = validEntries.filter(
        (e) => e.clock_out_time !== null
      );
      const incompleteEntries = validEntries.filter(
        (e) => e.clock_out_time === null
      );

      // Debug: Log summary of filtering
      if (employee?.id) {
        console.log(`Employee ${employee.id} - Entry filtering summary:`, {
          totalLoaded: (clockData || []).length,
          afterDateFilter: filteredClockData.length,
          afterStatusFilter: validEntries.length,
          completeEntries: completeEntries.length,
          incompleteEntries: incompleteEntries.length,
          period: `${periodStartStr} to ${periodEndStr}`,
        });
      }

      setLeaveRequests(leaveData || []);
      setOtRequests(otData || []);

      const scheduleMap = new Map<string, Schedule>();
      (scheduleData || []).forEach((s: any) => {
        scheduleMap.set(s.schedule_date, {
          schedule_date: s.schedule_date,
          start_time: s.start_time,
          end_time: s.end_time,
          day_off: s.day_off || false,
        });
      });
      setSchedules(scheduleMap);

      generateAttendanceDays(
        completeEntries,
        incompleteEntries,
        leaveData || [],
        otData || [],
        scheduleMap,
        formattedHolidays,
        employeeType === "client-based"
      );
    } catch (error) {
      console.error("Error loading attendance data:", error);
    }
  }, [employee, periodStart, periodEnd, supabase]);

  // Load attendance data for timesheet table
  useEffect(() => {
    if (employee && initialFetchComplete) {
      loadAttendanceData();
    }
  }, [employee, periodStart, initialFetchComplete, loadAttendanceData]);

  // Memoize attendance days generation to avoid recalculation
  const generateAttendanceDays = useCallback(
    (
      entries: ClockEntry[],
      incompleteEntries: ClockEntry[],
      leaveRequests: LeaveRequest[],
      otRequests: OvertimeRequest[],
      scheduleMap: Map<string, Schedule>,
      holidays: Holiday[],
      isClientBased?: boolean
    ) => {
      const workingDays = getBiMonthlyWorkingDays(periodStart);
      const days: AttendanceDay[] = [];

      // Group entries by date using reliable timezone conversion
      const entriesByDate = new Map<string, ClockEntry[]>();
      entries.forEach((entry) => {
        if (!entry.clock_out_time) return;
        // Use reliable timezone conversion to get date in Asia/Manila
        const dateStr = getDateInManilaTimezone(entry.clock_in_time);
        if (!entriesByDate.has(dateStr)) {
          entriesByDate.set(dateStr, []);
        }
        entriesByDate.get(dateStr)!.push(entry);
      });

      const incompleteByDate = new Map<string, ClockEntry[]>();
      incompleteEntries.forEach((entry) => {
        // Use reliable timezone conversion to get date in Asia/Manila
        const dateStr = getDateInManilaTimezone(entry.clock_in_time);
        if (!incompleteByDate.has(dateStr)) {
          incompleteByDate.set(dateStr, []);
        }
        incompleteByDate.get(dateStr)!.push(entry);
      });

      // Debug: Log entries by date to help diagnose issues
      const periodStartStr = formatDate(periodStart, "yyyy-MM-dd");
      const periodEndStr = formatDate(periodEnd, "yyyy-MM-dd");
      if (entries.length > 0 || incompleteEntries.length > 0 || employee?.id) {
        console.log(
          `Employee ${employee?.id || "unknown"} - Processing entries:`,
          {
            period: `${periodStartStr} to ${periodEndStr}`,
            workingDaysCount: workingDays.length,
            workingDaysSample: workingDays.slice(0, 3).map((d) => ({
              original: formatDate(d, "yyyy-MM-dd"),
              manila: getDateInManilaTimezone(d),
            })),
            completeEntries: entries.length,
            incompleteEntries: incompleteEntries.length,
            entriesByDate: Array.from(entriesByDate.entries()).map(
              ([date, ents]) => ({
                date,
                count: ents.length,
                entries: ents.map((e) => ({
                  id: e.id,
                  clock_in: e.clock_in_time,
                  clock_out: e.clock_out_time,
                  status: e.status,
                  date_in_manila: getDateInManilaTimezone(e.clock_in_time),
                })),
              })
            ),
            incompleteByDate: Array.from(incompleteByDate.entries()).map(
              ([date, ents]) => ({
                date,
                count: ents.length,
              })
            ),
          }
        );
      }

      // Group leave requests by date
      const leavesByDate = new Map<string, LeaveRequest[]>();
      leaveRequests.forEach((leave) => {
        if (leave.selected_dates && leave.selected_dates.length > 0) {
          leave.selected_dates.forEach((dateStr: string) => {
            if (!leavesByDate.has(dateStr)) {
              leavesByDate.set(dateStr, []);
            }
            leavesByDate.get(dateStr)!.push(leave);
          });
        } else {
          const startDate = new Date(leave.start_date);
          const endDate = new Date(leave.end_date);
          let currentDate = new Date(startDate);
          while (currentDate <= endDate) {
            const dateStr = formatDate(currentDate, "yyyy-MM-dd");
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
          : formatDate(new Date(ot.ot_date), "yyyy-MM-dd");
        if (!otByDate.has(otDateStr)) {
          otByDate.set(otDateStr, []);
        }
        otByDate.get(otDateStr)!.push(ot);
      });

      // Check if employee is account supervisor (defined once at function level)
      const isAccountSupervisor =
        employeePosition?.toUpperCase().includes("ACCOUNT SUPERVISOR") || false;
      const isClientBasedAccountSupervisor = isAccountSupervisor && (isClientBased === true);

      workingDays.forEach((date) => {
        // Use consistent date formatting to match admin/HR dashboard
        // Format date as yyyy-MM-dd to ensure consistency across both pages
        const dateStr = formatDate(date, "yyyy-MM-dd");
        const schedule = scheduleMap.get(dateStr);
        const isRestDay = schedule?.day_off === true;
        // Pass isClientBased so Sunday is not automatically treated as rest day for client-based employees
        const dayType = determineDayType(dateStr, holidays, isRestDay, isClientBased);
        const dayOfWeek = getDay(date);
        const dayEntries = entriesByDate.get(dateStr) || [];
        const incompleteDayEntries = incompleteByDate.get(dateStr) || [];
        const dayLeaves = leavesByDate.get(dateStr) || [];
        const dayOTs = otByDate.get(dateStr) || [];

        // Determine status based on priority (matching admin/HR page logic):
        // 1. Leave requests (LWOP, LEAVE, CTO, OB)
        // 2. Holidays (check BEFORE checking entries/ABSENT to ensure holidays are detected)
        // 3. OT requests
        // 4. Complete time entries (LOG)
        // 5. Incomplete time entries (INC)
        // 6. Rest days (Sunday)
        // 7. Saturday (regular work day - paid 6 days/week)
        // 8. No entry = ABSENT
        let status = "-";
        let bh = 0; // Basic Hours

        if (dayLeaves.length > 0) {
          // Check leave requests first
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
        } else if (dayType.includes("holiday")) {
          // Holiday - check BEFORE checking entries to ensure holidays are always detected
          // Even if employee didn't work, it's still a holiday (not ABSENT)
          status = dayType.includes("regular") ? "RH" : "SH";
          // BH will be set based on eligibility (8 if eligible, 0 if not)
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
          // Sunday Regular Work Day for Hotel Client-Based Account Supervisors:
          // For hotel client-based account supervisors, rest days are Monday, Tuesday, or Wednesday
          // If Sunday is NOT their rest day, it should be treated like Saturday (regular workday)
          const isSundayRestDay = isRestDay; // Already checked above
          if (isClientBasedAccountSupervisor && !isSundayRestDay) {
            // Sunday is NOT their rest day - treat like Saturday (regular workday)
            if (dayEntries.length > 0 || incompleteDayEntries.length > 0) {
              status = "LOG"; // Worked on Sunday
            } else {
              status = "LOG"; // Sunday - paid as regular work day even if not worked (like Saturday)
            }
          } else {
            // Sunday fallback (for office-based or if Sunday IS rest day for client-based)
            status = "RD"; // Rest day
          }
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

        // Debug: Log status determination for dates with entries or absences
        if (
          employee?.id &&
          (dayEntries.length > 0 ||
            incompleteDayEntries.length > 0)
        ) {
          console.log(`Employee ${employee.id} - Date ${dateStr}:`, {
            dayEntries: dayEntries.length,
            incompleteEntries: incompleteDayEntries.length,
            leaves: dayLeaves.length,
            ots: dayOTs.length,
            dayType,
            isRestDay,
            dayOfWeek,
            finalStatus: status,
            entries: dayEntries.map((e) => ({
              id: e.id,
              clock_in: e.clock_in_time,
              clock_out: e.clock_out_time,
              status: e.status,
              date_in_manila: getDateInManilaTimezone(e.clock_in_time),
            })),
          });
        }

        const firstEntry = dayEntries[0] || incompleteDayEntries[0];
        // For LWOP and LEAVE, don't show clock times
        const timeIn =
          status === "LWOP" || status === "LEAVE"
            ? null
            : firstEntry
            ? formatDate(parseISO(firstEntry.clock_in_time), "hh:mm a")
            : null;
        const timeOut =
          status === "LWOP" || status === "LEAVE"
            ? null
            : firstEntry?.clock_out_time
            ? formatDate(parseISO(firstEntry.clock_out_time), "hh:mm a")
            : null;

        let schedIn: string | null = null;
        let schedOut: string | null = null;
        if (schedule && schedule.start_time && schedule.end_time) {
          try {
            const startTimeStr = schedule.start_time.includes("T")
              ? schedule.start_time.split("T")[1].split(".")[0]
              : schedule.start_time;
            const endTimeStr = schedule.end_time.includes("T")
              ? schedule.end_time.split("T")[1].split(".")[0]
              : schedule.end_time;
            schedIn = formatDate(
              parseISO(`2000-01-01T${startTimeStr}`),
              "hh:mm a"
            );
            schedOut = formatDate(
              parseISO(`2000-01-01T${endTimeStr}`),
              "hh:mm a"
            );
          } catch (e) {
            console.warn("Error formatting schedule times:", e);
          }
        }

        // Calculate OT hours from approved OT requests
        // This should include ALL approved OT requests for this date, regardless of clock entries
        let otHours = 0;
        if (dayOTs.length > 0) {
          // Filter to only approved requests (status = "approved", "approved_by_manager", or "approved_by_hr")
          const approvedOTs = dayOTs.filter(ot =>
            ot.status === "approved" ||
            ot.status === "approved_by_manager" ||
            ot.status === "approved_by_hr"
          );
          otHours = approvedOTs.reduce((sum, ot) => sum + (ot.total_hours || 0), 0);
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
        if (dayType === "regular" && bh === 0 && dayEntries.length === 0 && dayOfWeek === 6) {
          bh = 8; // Regular work day: 8 hours even if not worked (paid 6 days/week)
        }

        // Sunday Regular Work Day for Hotel Client-Based Account Supervisors:
        // For hotel client-based account supervisors, rest days are Monday, Tuesday, or Wednesday
        // If Sunday is NOT their rest day, it should be treated like Saturday (regular workday)
        // Set BH = 8 even if employee didn't work (like Saturday)
        const isSundayRestDay = isRestDay; // Already checked above
        if (isClientBasedAccountSupervisor && dayOfWeek === 0 && !isSundayRestDay && bh === 0 && dayEntries.length === 0) {
          bh = 8; // Sunday regular work day: 8 hours even if not worked (like Saturday)
        }

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

        // Calculate ND (Night Differential) from approved OT requests
        // ND should come from overtime_requests, not from clock entries
        // Note: isAccountSupervisor is already defined at function level (above the loop)
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
                  : formatDate(new Date(ot.ot_date), "yyyy-MM-dd");
              const endDateStr = ot.end_date
                ? typeof ot.end_date === "string"
                  ? ot.end_date.split("T")[0]
                  : formatDate(new Date(ot.end_date), "yyyy-MM-dd")
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
                // OT doesn't span midnight
                // Calculate ND from max(start_time, 5PM) to min(end_time, 6AM next day)
                // But since it doesn't span midnight, end_time is same day, so cap at midnight
                const ndStartMin = Math.max(startTotalMin, nightStartMin);
                const ndEndMin = Math.min(endTotalMin, 24 * 60); // Cap at midnight
                ndFromThisOT = Math.max(0, (ndEndMin - ndStartMin) / 60);
              }

              ndHours += ndFromThisOT;
            }
          });
        }

        // ND is already calculated from overtime_requests above
        // No need to calculate from clock entries - ND must come from approved OT requests only
        const nd = ndHours;

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

      setAttendanceDays(days);
    },
    [employee, periodStart]
  );

  // Show modal when time in/out is clicked
  function handleClock(event: "in" | "out") {
    // Prevent clock in/out on rest days
    if (isRestDayToday) {
      toast.error("Cannot clock in/out on rest day");
      return;
    }
    setPendingClockAction(event);
    setShowLocationModal(true);
  }

  // Actual clock in/out logic (called from modal confirmation)
  async function confirmClock(location: {
    lat: number;
    lng: number;
  }): Promise<boolean> {
    console.log("confirmClock called", {
      action: pendingClockAction,
      location,
    });
    const action = pendingClockAction;
    if (!action) {
      console.error("No pending clock action");
      toast.error("No clock action pending");
      return false;
    }

    const locationString = `${location.lat.toFixed(6)}, ${location.lng.toFixed(
      6
    )}`;

    try {
      if (action === "in") {
        console.log("Starting clock in process...");
        // Note: The database function will prevent clock-in if there's an incomplete entry
        // from a previous day. User must file a failure-to-log request first.

        console.log("Calling employee_clock_in RPC...");
        const { data: clockInData, error: clockInError } = await supabase.rpc(
          "employee_clock_in",
          {
            p_employee_id: employee.id,
            p_location: locationString,
            p_device: navigator.userAgent?.slice(0, 255) || null,
            p_ip: clientIp,
          } as any
        );

        if (clockInError) {
          console.error("Clock in error:", clockInError);
          toast.error(
            `Failed to clock in: ${clockInError.message || "Unknown error"}`
          );
          return false;
        }

        const clockInResult = clockInData as Array<{
          success: boolean;
          error_message?: string;
          entry_id?: string;
        }> | null;

        if (
          !clockInResult ||
          clockInResult.length === 0 ||
          !clockInResult[0].success
        ) {
          const errorMsg =
            clockInResult?.[0]?.error_message || "Failed to clock in";
          console.error("Clock in failed:", errorMsg);
          toast.error(errorMsg);
          return false;
        }

        const entryId = clockInResult[0].entry_id;
        if (!entryId) {
          console.error("No entry ID returned from clock in");
          toast.error("Failed to get entry ID");
          return false;
        }

        console.log("Clock in successful, fetching entry...", entryId);

        // Fetch the created entry
        const { data: entryData, error: fetchError } = await supabase
          .from("time_clock_entries")
          .select("*")
          .eq("id", entryId)
          .maybeSingle();

        // Update device/IP details (best effort)
        await (supabase.from("time_clock_entries") as any)
          .update({
            clock_in_device: navigator.userAgent?.slice(0, 255) || null,
            clock_in_ip: clientIp,
          })
          .eq("id", entryId);

        if (fetchError || !entryData) {
          console.error("Error fetching created entry:", fetchError);
          // Still show success since the entry was created
          toast.success("Clocked in successfully!");
        } else {
          console.log("Clock in successful, updating UI...");
          setCurrentEntry(entryData);
          toast.success("Clocked in successfully!");
        }

        // Don't await these - let them run in background to avoid blocking
        fetchEntries().catch((err) =>
          console.error("Error fetching entries:", err)
        );
        checkClockStatus().catch((err) =>
          console.error("Error checking clock status:", err)
        );
        // Refresh attendance data
        loadAttendanceData().catch((err) =>
          console.error("Error refreshing attendance:", err)
        );

        // Close modal after successful operation
        setShowLocationModal(false);
        setPendingClockAction(null);
        console.log("Clock in complete");
        return true;
      }

      // Clock out
      console.log("Starting clock out process...");
      if (!currentEntry) {
        console.error("No current entry found");
        toast.error("No active clock-in entry found");
        return false;
      }

      console.log("Calling employee_clock_out RPC...");
      const { data: clockOutData, error: clockOutError } = await supabase.rpc(
        "employee_clock_out",
        {
          p_employee_id: employee.id,
          p_entry_id: currentEntry.id,
          p_location: locationString,
          p_device: navigator.userAgent?.slice(0, 255) || null,
          p_ip: clientIp,
        } as any
      );

      if (clockOutError) {
        console.error("Clock out error:", clockOutError);
        toast.error(
          `Failed to clock out: ${clockOutError.message || "Unknown error"}`
        );
        return false;
      }

      const clockOutResult = clockOutData as Array<{
        success: boolean;
        error_message?: string;
        warning_message?: string;
        device_mismatch?: boolean;
      }> | null;

      if (
        !clockOutResult ||
        clockOutResult.length === 0 ||
        !clockOutResult[0].success
      ) {
        const errorMsg =
          clockOutResult?.[0]?.error_message || "Failed to clock out";
        console.error("Clock out failed:", errorMsg);
        toast.error(errorMsg);
        return false;
      }

      console.log("Clock out successful, updating UI...");
      toast.success("Clocked out successfully!");
      setCurrentEntry(null);

      // Don't await these - let them run in background to avoid blocking
      fetchEntries().catch((err) =>
        console.error("Error fetching entries:", err)
      );
      checkClockStatus().catch((err) =>
        console.error("Error checking clock status:", err)
      );
      // Refresh attendance data
      loadAttendanceData().catch((err) =>
        console.error("Error refreshing attendance:", err)
      );

      // Close modal after successful operation
      setShowLocationModal(false);
      setPendingClockAction(null);

      // Re-fetch location after clock out (don't clear it, just refresh)
      console.log("Refreshing location after clock out...");
      getFreshLocation()
        .then((loc) => {
          if (loc) {
            setLocation(loc);
            validateLocation(loc.lat, loc.lng);
          }
        })
        .catch((err) => console.error("Error refreshing location:", err));

      console.log("Clock out complete");
      return true;
    } catch (error) {
      console.error("Unexpected error in confirmClock:", error);
      toast.error("An unexpected error occurred. Please try again.");
      return false;
    }
  }

  // Wrapper for validateLocation to match modal's expected signature
  const validateLocationForModal = useCallback(
    async (lat: number, lng: number) => {
      const { data, error } = await supabase.rpc(
        "is_employee_location_allowed",
        {
          p_employee_uuid: employee.id,
          p_latitude: lat,
          p_longitude: lng,
        } as any
      );

      if (error) {
        return {
          isAllowed: false,
          nearestLocation: null,
          distance: null,
          error: "Failed to validate location",
        };
      }

      if (data) {
        const dataArray = data as Array<{
          is_allowed: boolean;
          nearest_location_name: string | null;
          distance_meters: number | null;
          error_message: string | null;
        }>;

        if (dataArray.length > 0) {
          const result = dataArray[0];
          return {
            isAllowed: result.is_allowed,
            nearestLocation: result.nearest_location_name,
            distance: result.distance_meters
              ? Math.round(result.distance_meters)
              : null,
            error: result.error_message,
          };
        }
      }

      return {
        isAllowed: false,
        nearestLocation: null,
        distance: null,
        error: "Unable to validate location",
      };
    },
    [employee.id, supabase]
  );

  // Fetch SIL credits using optimized hook with caching
  const { silCredits } = useEmployeeLeaveCredits({
    employeeId: employee?.id || null,
    enabled: initialFetchComplete,
  });

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Icon
          name="ArrowsClockwise"
          size={IconSizes.xl}
          className="animate-spin text-emerald-600"
        />
      </div>
    );
  }

  return (
    <VStack gap="8" className="w-full pb-10">
      <Card className="w-full p-4 sm:p-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2 text-center">
            <div className="text-4xl sm:text-6xl font-bold text-gray-800 font-mono min-h-[48px] sm:min-h-[56px] flex items-center justify-center">
              {currentTime && timeSyncReady
                ? currentTime.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })
                : "Syncing time..."}
            </div>
            <div className="text-gray-500 min-h-[22px]">
              {currentTime && timeSyncReady
                ? currentTime.toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                : ""}
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                className="px-3 py-3"
                onClick={() =>
                  setPeriodStart(getPreviousBiMonthlyPeriod(periodStart))
                }
              >
                <Icon name="CaretLeft" size={IconSizes.sm} />
              </Button>
              <VStack gap="0" align="center">
                <Caption className="uppercase tracking-widest">
                  Bi-Monthly Period
                </Caption>
                <p className="text-lg font-semibold text-gray-800">
                  {formatBiMonthlyPeriod(periodStart, periodEnd)}
                </p>
              </VStack>
              <Button
                variant="secondary"
                size="sm"
                className="px-3 py-3"
                onClick={() =>
                  setPeriodStart(getNextBiMonthlyPeriod(periodStart))
                }
              >
                <Icon name="CaretRight" size={IconSizes.sm} />
              </Button>
            </div>
            <div className="text-sm text-gray-500 space-y-1">
              <div>
                Allotted SIL Credits: <span className="font-semibold text-gray-900">10</span>
              </div>
              <div>
                Available SIL Credits:{" "}
                <span className="font-semibold text-gray-900">
                  {silCredits !== null
                    ? `${silCredits.toFixed(1)} days`
                    : "Loading..."}
                </span>
              </div>
            </div>
          </div>

          {isRestDayToday ? (
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
              <BodySmall className="font-semibold mb-1 flex items-center gap-2">
                <Icon name="WarningCircle" size={IconSizes.sm} />
                Rest Day Today
              </BodySmall>
              <BodySmall>
                You cannot clock in or out on your rest day. Please enjoy your day off!
              </BodySmall>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Button
                onClick={() => handleClock("in")}
                disabled={!!currentEntry || !locationStatus?.isAllowed}
                size="lg"
                className={cn(
                  "w-full py-6 text-lg font-bold uppercase tracking-wider transition-all duration-200 min-h-[64px]",
                  currentEntry || !locationStatus?.isAllowed
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                    : "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 hover:shadow-xl active:scale-[0.98] shadow-lg"
                )}
                aria-label={currentEntry ? "Already clocked in" : "Clock in"}
              >
                <Icon name="Clock" size={IconSizes.md} className="mr-2" />
                Time In
              </Button>
              <Button
                onClick={() => handleClock("out")}
                disabled={!currentEntry || !locationStatus?.isAllowed}
                size="lg"
                className={cn(
                  "w-full py-6 text-lg font-bold uppercase tracking-wider transition-all duration-200 min-h-[64px]",
                  !currentEntry || !locationStatus?.isAllowed
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                    : "bg-gradient-to-br from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 hover:shadow-xl active:scale-[0.98] shadow-lg"
                )}
                aria-label={!currentEntry ? "No active clock in" : "Clock out"}
              >
                <Icon name="Clock" size={IconSizes.md} className="mr-2" />
                Time Out
              </Button>
            </div>
          )}

          <div>
            {location ? (
              locationStatus ? (
                locationStatus.isAllowed ? (
                  <HStack
                    gap="2"
                    align="center"
                    className="inline-flex text-sm text-green-600 bg-green-50 px-4 py-2 rounded-full border border-green-200"
                  >
                    <Icon name="MapPin" size={IconSizes.sm} />
                    <span>
                      At {locationStatus.nearestLocation || "an approved site"}
                      {locationStatus.distance !== null &&
                        ` (${locationStatus.distance}m away)`}
                    </span>
                  </HStack>
                ) : (
                  <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 text-sm text-red-700">
                    <BodySmall className="font-semibold mb-1">
                      Location not allowed
                    </BodySmall>
                    <BodySmall>
                      {locationStatus.error ||
                        "You must be at an approved location to clock in/out."}
                    </BodySmall>
                  </div>
                )
              ) : (
                <HStack
                  gap="2"
                  align="center"
                  className="inline-flex text-sm text-emerald-600 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-200"
                >
                  <Icon name="MapPin" size={IconSizes.sm} />
                  <span>Validating location...</span>
                </HStack>
              )
            ) : (
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 text-sm text-red-700">
                <BodySmall className="font-semibold mb-1">
                  Location required
                </BodySmall>
                <BodySmall>
                  Please enable GPS/location services and refresh the page.
                </BodySmall>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Time Attendance and Calendar Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4">
        {/* Time Attendance Table - Left Side (Bigger) */}
        <CardSection title="Time Attendance">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wide">
                    DATE
                  </th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wide">
                    DAY
                  </th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wide">
                    STATUS
                  </th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wide">
                    TIME IN
                  </th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wide">
                    TIME OUT
                  </th>
                  <th className="px-2 py-1.5 text-right text-[10px] font-medium uppercase tracking-wide">
                    BH
                  </th>
                  <th className="px-2 py-1.5 text-right text-[10px] font-medium uppercase tracking-wide">
                    OT
                  </th>
                  <th className="px-2 py-1.5 text-right text-[10px] font-medium uppercase tracking-wide">
                    UT
                  </th>
                  <th className="px-2 py-1.5 text-right text-[10px] font-medium uppercase tracking-wide">
                    ND
                  </th>
                </tr>
              </thead>
              <tbody>
                {attendanceDays.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="text-center py-6 text-gray-500 text-xs"
                    >
                      Loading attendance data...
                    </td>
                  </tr>
                ) : (
                  attendanceDays.map((day) => {
                    const isWeekend =
                      day.dayName === "Sat" || day.dayName === "Sun";

                    // Get status color classes
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
                        className={`border-b ${
                          isWeekend ? "bg-green-50/50" : ""
                        } hover:bg-gray-50/50`}
                      >
                        <td className="px-2 py-1.5 text-xs">
                          {formatDate(parseISO(day.date), "MMM dd")}
                        </td>
                        <td className="px-2 py-1.5 text-xs">{day.dayName}</td>
                        <td className="px-2 py-1.5">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold border ${getStatusColor(
                              day.status
                            )}`}
                          >
                            {day.status}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-xs">
                          {day.status === "LWOP" || day.status === "LEAVE"
                            ? "-"
                            : day.timeIn || "-"}
                        </td>
                        <td className="px-2 py-1.5 text-xs">
                          {day.status === "LWOP" || day.status === "LEAVE"
                            ? "-"
                            : day.timeOut || "-"}
                        </td>
                        <td className="px-2 py-1.5 text-xs text-right">
                          {day.status === "LWOP"
                            ? "-"
                            : day.status === "LEAVE"
                            ? "8.0"
                            : day.bh > 0
                            ? day.bh.toFixed(1)
                            : "-"}
                        </td>
                        <td className="px-2 py-1.5 text-xs text-right">
                          {day.ot > 0 ? day.ot.toFixed(2) : "-"}
                        </td>
                        <td className="px-2 py-1.5 text-xs text-right">
                          {day.ut > 0 ? day.ut : "0"}
                        </td>
                        <td className="px-2 py-1.5 text-xs text-right">
                          {day.nd > 0 ? day.nd.toFixed(2) : "0"}
                        </td>
                      </tr>
                    );
                  })
                )}
                {/* Summary Row */}
                {attendanceDays.length > 0 && (
                  <tr className="border-t-2 font-semibold bg-gray-50">
                    <td colSpan={5} className="px-2 py-1.5 text-xs">
                      Days Work:{" "}
                      {
                        attendanceDays.filter((d) => {
                          // Exclude non-working leave types (matches payslip generation logic)
                          // SIL (status = "LEAVE") counts as working day
                          // LWOP, CTO, OB do NOT count as working days
                          if (
                            d.status === "LWOP" ||
                            d.status === "CTO" ||
                            d.status === "OB"
                          ) {
                            return false;
                          }
                          // Count days with bh > 0 (includes SIL/LEAVE, regular work days, rest days, etc.)
                          return d.bh > 0;
                        }).length
                      }
                    </td>
                    <td className="px-2 py-1.5 text-xs text-right">
                      {attendanceDays
                        .reduce((sum, d) => sum + d.bh, 0)
                        .toFixed(1)}
                    </td>
                    <td className="px-2 py-1.5 text-xs text-right">
                      {attendanceDays
                        .reduce((sum, d) => sum + d.ot, 0)
                        .toFixed(2)}
                    </td>
                    <td className="px-2 py-1.5 text-xs text-right">
                      {attendanceDays.reduce((sum, d) => sum + d.ut, 0)}
                    </td>
                    <td className="px-2 py-1.5 text-xs text-right">
                      {attendanceDays
                        .reduce((sum, d) => sum + d.nd, 0)
                        .toFixed(2)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardSection>

        {/* Calendar - Right Side (Smaller) */}
        <div className="lg:col-span-1">
          <HolidayCalendar
            date={calendarDate}
            holidays={calendarHolidays}
            entries={calendarEntries}
            onPrev={() => setCalendarDate((prev) => subMonths(prev, 1))}
            onNext={() => setCalendarDate((prev) => addMonths(prev, 1))}
          />
        </div>
      </div>

      {/* Location Confirmation Modal */}
      {pendingClockAction && (
        <LocationConfirmationModal
          isOpen={showLocationModal}
          onClose={() => {
            setShowLocationModal(false);
            setPendingClockAction(null);
          }}
          onConfirm={confirmClock}
          type={pendingClockAction}
          validateLocation={validateLocationForModal}
        />
      )}
    </VStack>
  );
}

const HolidayCalendar = memo(
  function HolidayCalendar({
    date,
    holidays,
    entries,
    onPrev,
    onNext,
  }: {
    date: Date;
    holidays: CalendarHoliday[];
    entries: CalendarEntry[];
    onPrev: () => void;
    onNext: () => void;
  }) {
    const start = startOfWeek(startOfMonth(date), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(date), { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start, end });
    const holidayMap = new Map(
      holidays.map((holiday) => [holiday.date, holiday])
    );
    const entryMap = entries.reduce<Map<string, CalendarEntry[]>>(
      (map, entry) => {
        if (!map.has(entry.date)) {
          map.set(entry.date, []);
        }
        map.get(entry.date)!.push(entry);
        return map;
      },
      new Map()
    );

    const leaveColor = (label: string) => {
      if (label === "SIL") return "bg-blue-50 border-blue-200 text-blue-800";
      if (label === "Maternity Leave")
        return "bg-purple-50 border-purple-200 text-purple-800";
      if (label === "Paternity Leave")
        return "bg-cyan-50 border-cyan-200 text-cyan-800";
      return "bg-emerald-50 border-emerald-200 text-emerald-800";
    };

    const statusColor = (type: CalendarEntryType) => {
      if (type === "absent") return "bg-red-50 border-red-200 text-red-800";
      if (type === "inc")
        return "bg-orange-50 border-orange-200 text-orange-800";
      if (type === "present")
        return "bg-emerald-50 border-emerald-200 text-emerald-800";
      return "bg-gray-50 border-gray-200 text-gray-700";
    };

    return (
      <Card className="w-full p-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <HStack gap="1" align="center">
              <Button
                variant="secondary"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={onPrev}
              >
                <Icon name="CaretLeft" size={IconSizes.xs} />
              </Button>
              <H3 className="text-sm">{formatDate(date, "MMMM yyyy")}</H3>
              <Button
                variant="secondary"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={onNext}
              >
                <Icon name="CaretRight" size={IconSizes.xs} />
              </Button>
            </HStack>
            <div className="flex flex-wrap items-center gap-1.5 text-[9px] text-muted-foreground">
              <span className="inline-flex items-center gap-0.5">
                <span className="w-2 h-2 rounded-full bg-purple-600/60" />
                <span className="hidden sm:inline">Reg Holiday</span>
              </span>
              <span className="inline-flex items-center gap-0.5">
                <span className="w-2 h-2 rounded-full bg-amber-400/80" />
                <span className="hidden sm:inline">Spec Holiday</span>
              </span>
              <span className="inline-flex items-center gap-0.5">
                <span className="w-2 h-2 rounded-full bg-red-500/60" />
                <span className="hidden sm:inline">Absent</span>
              </span>
              <span className="inline-flex items-center gap-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500/60" />
                <span className="hidden sm:inline">Present</span>
              </span>
              <span className="inline-flex items-center gap-0.5">
                <span className="w-2 h-2 rounded-full bg-blue-500/60" />
                <span className="hidden sm:inline">Leave</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-7 text-center text-[9px] font-semibold text-muted-foreground border-t pt-1">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="truncate">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 border rounded-lg overflow-hidden text-[8px]">
            {days.map((day) => {
              const iso = formatDate(day, "yyyy-MM-dd");
              const holiday = holidayMap.get(iso);
              const dailyEntries = entryMap.get(iso);
              const isCurrentMonth = isSameMonth(day, date);
              const isToday = isSameDay(day, new Date());

              const leaves = (dailyEntries || []).filter(
                (e) => e.type === "leave"
              );
              const status = (dailyEntries || []).find(
                (e) =>
                  e.type === "absent" ||
                  e.type === "inc" ||
                  e.type === "present"
              );
              const times = (dailyEntries || []).filter(
                (e) => e.type === "time"
              );

              const badge =
                holiday &&
                (holiday.type === "regular" ? (
                  <div className="text-[8px] sm:text-[9px] md:text-[10px] px-1 py-0.5 rounded-full bg-purple-600/15 text-purple-700 border border-purple-200 font-semibold w-fit leading-tight">
                    <span className="hidden sm:inline">Regular Holiday</span>
                    <span className="sm:hidden">Reg</span>
                  </div>
                ) : (
                  <div className="text-[8px] sm:text-[9px] md:text-[10px] px-1 py-0.5 rounded-full bg-amber-400/30 text-amber-800 border border-amber-200 font-semibold w-fit leading-tight">
                    <span className="hidden sm:inline">Special Holiday</span>
                    <span className="sm:hidden">Spec</span>
                  </div>
                ));

              return (
                <div
                  key={iso}
                  className={`min-h-[60px] sm:min-h-[70px] border-r border-b p-0.5 overflow-hidden flex flex-col items-center justify-start ${
                    isCurrentMonth ? "bg-white" : "bg-muted/60 text-gray-400"
                  }`}
                >
                  <div className="w-full flex justify-center mb-0.5">
                    <div
                      className={`font-semibold text-[10px] ${
                        isToday ? "text-emerald-600" : "text-gray-600"
                      }`}
                    >
                      {formatDate(day, "d")}
                    </div>
                  </div>

                  <div className="flex flex-col gap-0.5 text-[7px] leading-tight overflow-hidden items-center w-full">
                    {holiday && (
                      <div className="font-semibold text-gray-900 leading-tight line-clamp-1 break-words text-[7px] text-center">
                        {holiday.name.length > 10
                          ? holiday.name.slice(0, 8) + "..."
                          : holiday.name}
                      </div>
                    )}
                    {badge && (
                      <div className="flex-shrink-0 flex justify-center">
                        <div className="text-[6px] px-0.5 py-0 rounded-full bg-purple-600/15 text-purple-700 border border-purple-200 font-semibold w-fit leading-tight">
                          {holiday?.type === "regular" ? "Reg" : "Spec"}
                        </div>
                      </div>
                    )}

                    {status && (
                      <div className="flex justify-center">
                        <div
                          className={`px-0.5 py-0 rounded-full border font-semibold w-fit text-[7px] leading-tight ${statusColor(
                            status.type
                          )}`}
                        >
                          {status.label.length > 6
                            ? status.label.slice(0, 5) + "..."
                            : status.label}
                        </div>
                      </div>
                    )}

                    {leaves.length > 0 && (
                      <div className="flex flex-wrap gap-0.5 justify-center">
                        {leaves.slice(0, 2).map((leave, idx) => (
                          <div
                            key={`${leave.label}-${idx}`}
                            className={`px-0.5 py-0 rounded-full border font-semibold text-[7px] w-fit leading-tight ${leaveColor(
                              leave.label
                            )}`}
                          >
                            {leave.label.length > 6
                              ? leave.label.slice(0, 5) + "..."
                              : leave.label}
                          </div>
                        ))}
                        {leaves.length > 2 && (
                          <div className="px-0.5 py-0 rounded-full border font-semibold text-[7px] bg-gray-100 text-gray-600 w-fit leading-tight">
                            +{leaves.length - 2}
                          </div>
                        )}
                      </div>
                    )}

                    {times.length > 0 && (
                      <div className="flex flex-wrap gap-0.5 justify-center">
                        {times.slice(0, 1).map((entry, idx) => {
                          const startLabel = formatDate(
                            new Date(entry.clock_in_time!),
                            "h:mm"
                          );
                          const endLabel = entry.clock_out_time
                            ? formatDate(new Date(entry.clock_out_time), "h:mm")
                            : null;
                          const timeLabel = endLabel
                            ? `${startLabel}-${endLabel}`
                            : startLabel;
                          return (
                            <div
                              key={`${entry.clock_in_time}-${idx}`}
                              className="inline-flex items-center gap-0.5 bg-emerald-50 border border-emerald-100 rounded-full px-0.5 py-0 text-emerald-800 text-[7px] font-semibold w-fit leading-tight"
                            >
                              {timeLabel.length > 8
                                ? timeLabel.slice(0, 7) + "..."
                                : timeLabel}
                            </div>
                          );
                        })}
                        {times.length > 1 && (
                          <div className="px-0.5 py-0 rounded-full border font-semibold text-[7px] bg-emerald-100 text-emerald-700 w-fit leading-tight">
                            +{times.length - 1}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison to prevent unnecessary re-renders
    return (
      prevProps.date.getTime() === nextProps.date.getTime() &&
      prevProps.holidays.length === nextProps.holidays.length &&
      prevProps.entries.length === nextProps.entries.length &&
      JSON.stringify(prevProps.holidays) ===
        JSON.stringify(nextProps.holidays) &&
      JSON.stringify(prevProps.entries) === JSON.stringify(nextProps.entries)
    );
  }
);