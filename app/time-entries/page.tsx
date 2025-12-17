"use client";

import { useState, useEffect } from "react";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from "date-fns";
import { OfficeLocation, resolveLocationDetails } from "@/lib/location";
import { EmployeeAvatar } from "@/components/EmployeeAvatar";

interface TimeEntry {
  id: string;
  employee_id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  total_hours: number | null;
  regular_hours: number | null;
  overtime_hours: number | null;
  night_diff_hours: number | null;
  status:
    | "clocked_in"
    | "clocked_out"
    | "approved"
    | "rejected"
    | "auto_approved"
    | "pending";
  employee_notes: string | null;
  hr_notes: string | null;
  clock_in_location: string | null;
  clock_out_location: string | null;
  is_manual_entry: boolean;
  employees: {
    employee_id: string;
    full_name: string;
    profile_picture_url?: string | null;
  };
}

interface HolidayEntry {
  date: string;
  name: string;
  type: "regular" | "non-working";
}

export default function TimeEntriesPage() {
  const supabase = createClient();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [employees, setEmployees] = useState<
    { id: string; employee_id: string; full_name: string }[]
  >([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedEntry, setSelectedEntry] = useState<TimeEntry | null>(null);
  const [hrNotes, setHrNotes] = useState("");
  const [officeLocations, setOfficeLocations] = useState<OfficeLocation[]>([]);
  const [holidays, setHolidays] = useState<HolidayEntry[]>([]);

  const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(selectedWeek, { weekStartsOn: 1 }); // Sunday

  useEffect(() => {
    fetchTimeEntries();
  }, [selectedWeek, statusFilter, selectedEmployee]);

  useEffect(() => {
    async function loadEmployees() {
      const { data, error } = await supabase
        .from("employees")
        .select("id, employee_id, full_name")
        .order("full_name", { ascending: true });

      if (error) {
        console.error("Failed to load employees", error);
        return;
      }

      setEmployees(data || []);
    }

    loadEmployees();
  }, [supabase]);

  useEffect(() => {
    const fetchLocations = async () => {
      const { data, error } = await supabase
        .from("office_locations")
        .select("id, name, address, latitude, longitude, radius_meters");

      if (error) {
        console.error("Error loading locations:", error);
        return;
      }

      setOfficeLocations((data || []) as OfficeLocation[]);
    };

    fetchLocations();
  }, [supabase]);

  const getHolidayTag = (clockInTime: string) => {
    const dateString = format(new Date(clockInTime), "yyyy-MM-dd");
    const holiday = holidays.find((h) => h.date === dateString);
    if (!holiday) return "";
    return holiday.type === "regular" ? "Regular Holiday" : "Special Holiday";
  };

  async function fetchTimeEntries() {
    setLoading(true);

    try {
      // Ensure weekEnd includes the full day
      const weekEndInclusive = new Date(weekEnd);
      weekEndInclusive.setHours(23, 59, 59, 999);

      // Debug logging
      console.log("Fetching time entries for range:", {
        weekStart: weekStart.toISOString(),
        weekEnd: weekEndInclusive.toISOString(),
        statusFilter,
        selectedEmployee,
      });

      // Build query step by step to avoid issues
      // Use single-line format to avoid any whitespace issues with Supabase PostgREST
      let query = supabase
        .from("time_clock_entries")
        .select("*,employees(employee_id,full_name,profile_picture_url)");

      // Apply date filters
      query = query
        .gte("clock_in_time", weekStart.toISOString())
        .lte("clock_in_time", weekEndInclusive.toISOString());

      // Apply status filter if needed
      if (statusFilter && statusFilter !== "all") {
        // Validate status filter value
        const validStatuses = [
          "clocked_in",
          "clocked_out",
          "approved",
          "rejected",
          "auto_approved",
          "pending",
        ];
        if (validStatuses.includes(statusFilter)) {
          query = query.eq("status", statusFilter);
        } else {
          console.warn("Invalid status filter:", statusFilter);
        }
      }

      // Apply employee filter if needed
      if (selectedEmployee && selectedEmployee !== "all") {
        // Validate that selectedEmployee is a valid UUID format
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(selectedEmployee)) {
          query = query.eq("employee_id", selectedEmployee);
        } else {
          console.warn("Invalid employee ID format:", selectedEmployee);
        }
      }

      // Apply ordering and limit
      query = query.order("clock_in_time", { ascending: false }).limit(1000);

      // Fetch entries and holidays in parallel
      const [entriesResult, holidaysResult] = await Promise.all([
        query,
        supabase
          .from("holidays")
          .select("holiday_date, holiday_name, holiday_type")
          .eq("is_active", true)
          .gte("holiday_date", format(weekStart, "yyyy-MM-dd"))
          .lte("holiday_date", format(weekEnd, "yyyy-MM-dd")),
      ]);

      const { data, error } = entriesResult;
      const { data: holidayData, error: holidayError } = holidaysResult;

      if (error) {
        console.error("Error fetching time entries:", error);
        console.error("Error details:", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        toast.error(
          `Failed to load time entries: ${
            error.message || error.code || "Unknown error"
          }`
        );
        setEntries([]); // Clear entries on error to prevent stale data
        setLoading(false);
        return;
      }

      console.log("Fetched entries:", data?.length || 0, "entries");

      if (holidayError) {
        console.warn("Error loading holidays for period:", holidayError);
        // Don't fail the whole request if holidays fail - this is non-critical
      }

      const formattedHolidays: HolidayEntry[] =
        holidayData?.map((holiday) => ({
          date: holiday.holiday_date,
          name: holiday.holiday_name,
          type: holiday.holiday_type as "regular" | "non-working",
        })) || [];

      // Transform data to ensure employees is a single object, not an array
      const transformedEntries: TimeEntry[] =
        data?.map((entry: any) => {
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

          return {
            ...entry,
            employees: employeeData,
          };
        }) || [];

      console.log("Transformed entries:", transformedEntries.length);

      setHolidays(formattedHolidays);
      setEntries(transformedEntries);

      // Log if no entries found to help debug
      if (transformedEntries.length === 0) {
        console.warn("No time entries found for the selected period:", {
          weekStart: weekStart.toISOString(),
          weekEnd: weekEndInclusive.toISOString(),
          statusFilter,
          selectedEmployee,
        });

        // Test query: Check if there are ANY entries in the database (for debugging)
        const { data: testData, error: testError } = await supabase
          .from("time_clock_entries")
          .select("id, clock_in_time, employee_id")
          .limit(5);

        if (!testError && testData && testData.length > 0) {
          console.log(
            "Found entries in database (sample):",
            testData.map((e) => ({
              id: e.id,
              clock_in_time: e.clock_in_time,
              employee_id: e.employee_id,
            }))
          );
          console.log("But none match the filter criteria.");
        } else if (!testError) {
          console.log("No entries found in database at all.");
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

  async function handleApprove(entryId: string) {
    const { error } = await supabase
      .from("time_clock_entries")
      .update({
        status: "approved",
        hr_notes: hrNotes || null,
      })
      .eq("id", entryId);

    if (error) {
      console.error("Error approving entry:", error);
      toast.error("Failed to approve entry");
      return;
    }

    toast.success("Time entry approved successfully!", {
      description: "Entry has been verified and approved",
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

    const { error } = await supabase
      .from("time_clock_entries")
      .update({
        status: "rejected",
        hr_notes: hrNotes,
      })
      .eq("id", entryId);

    if (error) {
      console.error("Error rejecting entry:", error);
      toast.error("Failed to reject entry");
      return;
    }

    toast.success("Time entry rejected", {
      description: "The entry has been declined",
    });
    fetchTimeEntries();
    setSelectedEntry(null);
    setHrNotes("");
  }

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
        const holidayTag = getHolidayTag(entry.clock_in_time);
        return [
          entry.employees.employee_id,
          entry.employees.full_name,
          format(new Date(entry.clock_in_time), "yyyy-MM-dd HH:mm:ss"),
          entry.clock_out_time
            ? format(new Date(entry.clock_out_time), "yyyy-MM-dd HH:mm:ss")
            : "Not clocked out",
          holidayTag || "Regular Day",
          entry.total_hours || 0,
          entry.regular_hours || 0,
          entry.night_diff_hours || 0,
          entry.status,
          entry.employee_notes || "",
        ].join(",");
      }),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `time-entries-${format(weekStart, "yyyy-MM-dd")}.csv`;
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
          className="rounded-full px-2 py-1 text-[11px] font-semibold bg-orange-100 text-orange-800"
        >
          INCOMPLETE
        </Badge>
      );
    }

    const tones: Record<string, string> = {
      clocked_in: "bg-emerald-100 text-emerald-800",
      clocked_out: "bg-amber-100 text-amber-800",
      approved: "bg-green-100 text-green-800",
      auto_approved: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
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
    pending: entries.filter((e) => e.status === "clocked_out").length,
    approved: entries.filter(
      (e) => e.status === "approved" || e.status === "auto_approved"
    ).length,
    totalHours: entries.reduce((sum, e) => sum + (e.total_hours || 0), 0),
  };

  const selectedClockInDetails = selectedEntry
    ? resolveLocationDetails(selectedEntry.clock_in_location, officeLocations)
    : null;
  const selectedClockOutDetails = selectedEntry
    ? resolveLocationDetails(selectedEntry.clock_out_location, officeLocations)
    : null;

  return (
    <DashboardLayout>
      <VStack gap="8" className="w-full">
        {/* Header */}
        <HStack
          justify="between"
          align="start"
          className="flex-col sm:flex-row gap-4"
        >
          <VStack gap="2" align="start">
            <H1>Time Entries</H1>
            <BodySmall>
              Review and approve employee time clock entries
            </BodySmall>
          </VStack>
          <Button
            onClick={exportToCSV}
            variant="secondary"
            className="w-full sm:w-auto"
          >
            <Icon name="ArrowsClockwise" size={IconSizes.sm} />
            Export CSV
          </Button>
        </HStack>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full auto-rows-fr">
          <Card className="h-full w-full">
            <CardContent className="p-6 h-full flex flex-col w-full">
              <VStack gap="2" align="start" className="flex-1 w-full">
                <BodySmall>Total Entries</BodySmall>
                <div className="text-2xl font-bold leading-tight text-foreground">
                  {stats.total}
                </div>
              </VStack>
            </CardContent>
          </Card>
          <Card className="h-full w-full">
            <CardContent className="p-6 h-full flex flex-col w-full">
              <VStack gap="2" align="start" className="flex-1 w-full">
                <BodySmall>Pending Review</BodySmall>
                <div className="text-2xl font-bold leading-tight text-yellow-600">
                  {stats.pending}
                </div>
              </VStack>
            </CardContent>
          </Card>
          <Card className="h-full w-full">
            <CardContent className="p-6 h-full flex flex-col w-full">
              <VStack gap="2" align="start" className="flex-1 w-full">
                <BodySmall>Approved</BodySmall>
                <div className="text-2xl font-bold leading-tight text-emerald-600">
                  {stats.approved}
                </div>
              </VStack>
            </CardContent>
          </Card>
          <Card className="h-full w-full">
            <CardContent className="p-6 h-full flex flex-col w-full">
              <VStack gap="2" align="start" className="flex-1 w-full">
                <BodySmall>Total Hours</BodySmall>
                <div className="text-2xl font-bold leading-tight text-foreground">
                  {stats.totalHours.toFixed(1)}h
                </div>
              </VStack>
            </CardContent>
          </Card>
        </div>

        {/* Info Banner */}
        {stats.pending > 0 && (
          <Card className="bg-emerald-50 border-emerald-200">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <Icon
                  name="WarningCircle"
                  size={IconSizes.sm}
                  className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0"
                />
                <div className="text-sm text-emerald-900 leading-relaxed">
                  <p className="font-semibold mb-2">Auto-Sync to Timesheet</p>
                  <p>
                    Approved entries automatically populate the timesheet.
                    Review and approve{" "}
                    <strong>
                      {stats.pending} pending{" "}
                      {stats.pending === 1 ? "entry" : "entries"}
                    </strong>{" "}
                    to make them available for payroll processing.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card className="w-full">
          <CardContent className="p-4 sm:p-6 w-full">
            <div className="flex flex-col gap-4 md:flex-row md:items-center w-full">
              {/* Week Navigation */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-2 items-center sm:items-center flex-shrink-0 w-full sm:w-auto">
                <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-start">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSelectedWeek(subWeeks(selectedWeek, 1))}
                    className="flex-shrink-0"
                  >
                    <Icon name="CaretLeft" size={IconSizes.sm} />
                  </Button>
                  <Caption className="min-w-[180px] sm:min-w-[200px] text-center font-medium text-xs sm:text-sm">
                    {format(weekStart, "MMM d")} -{" "}
                    {format(weekEnd, "MMM d, yyyy")}
                  </Caption>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSelectedWeek(addWeeks(selectedWeek, 1))}
                    className="flex-shrink-0"
                  >
                    <Icon name="CaretRight" size={IconSizes.sm} />
                  </Button>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedWeek(new Date())}
                  className="w-full sm:w-auto"
                >
                  Today
                </Button>
              </div>

              {/* Spacer to push filters to the right (hidden on mobile) */}
              <div className="hidden md:block flex-1 min-w-0" />

              {/* Filters Section */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto">
                {/* Status Filter */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Icon
                    name="MagnifyingGlass"
                    size={IconSizes.sm}
                    className="text-muted-foreground flex-shrink-0 hidden sm:block"
                  />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="flex h-10 w-full sm:w-[160px] lg:w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="all">All Status</option>
                    <option value="clocked_in">Clocked In</option>
                    <option value="clocked_out">Pending Review</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                {/* Employee Filter */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Icon
                    name="MagnifyingGlass"
                    size={IconSizes.sm}
                    className="text-muted-foreground flex-shrink-0 hidden sm:block"
                  />
                  <select
                    value={selectedEmployee}
                    onChange={(e) => setSelectedEmployee(e.target.value)}
                    className="flex h-10 w-full sm:w-[200px] lg:w-[240px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="all">All Employees</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.full_name} ({employee.employee_id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Entries List */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
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
                  ) : entries.length === 0 ? (
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
                    entries.map((entry) => {
                      const clockInDetails = resolveLocationDetails(
                        entry.clock_in_location,
                        officeLocations
                      );
                      const clockOutDetails = resolveLocationDetails(
                        entry.clock_out_location,
                        officeLocations
                      );
                      const holidayTag = getHolidayTag(entry.clock_in_time);

                      return (
                        <TableRow key={entry.id} className="hover:bg-muted/50">
                          <TableCell className="p-2 sm:p-3">
                            <HStack gap="2" align="center" className="min-w-0">
                              <EmployeeAvatar
                                profilePictureUrl={
                                  entry.employees.profile_picture_url
                                }
                                fullName={entry.employees.full_name}
                                size="sm"
                              />
                              <VStack gap="0" align="start" className="min-w-0">
                                <div className="font-medium text-xs sm:text-sm truncate">
                                  {entry.employees.full_name}
                                </div>
                                <Caption className="text-[10px] sm:text-xs truncate">
                                  {entry.employees.employee_id}
                                </Caption>
                              </VStack>
                            </HStack>
                          </TableCell>
                          <TableCell className="p-2 sm:p-3">
                            <div className="text-xs sm:text-sm font-medium">
                              {format(
                                new Date(entry.clock_in_time),
                                "MMM d, h:mm a"
                              )}
                            </div>
                            <div className="text-[10px] sm:text-xs text-muted-foreground">
                              {clockInDetails.name}
                            </div>
                            <div className="text-[10px] sm:text-[11px] text-muted-foreground">
                              {clockInDetails.address}
                            </div>
                            {clockInDetails.coordinates && (
                              <a
                                href={`https://www.google.com/maps?q=${clockInDetails.coordinates}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] text-emerald-600 hover:underline inline-flex items-center gap-1 mt-1"
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
                                  {format(
                                    new Date(entry.clock_out_time),
                                    "MMM d, h:mm a"
                                  )}
                                </div>
                                <div className="text-[10px] sm:text-xs text-muted-foreground">
                                  {clockOutDetails.name}
                                </div>
                                <div className="text-[10px] sm:text-[11px] text-muted-foreground">
                                  {clockOutDetails.address}
                                </div>
                                {clockOutDetails.coordinates && (
                                  <a
                                    href={`https://www.google.com/maps?q=${clockOutDetails.coordinates}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[11px] text-emerald-600 hover:underline inline-flex items-center gap-1 mt-1"
                                  >
                                    <Icon name="MapPin" size={IconSizes.xs} />
                                    View map
                                  </a>
                                )}
                              </>
                            ) : (
                              <div className="space-y-1">
                                <span className="text-xs text-orange-600 font-medium">
                                  No GPS data
                                </span>
                                <div className="text-[10px] text-muted-foreground">
                                  Location was not captured for this entry.
                                </div>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="p-2 sm:p-3 text-left">
                            <div className="text-xs sm:text-sm font-medium">
                              {holidayTag || "Regular Day"}
                            </div>
                            {holidayTag && (
                              <div className="text-[10px] sm:text-xs text-muted-foreground">
                                Logged on holiday
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="p-2 sm:p-3 text-right font-medium">
                            {entry.clock_out_time ? (
                              entry.total_hours?.toFixed(2) || "-"
                            ) : (
                              <span className="text-orange-600">
                                Incomplete
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="p-2 sm:p-3 text-center">
                            {getStatusBadge(entry.status, entry.clock_out_time)}
                          </TableCell>
                          <TableCell className="p-2 sm:p-3">
                            <div className="flex items-center justify-center gap-1">
                              {entry.status === "clocked_out" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setSelectedEntry(entry);
                                      setHrNotes(entry.hr_notes || "");
                                    }}
                                  >
                                    <Icon
                                      name="PencilSimple"
                                      size={IconSizes.sm}
                                    />
                                  </Button>
                                </>
                              )}
                              {(entry.status === "approved" ||
                                entry.status === "auto_approved") && (
                                <span className="text-xs text-green-600">
                                  ✓ Approved
                                </span>
                              )}
                              {entry.status === "rejected" && (
                                <span className="text-xs text-red-600">
                                  ✗ Rejected
                                </span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
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
          onOpenChange={(open) => !open && setSelectedEntry(null)}
        >
          <DialogContent className="max-w-2xl">
            {selectedEntry && (
              <>
                <DialogHeader>
                  <DialogTitle>Review Time Entry</DialogTitle>
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
                            {selectedClockInDetails.address}
                          </div>
                          {selectedClockInDetails.coordinates && (
                            <a
                              href={`https://www.google.com/maps?q=${selectedClockInDetails.coordinates}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-emerald-600 hover:underline flex items-center gap-1 mt-1"
                            >
                              <Icon name="MapPin" size={IconSizes.xs} />
                              View GPS Location
                            </a>
                          )}
                        </>
                      )}
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">
                        Clock Out
                      </div>
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
                            {selectedClockOutDetails.address}
                          </div>
                          {selectedClockOutDetails.coordinates && (
                            <a
                              href={`https://www.google.com/maps?q=${selectedClockOutDetails.coordinates}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-emerald-600 hover:underline flex items-center gap-1 mt-1"
                            >
                              <Icon name="MapPin" size={IconSizes.xs} />
                              View GPS Location
                            </a>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Hours Breakdown */}
                  <div className="grid grid-cols-3 gap-4 p-4 bg-emerald-50 rounded-lg">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">
                        Total
                      </div>
                      <div className="text-lg font-bold">
                        {selectedEntry.total_hours?.toFixed(2)}h
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">
                        Regular
                      </div>
                      <div className="text-lg font-bold">
                        {selectedEntry.regular_hours?.toFixed(2)}h
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">
                        Night Diff
                      </div>
                      <div className="text-lg font-bold text-purple-600">
                        {selectedEntry.night_diff_hours?.toFixed(2)}h
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
                  <Button
                    variant="destructive"
                    onClick={() =>
                      selectedEntry && handleReject(selectedEntry.id)
                    }
                  >
                    <Icon name="X" size={IconSizes.sm} />
                    Reject
                  </Button>
                  <Button
                    onClick={() =>
                      selectedEntry && handleApprove(selectedEntry.id)
                    }
                  >
                    <Icon name="Check" size={IconSizes.sm} />
                    Approve
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </VStack>
    </DashboardLayout>
  );
}
