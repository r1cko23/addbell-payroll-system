"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
} from "date-fns";

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
      name: "EDSA People Power Revolution",
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
    { date: "2025-12-26", name: "Day after Christmas", type: "non-working" },
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
    { date: "2026-12-31", name: "Last Day of the Year", type: "non-working" },
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

  const validateLocation = useCallback(
    async (lat: number, lng: number) => {
      const { data, error } = await supabase.rpc(
        "is_employee_location_allowed",
        {
          p_employee_uuid: employee.id,
          p_latitude: lat,
          p_longitude: lng,
        }
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

      if (data && data.length > 0) {
        const result = data[0];
        setLocationStatus({
          isAllowed: result.is_allowed,
          nearestLocation: result.nearest_location_name,
          distance: result.distance_meters
            ? Math.round(result.distance_meters)
            : null,
          error: result.error_message,
        });
      }
    },
    [employee.id, supabase, calendarHolidays]
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
      const entryDate = new Date(data.clock_in_time);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Convert to Asia/Manila timezone for accurate comparison
      const entryDatePH = new Date(
        entryDate.toLocaleString("en-US", { timeZone: "Asia/Manila" })
      );
      const todayPH = new Date(
        today.toLocaleString("en-US", { timeZone: "Asia/Manila" })
      );
      entryDatePH.setHours(0, 0, 0, 0);
      todayPH.setHours(0, 0, 0, 0);

      // Only set current entry if it's from today
      // If entry is from a previous day, it should remain incomplete
      // and the database function will prevent clocking in until failure-to-log is filed
      if (entryDatePH.getTime() === todayPH.getTime()) {
        setCurrentEntry(data);
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
        .select("holiday_date, holiday_name, holiday_type")
        .eq("is_active", true)
        .gte("holiday_date", startISO)
        .lte("holiday_date", endISO);

      if (error) {
        console.error("Failed to load calendar holidays", error);
      }

      const targetYear = targetDate.getFullYear();
      const dbHolidays =
        (data || []).map((holiday) => ({
          date: holiday.holiday_date,
          name: holiday.holiday_name,
          type:
            holiday.holiday_type === "regular"
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
      const holidaySet = new Set(calendarHolidays.map((h) => h.date));

      // Fetch time entries in range
      const { data: timeData, error: timeError } = await supabase
        .from("time_clock_entries")
        .select("clock_in_time, clock_out_time, status, clock_in_date_ph")
        .eq("employee_id", employee.id)
        .gte("clock_in_time", startRange)
        .lte("clock_in_time", endRange)
        .order("clock_in_time", { ascending: true });

      if (timeError) {
        console.error("Failed to load calendar time entries", timeError);
        return;
      }

      // Fetch approved leave requests overlapping the range
      const { data: leaveData, error: leaveError } = await supabase
        .from("leave_requests")
        .select("leave_type, start_date, end_date, selected_dates, status")
        .eq("employee_id", employee.id)
        .in("status", ["approved_by_manager", "approved_by_hr"]);

      if (leaveError) {
        console.error("Failed to load calendar leaves", leaveError);
      }

      const entries: CalendarEntry[] = [];

      // Fetch day-off flags from schedule within grid range
      const { data: scheduleDays, error: scheduleError } = await supabase
        .from("employee_week_schedules")
        .select("schedule_date, day_off")
        .eq("employee_id", employee.id)
        .gte("schedule_date", formatDate(gridStart, "yyyy-MM-dd"))
        .lte("schedule_date", formatDate(gridEnd, "yyyy-MM-dd"));

      if (scheduleError) {
        console.error("Failed to load schedule day-off flags", scheduleError);
      }

      const dayOffSet = new Set(
        (scheduleDays || [])
          .filter((d: any) => d.day_off)
          .map((d: any) => formatDate(new Date(d.schedule_date), "yyyy-MM-dd"))
      );

      // Time entries mapped to days
      (timeData || []).forEach((entry) => {
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
      (leaveData || []).forEach((leave) => {
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

  useEffect(() => {
    fetchCalendarHolidays(calendarDate);
    fetchCalendarEntries(calendarDate);
  }, [calendarDate, fetchCalendarEntries, fetchCalendarHolidays]);

  // Show modal when time in/out is clicked
  function handleClock(event: "in" | "out") {
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
          }
        );

        if (clockInError) {
          console.error("Clock in error:", clockInError);
          toast.error(
            `Failed to clock in: ${clockInError.message || "Unknown error"}`
          );
          return false;
        }

        if (
          !clockInData ||
          clockInData.length === 0 ||
          !clockInData[0].success
        ) {
          const errorMsg =
            clockInData?.[0]?.error_message || "Failed to clock in";
          console.error("Clock in failed:", errorMsg);
          toast.error(errorMsg);
          return false;
        }

        const entryId = clockInData[0].entry_id;
        console.log("Clock in successful, fetching entry...", entryId);

        // Fetch the created entry
        const { data: entryData, error: fetchError } = await supabase
          .from("time_clock_entries")
          .select("*")
          .eq("id", entryId)
          .single();

        // Update device/IP details (best effort)
        await supabase
          .from("time_clock_entries")
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
        }
      );

      if (clockOutError) {
        console.error("Clock out error:", clockOutError);
        toast.error(
          `Failed to clock out: ${clockOutError.message || "Unknown error"}`
        );
        return false;
      }

      if (
        !clockOutData ||
        clockOutData.length === 0 ||
        !clockOutData[0].success
      ) {
        const errorMsg =
          clockOutData?.[0]?.error_message || "Failed to clock out";
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
        }
      );

      if (error) {
        return {
          isAllowed: false,
          nearestLocation: null,
          distance: null,
          error: "Failed to validate location",
        };
      }

      if (data && data.length > 0) {
        const result = data[0];
        return {
          isAllowed: result.is_allowed,
          nearestLocation: result.nearest_location_name,
          distance: result.distance_meters
            ? Math.round(result.distance_meters)
            : null,
          error: result.error_message,
        };
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

  // Calculate total hours, excluding entries with pending failure to log requests
  const [totalHours, setTotalHours] = useState(0);

  useEffect(() => {
    const calculateTotalHours = async () => {
      if (entries.length === 0) {
        setTotalHours(0);
        setPendingFailureToLog(new Set());
        return;
      }

      // Get all pending failure to log requests for these entries
      const entryIds = entries.map((e) => e.id);
      const { data: pendingFailures } = await supabase
        .from("failure_to_log")
        .select("time_entry_id")
        .in("time_entry_id", entryIds)
        .eq("status", "pending");

      const pendingEntryIds = new Set(
        pendingFailures?.map((f) => f.time_entry_id) || []
      );
      setPendingFailureToLog(pendingEntryIds);

      // Only count hours for entries without pending failure to log requests
      const uniqueByDate = new Map<string, TimeEntry>();
      entries.forEach((entry) => {
        const dateIso =
          entry.clock_in_date_ph ||
          formatDate(new Date(entry.clock_in_time), "yyyy-MM-dd");
        const existing = uniqueByDate.get(dateIso);
        if (!existing) {
          uniqueByDate.set(dateIso, entry);
        } else {
          // Prefer one with clock_out_time (more complete)
          const existingHasOut = !!existing.clock_out_time;
          const currentHasOut = !!entry.clock_out_time;
          if (!existingHasOut && currentHasOut) {
            uniqueByDate.set(dateIso, entry);
          }
        }
      });

      const validHours = Array.from(uniqueByDate.values())
        .filter((entry) => !pendingEntryIds.has(entry.id))
        .reduce((sum, entry) => sum + (entry.total_hours || 0), 0);

      setTotalHours(validHours);
    };

    calculateTotalHours();
  }, [entries, supabase]);

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
            <div className="text-sm text-gray-500">
              Total Hours:{" "}
              <span className="font-semibold text-gray-900">
                {totalHours.toFixed(2)}h
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              onClick={() => handleClock("in")}
              disabled={!!currentEntry || !locationStatus?.isAllowed}
              className={cn(
                "w-full py-4 text-lg font-bold uppercase tracking-wider transition",
                currentEntry || !locationStatus?.isAllowed
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 shadow-lg"
              )}
            >
              Time In
            </Button>
            <Button
              onClick={() => handleClock("out")}
              disabled={!currentEntry || !locationStatus?.isAllowed}
              className={cn(
                "w-full py-4 text-lg font-bold uppercase tracking-wider transition",
                !currentEntry || !locationStatus?.isAllowed
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-gradient-to-br from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 shadow-lg"
              )}
            >
              Time Out
            </Button>
          </div>

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

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-4">
        <HolidayCalendar
          date={calendarDate}
          holidays={calendarHolidays}
          entries={calendarEntries}
          onPrev={() => setCalendarDate((prev) => subMonths(prev, 1))}
          onNext={() => setCalendarDate((prev) => addMonths(prev, 1))}
        />

        <Card className="w-full p-0 overflow-hidden">
          <div className="p-3 sm:p-4 border-b">
            <H3 className="text-sm sm:text-base">Time Records</H3>
            <BodySmall className="text-xs">
              {formatBiMonthlyPeriod(periodStart, periodEnd)}
            </BodySmall>
          </div>
          {/* Mobile Card Layout */}
          <div className="block sm:hidden">
            <div className="divide-y">
              {entries.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  No time records for this period.
                </div>
              ) : (
                entries.map((entry) => (
                  <div key={entry.id} className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-sm">
                        {new Date(entry.clock_in_time).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            weekday: "short",
                          }
                        )}
                      </div>
                      {entry.clock_out_time ? (
                        <span
                          className={`px-2 py-1 rounded-full text-[10px] font-semibold ${
                            entry.status === "clocked_in"
                              ? "bg-green-100 text-green-700"
                              : entry.status === "approved" ||
                                entry.status === "auto_approved"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {entry.status === "auto_approved"
                            ? "AUTO APPROVED"
                            : entry.status.replace("_", " ").toUpperCase()}
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700">
                          INC
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Time In:</span>{" "}
                        <span className="font-medium">
                          {new Date(entry.clock_in_time).toLocaleTimeString(
                            "en-US",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Time Out:</span>{" "}
                        <span className="font-medium">
                          {entry.clock_out_time
                            ? new Date(entry.clock_out_time).toLocaleTimeString(
                                "en-US",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )
                            : "—"}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Hours:</span>{" "}
                        <span className="font-semibold">
                          {pendingFailureToLog.has(entry.id) ? (
                            <span className="text-yellow-600">
                              Pending Approval
                            </span>
                          ) : entry.clock_out_time ? (
                            entry.total_hours ? (
                              entry.total_hours.toFixed(2)
                            ) : (
                              "-"
                            )
                          ) : (
                            <span className="text-orange-600">Incomplete</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          {/* Desktop Table Layout */}
          <div className="hidden sm:block w-full">
            <table className="w-full text-xs sm:text-sm table-auto">
              <thead className="bg-gray-50 text-gray-600 uppercase text-[10px] sm:text-xs tracking-wide">
                <tr>
                  <th className="text-left px-3 sm:px-4 py-3 min-w-[100px]">
                    Date
                  </th>
                  <th className="text-left px-3 sm:px-4 py-3 min-w-[80px]">
                    Time In
                  </th>
                  <th className="text-left px-3 sm:px-4 py-3 min-w-[80px]">
                    Time Out
                  </th>
                  <th className="text-right px-3 sm:px-4 py-3 min-w-[70px]">
                    Hours
                  </th>
                  <th className="text-center px-3 sm:px-4 py-3 min-w-[120px]">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-gray-500">
                      No time records for this period.
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <tr
                      key={entry.id}
                      className="hover:bg-gray-50 text-gray-800"
                    >
                      <td className="px-3 sm:px-4 py-3">
                        {new Date(entry.clock_in_time).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            weekday: "short",
                          }
                        )}
                      </td>
                      <td className="px-3 sm:px-4 py-3 font-medium">
                        {new Date(entry.clock_in_time).toLocaleTimeString(
                          "en-US",
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </td>
                      <td className="px-3 sm:px-4 py-3 font-medium">
                        {entry.clock_out_time
                          ? new Date(entry.clock_out_time).toLocaleTimeString(
                              "en-US",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )
                          : "—"}
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-right font-semibold">
                        {pendingFailureToLog.has(entry.id) ? (
                          <span className="text-yellow-600">
                            Pending Approval
                          </span>
                        ) : entry.clock_out_time ? (
                          entry.total_hours ? (
                            entry.total_hours.toFixed(2)
                          ) : (
                            "-"
                          )
                        ) : (
                          <span className="text-orange-600">Incomplete</span>
                        )}
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-center min-w-[100px]">
                        {entry.clock_out_time ? (
                          <span
                            className={`inline-block px-2 py-1 rounded-full text-[10px] sm:text-xs font-semibold ${
                              entry.status === "clocked_in"
                                ? "bg-green-100 text-green-700"
                                : entry.status === "approved" ||
                                  entry.status === "auto_approved"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {entry.status === "auto_approved"
                              ? "AUTO APPROVED"
                              : entry.status.replace("_", " ").toUpperCase()}
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-1 rounded-full text-[10px] sm:text-xs font-semibold bg-orange-100 text-orange-700">
                            INC
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
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
    if (label === "Off-setting")
      return "bg-amber-50 border-amber-200 text-amber-800";
    return "bg-emerald-50 border-emerald-200 text-emerald-800";
  };

  const statusColor = (type: CalendarEntryType) => {
    if (type === "absent") return "bg-red-50 border-red-200 text-red-800";
    if (type === "inc") return "bg-orange-50 border-orange-200 text-orange-800";
    if (type === "present")
      return "bg-emerald-50 border-emerald-200 text-emerald-800";
    return "bg-gray-50 border-gray-200 text-gray-700";
  };

  return (
    <Card className="w-full p-4">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <HStack gap="2" align="center">
            <Button variant="secondary" size="sm" onClick={onPrev}>
              <Icon name="CaretLeft" size={IconSizes.sm} />
            </Button>
            <H3>{formatDate(date, "MMMM yyyy")}</H3>
            <Button variant="secondary" size="sm" onClick={onNext}>
              <Icon name="CaretRight" size={IconSizes.sm} />
            </Button>
          </HStack>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-purple-600/60" />
              Regular Holiday
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-amber-400/80" />
              Special Holiday
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-red-500/60" />
              Absent/INC
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-emerald-500/60" />
              Present
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-blue-500/60" />
              Leave
            </span>
          </div>
        </div>

        <div className="grid grid-cols-7 text-center text-[10px] sm:text-xs font-semibold text-muted-foreground border-t pt-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="truncate">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 border rounded-lg overflow-hidden text-[10px] sm:text-[11px] md:text-sm">
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
                e.type === "absent" || e.type === "inc" || e.type === "present"
            );
            const times = (dailyEntries || []).filter((e) => e.type === "time");

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
                className={`min-h-[100px] sm:min-h-[120px] md:min-h-[140px] border-r border-b p-1 sm:p-2 overflow-hidden ${
                  isCurrentMonth ? "bg-white" : "bg-muted/60 text-gray-400"
                }`}
              >
                <div className="flex items-start justify-between mb-0.5 sm:mb-1">
                  <div
                    className={`font-semibold text-xs sm:text-sm ${
                      isToday ? "text-emerald-600" : "text-gray-600"
                    }`}
                  >
                    {formatDate(day, "d")}
                  </div>
                </div>

                <div className="flex flex-col gap-0.5 sm:gap-1 text-[8px] sm:text-[9px] md:text-[10px] leading-tight overflow-hidden">
                  {holiday && (
                    <div className="font-semibold text-gray-900 leading-tight line-clamp-1 break-words text-[8px] sm:text-[9px]">
                      {holiday.name}
                    </div>
                  )}
                  {badge && <div className="flex-shrink-0">{badge}</div>}

                  {status && (
                    <div
                      className={`px-1 py-0.5 rounded-full border font-semibold w-fit text-[8px] sm:text-[9px] md:text-[10px] leading-tight ${statusColor(
                        status.type
                      )}`}
                    >
                      {status.label}
                    </div>
                  )}

                  {leaves.length > 0 && (
                    <div className="flex flex-wrap gap-0.5">
                      {leaves.slice(0, 2).map((leave, idx) => (
                        <div
                          key={`${leave.label}-${idx}`}
                          className={`px-1 py-0.5 rounded-full border font-semibold text-[8px] sm:text-[9px] md:text-[10px] w-fit leading-tight ${leaveColor(
                            leave.label
                          )}`}
                        >
                          {leave.label.length > 8
                            ? leave.label.slice(0, 6) + "..."
                            : leave.label}
                        </div>
                      ))}
                      {leaves.length > 2 && (
                        <div className="px-1 py-0.5 rounded-full border font-semibold text-[8px] sm:text-[9px] bg-gray-100 text-gray-600 w-fit leading-tight">
                          +{leaves.length - 2}
                        </div>
                      )}
                    </div>
                  )}

                  {times.length > 0 && (
                    <div className="flex flex-wrap gap-0.5">
                      {times.slice(0, 1).map((entry, idx) => {
                        const startLabel = formatDate(
                          new Date(entry.clock_in_time!),
                          "h:mm a"
                        );
                        const endLabel = entry.clock_out_time
                          ? formatDate(new Date(entry.clock_out_time), "h:mm a")
                          : null;
                        const timeLabel = endLabel
                          ? `${startLabel} \u2013 ${endLabel}`
                          : startLabel;
                        return (
                          <div
                            key={`${entry.clock_in_time}-${idx}`}
                            className="inline-flex items-center gap-0.5 bg-emerald-50 border border-emerald-100 rounded-full px-1 py-0.5 text-emerald-800 text-[8px] sm:text-[9px] md:text-[10px] font-semibold w-fit leading-tight"
                          >
                            <span className="hidden sm:inline">
                              {timeLabel}
                            </span>
                            <span className="sm:hidden">
                              {startLabel.split(" ")[0]}
                            </span>
                          </div>
                        );
                      })}
                      {times.length > 1 && (
                        <div className="px-1 py-0.5 rounded-full border font-semibold text-[8px] sm:text-[9px] bg-emerald-100 text-emerald-700 w-fit leading-tight">
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
}
