"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useEmployeeSession } from "@/contexts/EmployeeSessionContext";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { toast } from "sonner";
import { MapPin, ArrowLeft, ArrowRight } from "lucide-react";
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

interface CalendarEntry {
  date: string;
  clock_in_time: string;
  clock_out_time: string | null;
  status: string;
}

export default function BundyClockPage() {
  const { employee } = useEmployeeSession();
  const supabase = createClient();

  const [currentEntry, setCurrentEntry] = useState<TimeEntry | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
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
  const [pendingClockAction, setPendingClockAction] = useState<"in" | "out" | null>(null);
  const [pendingFailureToLog, setPendingFailureToLog] = useState<Set<string>>(new Set());

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
      // Check if the entry is from a previous day (before today at 12am)
      const entryDate = new Date(data.clock_in_time);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // If entry is from a previous day, auto-close it
      if (entryDate < today) {
        // Auto-close the previous day's entry by setting clock_out_time to end of that day
        const endOfPreviousDay = new Date(entryDate);
        endOfPreviousDay.setHours(23, 59, 59, 999);
        
        await supabase
          .from("time_clock_entries")
          .update({
            clock_out_time: endOfPreviousDay.toISOString(),
            status: "clocked_out",
            // Don't calculate hours yet - wait for failure to log approval
            total_hours: null,
            regular_hours: null,
          })
          .eq("id", data.id);
        
        setCurrentEntry(null);
        return;
      }
      
      setCurrentEntry(data);
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

      const { data, error } = await supabase
        .from("time_clock_entries")
        .select("clock_in_time, clock_out_time, status")
        .eq("employee_id", employee.id)
        .gte("clock_in_time", startRange)
        .lte("clock_in_time", endRange)
        .order("clock_in_time", { ascending: true });

      if (error) {
        console.error("Failed to load calendar entries", error);
        return;
      }

      setCalendarEntries(
        (data || []).map((entry) => ({
          date: formatDate(new Date(entry.clock_in_time), "yyyy-MM-dd"),
          clock_in_time: entry.clock_in_time,
          clock_out_time: entry.clock_out_time,
          status: entry.status,
        }))
      );
    },
    [employee.id, supabase]
  );

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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
  async function confirmClock(location: { lat: number; lng: number }): Promise<boolean> {
    console.log("confirmClock called", { action: pendingClockAction, location });
    const action = pendingClockAction;
    if (!action) {
      console.error('No pending clock action');
      toast.error("No clock action pending");
      return false;
    }

    const locationString = `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`;

    try {
      if (action === "in") {
        console.log("Starting clock in process...");
        
        // First, check if there's an unclosed entry from previous day and auto-close it
        console.log("Checking for previous entries...");
        const { data: previousEntry, error: prevError } = await supabase
          .from("time_clock_entries")
          .select("*")
          .eq("employee_id", employee.id)
          .eq("status", "clocked_in")
          .order("clock_in_time", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (prevError) {
          console.error("Error checking previous entries:", prevError);
        }

        if (previousEntry) {
          const entryDate = new Date(previousEntry.clock_in_time);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          // If entry is from a previous day, auto-close it
          if (entryDate < today) {
            console.log("Auto-closing previous day entry...");
            const endOfPreviousDay = new Date(entryDate);
            endOfPreviousDay.setHours(23, 59, 59, 999);
            
            const { error: closeError } = await supabase
              .from("time_clock_entries")
              .update({
                clock_out_time: endOfPreviousDay.toISOString(),
                status: "clocked_out",
                // Don't calculate hours yet - wait for failure to log approval
                total_hours: null,
                regular_hours: null,
              })
              .eq("id", previousEntry.id);

            if (closeError) {
              console.error("Error closing previous entry:", closeError);
            }
          }
        }

        console.log("Calling employee_clock_in RPC...");
        const { data: clockInData, error: clockInError } = await supabase.rpc(
          'employee_clock_in',
          {
            p_employee_id: employee.id,
            p_location: locationString,
          }
        );

        if (clockInError) {
          console.error("Clock in error:", clockInError);
          toast.error(`Failed to clock in: ${clockInError.message || "Unknown error"}`);
          return false;
        }

        if (!clockInData || clockInData.length === 0 || !clockInData[0].success) {
          const errorMsg = clockInData?.[0]?.error_message || "Failed to clock in";
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

        if (fetchError || !entryData) {
          console.error("Error fetching created entry:", fetchError);
          // Still show success since the entry was created
          toast.success("✅ Clocked in successfully!");
        } else {
          console.log("Clock in successful, updating UI...");
          setCurrentEntry(entryData);
          toast.success("✅ Clocked in successfully!");
        }
        
        // Don't await these - let them run in background to avoid blocking
        fetchEntries().catch(err => console.error("Error fetching entries:", err));
        checkClockStatus().catch(err => console.error("Error checking clock status:", err));
        
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
        'employee_clock_out',
        {
          p_employee_id: employee.id,
          p_entry_id: currentEntry.id,
          p_location: locationString,
        }
      );

      if (clockOutError) {
        console.error("Clock out error:", clockOutError);
        toast.error(`Failed to clock out: ${clockOutError.message || "Unknown error"}`);
        return false;
      }

      if (!clockOutData || clockOutData.length === 0 || !clockOutData[0].success) {
        const errorMsg = clockOutData?.[0]?.error_message || "Failed to clock out";
        console.error("Clock out failed:", errorMsg);
        toast.error(errorMsg);
        return false;
      }

      console.log("Clock out successful, updating UI...");
      toast.success("✅ Clocked out successfully!");
      setCurrentEntry(null);
      
      // Don't await these - let them run in background to avoid blocking
      fetchEntries().catch(err => console.error("Error fetching entries:", err));
      checkClockStatus().catch(err => console.error("Error checking clock status:", err));
      
      // Close modal after successful operation
      setShowLocationModal(false);
      setPendingClockAction(null);
      
      // Re-fetch location after clock out (don't clear it, just refresh)
      console.log("Refreshing location after clock out...");
      getFreshLocation().then((loc) => {
        if (loc) {
          setLocation(loc);
          validateLocation(loc.lat, loc.lng);
        }
      }).catch(err => console.error("Error refreshing location:", err));
      
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
      const entryIds = entries.map(e => e.id);
      const { data: pendingFailures } = await supabase
        .from('failure_to_log')
        .select('time_entry_id')
        .in('time_entry_id', entryIds)
        .eq('status', 'pending');

      const pendingEntryIds = new Set(pendingFailures?.map(f => f.time_entry_id) || []);
      setPendingFailureToLog(pendingEntryIds);

      // Only count hours for entries without pending failure to log requests
      const validHours = entries
        .filter(entry => !pendingEntryIds.has(entry.id))
        .reduce((sum, entry) => sum + (entry.total_hours || 0), 0);

      setTotalHours(validHours);
    };

    calculateTotalHours();
  }, [entries, supabase]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2 text-center">
            <div className="text-6xl font-bold text-gray-800 font-mono">
              {currentTime.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </div>
            <div className="text-gray-500">
              {currentTime.toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
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
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase tracking-widest">
                  Bi-Monthly Period
                </p>
                <p className="text-lg font-semibold text-gray-800">
                  {formatBiMonthlyPeriod(periodStart, periodEnd)}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="px-3 py-3"
                onClick={() =>
                  setPeriodStart(getNextBiMonthlyPeriod(periodStart))
                }
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-sm text-gray-500">
              Total Hours:{" "}
              <span className="font-semibold text-gray-900">
                {totalHours.toFixed(2)}h
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => handleClock("in")}
              disabled={!!currentEntry || !locationStatus?.isAllowed}
              className={`py-4 rounded-xl text-lg font-bold uppercase tracking-wider transition ${
                currentEntry || !locationStatus?.isAllowed
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 shadow-lg"
              }`}
            >
              Time In
            </button>
            <button
              onClick={() => handleClock("out")}
              disabled={!currentEntry || !locationStatus?.isAllowed}
              className={`py-4 rounded-xl text-lg font-bold uppercase tracking-wider transition ${
                !currentEntry || !locationStatus?.isAllowed
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-gradient-to-br from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 shadow-lg"
              }`}
            >
              Time Out
            </button>
          </div>

          <div>
            {location ? (
              locationStatus ? (
                locationStatus.isAllowed ? (
                  <div className="inline-flex items-center gap-2 text-sm text-green-600 bg-green-50 px-4 py-2 rounded-full border border-green-200">
                    <MapPin className="h-4 w-4" />
                    <span>
                      At {locationStatus.nearestLocation || "an approved site"}
                      {locationStatus.distance !== null &&
                        ` (${locationStatus.distance}m away)`}
                    </span>
                  </div>
                ) : (
                  <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 text-sm text-red-700">
                    <p className="font-semibold mb-1">Location not allowed</p>
                    <p>
                      {locationStatus.error ||
                        "You must be at an approved location to clock in/out."}
                    </p>
                  </div>
                )
              ) : (
                <div className="inline-flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-200">
                  <MapPin className="h-4 w-4" />
                  <span>Validating location...</span>
                </div>
              )
            ) : (
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 text-sm text-red-700">
                <p className="font-semibold mb-1">Location required</p>
                <p>Please enable GPS/location services and refresh the page.</p>
              </div>
            )}
          </div>
        </div>
      </Card>

      <HolidayCalendar
        date={calendarDate}
        holidays={calendarHolidays}
        entries={calendarEntries}
        onPrev={() => setCalendarDate((prev) => subMonths(prev, 1))}
        onNext={() => setCalendarDate((prev) => addMonths(prev, 1))}
      />

      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">Time Records</h2>
          <p className="text-sm text-gray-500">
            {formatBiMonthlyPeriod(periodStart, periodEnd)}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Time In</th>
                <th className="text-left px-4 py-3">Time Out</th>
                <th className="text-right px-4 py-3">Hours</th>
                <th className="text-center px-4 py-3">Status</th>
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
                  <tr key={entry.id} className="hover:bg-gray-50 text-gray-800">
                    <td className="px-4 py-3">
                      {new Date(entry.clock_in_time).toLocaleDateString(
                        "en-US",
                        {
                          month: "short",
                          day: "numeric",
                          weekday: "short",
                        }
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {new Date(entry.clock_in_time).toLocaleTimeString(
                        "en-US",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">
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
                    <td className="px-4 py-3 text-right font-semibold">
                      {pendingFailureToLog.has(entry.id) ? (
                        <span className="text-yellow-600">Pending Approval</span>
                      ) : entry.total_hours ? (
                        entry.total_hours.toFixed(2)
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          entry.status === "clocked_in"
                            ? "bg-green-100 text-green-700"
                            : entry.status === "approved" ||
                              entry.status === "auto_approved"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {entry.status.replace("_", " ").toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

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
    </div>
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

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onPrev}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="text-lg font-semibold">
              {formatDate(date, "MMMM yyyy")}
            </div>
            <Button variant="secondary" size="sm" onClick={onNext}>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-purple-600/60" />
              Regular Holiday
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-amber-400/80" />
              Special Holiday
            </span>
          </div>
        </div>

        <div className="grid grid-cols-7 text-center text-xs font-semibold text-muted-foreground border-t pt-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day}>{day}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 border rounded-lg overflow-hidden text-sm">
          {days.map((day) => {
            const iso = formatDate(day, "yyyy-MM-dd");
            const holiday = holidayMap.get(iso);
            const dailyEntries = entryMap.get(iso);
            const isCurrentMonth = isSameMonth(day, date);
            const isToday = isSameDay(day, new Date());

            const badge =
              holiday &&
              (holiday.type === "regular" ? (
                <div className="mt-1 text-[11px] px-2 py-1 rounded-full bg-purple-600/15 text-purple-700 border border-purple-200 font-semibold">
                  Regular Holiday
                </div>
              ) : (
                <div className="mt-1 text-[11px] px-2 py-1 rounded-full bg-amber-400/30 text-amber-800 border border-amber-200 font-semibold">
                  Special Holiday
                </div>
              ));

            return (
              <div
                key={iso}
                className={`min-h-[90px] border-r border-b p-2 ${
                  isCurrentMonth ? "bg-white" : "bg-muted/60 text-gray-400"
                }`}
              >
                <div
                  className={`text-right font-semibold ${
                    isToday ? "text-emerald-600" : "text-gray-600"
                  }`}
                >
                  {formatDate(day, "d")}
                </div>
                {holiday && (
                  <div className="mt-1 text-[11px] font-semibold text-gray-900 leading-tight">
                    {holiday.name}
                  </div>
                )}
                {badge}
                {dailyEntries && dailyEntries.length > 0 && (
                  <div className="mt-1 space-y-1">
                    {dailyEntries.map((entry, idx) => (
                      <div
                        key={`${entry.clock_in_time}-${idx}`}
                        className="text-[11px] bg-emerald-50 border border-emerald-100 rounded px-2 py-1 text-emerald-800"
                      >
                        {formatDate(new Date(entry.clock_in_time), "h:mm a")}
                        {entry.clock_out_time && (
                          <>
                            {" "}
                            –{" "}
                            {formatDate(
                              new Date(entry.clock_out_time),
                              "h:mm a"
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
