"use client";

import Link from "next/link";
import { useState, useEffect, useMemo, Fragment } from "react";
import { createClient } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { CardSection } from "@/components/ui/card-section";
import { H1, BodySmall, Caption } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { getBiMonthlyPeriodEnd } from "@/utils/bimonthly";
import { OfficeLocation, resolveLocationDetails } from "@/lib/location";
import { EmployeeAvatar } from "@/components/EmployeeAvatar";
import { determineDayType, normalizeHolidays } from "@/utils/holidays";
import { regularHoursFromBundyClockPair } from "@/utils/business-hours";
import { getDayTypeLabel } from "@/utils/payroll-calculator";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { useAssignedGroups } from "@/lib/hooks/useAssignedGroups";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { fetchSessionsInRange, getDateInManilaDefault, type TimeEntrySession } from "@/lib/timeEntries";
import { syntheticClockOutFromApprovedOt, normalizeApprovedFtlClockPair } from "@/lib/ftl-ot-synthesis";

interface TimeEntry {
  id: string;
  out_punch_id?: string | null;
  employee_id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  total_hours: number | null;
  regular_hours: number | null;
  overtime_hours: number | null;
  total_night_diff_hours: number | null;
  status:
    | "clocked_in"
    | "clocked_out"
    | "approved"
    | "rejected"
    | "auto_approved"
    | "pending";
  employee_notes?: string | null;
  hr_notes?: string | null;
  clock_in_location?: string | null;
  clock_out_location?: string | null;
  clock_in_ip?: string | null;
  clock_out_ip?: string | null;
  is_manual_entry: boolean;
  employees: {
    employee_id: string;
    full_name: string;
    profile_picture_url?: string | null;
    overtime_group_id?: string | null;
    employee_type?: string | null;
  };
}

interface HolidayEntry {
  date: string;
  name: string;
  type: "regular" | "non-working";
}

interface FailureToLogEntry {
  employee_id: string;
  missed_date: string | null;
  actual_clock_in_time: string | null;
  actual_clock_out_time: string | null;
  entry_type: "in" | "out" | "both";
  status: string;
}

// Alias for compatibility
type Holiday = HolidayEntry;

export default function TimeEntriesPage() {
  const supabase = createClient();
  const { isAdmin, isHR, loading: roleLoading } = useUserRole();
  const { groupIds: assignedGroupIds, loading: groupsLoading } = useAssignedGroups();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [employees, setEmployees] = useState<
    { id: string; employee_id: string; full_name: string; last_name?: string | null; first_name?: string | null }[]
  >([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const today = new Date();
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    // Company weekly cutoff: Wednesday to Tuesday
    while (d.getDay() !== 3) {
      d.setDate(d.getDate() - 1);
    }
    return d;
  });
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedEntry, setSelectedEntry] = useState<TimeEntry | null>(null);
  const [hrNotes, setHrNotes] = useState("");
  const [officeLocations, setOfficeLocations] = useState<OfficeLocation[]>([]);
  const [holidays, setHolidays] = useState<HolidayEntry[]>([]);
  const [employeeInfoMap, setEmployeeInfoMap] = useState<Map<string, { employee_type: string | null; restDays: Map<string, boolean> }>>(new Map());
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [editedClockIn, setEditedClockIn] = useState("");
  const [editedClockOut, setEditedClockOut] = useState("");
  const [savingTimeEdit, setSavingTimeEdit] = useState(false);
  const [driversGroupId, setDriversGroupId] = useState<string | null>(null);
  const [showAddEntryDialog, setShowAddEntryDialog] = useState(false);
  const [newEntryEmployee, setNewEntryEmployee] = useState<string>("");
  const [newEntryClockIn, setNewEntryClockIn] = useState("");
  const [newEntryClockOut, setNewEntryClockOut] = useState("");
  const [newEntryNotes, setNewEntryNotes] = useState("");
  const [savingNewEntry, setSavingNewEntry] = useState(false);
  const [driversEmployees, setDriversEmployees] = useState<typeof employees>([]);

  // Bulk entry states
  const [showBulkEntryDialog, setShowBulkEntryDialog] = useState(false);
  const [bulkEntryEmployee, setBulkEntryEmployee] = useState<string>("");
  const [bulkEntries, setBulkEntries] = useState<Array<{ date: string; timeIn: string; timeOut: string; notes: string }>>([{ date: "", timeIn: "", timeOut: "", notes: "" }]);
  const [savingBulkEntries, setSavingBulkEntries] = useState(false);
  const [expandedDayKeys, setExpandedDayKeys] = useState<Set<string>>(new Set());
  const [reverseGeocodeMap, setReverseGeocodeMap] = useState<Record<string, string>>({});

  // Weekly cutoff: Wednesday to Tuesday
  const periodStart = selectedWeekStart;
  const periodEnd = (() => {
    const d = new Date(selectedWeekStart);
    d.setDate(d.getDate() + 6);
    return d;
  })();

  /** Regular BH from Manila business windows (matches timesheet / punch sessions; not capped at 8). */
  const calculateBusinessRegularHours = (
    clockInISO: string,
    clockOutISO: string | null
  ): number => {
    if (!clockOutISO) return 0;
    return regularHoursFromBundyClockPair(clockInISO, clockOutISO);
  };

  useEffect(() => {
    if (!groupsLoading) {
      fetchTimeEntries();
    }
  }, [selectedWeekStart, statusFilter, selectedEmployee, assignedGroupIds, groupsLoading, isAdmin, isHR]);

  useEffect(() => {
    async function loadEmployees() {
      if (groupsLoading) return;

      let query = supabase
        .from("employees")
        .select("id, employee_id, full_name, overtime_group_id, last_name, first_name")
        .order("last_name", { ascending: true, nullsFirst: false })
        .order("first_name", { ascending: true, nullsFirst: false });

      // Filter by assigned groups if user is approver/viewer (not admin or HR)
      // Admin and HR should see all employees
      if (!isAdmin && !isHR && assignedGroupIds.length > 0) {
        query = query.in("overtime_group_id", assignedGroupIds);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Failed to load employees", error);
        return;
      }

      setEmployees(data || []);
    }

    loadEmployees();
  }, [supabase, assignedGroupIds, groupsLoading, isAdmin, isHR]);

  useEffect(() => {
    const fetchLocations = async () => {
      const { data, error } = await supabase
        .from("office_locations")
        .select("id, name, address, latitude, longitude, radius_meters");

      if (error) {
        console.warn("Office locations not available:", error.message);
        setOfficeLocations([]);
        return;
      }
      setOfficeLocations((data || []) as OfficeLocation[]);
    };
    fetchLocations();
  }, [supabase]);

  // Schema does not include overtime_groups table — no drivers group or special edit rules
  useEffect(() => {
    setDriversGroupId(null);
    setDriversEmployees([]);
  }, []);

  // Only HR may correct clock in/out times (not admin).
  const canEditTime = isHR;

  const getDayType = (clockInTime: string, employeeId?: string): string => {
    const dateString = format(new Date(clockInTime), "yyyy-MM-dd");

    // Ensure holidays are available
    if (!holidays || holidays.length === 0) {
      // If holidays not loaded yet, check if it's Sunday as fallback
      // But only for office-based employees
      const dayOfWeek = new Date(clockInTime).getDay();
      if (dayOfWeek === 0) {
        // Check if employee is client-based
        if (employeeId) {
          const empInfo = employeeInfoMap.get(employeeId);
          if (empInfo?.employee_type === "client-based") {
            // Client-based: Sunday is NOT automatically a rest day
            return "Regular Day";
          }
        }
        return "Sunday/Rest Day";
      }
      return "Regular Day";
    }

    // Convert holidays to the format expected by determineDayType
    const normalizedHolidaysList: Holiday[] = normalizeHolidays(
      holidays.map((h) => ({
        date: h.date,
        name: h.name,
        type: h.type,
      }))
    );

    // Get employee info if available
    let isRestDay: boolean | undefined = undefined;
    let isClientBased = false;

    if (employeeId) {
      const empInfo = employeeInfoMap.get(employeeId);
      if (empInfo) {
        isClientBased = empInfo.employee_type === "client-based";
        // Check if this date is a rest day for this employee
        isRestDay = empInfo.restDays.get(dateString) || false;
      }
    }

    // Determine the actual day type (regular, holiday, sunday, etc.)
    const dayType = determineDayType(dateString, normalizedHolidaysList, isRestDay, isClientBased);

    // Debug logging for December dates
    if (dateString.includes("12-24") || dateString.includes("12-25") || dateString.includes("12-26")) {
      console.log("Day type detection:", {
        dateString,
        dayType,
        holidaysCount: normalizedHolidaysList.length,
        matchingHoliday: normalizedHolidaysList.find(h => h.date === dateString),
      });
    }

    // Return the formatted label
    // Pass isClientBased so client-based employees see "Rest Day" instead of "Sunday/Rest Day"
    return getDayTypeLabel(dayType, isClientBased);
  };

  // Group entries by employee + date (one card per employee per day)
  const groupedByDay = useMemo(() => {
    const getLatestClockIn = (dayEntries: TimeEntry[]) => {
      return dayEntries.reduce((latest, entry) => {
        const time = new Date(entry.clock_in_time).getTime();
        return Number.isFinite(time) && time > latest ? time : latest;
      }, 0);
    };

    const keyToDateStr = (clockInTime: string) => {
      const d = new Date(clockInTime);
      const dPH = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
      return format(dPH, "yyyy-MM-dd");
    };
    const map = new Map<string, TimeEntry[]>();
    entries.forEach((entry) => {
      const dateKey = keyToDateStr(entry.clock_in_time);
      const key = `${entry.employee_id}-${dateKey}`;
      const list = map.get(key) ?? [];
      list.push(entry);
      map.set(key, list);
    });
    const result: Array<{
      key: string;
      employeeId: string;
      employee: { full_name: string; employee_id: string; profile_picture_url?: string | null };
      dateKey: string;
      dateLabel: string;
      entries: TimeEntry[];
      totalHours: number;
    }> = [];
    map.forEach((dayEntries, key) => {
      const first = dayEntries[0];
      const emp = first.employees ?? { full_name: "Unknown", employee_id: first.employee_id ?? "", profile_picture_url: null };
      const dateKey = keyToDateStr(first.clock_in_time);
      const dateLabel = format(new Date(first.clock_in_time), "MMM d, yyyy");
      const totalHours = dayEntries.reduce(
        (sum, e) =>
          sum +
          (e.clock_out_time
            ? calculateBusinessRegularHours(e.clock_in_time, e.clock_out_time)
            : 0),
        0
      );
      result.push({
        key,
        employeeId: first.employee_id,
        employee: emp,
        dateKey,
        dateLabel,
        entries: dayEntries,
        totalHours,
      });
    });
    result.sort((a, b) => {
      const dateCmp = b.dateKey.localeCompare(a.dateKey);
      if (dateCmp !== 0) return dateCmp;
      const latestCmp = getLatestClockIn(b.entries) - getLatestClockIn(a.entries);
      if (latestCmp !== 0) return latestCmp;
      return (a.employee?.full_name ?? "").localeCompare(b.employee?.full_name ?? "");
    });
    return result;
  }, [entries]);

  const parseCoordinates = (locationString?: string | null): string | null => {
    if (!locationString) return null;
    if (locationString.startsWith("office:")) return null;
    const [latStr, lngStr] = locationString.split(",");
    const lat = Number.parseFloat(latStr);
    const lng = Number.parseFloat(lngStr);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  };

  const normalizeCoordinateKey = (coordinates: string): string => {
    const [latStr, lngStr] = coordinates.split(",");
    const lat = Number.parseFloat(latStr);
    const lng = Number.parseFloat(lngStr);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return coordinates;
    }
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  };

  const getResolvedAddress = (details: ReturnType<typeof resolveLocationDetails>) => {
    if (details.isNearestRegisteredLandmark) return details.address;
    if (details.isWithinAllowedArea) return details.address;
    if (!details.coordinates) return details.address;
    const key = normalizeCoordinateKey(details.coordinates);
    return reverseGeocodeMap[key] || details.address;
  };

  useEffect(() => {
    const coordinateSet = new Set<string>();

    entries.forEach((entry) => {
      const inCoordinates = parseCoordinates(entry.clock_in_location);
      if (inCoordinates) coordinateSet.add(inCoordinates);

      const outCoordinates = parseCoordinates(entry.clock_out_location);
      if (outCoordinates) coordinateSet.add(outCoordinates);
    });

    const unresolved = Array.from(coordinateSet).filter((coords) => !reverseGeocodeMap[coords]);
    if (unresolved.length === 0) return;

    let cancelled = false;

    const resolveAddresses = async () => {
      const updates: Record<string, string> = {};

      await Promise.all(
        unresolved.slice(0, 80).map(async (coords) => {
          const [latStr, lngStr] = coords.split(",");
          const lat = Number.parseFloat(latStr);
          const lng = Number.parseFloat(lngStr);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

          try {
            const res = await fetch(
              `/api/geocode/reverse?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`
            );
            const json = (await res.json()) as { address?: string | null };
            if (res.ok && json.address) {
              updates[coords] = json.address;
            }
          } catch {
            // Keep coordinate fallback when reverse geocoding fails.
          }
        })
      );

      if (cancelled || Object.keys(updates).length === 0) return;
      setReverseGeocodeMap((prev) => ({ ...prev, ...updates }));
    };

    void resolveAddresses();

    return () => {
      cancelled = true;
    };
  }, [entries, reverseGeocodeMap]);

  const toggleDayExpanded = (key: string) => {
    setExpandedDayKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  async function fetchTimeEntries() {
    setLoading(true);

    try {
      // Ensure periodEnd includes the full day
      const periodEndInclusive = new Date(periodEnd);
      periodEndInclusive.setHours(23, 59, 59, 999);

      // Debug logging
      console.log("Fetching time entries for range:", {
        periodStart: periodStart.toISOString(),
        periodEnd: periodEndInclusive.toISOString(),
        statusFilter,
        selectedEmployee,
      });

      const employeeIdFilter =
        selectedEmployee && selectedEmployee !== "all" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedEmployee)
          ? selectedEmployee
          : undefined;

      const sessionsResult = await fetchSessionsInRange(supabase, periodStart.toISOString(), periodEndInclusive.toISOString(), {
        employeeId: employeeIdFilter,
        statusFilter: statusFilter && statusFilter !== "all" ? statusFilter : undefined,
      });
      const sessions = sessionsResult.slice(0, 1000);

      // Holidays: use in-app fallback only (no holidays table in schema)
      const holidayData: Array<{ holiday_date: string; name: string; is_regular: boolean }> = [];

      const employeeIds = Array.from(new Set(sessions.map((s) => s.employee_id).filter(Boolean))) as string[];
      const { data: employeesData } = employeeIds.length
        ? await supabase
            .from("employees")
            .select("id, employee_id, full_name, overtime_group_id, employment_type")
            .in("id", employeeIds)
        : { data: [] };

      const employeesMap = new Map(
        (employeesData || []).map((e: any) => [
          e.id,
          { ...e, employee_type: e.employment_type },
        ])
      );
      const data = sessions.map((s) => ({
        ...s,
        employees: s.employee_id ? employeesMap.get(s.employee_id) ?? null : null,
      }));

      // Filter by assigned groups if user is approver/viewer (not admin)
      let filteredData = data;
      if (!isAdmin && assignedGroupIds.length > 0 && data) {
        filteredData = data.filter((entry: any) => {
          const employeeGroupId = entry.employees?.overtime_group_id;
          return employeeGroupId && assignedGroupIds.includes(employeeGroupId);
        });
      }

      console.log("Fetched entries:", filteredData?.length || 0, "entries");

      const holidaysArray = holidayData;

      // Normalize holidays to ensure consistent date format
      const { normalizeHolidays } = await import("@/utils/holidays");
      const formattedHolidays: HolidayEntry[] = normalizeHolidays(
        (holidaysArray || []).map((holiday) => ({
          date: holiday.holiday_date,
          name: holiday.name,
          type: holiday.is_regular ? "regular" : "non-working",
        }))
      );

      // Debug: Log holidays for December
      const decHolidays = formattedHolidays.filter(h => h.date.includes("12-"));
      if (decHolidays.length > 0) {
        console.log("December holidays loaded:", decHolidays);
      }

      // Filter entries by date in Asia/Manila timezone (same as Timesheet and Payslip pages)
      // This ensures entries appear on the correct dates
      const periodStartStr = format(periodStart, "yyyy-MM-dd");
      const periodEndStr = format(periodEnd, "yyyy-MM-dd");

      const dateFilteredData = (filteredData || []).filter((entry: any) => {
        if (!entry.clock_in_time) return false;

        const entryDateStr =
          entry.clock_in_date_ph || getDateInManilaDefault(entry.clock_in_time);

        // Check if entry date falls within the period
        return entryDateStr >= periodStartStr && entryDateStr <= periodEndStr;
      });

      console.log(
        `Filtered ${dateFilteredData.length} entries (from ${filteredData?.length || 0} total) using Asia/Manila timezone`
      );

      const employeeIdsForFtl = Array.from(
        new Set(
          dateFilteredData
            .map((entry: any) => entry.employee_id)
            .filter((id: string | null | undefined): id is string => Boolean(id))
        )
      );
      const ftlCompositeKey = (employeeId: string, dateKey: string) =>
        `${employeeId}::${dateKey}`;

      let approvedFtlByEmployeeDate = new Map<
        string,
        { inTime: string | null; outTime: string | null }
      >();
      if (employeeIdsForFtl.length > 0) {
        const { data: approvedFtlRows, error: approvedFtlError } = await supabase
          .from("failure_to_log")
          .select(
            "employee_id, missed_date, actual_clock_in_time, actual_clock_out_time, entry_type, status"
          )
          .in("employee_id", employeeIdsForFtl)
          .gte("missed_date", periodStartStr)
          .lte("missed_date", periodEndStr)
          .eq("status", "approved");

        if (approvedFtlError) {
          console.warn("Error loading approved failure-to-log rows:", approvedFtlError);
        } else {
          ((approvedFtlRows || []) as FailureToLogEntry[]).forEach((row) => {
            if (!row.missed_date) return;
            const dateKey = String(row.missed_date).split("T")[0];
            const key = ftlCompositeKey(row.employee_id, dateKey);
            const existing = approvedFtlByEmployeeDate.get(key) || {
              inTime: null,
              outTime: null,
            };

            if (
              (row.entry_type === "in" || row.entry_type === "both") &&
              row.actual_clock_in_time
            ) {
              existing.inTime = row.actual_clock_in_time;
            }
            if (
              (row.entry_type === "out" || row.entry_type === "both") &&
              row.actual_clock_out_time
            ) {
              existing.outTime = row.actual_clock_out_time;
            }
            approvedFtlByEmployeeDate.set(key, existing);
          });
        }
      }

      let approvedOtRowsForFtl: Array<{
        employee_id: string;
        ot_date: string;
        end_date?: string | null;
        start_time: string;
        end_time: string;
        status?: string | null;
        total_hours?: number | null;
      }> = [];
      if (employeeIdsForFtl.length > 0) {
        const { data: otRowsForFtl, error: otForFtlError } = await supabase
          .from("overtime_requests")
          .select(
            "employee_id, ot_date, end_date, start_time, end_time, total_hours, status"
          )
          .in("employee_id", employeeIdsForFtl)
          .gte("ot_date", periodStartStr)
          .lte("ot_date", periodEndStr)
          .in("status", ["approved", "approved_by_manager", "approved_by_hr"]);
        if (otForFtlError) {
          console.warn("Error loading OT for FTL clock-out synthesis:", otForFtlError);
        } else {
          approvedOtRowsForFtl = (otRowsForFtl || []) as typeof approvedOtRowsForFtl;
        }
      }

      approvedFtlByEmployeeDate.forEach((pair, key) => {
        if (!pair.inTime || pair.outTime || approvedOtRowsForFtl.length === 0) return;
        const parts = key.split("::");
        const employeeId = parts[0];
        const dateKey = parts.slice(1).join("::");
        if (!employeeId || !dateKey) return;
        const ots = approvedOtRowsForFtl.filter(
          (ot) =>
            ot.employee_id === employeeId &&
            String(ot.ot_date).split("T")[0] === dateKey
        );
        const syn = syntheticClockOutFromApprovedOt(pair.inTime, dateKey, ots);
        if (syn) {
          pair.outTime = syn;
          approvedFtlByEmployeeDate.set(key, pair);
        }
      });

      approvedFtlByEmployeeDate.forEach((pair) => {
        if (!pair.inTime || !pair.outTime) return;
        const n = normalizeApprovedFtlClockPair(pair.inTime, pair.outTime);
        pair.inTime = n.clockInIso;
        pair.outTime = n.clockOutIso;
      });

      // Transform data to ensure employees is a single object, not an array
      const transformedEntries: TimeEntry[] =
        dateFilteredData.map((entry: any) => {
          // Handle employees relationship - could be array, object, or null
          let employeeData = {
            employee_id: "",
            full_name: "Unknown Employee",
            profile_picture_url: null as string | null | undefined,
          };

          if (entry.employees) {
            if (Array.isArray(entry.employees)) {
              employeeData = entry.employees[0] || employeeData;
            } else {
              employeeData = entry.employees;
            }
          }

          const entryDateKey =
            (entry as TimeEntrySession).clock_in_date_ph ||
            getDateInManilaDefault(entry.clock_in_time);
          const ftlForEntry = approvedFtlByEmployeeDate.get(
            ftlCompositeKey(entry.employee_id, entryDateKey)
          );

          const resolvedClockOutTime = (() => {
            if (entry.clock_out_time) return entry.clock_out_time;
            if (entry.status !== "clocked_in" || !entry.clock_in_time || !ftlForEntry?.outTime) {
              return null;
            }
            if (new Date(ftlForEntry.outTime) <= new Date(entry.clock_in_time)) {
              return null;
            }
            return ftlForEntry.outTime;
          })();

          const resolvedClockInTime =
            entry.clock_in_time ||
            (entry.status === "clocked_in" ? ftlForEntry?.inTime || null : null);

          return {
            ...entry,
            clock_in_time: resolvedClockInTime,
            clock_out_time: resolvedClockOutTime,
            status:
              entry.status === "clocked_in" && resolvedClockOutTime
                ? "approved"
                : entry.status,
            employees: employeeData,
          };
        }) || [];

      const existingEntryKeys = new Set(
        transformedEntries.map((entry) => {
          const dateKey =
            (entry as TimeEntrySession).clock_in_date_ph ||
            getDateInManilaDefault(entry.clock_in_time);
          return ftlCompositeKey(entry.employee_id, dateKey);
        })
      );

      approvedFtlByEmployeeDate.forEach((pair, key) => {
        if (!pair.inTime || !pair.outTime) return;
        if (new Date(pair.outTime) <= new Date(pair.inTime)) return;
        if (existingEntryKeys.has(key)) return;

        const [employeeId] = key.split("::");
        const employeeData = employeesMap.get(employeeId) || {
          employee_id: "",
          full_name: "Unknown Employee",
          profile_picture_url: null,
          overtime_group_id: null,
          employee_type: null,
        };
        const inTime = new Date(pair.inTime);
        const outTime = new Date(pair.outTime);
        const totalHours =
          outTime > inTime
            ? Math.round(((outTime.getTime() - inTime.getTime()) / (1000 * 60 * 60)) * 100) / 100
            : null;

        transformedEntries.push({
          id: `ftl-${key}`,
          out_punch_id: null,
          employee_id: employeeId,
          clock_in_time: pair.inTime,
          clock_out_time: pair.outTime,
          total_hours: totalHours,
          regular_hours: totalHours,
          overtime_hours: 0,
          total_night_diff_hours: 0,
          status: "approved",
          employee_notes: "Auto-generated from approved Failure-to-Log",
          hr_notes: null,
          clock_in_location: null,
          clock_out_location: null,
          clock_in_ip: null,
          clock_out_ip: null,
          is_manual_entry: true,
          employees: employeeData,
        });
      });

      console.log("Transformed entries:", transformedEntries.length);

      setHolidays(formattedHolidays);
      setEntries(transformedEntries);

      // Fetch employee info and schedules for rest day determination
      if (transformedEntries.length > 0) {
        await fetchEmployeeInfoAndSchedules(transformedEntries);
      }

        // Log if no entries found to help debug
      if (transformedEntries.length === 0) {
        console.warn("No time entries found for the selected period:", {
          periodStart: periodStart.toISOString(),
          periodEnd: periodEndInclusive.toISOString(),
          statusFilter,
          selectedEmployee,
          assignedGroups: assignedGroupIds,
        });

        // Test query: Check if there are ANY punches in the database (for debugging)
        const { data: testData, error: testError } = await supabase
          .from("time_entries")
          .select("id, punched_at, employee_id, punch_type")
          .limit(5);

        const testEntries = testData as Array<{
          id: string;
          punched_at: string;
          employee_id: string;
          punch_type: string;
        }> | null;

        if (!testError && testEntries && testEntries.length > 0) {
          console.log(
            "Found punches in database (sample):",
            testEntries.map((e) => ({
              id: e.id,
              punched_at: e.punched_at,
              employee_id: e.employee_id,
              punch_type: e.punch_type,
            }))
          );
          console.log("But none match the filter criteria.");
        } else if (!testError) {
          console.log("No punches found in database at all.");
        } else {
          console.error("Error testing database:", testError);
        }
      }
    } catch (error: any) {
      console.error("Unexpected error in fetchTimeEntries:", error);
      toast.error(
        error?.message ||
          "Failed to load time entries. Please refresh the page."
      );
      setEntries([]); // Clear entries on error
    } finally {
      setLoading(false);
    }
  }

  async function fetchEmployeeInfoAndSchedules(entries: TimeEntry[]) {
    try {
      // Get unique employee IDs
      const employeeIds = Array.from(new Set(entries.map(e => e.employee_id)));
      if (employeeIds.length === 0) return;

      // Fetch employee types (DB column is employment_type)
      const { data: employeesData, error: empError } = await supabase
        .from("employees")
        .select("id, employment_type")
        .in("id", employeeIds);

      if (empError) {
        console.error("Error fetching employee info:", empError);
        return;
      }

      // Create employee type map (use employment_type from DB; UI still reads employee_type key)
      const employeeTypeMap = new Map<string, string | null>();
      (employeesData || []).forEach((emp: { id: string; employment_type: string | null }) => {
        employeeTypeMap.set(emp.id, emp.employment_type);
      });

      // Fetch schedules for client-based employees
      // Schema does not include employee_week_schedules table — no rest-day data from schedule
      const restDaysMap = new Map<string, Map<string, boolean>>();

      // Create combined map
      const combinedMap = new Map<string, { employee_type: string | null; restDays: Map<string, boolean> }>();
      employeeIds.forEach(empId => {
        combinedMap.set(empId, {
          employee_type: employeeTypeMap.get(empId) || null,
          restDays: restDaysMap.get(empId) || new Map()
        });
      });

      setEmployeeInfoMap(combinedMap);
    } catch (error) {
      console.error("Error fetching employee info and schedules:", error);
    }
  }

  async function handleApprove(entryId: string) {
    // Punch-based time_entries have no per-entry status; approval is tracked in attendance_records
    toast.success("Time entry approved", {
      description: "Approval is tracked in attendance records",
    });
    fetchTimeEntries();
    setSelectedEntry(null);
    setHrNotes("");
  }

  async function handleReject(entryId: string) {
    if (!hrNotes.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }
    // Punch-based time_entries have no per-entry status; no-op for compatibility
    toast.success("Time entry rejected", {
      description: "The entry has been declined",
    });
    fetchTimeEntries();
    setSelectedEntry(null);
    setHrNotes("");
  }

  async function handleDelete(entryId: string) {
    if (!isHR) {
      toast.error("Only HR can delete time entries");
      return;
    }
    if (!confirm("Are you sure you want to delete this time entry? This action cannot be undone.")) {
      return;
    }
    const entry = entries.find((e) => e.id === entryId) as (TimeEntry & { out_punch_id?: string | null }) | undefined;
    const idsToDelete = entry?.out_punch_id ? [entryId, entry.out_punch_id] : [entryId];
    for (const id of idsToDelete) {
      const { error } = await supabase.from("time_entries").delete().eq("id", id);
      if (error) {
        console.error("Error deleting punch:", error);
        toast.error("Failed to delete entry");
        return;
      }
    }
    toast.success("Time entry deleted", {
      description: "The entry has been permanently removed",
    });
    fetchTimeEntries();
    setSelectedEntry(null);
    setHrNotes("");
  }

  async function handleSaveTimeEdit() {
    if (!selectedEntry) return;

    if (!editedClockIn || !editedClockOut) {
      toast.error("Please provide both clock in and clock out times");
      return;
    }

    const clockInDate = new Date(editedClockIn);
    const clockOutDate = new Date(editedClockOut);
    if (clockOutDate <= clockInDate) {
      toast.error("Clock out time must be after clock in time");
      return;
    }

    setSavingTimeEdit(true);
    try {
      const entry = selectedEntry as TimeEntry & { out_punch_id?: string | null };
      const { error: inError } = await supabase
        .from("time_entries")
        .update({ punched_at: clockInDate.toISOString() })
        .eq("id", selectedEntry.id);
      if (inError) {
        toast.error("Failed to update clock-in time");
        return;
      }
      if (entry.out_punch_id) {
        const { error: outError } = await supabase
          .from("time_entries")
          .update({ punched_at: clockOutDate.toISOString() })
          .eq("id", entry.out_punch_id);
        if (outError) {
          toast.error("Failed to update clock-out time");
          return;
        }
      }

      toast.success("Time entry updated successfully", {
        description: "Clock in/out times have been updated",
      });
      await fetchTimeEntries();
      setSelectedEntry(null);
      setIsEditingTime(false);
      setEditedClockIn("");
      setEditedClockOut("");
      setHrNotes("");
    } catch (error: any) {
      console.error("Error saving time edit:", error);
      toast.error(error.message || "Failed to save changes");
    } finally {
      setSavingTimeEdit(false);
    }
  }

  async function handleCreateTimeEntry() {
    if (!newEntryEmployee || !newEntryClockIn || !newEntryClockOut) {
      toast.error("Please fill in all required fields");
      return;
    }

    const clockInDate = new Date(newEntryClockIn);
    const clockOutDate = new Date(newEntryClockOut);
    if (clockOutDate <= clockInDate) {
      toast.error("Clock out time must be after clock in time");
      return;
    }

    setSavingNewEntry(true);
    try {
      const { error: inError } = await supabase.from("time_entries").insert({
        employee_id: newEntryEmployee,
        punch_type: "in",
        punched_at: clockInDate.toISOString(),
        device_info: `Manual entry${newEntryNotes ? `: ${newEntryNotes}` : ""}`,
      });
      if (inError) throw inError;
      const { error: outError } = await supabase.from("time_entries").insert({
        employee_id: newEntryEmployee,
        punch_type: "out",
        punched_at: clockOutDate.toISOString(),
        device_info: `Manual entry${newEntryNotes ? `: ${newEntryNotes}` : ""}`,
      });
      if (outError) throw outError;

      toast.success("Time entry created successfully", {
        description: "New time entry has been added",
      });
      await fetchTimeEntries();
      setShowAddEntryDialog(false);
      setNewEntryEmployee("");
      setNewEntryClockIn("");
      setNewEntryClockOut("");
      setNewEntryNotes("");
    } catch (error: any) {
      console.error("Error creating time entry:", error);
      toast.error("Failed to create time entry: " + (error?.message ?? "Unknown error"));
    } finally {
      setSavingNewEntry(false);
    }
  }

  async function handleBulkCreateTimeEntries() {
    if (!bulkEntryEmployee) {
      toast.error("Please select an employee");
      return;
    }

    // Filter out empty entries and validate
    const validEntries = bulkEntries.filter(entry => entry.date && entry.timeIn && entry.timeOut);

    if (validEntries.length === 0) {
      toast.error("Please add at least one valid time entry");
      return;
    }

    // Validate all entries
    const errors: string[] = [];
    validEntries.forEach((entry, index) => {
      const clockInDate = new Date(`${entry.date}T${entry.timeIn}`);
      const clockOutDate = new Date(`${entry.date}T${entry.timeOut}`);

      if (clockOutDate <= clockInDate) {
        errors.push(`Row ${index + 1}: Clock out time must be after clock in time`);
      }
    });

    if (errors.length > 0) {
      toast.error(errors[0]);
      return;
    }

    setSavingBulkEntries(true);
    try {
      let successCount = 0;
      let failCount = 0;

      for (const entry of validEntries) {
        const clockInDate = new Date(`${entry.date}T${entry.timeIn}`);
        const clockOutDate = new Date(`${entry.date}T${entry.timeOut}`);
        const deviceInfo = entry.notes || `Bulk imported - ${entry.date}`;
        const { error: inErr } = await supabase.from("time_entries").insert({
          employee_id: bulkEntryEmployee,
          punch_type: "in",
          punched_at: clockInDate.toISOString(),
          device_info: deviceInfo,
        });
        if (inErr) {
          failCount += 1;
          continue;
        }
        const { error: outErr } = await supabase.from("time_entries").insert({
          employee_id: bulkEntryEmployee,
          punch_type: "out",
          punched_at: clockOutDate.toISOString(),
          device_info: deviceInfo,
        });
        if (outErr) failCount += 1;
        else successCount += 1;
      }

      if (failCount > 0) {
        toast.error(`Failed to create ${failCount} entries`);
      } else {
        toast.success(`Successfully created ${successCount} time entries`, {
          description: `Added ${successCount} entries for the selected employee`,
        });
      }

      // Refresh entries and close dialog
      await fetchTimeEntries();
      setShowBulkEntryDialog(false);
      setBulkEntryEmployee("");
      setBulkEntries([{ date: "", timeIn: "", timeOut: "", notes: "" }]);
    } catch (error: any) {
      console.error("Error creating bulk time entries:", error);
      toast.error(error.message || "Failed to create time entries");
    } finally {
      setSavingBulkEntries(false);
    }
  }

  function addBulkEntryRow() {
    setBulkEntries([...bulkEntries, { date: "", timeIn: "", timeOut: "", notes: "" }]);
  }

  function removeBulkEntryRow(index: number) {
    if (bulkEntries.length > 1) {
      setBulkEntries(bulkEntries.filter((_, i) => i !== index));
    }
  }

  function updateBulkEntry(index: number, field: string, value: string) {
    const updated = [...bulkEntries];
    updated[index] = { ...updated[index], [field]: value };
    setBulkEntries(updated);
  }

  // Initialize edit fields when opening dialog for driver entry
  useEffect(() => {
    if (selectedEntry && canEditTime && !isEditingTime) {
      // Format times for datetime-local input (YYYY-MM-DDTHH:mm)
      const clockIn = new Date(selectedEntry.clock_in_time);
      const clockOut = selectedEntry.clock_out_time
        ? new Date(selectedEntry.clock_out_time)
        : new Date(clockIn.getTime() + 8 * 60 * 60 * 1000); // Default 8 hours if no clock out

      // Convert to local time for input (datetime-local uses local timezone)
      const formatForInput = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        return `${year}-${month}-${day}T${hours}:${minutes}`;
      };

      setEditedClockIn(formatForInput(clockIn));
      setEditedClockOut(formatForInput(clockOut));
    }
  }, [selectedEntry, canEditTime, isEditingTime]);

  async function exportToCSV() {
    const csv = [
      [
        "Employee ID",
        "Name",
        "Clock In",
        "Clock Out",
        "Holiday Tag",
        "Total Hours",
        "Regular",
        "Night Diff",
        "Status",
        "Notes",
      ].join(","),
      ...entries.map((entry) => {
        const dayTypeLabel = getDayType(entry.clock_in_time);
        return [
          entry.employees.employee_id,
          entry.employees.full_name,
          format(new Date(entry.clock_in_time), "yyyy-MM-dd HH:mm:ss"),
          entry.clock_out_time
            ? format(new Date(entry.clock_out_time), "yyyy-MM-dd HH:mm:ss")
            : "Not clocked out",
          dayTypeLabel,
          entry.total_hours || 0,
          entry.regular_hours || 0,
          entry.total_night_diff_hours || 0,
          entry.status,
          entry.employee_notes || "",
        ].join(",");
      }),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `time-entries-${format(periodStart, "yyyy-MM-dd")}-${format(periodEnd, "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported to CSV");
  }

  const getStatusBadge = (
    status: string,
    clockOutTime: string | null = null
  ) => {
    // If entry is incomplete (no clock out), show incomplete badge
    if (!clockOutTime && status === "clocked_in") {
      return (
        <Badge
          variant="secondary"
          className="rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary"
        >
          INCOMPLETE
        </Badge>
      );
    }

    const tones: Record<string, string> = {
      clocked_in: "border border-primary/25 bg-primary/10 text-primary",
      clocked_out: "border border-border bg-muted/60 text-foreground",
      approved: "border border-primary/25 bg-primary/10 text-primary",
      auto_approved: "border border-primary/25 bg-primary/10 text-primary",
      rejected: "border border-destructive/30 bg-destructive/10 text-destructive",
      pending: "bg-muted text-foreground",
    };
    const labels: Record<string, string> = {
      clocked_in: "CLOCKED IN",
      clocked_out: "CLOCKED OUT",
      approved: "APPROVED",
      auto_approved: "AUTO APPROVED",
      rejected: "REJECTED",
      pending: "PENDING",
    };
    return (
      <Badge
        variant="secondary"
        className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
          tones[status] || "bg-muted text-foreground"
        }`}
      >
        {labels[status] || status.replace("_", " ").toUpperCase()}
      </Badge>
    );
  };

  const stats = {
    total: entries.length,
    totalHours: entries.reduce(
      (sum, e) =>
        sum +
        (e.clock_out_time
          ? calculateBusinessRegularHours(e.clock_in_time, e.clock_out_time)
          : 0),
      0
    ),
  };

  const selectedClockInDetails = selectedEntry
    ? resolveLocationDetails(
        selectedEntry.clock_in_location ?? null,
        officeLocations
      )
    : null;
  const selectedClockOutDetails = selectedEntry
    ? resolveLocationDetails(
        selectedEntry.clock_out_location ?? null,
        officeLocations
      )
    : null;

  return (
    <DashboardLayout>
      <VStack gap="8" className="w-full max-w-full min-w-0">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <VStack gap="2" align="start">
            <H1>Time entries</H1>
            <BodySmall>Review employee punches, add manual entries, and export logs.</BodySmall>
          </VStack>
          <HStack gap="2" className="w-full sm:w-auto">
            {/* Admin-only: Add Time Entry for any employee */}
            {isAdmin && (
              <>
                <Button
                  onClick={() => {
                    // Set default times to today, 8 AM to 5 PM
                    const today = new Date();
                    const clockIn = new Date(today);
                    clockIn.setHours(8, 0, 0, 0);
                    const clockOut = new Date(today);
                    clockOut.setHours(17, 0, 0, 0);

                    const formatForInput = (date: Date) => {
                      const year = date.getFullYear();
                      const month = String(date.getMonth() + 1).padStart(2, "0");
                      const day = String(date.getDate()).padStart(2, "0");
                      const hours = String(date.getHours()).padStart(2, "0");
                      const minutes = String(date.getMinutes()).padStart(2, "0");
                      return `${year}-${month}-${day}T${hours}:${minutes}`;
                    };

                    setNewEntryClockIn(formatForInput(clockIn));
                    setNewEntryClockOut(formatForInput(clockOut));
                    setShowAddEntryDialog(true);
                  }}
                  className="w-full sm:w-auto"
                >
                  <Icon name="Plus" size={IconSizes.sm} className="mr-2" />
                  Add Time Entry
                </Button>
                <Button
                  onClick={() => {
                    setShowBulkEntryDialog(true);
                  }}
                  variant="secondary"
                  className="w-full sm:w-auto"
                >
                  <Icon name="Plus" size={IconSizes.sm} className="mr-2" />
                  Bulk Add Entries
                </Button>
              </>
            )}
            {/* HR: Add Time Entry for drivers only (legacy functionality) */}
            {isHR && !isAdmin && driversGroupId && (
              <Button
                  onClick={() => {
                    // Set default times to today, 8 AM to 5 PM
                    const today = new Date();
                    const clockIn = new Date(today);
                    clockIn.setHours(8, 0, 0, 0);
                    const clockOut = new Date(today);
                    clockOut.setHours(17, 0, 0, 0);

                    const formatForInput = (date: Date) => {
                      const year = date.getFullYear();
                      const month = String(date.getMonth() + 1).padStart(2, "0");
                      const day = String(date.getDate()).padStart(2, "0");
                      const hours = String(date.getHours()).padStart(2, "0");
                      const minutes = String(date.getMinutes()).padStart(2, "0");
                      return `${year}-${month}-${day}T${hours}:${minutes}`;
                    };

                    setNewEntryClockIn(formatForInput(clockIn));
                    setNewEntryClockOut(formatForInput(clockOut));
                    setShowAddEntryDialog(true);
                  }}
                  className="w-full sm:w-auto"
                >
                  <Icon name="Plus" size={IconSizes.sm} className="mr-2" />
                  Add Driver Time Entry
                </Button>
              )}
            <Button
              asChild
              variant="secondary"
              className="w-full sm:w-auto"
            >
              <Link href="/time-entries/attlog-import">
                <Icon name="ArrowDown" size={IconSizes.sm} />
                Import AttLog
              </Link>
            </Button>
            <Button
              onClick={exportToCSV}
              variant="secondary"
              className="w-full sm:w-auto"
            >
              <Icon name="ArrowsClockwise" size={IconSizes.sm} />
              Export CSV
            </Button>
          </HStack>
        </div>

        {/* Stats Cards — use full horizontal space */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-full">
          <Card className="w-full min-w-0">
            <CardContent className="p-6">
              <VStack gap="2" align="start" className="w-full">
                <BodySmall>Total Entries</BodySmall>
                <div className="text-2xl font-bold leading-tight text-foreground">
                  {stats.total}
                </div>
              </VStack>
            </CardContent>
          </Card>
          <Card className="w-full min-w-0">
            <CardContent className="p-6">
              <VStack gap="2" align="start" className="w-full">
                <BodySmall>Total Hours</BodySmall>
                <div className="text-2xl font-bold leading-tight text-foreground">
                  {stats.totalHours.toFixed(1)}h
                </div>
              </VStack>
            </CardContent>
          </Card>
        </div>

        {/* Filters — full width */}
        <Card className="w-full max-w-full">
          <CardContent className="p-4 sm:p-6 w-full max-w-full">
            <div className="flex flex-col gap-4 md:flex-row md:items-center w-full max-w-full">
              {/* Weekly Cutoff (Wednesday–Tuesday) */}
              <div className="flex flex-col sm:flex-row gap-2 items-center flex-shrink-0 w-full sm:w-auto">
                <Caption className="min-w-[220px] sm:min-w-[240px] text-center font-medium text-xs sm:text-sm">
                  Weekly Cutoff{" "}
                  {format(periodStart, "MMM d")} -{" "}
                  {format(periodEnd, "MMM d, yyyy")}
                </Caption>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      setSelectedWeekStart((prev) => {
                        const d = new Date(prev);
                        d.setDate(d.getDate() - 7);
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
                        return d;
                      })
                    }
                    aria-label="Next week"
                  >
                    <Icon name="CaretRight" size={IconSizes.sm} />
                  </Button>
                </div>
              </div>

              {/* Spacer to push filters to the right (hidden on mobile) */}
              <div className="hidden md:block flex-1 min-w-0" />

              {/* Filters Section */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto">
                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="flex h-10 w-full sm:w-[160px] lg:w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="all">All Status</option>
                  <option value="clocked_in">Clocked In</option>
                  <option value="clocked_out">Clocked Out</option>
                </select>

                {/* Employee Filter — grows to use remaining space */}
                <div className="flex-1 min-w-0 w-full sm:min-w-[200px] sm:max-w-md">
                  <EmployeeSearchSelect
                    employees={employees.map((e) => ({
                      id: e.id,
                      employee_id: e.employee_id,
                      full_name: e.full_name ?? "",
                      first_name: e.first_name,
                      last_name: e.last_name,
                    }))}
                    value={selectedEmployee}
                    onValueChange={setSelectedEmployee}
                    showAllOption={true}
                    placeholder="Search by name or employee ID..."
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Entries List — full width */}
        <Card className="overflow-hidden w-full max-w-full">
          <CardContent className="p-0 w-full">
            <div className="overflow-x-auto w-full">
              <Table className="w-full">
                <TableHeader className="bg-muted">
                  <TableRow>
                    <TableHead className="text-left p-2 sm:p-3 text-xs sm:text-sm font-medium whitespace-nowrap">
                      Employee
                    </TableHead>
                    <TableHead className="text-left p-2 sm:p-3 text-xs sm:text-sm font-medium whitespace-nowrap">
                      Clock In
                    </TableHead>
                    <TableHead className="text-left p-2 sm:p-3 text-xs sm:text-sm font-medium whitespace-nowrap">
                      Clock Out
                    </TableHead>
                    <TableHead className="text-left p-2 sm:p-3 text-xs sm:text-sm font-medium whitespace-nowrap">
                      Holiday
                    </TableHead>
                    <TableHead className="text-right p-2 sm:p-3 text-xs sm:text-sm font-medium whitespace-nowrap">
                      Hours
                    </TableHead>
                    <TableHead className="text-center p-2 sm:p-3 text-xs sm:text-sm font-medium whitespace-nowrap">
                      Status
                    </TableHead>
                    <TableHead className="text-center p-2 sm:p-3 text-xs sm:text-sm font-medium whitespace-nowrap">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y">
                  {loading ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center py-8 sm:py-12 text-muted-foreground p-2 sm:p-3"
                      >
                        <Icon
                          name="Clock"
                          size={IconSizes.lg}
                          className="animate-spin mx-auto mb-2"
                        />
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : groupedByDay.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center py-8 sm:py-12 text-muted-foreground p-2 sm:p-3"
                      >
                        <Icon
                          name="WarningCircle"
                          size={IconSizes.xl}
                          className="mx-auto mb-3 opacity-50"
                        />
                        No time entries found for this period
                      </TableCell>
                    </TableRow>
                  ) : (
                    groupedByDay.map((group) => {
                      const isExpanded = expandedDayKeys.has(group.key);
                      const dayTypeLabel = getDayType(group.entries[0].clock_in_time, group.employeeId);
                      return (
                        <Fragment key={group.key}>
                          <TableRow
                            className="bg-muted/40 hover:bg-muted/60 cursor-pointer border-b"
                            onClick={() => toggleDayExpanded(group.key)}
                          >
                            <TableCell colSpan={7} className="p-2 sm:p-3">
                              <div className="flex items-center justify-between gap-4 flex-wrap">
                                <HStack gap="3" align="center" className="min-w-0">
                                  <EmployeeAvatar
                                    profilePictureUrl={group.employee.profile_picture_url}
                                    fullName={group.employee.full_name}
                                    size="sm"
                                  />
                                  <VStack gap="0" align="start" className="min-w-0">
                                    <div className="font-medium text-xs sm:text-sm">
                                      {group.employee.full_name}
                                    </div>
                                    <Caption className="text-[10px] sm:text-xs text-muted-foreground">
                                      {group.employee.employee_id} · {group.dateLabel}
                                    </Caption>
                                  </VStack>
                                </HStack>
                                <HStack gap="4" align="center" className="text-xs sm:text-sm text-muted-foreground shrink-0">
                                  <span>{dayTypeLabel}</span>
                                  <span className="font-medium text-foreground">{group.totalHours.toFixed(2)}h</span>
                                  <span>{group.entries.length} punch{group.entries.length !== 1 ? "es" : ""}</span>
                                  <Icon
                                    name={isExpanded ? "CaretUp" : "CaretDown"}
                                    size={IconSizes.sm}
                                    className="text-muted-foreground"
                                  />
                                </HStack>
                              </div>
                            </TableCell>
                          </TableRow>
                          {isExpanded &&
                            group.entries.map((entry) => {
                              const clockInDetails = resolveLocationDetails(
                                entry.clock_in_location ?? null,
                                officeLocations
                              );
                              const clockOutDetails = resolveLocationDetails(
                                entry.clock_out_location ?? null,
                                officeLocations
                              );
                              const entryDayTypeLabel = getDayType(entry.clock_in_time, entry.employee_id);
                              const isHoliday = entryDayTypeLabel.includes("Holiday") || entryDayTypeLabel.includes("Special");

                              return (
                                <TableRow
                                  key={entry.id}
                                  className="hover:bg-muted/50"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <TableCell className="p-2 sm:p-3 bg-background/80">
                                    <span className="text-xs sm:text-sm text-muted-foreground">
                                      {format(new Date(entry.clock_in_time), "h:mm a")} –{" "}
                                      {entry.clock_out_time
                                        ? format(new Date(entry.clock_out_time), "h:mm a")
                                        : "—"}
                                    </span>
                                  </TableCell>
                                  <TableCell className="p-2 sm:p-3">
                                    <div className="text-xs sm:text-sm font-medium">
                                      {format(new Date(entry.clock_in_time), "MMM d, h:mm a")}
                                    </div>
                                    <div className="text-[10px] sm:text-xs text-muted-foreground">
                                      {clockInDetails.name}
                                    </div>
                                    <div className="text-[10px] sm:text-[11px] text-muted-foreground">
                                      {getResolvedAddress(clockInDetails)}
                                    </div>
                                    {clockInDetails.coordinates && (
                                      <a
                                        href={`https://www.google.com/maps?q=${clockInDetails.coordinates}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                                      >
                                        <Icon name="MapPin" size={IconSizes.xs} />
                                        View map
                                      </a>
                                    )}
                                  </TableCell>
                                  <TableCell className="p-2 sm:p-3">
                                    {entry.clock_out_time ? (
                                      <>
                                        <div className="text-xs sm:text-sm font-medium">
                                          {format(new Date(entry.clock_out_time), "MMM d, h:mm a")}
                                        </div>
                                        <div className="text-[10px] sm:text-xs text-muted-foreground">
                                          {clockOutDetails.name}
                                        </div>
                                        <div className="text-[10px] sm:text-[11px] text-muted-foreground">
                                          {getResolvedAddress(clockOutDetails)}
                                        </div>
                                        {clockOutDetails.coordinates && (
                                          <a
                                            href={`https://www.google.com/maps?q=${clockOutDetails.coordinates}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                                          >
                                            <Icon name="MapPin" size={IconSizes.xs} />
                                            View map
                                          </a>
                                        )}
                                      </>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">—</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="p-2 sm:p-3 text-left">
                                    <div className="text-xs sm:text-sm font-medium">
                                      {entryDayTypeLabel}
                                    </div>
                                    {isHoliday && (
                                      <div className="text-[10px] sm:text-xs text-muted-foreground">
                                        Logged on holiday
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell className="p-2 sm:p-3 text-right font-medium">
                                    {entry.clock_out_time ? (
                                      calculateBusinessRegularHours(
                                        entry.clock_in_time,
                                        entry.clock_out_time
                                      ).toFixed(2)
                                    ) : (
                                      <span className="text-primary">Incomplete</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="p-2 sm:p-3 text-center">
                                    {getStatusBadge(entry.status, entry.clock_out_time)}
                                  </TableCell>
                                  <TableCell className="p-2 sm:p-3">
                                    <div className="flex items-center justify-center gap-1 flex-wrap">
                                      {entry.status === "clocked_out" && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => {
                                            setSelectedEntry(entry);
                                            setHrNotes(entry.hr_notes || "");
                                          }}
                                        >
                                          <Icon name="PencilSimple" size={IconSizes.sm} />
                                        </Button>
                                      )}
                                      {(entry.status === "clocked_in" || entry.status === "clocked_out" || entry.status === "rejected") && isHR && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => {
                                            if (confirm("Are you sure you want to delete this time entry? This action cannot be undone.")) {
                                              handleDelete(entry.id);
                                            }
                                          }}
                                          className="text-destructive hover:text-destructive/85"
                                        >
                                          <Icon name="Trash" size={IconSizes.sm} />
                                        </Button>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                        </Fragment>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Dialog
          open={!!selectedEntry}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedEntry(null);
              setIsEditingTime(false);
              setEditedClockIn("");
              setEditedClockOut("");
              setHrNotes("");
            }
          }}
        >
          <DialogContent className="max-w-2xl">
            {selectedEntry && (
              <>
                <DialogHeader>
                  <DialogTitle>Time Entry Details</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  {/* Employee Info */}
                  <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                    <div>
                      <div className="text-sm text-muted-foreground">
                        Employee
                      </div>
                      <HStack gap="2" align="center">
                        <EmployeeAvatar
                          profilePictureUrl={
                            selectedEntry.employees.profile_picture_url
                          }
                          fullName={selectedEntry.employees.full_name}
                          size="md"
                        />
                        <div className="font-medium">
                          {selectedEntry.employees.full_name}
                        </div>
                      </HStack>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">
                        Employee ID
                      </div>
                      <div className="font-medium">
                        {selectedEntry.employees.employee_id}
                      </div>
                    </div>
                  </div>

                  {/* Time Details */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">
                        Clock In
                      </div>
                      {isEditingTime && canEditTime ? (
                        <div>
                          <Input
                            type="datetime-local"
                            value={editedClockIn}
                            onChange={(e) => setEditedClockIn(e.target.value)}
                            className="w-full"
                          />
                          <Caption className="text-muted-foreground mt-1">
                            Edit clock in time (HR only)
                          </Caption>
                        </div>
                      ) : (
                        <>
                          <div className="font-medium">
                            {format(
                              new Date(selectedEntry.clock_in_time),
                              "MMM d, yyyy h:mm a"
                            )}
                          </div>
                          {selectedClockInDetails && (
                            <>
                              <div className="text-xs text-muted-foreground">
                                {selectedClockInDetails.name}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {getResolvedAddress(selectedClockInDetails)}
                              </div>
                              {selectedClockInDetails.coordinates && (
                                <a
                                  href={`https://www.google.com/maps?q=${selectedClockInDetails.coordinates}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline"
                                >
                                  <Icon name="MapPin" size={IconSizes.xs} />
                                  View GPS Location
                                </a>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">
                        Clock Out
                      </div>
                      {isEditingTime && canEditTime ? (
                        <div>
                          <Input
                            type="datetime-local"
                            value={editedClockOut}
                            onChange={(e) => setEditedClockOut(e.target.value)}
                            className="w-full"
                          />
                          <Caption className="text-muted-foreground mt-1">
                            Edit clock out time (HR only)
                          </Caption>
                        </div>
                      ) : (
                        <>
                          <div className="font-medium">
                            {selectedEntry.clock_out_time
                              ? format(
                                  new Date(selectedEntry.clock_out_time),
                                  "MMM d, yyyy h:mm a"
                                )
                              : "Not clocked out"}
                          </div>
                          {selectedClockOutDetails && (
                            <>
                              <div className="text-xs text-muted-foreground">
                                {selectedClockOutDetails.name}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {getResolvedAddress(selectedClockOutDetails)}
                              </div>
                              {selectedClockOutDetails.coordinates && (
                                <a
                                  href={`https://www.google.com/maps?q=${selectedClockOutDetails.coordinates}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline"
                                >
                                  <Icon name="MapPin" size={IconSizes.xs} />
                                  View GPS Location
                                </a>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Edit clock times — HR only */}
                  {canEditTime && !isEditingTime && (
                    <div className="pt-2 border-t">
                      <Button
                        variant="outline"
                        onClick={() => setIsEditingTime(true)}
                        className="w-full"
                      >
                        <Icon name="PencilSimple" size={IconSizes.sm} className="mr-2" />
                        Edit Clock Times (HR only)
                      </Button>
                    </div>
                  )}

                  {isEditingTime && canEditTime && (
                    <div className="pt-2 border-t space-y-2">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsEditingTime(false);
                            // Reset to original values
                            if (selectedEntry) {
                              const clockIn = new Date(selectedEntry.clock_in_time);
                              const clockOut = selectedEntry.clock_out_time
                                ? new Date(selectedEntry.clock_out_time)
                                : new Date(clockIn.getTime() + 8 * 60 * 60 * 1000);
                              const formatForInput = (date: Date) => {
                                const year = date.getFullYear();
                                const month = String(date.getMonth() + 1).padStart(2, "0");
                                const day = String(date.getDate()).padStart(2, "0");
                                const hours = String(date.getHours()).padStart(2, "0");
                                const minutes = String(date.getMinutes()).padStart(2, "0");
                                return `${year}-${month}-${day}T${hours}:${minutes}`;
                              };
                              setEditedClockIn(formatForInput(clockIn));
                              setEditedClockOut(formatForInput(clockOut));
                            }
                          }}
                          disabled={savingTimeEdit}
                        >
                          Cancel Edit
                        </Button>
                        <Button
                          onClick={handleSaveTimeEdit}
                          disabled={savingTimeEdit}
                          className="flex-1"
                        >
                          {savingTimeEdit ? (
                            <>
                              <Icon
                                name="ArrowsClockwise"
                                size={IconSizes.sm}
                                className="animate-spin mr-2"
                              />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Icon name="Check" size={IconSizes.sm} className="mr-2" />
                              Save Time Changes
                            </>
                          )}
                        </Button>
                      </div>
                      <Caption className="text-muted-foreground">
                        This will update the clock in/out times and mark the entry as manually edited.
                      </Caption>
                    </div>
                  )}

                  {/* Hours Breakdown */}
                  <div className="grid grid-cols-3 gap-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">
                        Total
                      </div>
                      <div className="text-lg font-bold">
                        {selectedEntry.clock_out_time
                          ? `${calculateBusinessRegularHours(
                            selectedEntry.clock_in_time,
                            selectedEntry.clock_out_time
                          ).toFixed(2)}h`
                          : "-"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">
                        Regular
                      </div>
                      <div className="text-lg font-bold">
                        {selectedEntry.clock_out_time
                          ? `${calculateBusinessRegularHours(
                            selectedEntry.clock_in_time,
                            selectedEntry.clock_out_time
                          ).toFixed(2)}h`
                          : "-"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">
                        Night Diff
                      </div>
                      <div className="text-lg font-bold text-foreground">
                        {selectedEntry.total_night_diff_hours?.toFixed(2)}h
                      </div>
                    </div>
                  </div>

                  {/* Employee Notes */}
                  {selectedEntry.employee_notes && (
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">
                        Employee Notes
                      </div>
                      <div className="p-3 bg-muted rounded border">
                        {selectedEntry.employee_notes}
                      </div>
                    </div>
                  )}

                  {/* HR Notes */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      HR Notes (Optional)
                    </label>
                    <textarea
                      value={hrNotes}
                      onChange={(e) => setHrNotes(e.target.value)}
                      placeholder="Add any notes or reasons for rejection..."
                      className="w-full p-3 border rounded-md resize-none"
                      rows={3}
                    />
                  </div>
                </div>

                <DialogFooter className="pt-4">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSelectedEntry(null);
                      setHrNotes("");
                    }}
                  >
                    Cancel
                  </Button>
                  {isHR && (
                    <Button
                      variant="destructive"
                      onClick={() =>
                        selectedEntry && handleDelete(selectedEntry.id)
                      }
                    >
                      <Icon name="Trash" size={IconSizes.sm} />
                      Delete
                    </Button>
                  )}
                  <Button
                    onClick={() => {
                      setSelectedEntry(null);
                      setHrNotes("");
                    }}
                  >
                    Close
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Add Time Entry Dialog */}
        <Dialog
          open={showAddEntryDialog}
          onOpenChange={(open) => {
            if (!open) {
              setShowAddEntryDialog(false);
              setNewEntryEmployee("");
              setNewEntryClockIn("");
              setNewEntryClockOut("");
              setNewEntryNotes("");
            }
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Time Entry</DialogTitle>
              <DialogDescription>
                {isAdmin
                  ? "Manually create a time entry for any employee. This entry will be marked as manually created."
                  : "Manually create a time entry for a driver. This entry will be marked as manually created."
                }
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              {/* Employee Selection */}
              <div>
                <Label htmlFor="new-entry-employee">Employee *</Label>
                <Select
                  value={newEntryEmployee}
                  onValueChange={setNewEntryEmployee}
                >
                  <SelectTrigger id="new-entry-employee" className="w-full mt-1">
                    <SelectValue placeholder={isAdmin ? "Select an employee" : "Select a driver"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(isAdmin ? employees : driversEmployees).length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        {isAdmin
                          ? "No employees found."
                          : "No drivers found. Please ensure drivers are assigned to the DRIVERS group."
                        }
                      </div>
                    ) : (
                      (isAdmin ? employees : driversEmployees).map((employee) => {
                        const nameParts = employee.full_name?.trim().split(/\s+/) || [];
                        const lastName = employee.last_name || (nameParts.length > 0 ? nameParts[nameParts.length - 1] : "");
                        const firstName = employee.first_name || (nameParts.length > 0 ? nameParts[0] : "");
                        const middleParts = nameParts.length > 2 ? nameParts.slice(1, -1) : [];
                        const displayName = lastName && firstName
                          ? `${lastName.toUpperCase()}, ${firstName.toUpperCase()}${middleParts.length > 0 ? " " + middleParts.join(" ").toUpperCase() : ""}`
                          : employee.full_name || "";
                        return (
                          <SelectItem key={employee.id} value={employee.id}>
                            {displayName} ({employee.employee_id})
                          </SelectItem>
                        );
                      })
                    )}
                  </SelectContent>
                </Select>
                <Caption className="text-muted-foreground mt-1">
                  {isAdmin
                    ? "All employees are shown in this list"
                    : "Only drivers are shown in this list"
                  }
                </Caption>
              </div>

              {/* Clock In Time */}
              <div>
                <Label htmlFor="new-entry-clock-in">Clock In Time *</Label>
                <Input
                  id="new-entry-clock-in"
                  type="datetime-local"
                  value={newEntryClockIn}
                  onChange={(e) => setNewEntryClockIn(e.target.value)}
                  className="w-full mt-1"
                />
              </div>

              {/* Clock Out Time */}
              <div>
                <Label htmlFor="new-entry-clock-out">Clock Out Time *</Label>
                <Input
                  id="new-entry-clock-out"
                  type="datetime-local"
                  value={newEntryClockOut}
                  onChange={(e) => setNewEntryClockOut(e.target.value)}
                  className="w-full mt-1"
                />
              </div>

              {/* Notes */}
              <div>
                <Label htmlFor="new-entry-notes">Notes (Optional)</Label>
                <Textarea
                  id="new-entry-notes"
                  value={newEntryNotes}
                  onChange={(e) => setNewEntryNotes(e.target.value)}
                  placeholder="Add any notes about this time entry..."
                  className="w-full mt-1"
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowAddEntryDialog(false);
                  setNewEntryEmployee("");
                  setNewEntryClockIn("");
                  setNewEntryClockOut("");
                  setNewEntryNotes("");
                }}
                disabled={savingNewEntry}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateTimeEntry}
                disabled={savingNewEntry || !newEntryEmployee || !newEntryClockIn || !newEntryClockOut}
              >
                {savingNewEntry ? (
                  <>
                    <Icon
                      name="ArrowsClockwise"
                      size={IconSizes.sm}
                      className="animate-spin mr-2"
                    />
                    Creating...
                  </>
                ) : (
                  <>
                    <Icon name="Check" size={IconSizes.sm} className="mr-2" />
                    Create Time Entry
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Add Time Entries Dialog */}
        <Dialog
          open={showBulkEntryDialog}
          onOpenChange={(open) => {
            if (!open) {
              setShowBulkEntryDialog(false);
              setBulkEntryEmployee("");
              setBulkEntries([{ date: "", timeIn: "", timeOut: "", notes: "" }]);
            }
          }}
        >
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Bulk Add Time Entries</DialogTitle>
              <DialogDescription>
                Add multiple time entries for one employee at once. Each row represents one day's entry.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              {/* Employee Selection */}
              <div>
                <Label htmlFor="bulk-entry-employee">Employee *</Label>
                <Select
                  value={bulkEntryEmployee}
                  onValueChange={setBulkEntryEmployee}
                >
                  <SelectTrigger id="bulk-entry-employee" className="w-full mt-1">
                    <SelectValue placeholder="Select an employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        No employees found.
                      </div>
                    ) : (
                      employees.map((employee) => {
                        const nameParts = employee.full_name?.trim().split(/\s+/) || [];
                        const lastName = employee.last_name || (nameParts.length > 0 ? nameParts[nameParts.length - 1] : "");
                        const firstName = employee.first_name || (nameParts.length > 0 ? nameParts[0] : "");
                        const middleParts = nameParts.length > 2 ? nameParts.slice(1, -1) : [];
                        const displayName = lastName && firstName
                          ? `${lastName.toUpperCase()}, ${firstName.toUpperCase()}${middleParts.length > 0 ? " " + middleParts.join(" ").toUpperCase() : ""}`
                          : employee.full_name || "";
                        return (
                          <SelectItem key={employee.id} value={employee.id}>
                            {displayName} ({employee.employee_id})
                          </SelectItem>
                        );
                      })
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Bulk Entries Table */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label>Time Entries</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addBulkEntryRow}
                  >
                    <Icon name="Plus" size={IconSizes.sm} className="mr-1" />
                    Add Row
                  </Button>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="p-2 text-left">Date</th>
                          <th className="p-2 text-left">Time In</th>
                          <th className="p-2 text-left">Time Out</th>
                          <th className="p-2 text-left">Notes (Optional)</th>
                          <th className="p-2 text-left w-20">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkEntries.map((entry, index) => (
                          <tr key={index} className="border-t">
                            <td className="p-2">
                              <Input
                                type="date"
                                value={entry.date}
                                onChange={(e) => updateBulkEntry(index, "date", e.target.value)}
                                className="w-full"
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                type="time"
                                value={entry.timeIn}
                                onChange={(e) => updateBulkEntry(index, "timeIn", e.target.value)}
                                className="w-full"
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                type="time"
                                value={entry.timeOut}
                                onChange={(e) => updateBulkEntry(index, "timeOut", e.target.value)}
                                className="w-full"
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                type="text"
                                value={entry.notes}
                                onChange={(e) => updateBulkEntry(index, "notes", e.target.value)}
                                placeholder="Optional notes"
                                className="w-full"
                              />
                            </td>
                            <td className="p-2">
                              {bulkEntries.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeBulkEntryRow(index)}
                                >
                                  <Icon name="Trash" size={IconSizes.sm} />
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <Caption className="text-muted-foreground mt-1">
                  Add multiple rows to create entries for different dates. Empty rows will be skipped.
                </Caption>
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowBulkEntryDialog(false);
                  setBulkEntryEmployee("");
                  setBulkEntries([{ date: "", timeIn: "", timeOut: "", notes: "" }]);
                }}
                disabled={savingBulkEntries}
              >
                Cancel
              </Button>
              <Button
                onClick={handleBulkCreateTimeEntries}
                disabled={savingBulkEntries || !bulkEntryEmployee || bulkEntries.every(e => !e.date || !e.timeIn || !e.timeOut)}
              >
                {savingBulkEntries ? (
                  <>
                    <Icon
                      name="ArrowsClockwise"
                      size={IconSizes.sm}
                      className="animate-spin mr-2"
                    />
                    Creating...
                  </>
                ) : (
                  <>
                    <Icon name="Check" size={IconSizes.sm} className="mr-2" />
                    Create {bulkEntries.filter(e => e.date && e.timeIn && e.timeOut).length} Entries
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </VStack>
    </DashboardLayout>
  );
}