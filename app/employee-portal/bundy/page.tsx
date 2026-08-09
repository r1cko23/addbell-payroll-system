"use client";

import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useEmployeeSession } from "@/contexts/EmployeeSessionContext";
import { useSessionQuery } from "@/lib/hooks/useSessionQuery";
import { sessionCacheGet } from "@/lib/session-cache";
import { bustCache } from "@/lib/cache-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CardSection } from "@/components/ui/card-section";
import { PortalPageHeader } from "@/components/portal/PortalPageHeader";
import { H3, BodySmall, Caption } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { cn } from "@/lib/utils";
import { epFormCard, epPageWrapper, epPeriodNavButton, epPeriodNavRow } from "@/lib/employee-portal-ui";
import { toast } from "sonner";
import { creditNightDiffHours, creditOvertimeHours, creditWorkHoursHalfHour } from "@/utils/overtime";
import { LocationConfirmationModal } from "@/components/LocationConfirmationModal";
import {
  getWednesdayWeekStart,
  getWeeklyCutoffEnd,
  getNextWeeklyCutoff,
  getPreviousWeeklyCutoff,
  formatWeeklyCutoffPeriod,
  getWeeklyCutoffDays,
} from "@/utils/bimonthly";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format as formatDate,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
  parseISO,
  getDay,
} from "date-fns";
import { getBundyBusinessDayKeyForInPunch } from "@/lib/bundy-business-day";
import {
  calculateLateHours,
  calculateUndertimeHoursForAttendanceDay,
  getBusinessDayPolicyByDay,
  getManilaDateKeyFromIso,
  regularHoursFromBundyClockPair,
} from "@/utils/business-hours";

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

/**
 * Manila calendar date (YYYY-MM-DD) for a visible calendar grid day.
 * Uses local noon to avoid midnight/DST skew when mapping to Asia/Manila.
 */
function getManilaDateStringFromLocalDate(d: Date): string {
  return getDateInManilaTimezone(
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0)
  );
}

function getManilaTodayString(): string {
  return getDateInManilaTimezone(new Date());
}

function getManilaHourMinute(isoTimestamp: string): { hour: number; minute: number } {
  const date = new Date(isoTimestamp);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(date);
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);
  return { hour, minute };
}

function formatTime12h(value?: string | null): string {
  if (!value) return "—";
  const raw = value.includes("T")
    ? value.split("T")[1]?.split(".")[0] || value
    : value;
  const [h, m] = raw.split(":");
  const hh = Number(h);
  const mm = Number(m);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return value;
  const date = new Date();
  date.setHours(hh, mm, 0, 0);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

import {
  determineDayType,
  getDayName,
  HOLIDAY_DE_MINIMIS_HOURS,
  HOLIDAY_UNWORKED_CREDIT_HOURS,
} from "@/utils/holidays";
import type { Holiday } from "@/utils/holidays";
import { useEmployeeLeaveCredits } from "@/lib/hooks/useEmployeeData";
import { formatSilCreditsAvailable } from "@/lib/employee-sil-display";
import { filterOfficialBundySessions } from "@/lib/official-bundy-sessions";
import {
  punchesToSessions,
  getOpenEntryFromPunches,
  type TimeEntryPunch,
  type TimeEntrySession,
} from "@/lib/timeEntries";

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
    { date: "2026-05-27", name: "Eid al-Adha (Feast of Sacrifice)", type: "regular" },
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
  half_day_dates?: string[] | null;
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
  isHalfDayLeave?: boolean;
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

/** Calendar status badge — same rules as the Time Attendance table. */
function calendarStatusEntryFromAttendanceDay(
  day: AttendanceDay
): CalendarEntry | null {
  if (day.date > getManilaTodayString()) return null;

  switch (day.status) {
    case "ABSENT":
    case "LWOP":
      return { date: day.date, type: "absent", label: "Absent" };
    case "INC":
      return { date: day.date, type: "inc", label: "INC" };
    case "LOG":
    case "OB":
      return { date: day.date, type: "present", label: "Present" };
    case "RD":
      return { date: day.date, type: "present", label: "RD" };
    case "RH":
    case "SH":
    case "LEAVE":
    case "CTO":
    case "-":
      return null;
    default:
      return null;
  }
}

function mergeCalendarWithAttendanceTable(
  base: CalendarEntry[],
  attendance: AttendanceDay[]
): CalendarEntry[] {
  const dayMap = new Map<string, CalendarEntry[]>();
  for (const e of base) {
    if (!dayMap.has(e.date)) dayMap.set(e.date, []);
    dayMap.get(e.date)!.push(e);
  }
  for (const day of attendance) {
    const statusEntry = calendarStatusEntryFromAttendanceDay(day);
    const existing = dayMap.get(day.date) || [];
    const withoutStatus = existing.filter(
      (e) => e.type !== "absent" && e.type !== "present" && e.type !== "inc"
    );
    dayMap.set(
      day.date,
      statusEntry ? [...withoutStatus, statusEntry] : withoutStatus
    );
  }
  return Array.from(dayMap.values()).flat();
}

export default function BundyClockPage() {
  const { employee } = useEmployeeSession();
  const supabase = createClient();
  const employeeId = employee?.id ?? null;

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
    getWednesdayWeekStart(new Date())
  );
  const periodEnd = useMemo(
    () => getWeeklyCutoffEnd(periodStart),
    [periodStart]
  );
  const periodStartIso = periodStart.toISOString();
  const periodEndIso = periodEnd.toISOString();
  const periodStartStr = useMemo(
    () => getManilaDateStringFromLocalDate(periodStart),
    [periodStart]
  );
  const periodEndStr = useMemo(
    () => getManilaDateStringFromLocalDate(periodEnd),
    [periodEnd]
  );

  const profileKey = employeeId ? `employee-profile:${employeeId}` : null;
  const profileUrl = employeeId
    ? `/api/employee-portal/employee-profile?employee_id=${encodeURIComponent(employeeId)}`
    : null;
  const { data: profileQueryData, refresh: refreshProfile } = useSessionQuery<{
    position?: string | null;
    employment_type?: string | null;
    job_level?: string | null;
    shift_start_time?: string | null;
    shift_end_time?: string | null;
    error?: string;
  }>(profileKey, profileUrl, { enabled: !!employeeId });

  const clockStatusKey = employeeId ? `clock-status:${employeeId}` : null;
  const clockStatusUrl = employeeId
    ? `/api/employee-portal/time-entries?employee_id=${encodeURIComponent(employeeId)}&limit=500`
    : null;
  const {
    data: clockStatusData,
    loading: clockStatusLoading,
    refresh: refreshClockStatus,
  } = useSessionQuery<{ punches?: TimeEntryPunch[] }>(
    clockStatusKey,
    clockStatusUrl,
    { enabled: !!employeeId }
  );

  const periodEntriesKey = employeeId
    ? `time-entries:period:${employeeId}:${periodStartIso}:${periodEndIso}`
    : null;
  const periodEntriesUrl = employeeId
    ? `/api/employee-portal/time-entries?employee_id=${encodeURIComponent(employeeId)}&start=${encodeURIComponent(periodStartIso)}&end=${encodeURIComponent(periodEndIso)}&limit=500`
    : null;
  const {
    data: periodEntriesData,
    loading: periodEntriesLoading,
    refresh: refreshPeriodEntries,
  } = useSessionQuery<{ punches?: TimeEntryPunch[] }>(
    periodEntriesKey,
    periodEntriesUrl,
    { enabled: !!employeeId }
  );

  const leaveKey = employeeId ? `leave-requests:${employeeId}` : null;
  const leaveUrl = employeeId
    ? `/api/employee-portal/leave-requests?employee_id=${encodeURIComponent(employeeId)}`
    : null;
  const { data: leaveQueryData, refresh: refreshLeaveRequests } =
    useSessionQuery<{
      requests?: Array<{
        id: string;
        leave_type: string;
        start_date: string;
        end_date: string;
        status: string;
        half_day_dates?: string[] | null;
      }>;
    }>(leaveKey, leaveUrl, { enabled: !!employeeId });

  const otKey = employeeId ? `ot-requests:${employeeId}` : null;
  const otUrl = employeeId
    ? `/api/employee-portal/overtime-requests?employee_id=${encodeURIComponent(employeeId)}`
    : null;
  const { data: otQueryData, refresh: refreshOtRequests } = useSessionQuery<{
    requests?: Array<{
      id: string;
      ot_date: string;
      start_time: string;
      end_time: string;
      total_hours: number;
      status: string;
    }>;
  }>(otKey, otUrl, { enabled: !!employeeId });

  const attendanceWideRange = useMemo(() => {
    const periodStartDate = new Date(periodStart);
    periodStartDate.setHours(0, 0, 0, 0);
    periodStartDate.setDate(periodStartDate.getDate() - 7);
    const periodEndDate = new Date(periodEnd);
    periodEndDate.setHours(23, 59, 59, 999);
    periodEndDate.setDate(periodEndDate.getDate() + 1);
    return {
      startIso: periodStartDate.toISOString(),
      endIso: periodEndDate.toISOString(),
    };
  }, [periodStart, periodEnd]);

  const attendanceClockKey = employeeId
    ? `time-entries:attendance:${employeeId}:${attendanceWideRange.startIso}:${attendanceWideRange.endIso}`
    : null;
  const attendanceClockUrl = employeeId
    ? `/api/employee-portal/time-entries?employee_id=${encodeURIComponent(employeeId)}&start=${encodeURIComponent(attendanceWideRange.startIso)}&end=${encodeURIComponent(attendanceWideRange.endIso)}&limit=500`
    : null;
  const {
    data: attendanceClockData,
    refresh: refreshAttendanceClock,
  } = useSessionQuery<{ punches?: TimeEntryPunch[] }>(
    attendanceClockKey,
    attendanceClockUrl,
    { enabled: !!employeeId }
  );

  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const calendarDateKey = useMemo(
    () => formatDate(calendarDate, "yyyy-MM"),
    [calendarDate]
  );
  const calendarGridRange = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(calendarDate), {
      weekStartsOn: 0,
    });
    const gridEnd = endOfWeek(endOfMonth(calendarDate), { weekStartsOn: 0 });
    return {
      gridStart,
      gridEnd,
      startRange: gridStart.toISOString(),
      endRange: gridEnd.toISOString(),
    };
  }, [calendarDateKey, calendarDate]);
  const calendarTimeKey = employeeId
    ? `time-entries:calendar:${employeeId}:${calendarGridRange.startRange}:${calendarGridRange.endRange}`
    : null;
  const calendarTimeUrl = employeeId
    ? `/api/employee-portal/time-entries?employee_id=${encodeURIComponent(employeeId)}&start=${encodeURIComponent(calendarGridRange.startRange)}&end=${encodeURIComponent(calendarGridRange.endRange)}&limit=500`
    : null;
  const { data: calendarTimeData, refresh: refreshCalendarTime } =
    useSessionQuery<{ punches?: TimeEntryPunch[] }>(
      calendarTimeKey,
      calendarTimeUrl,
      { enabled: !!employeeId }
    );

  const loading = clockStatusLoading || periodEntriesLoading;
  const initialFetchComplete = !loading && !!employeeId;

  const refreshBundyData = useCallback(async () => {
    await bustCache();
    await Promise.all([
      refreshProfile({ force: true }),
      refreshClockStatus({ force: true }),
      refreshPeriodEntries({ force: true }),
      refreshLeaveRequests({ force: true }),
      refreshOtRequests({ force: true }),
      refreshAttendanceClock({ force: true }),
      refreshCalendarTime({ force: true }),
    ]);
  }, [
    refreshProfile,
    refreshClockStatus,
    refreshPeriodEntries,
    refreshLeaveRequests,
    refreshOtRequests,
    refreshAttendanceClock,
    refreshCalendarTime,
  ]);

  const [calendarHolidays, setCalendarHolidays] = useState<CalendarHoliday[]>(
    []
  );
  const [calendarBaseEntries, setCalendarBaseEntries] = useState<CalendarEntry[]>(
    []
  );
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
  const calendarEntries = useMemo(
    () => mergeCalendarWithAttendanceTable(calendarBaseEntries, attendanceDays),
    [calendarBaseEntries, attendanceDays]
  );
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
  const [employeeJobLevel, setEmployeeJobLevel] = useState<string | null>(null);

  // Sync employee profile from session cache
  useEffect(() => {
    if (!profileQueryData) return;
    if (
      profileQueryData.employment_type === undefined &&
      profileQueryData.position === undefined
    ) {
      return;
    }

    setEmployeePosition(profileQueryData.position ?? null);
    setEmployeeType(profileQueryData.employment_type ?? null);
    setEmployeeJobLevel(profileQueryData.job_level ?? null);

    if (profileQueryData.employment_type === "client-based") {
      setIsRestDayToday(false);
    } else {
      const dayOfWeek = getDay(new Date());
      setIsRestDayToday(dayOfWeek === 0);
    }
  }, [profileQueryData]);

  // Sync open clock session from session cache
  useEffect(() => {
    if (!clockStatusData?.punches) return;
    const open = getOpenEntryFromPunches(clockStatusData.punches, (iso) =>
      getDateInManilaTimezone(iso)
    );
    setCurrentEntry(open ? (open as TimeEntry) : null);
  }, [clockStatusData]);

  // Sync period entries from session cache
  useEffect(() => {
    if (!periodEntriesData?.punches) return;
    const list = periodEntriesData.punches;
    const sessions = filterOfficialBundySessions(
      punchesToSessions(list, (iso) => getDateInManilaTimezone(iso)),
      (s) => getBundyBusinessDayKeyForInPunch(s.id, s.clock_in_time, list)
    ).reverse();
    setEntries(sessions as TimeEntry[]);
  }, [periodEntriesData]);

  const checkClockStatus = useCallback(async (): Promise<TimeEntrySession | null> => {
    await refreshClockStatus({ force: true });
    if (!clockStatusKey) return null;
    const cached = sessionCacheGet<{ punches?: TimeEntryPunch[] }>(
      clockStatusKey
    );
    const punches = cached?.data.punches ?? [];
    const open = getOpenEntryFromPunches(punches, (iso) =>
      getDateInManilaTimezone(iso)
    );
    setCurrentEntry(open ? (open as TimeEntry) : null);
    return open;
  }, [refreshClockStatus, clockStatusKey]);

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

  const fetchCalendarHolidays = useCallback(
    async (targetDate: Date) => {
      const gridStart = startOfWeek(startOfMonth(targetDate), {
        weekStartsOn: 0,
      });
      const gridEnd = endOfWeek(endOfMonth(targetDate), { weekStartsOn: 0 });
      const startISO = formatDate(gridStart, "yyyy-MM-dd");
      const endISO = formatDate(gridEnd, "yyyy-MM-dd");

      // Schema does not include holidays table — use in-app list only
      const targetYear = targetDate.getFullYear();
      const fallbackHolidays =
        PHILIPPINE_HOLIDAYS[targetYear]?.filter(
          (holiday) => holiday.date >= startISO && holiday.date <= endISO
        ) || [];

      const merged = new Map<string, CalendarHoliday>();
      fallbackHolidays.forEach((holiday) => {
        merged.set(holiday.date, holiday);
      });

      setCalendarHolidays(Array.from(merged.values()));
    },
    [supabase]
  );

  useEffect(() => {
    if (!calendarTimeData?.punches && !leaveQueryData?.requests) return;

    const { gridStart, gridEnd } = calendarGridRange;
    const timeData = calendarTimeData?.punches || [];
    const leaveData = (leaveQueryData?.requests || []).filter((r) =>
      ["approved_by_manager", "approved_by_hr"].includes(r.status)
    );

    const entries: CalendarEntry[] = [];
    const punchesList = timeData as TimeEntryPunch[];
    const timeSessions = filterOfficialBundySessions(
      punchesToSessions(punchesList, (iso) => getDateInManilaTimezone(iso)),
      (s) => getBundyBusinessDayKeyForInPunch(s.id, s.clock_in_time, punchesList)
    );
    timeSessions.forEach((entry) => {
      const dateIso =
        entry.clock_in_date_ph ||
        getDateInManilaTimezone(entry.clock_in_time);
      entries.push({
        date: dateIso,
        type: entry.clock_out_time ? "time" : "inc",
        label: entry.clock_out_time ? "Present" : "Incomplete",
        clock_in_time: entry.clock_in_time,
        clock_out_time: entry.clock_out_time,
      });
    });

    leaveData.forEach((leave) => {
      const start = new Date(leave.start_date);
      const end = new Date(leave.end_date);
      const datesToProcess = eachDayOfInterval({ start, end });

      datesToProcess.forEach((d) => {
        const iso = getManilaDateStringFromLocalDate(d);
        if (d >= gridStart && d <= gridEnd) {
          entries.push({
            date: iso,
            type: "leave",
            label: leave.leave_type,
          });
        }
      });
    });

    setCalendarBaseEntries(entries);
  }, [calendarTimeData, leaveQueryData, calendarGridRange]);

  // Refresh clock status periodically and on window focus to handle stale state
  useEffect(() => {
    const interval = setInterval(() => {
      void refreshClockStatus().catch((err) =>
        console.error("Error refreshing clock status:", err)
      );
    }, 30000);

    const handleFocus = () => {
      void refreshClockStatus().catch((err) =>
        console.error("Error refreshing clock status on focus:", err)
      );
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [refreshClockStatus, employeeId]);

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

  useEffect(() => {
    fetchCalendarHolidays(calendarDate);
  }, [calendarDateKey, fetchCalendarHolidays]);

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
      const workingDays = getWeeklyCutoffDays(periodStart);
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
      const periodStartStr = getManilaDateStringFromLocalDate(periodStart);
      const periodEndStr = getManilaDateStringFromLocalDate(periodEnd);
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

      // Group leave requests by date (schema has no selected_dates — use start_date/end_date only)
      const leavesByDate = new Map<string, LeaveRequest[]>();
      leaveRequests.forEach((leave) => {
        const startDate = new Date(leave.start_date);
        const endDate = new Date(leave.end_date);
        let currentDate = new Date(startDate);
        while (currentDate <= endDate) {
          const dateStr = getManilaDateStringFromLocalDate(currentDate);
          if (!leavesByDate.has(dateStr)) {
            leavesByDate.set(dateStr, []);
          }
          leavesByDate.get(dateStr)!.push(leave);
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
      // ND only when OT request overlaps 10PM–6AM Philippine time (all employees)
      const ndNightStartHour = 22; // 10PM – 6AM; 0 ND if OT is outside this window

      workingDays.forEach((date) => {
        // Manila calendar date — must match getDateInManilaTimezone(punch times)
        const dateStr = getManilaDateStringFromLocalDate(date);
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
        // 1. Holidays (check FIRST - before everything else)
        // 2. Leave requests (LWOP, LEAVE, CTO, OB)
        // 3. Complete time entries (LOG) — before OT-only so punches + OT show LOG, not OT in badge
        // 4. Incomplete time entries (INC)
        // 5. OT requests only (no punch — hours in OT column; status "-")
        // 6. Rest days (Sunday)
        // 7. Saturday (regular work day - paid 6 days/week)
        // 8. No entry = ABSENT
        let status = "-";
        let bh = 0; // Basic Hours
        let isHalfDayLeave = false;
        let eligibleForHolidayCredit = false;

        // Check for holidays FIRST (before everything else) to ensure they're always detected
        // This is critical - holidays should be detected even if there are no clock entries
        // Check both dayType and direct holiday lookup
        const holidayForDate = holidays.find(h => {
          const normalizedHolidayDate = h.date.split('T')[0]; // Remove time if present
          return normalizedHolidayDate === dateStr;
        });
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
            const checkDateStr = getManilaDateStringFromLocalDate(checkDate);
            const checkDayEntries = entriesByDate.get(checkDateStr) || [];
            const checkDayType = determineDayType(checkDateStr, holidays, scheduleMap.get(checkDateStr)?.day_off === true, isClientBased);

            // Only check regular working days (skip holidays and rest days)
            if (checkDayType === "regular" && checkDayEntries.length > 0) {
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
        } else if (dayEntries.length > 0) {
          // Complete time entries exist (OT hours stay in the OT column, not the status badge)
          status = "LOG";
        } else if (incompleteDayEntries.length > 0) {
          // Incomplete entry (clock_in but no clock_out)
          status = "INC";
        } else if (dayOTs.length > 0) {
          // Approved OT only — show hours in OT column; status stays neutral
          status = "-";
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
        // Saturday handling:
        // Match Staff Workspace Timesheet: Saturday is not treated as an absence day.
        // If no logs, still show LOG (BH/OT remain derived from actual punches, if any).
        if (dayEntries.length > 0 || incompleteDayEntries.length > 0) {
          status = "LOG"; // Worked on Saturday
        } else {
          status = "LOG";
        }
        } else if (dayOfWeek === 0) {
          // Sunday handling:
          // - Office-based: Sunday is rest day (handled above)
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
                const todayStr = getManilaTodayString();
                if (dateStr > todayStr) status = "-";
                else if (dateStr === todayStr) status = "-";
                else status = "ABSENT";
              }
            }
          } else {
            // Office-based: Sunday is rest day (already handled above, but fallback)
            status = "RD";
          }
        } else {
          // Monday-Friday: Manila dates — future / today = not absent yet; past with no log = ABSENT
          const todayStr = getManilaTodayString();
          if (dateStr > todayStr) {
            status = "-";
          } else if (dateStr === todayStr) {
            status = "-";
          } else {
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

        // Show only the official first Time In / Time Out pair for the day.
        const officialDayEntries = dayEntries.slice(0, 1);
        const allDayEntries = [...officialDayEntries, ...incompleteDayEntries].sort(
          (a, b) =>
            new Date(a.clock_in_time).getTime() -
            new Date(b.clock_in_time).getTime()
        );
        const firstEntry = allDayEntries[0];
        let timeIn: string | null = null;
        let timeOut: string | null = null;
        const hideClockForFullDayLeave =
          (status === "LWOP" || status === "LEAVE") && !isHalfDayLeave;
        if (!hideClockForFullDayLeave && allDayEntries.length > 0) {
          const inParts = allDayEntries.map((e) =>
            formatDate(parseISO(e.clock_in_time), "hh:mm a")
          );
          const outParts = allDayEntries.map((e) => {
            if (!e.clock_out_time) return "—";
            const formatted = formatDate(parseISO(e.clock_out_time), "hh:mm a");
            const outDate = getManilaDateKeyFromIso(e.clock_out_time);
            return outDate && outDate > dateStr ? `${formatted} (+1)` : formatted;
          });
          timeIn = inParts.join(", ");
          timeOut = outParts.join(", ");
        }

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
          // Normalize legacy OT rows: apply min 1h, then 0.5 increments.
          otHours = approvedOTs.reduce(
            (sum, ot) => sum + creditOvertimeHours(Number(ot.total_hours || 0)),
            0
          );
        }

        // Calculate BH (Basic Hours) from business-window overlap (matches Time Attendance).
        if (bh === 0) {
          if (dayEntries.length > 0) {
            const bhFromBusinessWindows = dayEntries.reduce((sum, entry) => {
              if (!entry.clock_in_time || !entry.clock_out_time) {
                return sum + (entry.regular_hours || 0);
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
                return sum + (entry.regular_hours || 0);
              }
            }, 0);
            const credited = creditWorkHoursHalfHour(
              Math.round(bhFromBusinessWindows * 100) / 100
            );
            if (dayOfWeek === 6) {
              // Saturday: bundy punches do not auto-count as OT; OT comes from approved filings only.
              bh = 0;
            } else {
              bh = credited;
            }
          } else if (dayOTs.length > 0 && dayEntries.length === 0) {
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
        const hasCompleteTimeLog = officialDayEntries.some(
          (e) => e.clock_in_time && e.clock_out_time
        );
        if (eligibleForHolidayCredit && !hasCompleteTimeLog && bh < HOLIDAY_DE_MINIMIS_HOURS) {
          bh = HOLIDAY_UNWORKED_CREDIT_HOURS;
        }

      // Note: Employees do NOT get automatic BH for Saturday or Sunday.
      // They must log time on all workdays or be marked as ABSENT/rest day.

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
            const actualClockIn = getManilaHourMinute(firstEntry.clock_in_time);
            const actualClockInMinutes = actualClockIn.hour * 60 + actualClockIn.minute;
            lt = calculateLateHours(resolvedStartMinutes, actualClockInMinutes);
          } catch (e) {
            console.warn("Error calculating late minutes:", e);
          }
        }

        // Undertime: clock-out before scheduled end (not missing BH from late arrival).
        let utEndMinutes = resolvedEndMinutes;
        if (isHalfDayLeave && businessPolicy.windows.length > 0) {
          utEndMinutes = businessPolicy.windows[0].endHour * 60;
        }
        const lastClockOutEntry = [...allDayEntries]
          .filter((e) => e.clock_out_time)
          .sort(
            (a, b) =>
              new Date(a.clock_out_time!).getTime() -
              new Date(b.clock_out_time!).getTime()
          )
          .pop();
        let ut = 0;
        if (lastClockOutEntry?.clock_out_time && utEndMinutes !== null) {
          try {
            ut = calculateUndertimeHoursForAttendanceDay(
              dateStr,
              lastClockOutEntry.clock_out_time,
              utEndMinutes
            );
          } catch (e) {
            console.warn("Error calculating undertime:", e);
          }
        }

        // Future / not-yet-worked days (status "-") should not show late or undertime.
        if (status === "-") {
          lt = 0;
          ut = 0;
        }

        // Calculate ND (Night Differential) from approved OT requests
        // ND should come from overtime_requests, not from clock entries
        // Note: isAccountSupervisor is already defined at function level (above the loop)
        /** Raw ND overlap for the day (sum across OT filings); one creditNightDiffHours applied below. */
        let ndRawTotal = 0;

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
                  : formatDate(new Date(ot.ot_date), "yyyy-MM-dd");
              const endDateStr = ot.end_date
                ? typeof ot.end_date === "string"
                  ? ot.end_date.split("T")[0]
                  : formatDate(new Date(ot.end_date), "yyyy-MM-dd")
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
                const ndStartMin = Math.max(startTotalMin, nightStartMin);
                const ndEndMin = Math.min(endTotalMin, 24 * 60);
                ndFromThisOT = Math.max(0, (ndEndMin - ndStartMin) / 60);
              }

              const creditedOt = creditOvertimeHours(Number(ot.total_hours || 0));
              ndFromThisOT = Math.min(Math.max(0, ndFromThisOT), creditedOt);
              ndRawTotal += ndFromThisOT;
            }
          });
        }

        // ND from approved OT only: sum raw overlap for the day, then 1h minimum + 0.5h steps (same as Time Attendance).
        const nd = creditNightDiffHours(Math.round(ndRawTotal * 100) / 100);

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
          nd: Math.round(nd * 100) / 100,
        });
      });

      setAttendanceDays(days);
    },
    [employee, periodStart, employeePosition, employeeType, employeeJobLevel]
  );

  useEffect(() => {
    if (!employee || !initialFetchComplete) return;
    if (
      attendanceClockData == null &&
      leaveQueryData == null &&
      otQueryData == null &&
      profileQueryData == null
    ) {
      return;
    }

    try {
      const year = new Date(periodStartStr).getFullYear();
      const holidaysData = (PHILIPPINE_HOLIDAYS[year] || []).filter(
        (h) => h.date >= periodStartStr && h.date <= periodEndStr
      ).map((h) => ({
        holiday_date: h.date,
        name: h.name,
        is_regular: h.type === "regular",
      }));

      const clockPunches = (attendanceClockData?.punches || []) as TimeEntryPunch[];
      const clockData = filterOfficialBundySessions(
        punchesToSessions(clockPunches, (iso) => getDateInManilaTimezone(iso)),
        (s) => getBundyBusinessDayKeyForInPunch(s.id, s.clock_in_time, clockPunches)
      );
      const leaveData = (leaveQueryData?.requests || []).filter(
        (r) =>
          ["approved_by_manager", "approved_by_hr"].includes(r.status) &&
          r.start_date <= periodEndStr &&
          r.end_date >= periodStartStr
      );
      const otData = (otQueryData?.requests || []).filter(
        (r) =>
          ["approved", "approved_by_manager", "approved_by_hr"].includes(
            r.status
          ) &&
          r.ot_date >= periodStartStr &&
          r.ot_date <= periodEndStr
      );
      const scheduleData: Array<{
        schedule_date: string;
        day_off: boolean;
        start_time: string;
        end_time: string;
      }> = [];
      const shiftStartTime =
        typeof profileQueryData?.shift_start_time === "string"
          ? profileQueryData.shift_start_time
          : null;
      const shiftEndTime =
        typeof profileQueryData?.shift_end_time === "string"
          ? profileQueryData.shift_end_time
          : null;
      if (shiftStartTime && shiftEndTime) {
        getWeeklyCutoffDays(periodStart).forEach((day) => {
          const policy = getBusinessDayPolicyByDay(getDay(day));
          if (!policy.requiresOffice) return;
          scheduleData.push({
            schedule_date: getManilaDateStringFromLocalDate(day),
            day_off: false,
            start_time: shiftStartTime,
            end_time: shiftEndTime,
          });
        });
      }
      const isClientBasedFromDbOrSchedule =
        profileQueryData?.employment_type === "client-based";

      const formattedHolidays: Holiday[] = (holidaysData || []).map((h) => ({
        date: h.holiday_date,
        name: h.name,
        type: h.is_regular ? "regular" : ("non-working" as const),
      }));
      setHolidays(formattedHolidays);

      type AttendanceClockEntry = {
        id: string;
        clock_in_time: string;
        clock_out_time: string | null;
        regular_hours: number | null;
        total_hours: number | null;
        total_night_diff_hours: number | null;
        status: string;
      };
      const filteredClockData = ((clockData || []) as AttendanceClockEntry[]).filter(
        (entry) => {
          const entryDateStr = getDateInManilaTimezone(entry.clock_in_time);
          return entryDateStr >= periodStartStr && entryDateStr <= periodEndStr;
        }
      );

      const statusOk = (e: AttendanceClockEntry) =>
        e.status !== "rejected" &&
        e.status !== "pending" &&
        (e.status === "auto_approved" ||
          e.status === "approved" ||
          e.status === "clocked_out" ||
          e.status === "clocked_in");

      const validEntriesInPeriod = filteredClockData.filter(statusOk);
      const validEntriesLookback = ((clockData || []) as AttendanceClockEntry[]).filter(
        statusOk
      );

      setClockEntriesForAttendance(validEntriesInPeriod || []);

      const completeEntries = validEntriesLookback.filter(
        (e) => e.clock_out_time !== null
      );
      const incompleteEntries = validEntriesLookback.filter(
        (e) => e.clock_out_time === null
      );

      setLeaveRequests(leaveData || []);
      setOtRequests(otData || []);

      const scheduleMap = new Map<string, Schedule>();
      (scheduleData || []).forEach((s) => {
        const key =
          typeof s.schedule_date === "string" && s.schedule_date.includes("T")
            ? s.schedule_date.split("T")[0]
            : s.schedule_date;
        scheduleMap.set(key, {
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
        isClientBasedFromDbOrSchedule
      );
    } catch (error) {
      console.error("Error loading attendance data:", error);
    }
  }, [
    employee,
    initialFetchComplete,
    attendanceClockData,
    leaveQueryData,
    otQueryData,
    profileQueryData,
    periodStart,
    periodStartStr,
    periodEndStr,
    generateAttendanceDays,
  ]);

  // Show modal when time in/out is clicked
  async function handleClock(event: "in" | "out") {
    // Prevent clock in/out on rest days
    if (isRestDayToday) {
      toast.error("Cannot clock in/out on rest day");
      return;
    }
    const openSession = await checkClockStatus();
    if (event === "in" && openSession) {
      toast.error(
        "You are still clocked in. Time out first before starting another session."
      );
      return;
    }
    if (event === "out" && !openSession) {
      toast.error("No active time in found. Clock in before clocking out.");
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

    try {
      const openSession = await checkClockStatus();
      if (action === "in" && openSession) {
        toast.error(
          "You are still clocked in. Time out first before starting another session."
        );
        return false;
      }
      if (action === "out" && !openSession) {
        toast.error("No active time in found. Clock in before clocking out.");
        return false;
      }

      if (action === "in") {
        console.log("Starting clock in process...");
        const deviceInfo =
          (navigator.userAgent?.slice(0, 255) || null) +
          (clientIp ? ` | IP: ${clientIp}` : "");

        const clockRes = await fetch("/api/employee-portal/clock-punch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employee_id: employee.id,
            punch_type: "in",
            lat: location.lat,
            lng: location.lng,
            device_info: deviceInfo,
          }),
        });
        const clockJson = (await clockRes.json().catch(() => ({}))) as {
          error?: string;
          id?: string;
          punched_at?: string;
        };

        if (!clockRes.ok || !clockJson.id || !clockJson.punched_at) {
          console.error("Clock in error:", clockJson);
          const autoClosed = Boolean(
            (clockJson as { auto_closed?: boolean }).auto_closed
          );
          if (autoClosed) {
            await checkClockStatus();
            toast.message(
              clockJson.error ||
                "Your previous session was auto-closed. Tap Time In again."
            );
          } else {
            toast.error(
              `Failed to clock in: ${clockJson.error || clockRes.statusText || "Unknown error"}`
            );
          }
          return false;
        }

        const punchedAt = clockJson.punched_at;
        const entryId = clockJson.id;
        const clockInEntry: TimeEntrySession = {
          id: entryId,
          clock_in_time: punchedAt,
          clock_out_time: null,
          clock_in_date_ph: getDateInManilaTimezone(punchedAt),
          status: "clocked_in",
          total_hours: null,
        };
        setCurrentEntry(clockInEntry as any);
        toast.success("Clocked in successfully!");

        void refreshBundyData().catch((err) =>
          console.error("Error refreshing bundy data:", err)
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

      const deviceInfoOut =
        (navigator.userAgent?.slice(0, 255) || null) +
        (clientIp ? ` | IP: ${clientIp}` : "");

      const clockOutRes = await fetch("/api/employee-portal/clock-punch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: employee.id,
          punch_type: "out",
          lat: location.lat,
          lng: location.lng,
          device_info: deviceInfoOut,
        }),
      });
      const clockOutJson = (await clockOutRes.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!clockOutRes.ok) {
        console.error("Clock out error:", clockOutJson);
        toast.error(
          `Failed to clock out: ${clockOutJson.error || clockOutRes.statusText || "Unknown error"}`
        );
        return false;
      }

      toast.success("Clocked out successfully!");
      setCurrentEntry(null);

      void refreshBundyData().catch((err) =>
        console.error("Error refreshing bundy data:", err)
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

  const handleLocationModalConfirm = useCallback(
    async (location: { lat: number; lng: number }): Promise<boolean | void> => {
      return confirmClock(location);
    },
    [confirmClock]
  );

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
  const { silCredits, silAnnualAllotment } = useEmployeeLeaveCredits({
    employeeId: employee?.id || null,
    enabled: initialFetchComplete,
  });

  const todaySessions = useMemo(() => {
    if (!currentTime) return [];
    const todayStr = getDateInManilaTimezone(currentTime);
    return entries.filter((e) => getDateInManilaTimezone(e.clock_in_time) === todayStr);
  }, [entries, currentTime]);

  const parseHHMMToMinutes = (value?: string | null): number | null => {
    if (!value || typeof value !== "string") return null;
    const raw = value.includes("T") ? value.split("T")[1] : value;
    const hhmm = raw.split(":").slice(0, 2);
    const h = Number(hhmm[0]);
    const m = Number(hhmm[1]);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
  };

  const manilaNowMinutes = useMemo(() => {
    if (!currentTime) return null;
    const { hour, minute } = getManilaHourMinute(currentTime.toISOString());
    return hour * 60 + minute;
  }, [currentTime]);

  const isBeyondBusinessHoursToday = useMemo(() => {
    if (!currentTime) return false;
    const todayStr = getManilaTodayString();

    // Rest day should always be treated as "outside business hours" for OT guidance.
    if (isRestDayToday) return true;

    // Prefer employee-specific schedule for today (shift start/end).
    const todaySchedule = schedules.get(todayStr);
    const endMinutes =
      todaySchedule && todaySchedule.end_time
        ? parseHHMMToMinutes(todaySchedule.end_time)
        : null;

    // Fallback to company business-hours policy (day-of-week).
    const fallbackEndMinutes = (() => {
      const dayPolicy = getBusinessDayPolicyByDay(getDay(parseISO(todayStr)));
      if (!dayPolicy.windows || dayPolicy.windows.length === 0) return null;
      const lastWindow = dayPolicy.windows[dayPolicy.windows.length - 1];
      // windows store endHour in business-hours util
      return typeof lastWindow?.endHour === "number" ? lastWindow.endHour * 60 : null;
    })();

    const end = endMinutes ?? fallbackEndMinutes;
    if (end == null || manilaNowMinutes == null) return false;

    // If the current time is strictly after the business end, OT is expected.
    return manilaNowMinutes > end;
  }, [currentTime, isRestDayToday, schedules, manilaNowMinutes]);

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
    <div className={cn("w-full", epPageWrapper)}>
      <PortalPageHeader
        title="Bundy Clock"
        description="Clock in and out for your assigned location."
      />
      <Card className={cn(epFormCard, "border-primary/20 bg-card p-4 sm:p-6")}>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2 text-center">
            <div className="font-mono text-4xl font-bold text-foreground sm:text-6xl min-h-[48px] sm:min-h-[56px] flex items-center justify-center">
              {currentTime && timeSyncReady
                ? currentTime.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })
                : "Syncing time..."}
            </div>
            <div className="text-muted-foreground min-h-[22px]">
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

          <div className="hidden md:flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className={cn(epPeriodNavRow, "mb-0 sm:justify-start")}>
              <Button
                variant="secondary"
                size="sm"
                className={epPeriodNavButton}
                onClick={() =>
                  setPeriodStart(getPreviousWeeklyCutoff(periodStart))
                }
              >
                <Icon name="CaretLeft" size={IconSizes.sm} />
              </Button>
              <VStack gap="0" align="center" className="min-w-0 flex-1 px-2">
                <Caption className="text-center">
                  Weekly Cutoff (Wed – Tue)
                </Caption>
                <p className="text-center text-sm font-semibold text-foreground sm:text-lg">
                  {formatWeeklyCutoffPeriod(periodStart, periodEnd)}
                </p>
              </VStack>
              <Button
                variant="secondary"
                size="sm"
                className={epPeriodNavButton}
                onClick={() =>
                  setPeriodStart(getNextWeeklyCutoff(periodStart))
                }
              >
                <Icon name="CaretRight" size={IconSizes.sm} />
              </Button>
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground space-y-1 md:min-w-[220px]">
              <div>
                Allotted SIL Credits:{" "}
                <span className="font-semibold text-foreground">
                  {silAnnualAllotment}
                </span>
              </div>
              <div>
                Available SIL Credits:{" "}
                <span className="font-semibold text-foreground">
                  {silCredits !== null
                    ? formatSilCreditsAvailable(silCredits)
                    : "Loading..."}
                </span>
              </div>
            </div>
          </div>

          {/* Mobile week navigation (so employees can view previous weeks) */}
          <div className="flex flex-col gap-2 md:hidden">
            <div className={cn(epPeriodNavRow, "mb-0")}>
              <Button
                variant="secondary"
                size="sm"
                className={epPeriodNavButton}
                onClick={() => setPeriodStart(getPreviousWeeklyCutoff(periodStart))}
                aria-label="Previous week"
              >
                <Icon name="CaretLeft" size={IconSizes.sm} />
              </Button>
              <VStack gap="0" align="center" className="min-w-0 flex-1 px-2">
                <Caption className="text-center">Weekly Cutoff (Wed – Tue)</Caption>
                <p className="text-center text-sm font-semibold text-foreground">
                  {formatWeeklyCutoffPeriod(periodStart, periodEnd)}
                </p>
              </VStack>
              <Button
                variant="secondary"
                size="sm"
                className={epPeriodNavButton}
                onClick={() => setPeriodStart(getNextWeeklyCutoff(periodStart))}
                aria-label="Next week"
              >
                <Icon name="CaretRight" size={IconSizes.sm} />
              </Button>
            </div>
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-center text-xs text-muted-foreground space-y-0.5">
              <div>
                Allotted SIL Credits:{" "}
                <span className="font-semibold text-foreground">
                  {silAnnualAllotment}
                </span>
              </div>
              <div>
                Available SIL Credits:{" "}
                <span className="font-semibold text-foreground">
                  {silCredits !== null
                    ? formatSilCreditsAvailable(silCredits)
                    : "Loading..."}
                </span>
              </div>
            </div>
          </div>

          {currentEntry && !isRestDayToday ? (
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
              <BodySmall className="font-semibold mb-1 flex items-center gap-2">
                <Icon name="Clock" size={IconSizes.sm} />
                You are clocked in
              </BodySmall>
              <BodySmall>
                Time in:{" "}
                {new Date(currentEntry.clock_in_time).toLocaleString("en-PH", {
                  timeZone: "Asia/Manila",
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
                . Use Time Out when you finish your shift.
              </BodySmall>
            </div>
          ) : null}

          {isRestDayToday ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <BodySmall className="font-semibold mb-1 flex items-center gap-2">
                <Icon name="WarningCircle" size={IconSizes.sm} />
                Rest Day Today
              </BodySmall>
              <BodySmall>Rest day — clock in/out is disabled.</BodySmall>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                onClick={() => handleClock("in")}
                disabled={!!currentEntry || !locationStatus?.isAllowed}
                size="lg"
                className={cn(
                  "w-full py-4 md:py-6 text-base md:text-lg font-bold uppercase tracking-wider transition-all duration-200 min-h-[56px] md:min-h-[64px]",
                  currentEntry || !locationStatus?.isAllowed
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                    : "bg-emerald-600 text-white shadow-md hover:bg-emerald-700 active:scale-[0.98]"
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
                  "w-full py-4 md:py-6 text-base md:text-lg font-bold uppercase tracking-wider transition-all duration-200 min-h-[56px] md:min-h-[64px]",
                  !currentEntry || !locationStatus?.isAllowed
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                    : "bg-orange-600 text-white shadow-md hover:bg-orange-700 active:scale-[0.98]"
                )}
                aria-label={!currentEntry ? "No active clock in" : "Clock out"}
              >
                <Icon name="Clock" size={IconSizes.md} className="mr-2" />
                Time Out
              </Button>
            </div>
          )}

          {!isRestDayToday && (
            <Caption className="text-center text-muted-foreground block mt-2">
              Business day starts 7:00 AM. Forgot to time out? Auto-closes 23
              hours after time in.
            </Caption>
          )}

          <div>
            {location ? (
              locationStatus ? (
                locationStatus.isAllowed ? (
                  <HStack
                    gap="2"
                    align="center"
                    className="inline-flex rounded-full border border-primary/30 bg-primary/5 px-4 py-2 text-sm text-primary"
                  >
                    <Icon name="MapPin" size={IconSizes.sm} />
                    <span>
                      At {locationStatus.nearestLocation || "an approved site"}
                      {locationStatus.distance !== null &&
                        ` (${locationStatus.distance}m away)`}
                    </span>
                  </HStack>
                ) : (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
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
                  className="inline-flex rounded-full border border-primary/30 bg-primary/5 px-4 py-2 text-sm text-primary"
                >
                  <Icon name="MapPin" size={IconSizes.sm} />
                  <span>Validating location...</span>
                </HStack>
              )
            ) : (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                <BodySmall className="font-semibold mb-1">
                  Location required
                </BodySmall>
                <BodySmall>
                  Please enable location services.
                </BodySmall>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Today's detailed time in / out list */}
      <CardSection title="Today’s Time In / Out">
        {todaySessions.length === 0 ? (
          <BodySmall className="text-muted-foreground">
            No time in or time out recorded yet for today.
          </BodySmall>
        ) : (
          <>
            <div className="space-y-2 md:hidden">
              {todaySessions.map((entry, index) => (
                <div
                  key={entry.id}
                  className="rounded-lg border border-border/80 bg-card p-3"
                >
                  <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
                    Punch {index + 1}
                  </p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <span className="text-muted-foreground">Time in</span>
                    <span className="text-right font-medium">
                      {formatDate(new Date(entry.clock_in_time), "hh:mm a")}
                    </span>
                    <span className="text-muted-foreground">Time out</span>
                    <span className="text-right font-medium">
                      {entry.clock_out_time
                        ? formatDate(new Date(entry.clock_out_time), "hh:mm a")
                        : "—"}
                    </span>
                    <span className="text-muted-foreground">Hours</span>
                    <span className="text-right tabular-nums font-semibold">
                      {entry.total_hours != null ? entry.total_hours.toFixed(2) : "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden md:block -mx-4 overflow-x-auto rounded-xl border border-border/80 bg-background/80 px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-0 table-fixed border-collapse text-xs">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wide">
                    #
                  </th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wide">
                    Time In
                  </th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wide">
                    Time Out
                  </th>
                  <th className="px-2 py-1.5 text-right text-[10px] font-medium uppercase tracking-wide">
                    Hours
                  </th>
                </tr>
              </thead>
              <tbody>
                {todaySessions.map((entry, index) => (
                  <tr key={entry.id} className="border-b border-border/70 hover:bg-primary/5">
                    <td className="px-2 py-1.5 text-xs">{index + 1}</td>
                    <td className="px-2 py-1.5 text-xs">
                      {formatDate(new Date(entry.clock_in_time), "hh:mm a")}
                    </td>
                    <td className="px-2 py-1.5 text-xs">
                      {entry.clock_out_time
                        ? formatDate(new Date(entry.clock_out_time), "hh:mm a")
                        : "—"}
                    </td>
                    <td className="px-2 py-1.5 text-xs text-right">
                      {entry.total_hours != null ? entry.total_hours.toFixed(2) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </>
        )}
      </CardSection>

      {/* Mobile weekly attendance — simplified day cards */}
      <CardSection title="Weekly Attendance" className="md:hidden">
        {attendanceDays.length === 0 ? (
          <BodySmall className="text-muted-foreground">
            Loading attendance data...
          </BodySmall>
        ) : (
          <div className="space-y-2">
            {attendanceDays.map((day) => (
              <div
                key={day.date}
                className="rounded-lg border border-border/80 bg-card p-3"
              >
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    {formatDate(parseISO(day.date), "MMM dd")} · {day.dayName}
                  </span>
                  <span className="shrink-0 rounded border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold">
                    {day.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    <strong className="text-foreground">In:</strong>{" "}
                    {day.timeIn || "—"}
                  </span>
                  <span>
                    <strong className="text-foreground">Out:</strong>{" "}
                    {day.timeOut || "—"}
                  </span>
                  <span>
                    <strong className="text-foreground">BH:</strong>{" "}
                    {day.bh > 0 ? day.bh.toFixed(1) : "—"}
                  </span>
                  <span>
                    <strong className="text-foreground">OT:</strong>{" "}
                    {day.ot > 0 ? day.ot.toFixed(1) : "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardSection>

      <CardSection title="Monthly Calendar" className="md:hidden">
        <HolidayCalendar
          date={calendarDate}
          holidays={calendarHolidays}
          entries={calendarEntries}
          onPrev={() => setCalendarDate((prev) => subMonths(prev, 1))}
          onNext={() => setCalendarDate((prev) => addMonths(prev, 1))}
        />
      </CardSection>

      {/* Time Attendance and Calendar Layout */}
      <div className="hidden md:grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4">
        {/* Time Attendance Table - Left Side (Bigger) */}
        <CardSection
          title={
            <div className="flex items-center justify-between gap-3">
              <span>Time Attendance</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="shrink-0 px-3 py-3"
                  onClick={() => setPeriodStart(getPreviousWeeklyCutoff(periodStart))}
                  aria-label="Previous week"
                >
                  <Icon name="CaretLeft" size={IconSizes.sm} />
                </Button>
                <span className="hidden sm:inline text-xs text-muted-foreground">
                  {formatWeeklyCutoffPeriod(periodStart, periodEnd)}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  className="shrink-0 px-3 py-3"
                  onClick={() => setPeriodStart(getNextWeeklyCutoff(periodStart))}
                  aria-label="Next week"
                >
                  <Icon name="CaretRight" size={IconSizes.sm} />
                </Button>
              </div>
            </div>
          }
        >
          <div className="-mx-4 overflow-x-auto rounded-xl border border-border/80 bg-background/80 px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-0 table-fixed border-collapse text-xs">
              <thead>
                <tr className="border-b bg-muted/40">
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
                    LT
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
                      className="py-6 text-center text-xs text-muted-foreground"
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
                        case "RD":
                          return "bg-green-100 text-green-700 border-green-200";
                        case "OB":
                          return "bg-emerald-100 text-emerald-700 border-emerald-200";
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
                          isWeekend ? "bg-primary/5" : ""
                        } hover:bg-primary/5`}
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
                          {(day.status === "LWOP" || day.status === "LEAVE") &&
                          !day.isHalfDayLeave
                            ? "-"
                            : day.timeIn || "-"}
                        </td>
                        <td className="px-2 py-1.5 text-xs">
                          {(day.status === "LWOP" || day.status === "LEAVE") &&
                          !day.isHalfDayLeave
                            ? "-"
                            : day.timeOut || "-"}
                        </td>
                        <td className="px-2 py-1.5 text-xs text-right">
                          {day.status === "LWOP" && !day.isHalfDayLeave
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
                          {day.lt > 0 ? day.lt.toFixed(0) : "0"}
                        </td>
                        <td className="px-2 py-1.5 text-xs text-right">
                          {day.ut > 0 ? day.ut.toFixed(1) : "0"}
                        </td>
                        <td className="px-2 py-1.5 text-xs text-right">
                          {day.nd > 0 ? day.nd.toFixed(2) : "0"}
                        </td>
                      </tr>
                    );
                  })
                )}
                {/* Summary Row - Weekly (Wednesday to Tuesday) based on company cutoff */}
                {attendanceDays.length > 0 && (() => {
                  const weekStartStr = formatDate(periodStart, "yyyy-MM-dd");
                  const weekEndStr = formatDate(periodEnd, "yyyy-MM-dd");

                  const totalBH = attendanceDays.reduce((sum, d) => {
                    if (d.date < weekStartStr || d.date > weekEndStr) return sum;
                    if (
                      (d.status === "LWOP" && !d.isHalfDayLeave) ||
                      d.status === "CTO" ||
                      d.status === "OB"
                    ) {
                      return sum;
                    }
                    return sum + d.bh;
                  }, 0);
                  const daysWork = totalBH / 8;
                  const totalOT = attendanceDays
                    .filter((d) => d.date >= weekStartStr && d.date <= weekEndStr)
                    .reduce((sum, d) => sum + d.ot, 0);
                  const totalLT = attendanceDays
                    .filter((d) => d.date >= weekStartStr && d.date <= weekEndStr)
                    .reduce((sum, d) => sum + d.lt, 0);
                  const totalUT = attendanceDays
                    .filter((d) => d.date >= weekStartStr && d.date <= weekEndStr)
                    .reduce((sum, d) => sum + d.ut, 0);
                  const totalND = attendanceDays
                    .filter((d) => d.date >= weekStartStr && d.date <= weekEndStr)
                    .reduce((sum, d) => sum + d.nd, 0);

                  return (
                    <tr className="border-t-2 border-primary/30 bg-primary/5 font-semibold">
                      <td colSpan={5} className="px-2 py-1.5 text-xs">
                        Days Work (Wed–Tue): {Math.round(daysWork)}
                      </td>
                      <td className="px-2 py-1.5 text-xs text-right">
                        {totalBH.toFixed(1)}
                      </td>
                      <td className="px-2 py-1.5 text-xs text-right">
                        {totalOT.toFixed(2)}
                      </td>
                      <td className="px-2 py-1.5 text-xs text-right">
                        {totalLT > 0 ? totalLT.toFixed(0) : "0"}
                      </td>
                      <td className="px-2 py-1.5 text-xs text-right">
                        {totalUT > 0 ? totalUT.toFixed(1) : "0"}
                      </td>
                      <td className="px-2 py-1.5 text-xs text-right">
                        {totalND.toFixed(2)}
                      </td>
                    </tr>
                  );
                })()}
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
          onConfirm={handleLocationModalConfirm}
          type={pendingClockAction ?? "in"}
          validateLocation={validateLocationForModal}
        />
      )}
    </div>
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
      if (label === "SIL") return "bg-emerald-50 border-emerald-200 text-emerald-800";
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
                className={epPeriodNavButton}
                onClick={onPrev}
                aria-label="Previous month"
              >
                <Icon name="CaretLeft" size={IconSizes.xs} />
              </Button>
              <H3 className="text-sm">{formatDate(date, "MMMM yyyy")}</H3>
              <Button
                variant="secondary"
                size="sm"
                className={epPeriodNavButton}
                onClick={onNext}
                aria-label="Next month"
              >
                <Icon name="CaretRight" size={IconSizes.xs} />
              </Button>
            </HStack>
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className="inline-flex items-center gap-0.5">
                <span className="w-2 h-2 rounded-full bg-purple-600/60" aria-hidden />
                <span>Reg hol</span>
              </span>
              <span className="inline-flex items-center gap-0.5">
                <span className="w-2 h-2 rounded-full bg-amber-400/80" aria-hidden />
                <span>Spec hol</span>
              </span>
              <span className="inline-flex items-center gap-0.5">
                <span className="w-2 h-2 rounded-full bg-red-500/60" aria-hidden />
                <span>Absent</span>
              </span>
              <span className="inline-flex items-center gap-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500/60" aria-hidden />
                <span>Present</span>
              </span>
              <span className="inline-flex items-center gap-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500/60" aria-hidden />
                <span>Leave</span>
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
              const iso = getManilaDateStringFromLocalDate(day);
              const holiday = holidayMap.get(iso);
              const dailyEntries = entryMap.get(iso);
              const isCurrentMonth = isSameMonth(day, date);
              const isToday = iso === getManilaTodayString();

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