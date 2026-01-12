"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, startOfWeek, format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSection } from "@/components/ui/card-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { H1, H3, BodySmall, Caption } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useEmployeeSession } from "@/contexts/EmployeeSessionContext";
import { toast } from "sonner";

type DayEntry = {
  schedule_date: string;
  start_time: string;
  end_time: string;
  day_off: boolean;
  tasks: string;
};

export default function SchedulePage() {
  const supabase = createClient();
  const { employee } = useEmployeeSession();
  const router = useRouter();
  // Default to next week (Mon) but allow selecting any week (snaps to Monday)
  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeek(addDays(new Date(), 7), { weekStartsOn: 1 })
  );
  const [days, setDays] = useState<DayEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [employeeType, setEmployeeType] = useState<"office-based" | "client-based" | null>(null);
  const [employeePosition, setEmployeePosition] = useState<string | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const weekMonday = startOfWeek(weekStart, { weekStartsOn: 1 });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Locked if the selected week is already past Monday (today > Monday of that week)
  const isLocked = today.getTime() > weekMonday.getTime();

  // Check if employee is client-based AND Account Supervisor
  const isClientBasedAccountSupervisor =
    employeeType === "client-based" &&
    (employeePosition?.toUpperCase().includes("ACCOUNT SUPERVISOR") ?? false);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
  }, [weekStart]);

  // Fetch employee type and position and check access
  useEffect(() => {
    const fetchEmployeeInfo = async () => {
      setCheckingAccess(true);
      const { data, error } = await supabase
        .from("employees")
        .select("employee_type, position")
        .eq("id", employee.id)
        .single<{ employee_type: "office-based" | "client-based" | null; position: string | null }>();

      if (!error && data) {
        setEmployeeType(data.employee_type);
        setEmployeePosition(data.position);

        // Check if employee is client-based AND Account Supervisor
        const isClientBasedAccountSupervisor =
          data.employee_type === "client-based" &&
          (data.position?.toUpperCase().includes("ACCOUNT SUPERVISOR") ?? false);

        // Redirect if not an Account Supervisor
        if (!isClientBasedAccountSupervisor) {
          toast.error("Schedule access is restricted to Account Supervisors only.");
          router.push("/employee-portal/bundy");
          return;
        }
      } else {
        // If error fetching, redirect to be safe
        toast.error("Unable to verify access. Redirecting...");
        router.push("/employee-portal/bundy");
        return;
      }

      setCheckingAccess(false);
    };
    fetchEmployeeInfo();
  }, [employee.id, supabase, router]);

  useEffect(() => {
    const loadWeek = async () => {
      setLoading(true);
      const monday = startOfWeek(weekStart, { weekStartsOn: 1 });
      const { data, error } = await supabase.rpc("get_my_week_schedule", {
        p_employee_id: employee.id,
        p_week_start: format(monday, "yyyy-MM-dd"),
      } as any);
      if (error) {
        console.error("Failed to load week schedule", error);
      } else {
        const scheduleData = data as Array<{
          schedule_date: string;
          start_time: string | null;
          end_time: string | null;
          day_off: boolean;
          tasks?: string | null;
        }> | null;

        setDays(
          weekDays.map((d) => {
            const iso = format(d, "yyyy-MM-dd");
            const existing = (scheduleData || []).find(
              (row: any) => row.schedule_date === iso
            );
            return {
              schedule_date: iso,
              start_time: existing?.start_time || "",
              end_time: existing?.end_time || "",
              day_off: existing?.day_off || false,
              tasks: existing?.tasks || "",
            };
          })
        );
      }
      setLoading(false);
    };
    loadWeek();
  }, [employee.id, supabase, weekDays, weekStart]);

  // Helper function to validate time range for a day
  const isValidTimeRange = (day: DayEntry): boolean => {
    if (day.day_off || !day.start_time || !day.end_time) {
      return true; // Valid if day off or times not set
    }
    return day.start_time < day.end_time;
  };

  const handleChange = (
    idx: number,
    field: keyof DayEntry,
    value: string | boolean
  ) => {
    setDays((prev) => {
      const next = [...prev];
      // If switching to day_off, validate for Account Supervisors
      if (field === "day_off") {
        const isOff = value === true || value === "true";

        // For client-based Account Supervisors: Restrict rest days to Mon-Wed only
        if (isClientBasedAccountSupervisor && isOff) {
          const dayDate = new Date(next[idx].schedule_date);
          const dayOfWeek = dayDate.getDay(); // 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday

          // Only allow Monday (1), Tuesday (2), Wednesday (3)
          if (dayOfWeek !== 1 && dayOfWeek !== 2 && dayOfWeek !== 3) {
            const dayName = format(dayDate, "EEEE");
            toast.error(`Account Supervisors can only schedule rest days on Monday, Tuesday, or Wednesday. ${dayName} is not allowed.`);
            return prev; // Don't update if invalid
          }
        }

        next[idx] = {
          ...next[idx],
          day_off: isOff,
          start_time: isOff ? "" : next[idx].start_time,
          end_time: isOff ? "" : next[idx].end_time,
        };
      } else {
        next[idx] = { ...next[idx], [field]: value as string };
      }
      return next;
    });
  };

  const handleAutofill = () => {
    if (isLocked) {
      toast.error("This week is locked. Edits are only allowed until Monday.");
      return;
    }
    setDays(() =>
      weekDays.map((d) => ({
        schedule_date: format(d, "yyyy-MM-dd"),
        start_time: "08:00",
        end_time: "17:00",
        day_off: false,
        tasks: "",
      }))
    );
  };

  const handleSaveWeek = async () => {
    if (isLocked) {
      toast.error("This week is locked. Edits are only allowed until Monday.");
      return;
    }

    // For client-based Account Supervisors: Validate rest days are only Mon-Wed
    if (isClientBasedAccountSupervisor) {
      for (const day of days) {
        if (day.day_off) {
          const dayDate = new Date(day.schedule_date);
          const dayOfWeek = dayDate.getDay(); // 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday

          if (dayOfWeek !== 1 && dayOfWeek !== 2 && dayOfWeek !== 3) {
            const dayName = format(dayDate, "EEEE, MMM d");
            toast.error(
              `Account Supervisors can only schedule rest days on Monday, Tuesday, or Wednesday. ${dayName} is not allowed.`,
              { duration: 6000 }
            );
            return;
          }
        }
      }
    }

    // Client-side validation: check for invalid time ranges
    for (const day of days) {
      if (!day.day_off && day.start_time && day.end_time) {
        // Convert time strings to comparable format
        const startTime = day.start_time;
        const endTime = day.end_time;

        // Compare times (HH:MM format)
        if (startTime >= endTime) {
          const dayName = format(new Date(day.schedule_date), "EEEE, MMM d");
          toast.error(
            `Invalid time range on ${dayName}: The end time must be later than the start time.`,
            { duration: 6000 }
          );
          return;
        }
      }
    }

    setLoading(true);
    setShowSaveConfirm(false);
    // Include all days: working days with times, and day off days
    // This allows saving partial schedules (only some days filled)
    const entries = days
      .filter((d) => d.schedule_date)
      .map((d) => ({
        schedule_date: d.schedule_date,
        start_time: d.day_off ? null : d.start_time || null,
        end_time: d.day_off ? null : d.end_time || null,
        tasks: d.day_off ? null : d.tasks || null,
        day_off: d.day_off || false,
      }));

    const weekStartIso = format(
      startOfWeek(weekStart, { weekStartsOn: 1 }),
      "yyyy-MM-dd"
    );

    try {
      console.log("Saving schedule:", {
        employeeId: employee.id,
        weekStartIso,
        entries,
      });

      // Use replace_week_schedule RPC function
      const { data, error } = await supabase.rpc("replace_week_schedule", {
        p_employee_id: employee.id,
        p_week_start: weekStartIso,
        p_entries: entries.length > 0 ? entries : null,
      } as any);

      console.log("RPC response:", { data, error });

      // If RPC succeeds
      if (!error) {
        console.log("RPC succeeded, showing success toast");
        toast.success("Schedule has been saved successfully!", {
          description: `Week starting ${format(
            startOfWeek(weekStart, { weekStartsOn: 1 }),
            "MMMM d, yyyy"
          )}`,
          duration: 5000,
        });

        // Reload the schedule to show updated data
        const monday = startOfWeek(weekStart, { weekStartsOn: 1 });
        const { data: updatedData, error: reloadError } = await supabase.rpc(
          "get_my_week_schedule",
          {
            p_employee_id: employee.id,
            p_week_start: format(monday, "yyyy-MM-dd"),
          } as any
        );
        if (!reloadError && updatedData) {
          const reloadScheduleData = updatedData as Array<{
            schedule_date: string;
            start_time: string | null;
            end_time: string | null;
            day_off: boolean;
            tasks?: string | null;
          }> | null;

          setDays(
            weekDays.map((d) => {
              const iso = format(d, "yyyy-MM-dd");
              const existing = (reloadScheduleData || []).find(
                (row: any) => row.schedule_date === iso
              );
              return {
                schedule_date: iso,
                start_time: existing?.start_time || "",
                end_time: existing?.end_time || "",
                day_off: existing?.day_off || false,
                tasks: existing?.tasks || "",
              };
            })
          );
        }
        setLoading(false);
        return;
      }

      // If RPC fails, fallback to direct table writes
      console.warn("RPC failed, using fallback:", error);
      const weekEndIso = format(
        addDays(new Date(weekStartIso), 6),
        "yyyy-MM-dd"
      );

      const { error: delErr } = await supabase
        .from("employee_week_schedules")
        .delete()
        .eq("employee_id", employee.id)
        .gte("schedule_date", weekStartIso)
        .lte("schedule_date", weekEndIso);

      if (delErr) throw delErr;

      if (entries.length > 0) {
        const { error: insErr } = await (
          supabase.from("employee_week_schedules") as any
        ).insert(
          entries.map((e) => ({
            employee_id: employee.id,
            week_start: weekStartIso,
            schedule_date: e.schedule_date,
            start_time: e.start_time,
            end_time: e.end_time,
            tasks: e.tasks || null,
            day_off: e.day_off || false,
          }))
        );

        if (insErr) throw insErr;
      }

      console.log("Fallback save succeeded, showing success toast");
      toast.success("Schedule has been saved successfully!", {
        description: `Week starting ${format(
          startOfWeek(weekStart, { weekStartsOn: 1 }),
          "MMMM d, yyyy"
        )}`,
        duration: 5000,
      });

      // Reload the schedule to show updated data
      const monday = startOfWeek(weekStart, { weekStartsOn: 1 });
      const { data: updatedData, error: reloadError } = await supabase.rpc(
        "get_my_week_schedule",
        {
          p_employee_id: employee.id,
          p_week_start: format(monday, "yyyy-MM-dd"),
        } as any
      );
      if (!reloadError && updatedData) {
        const reloadScheduleData = updatedData as Array<{
          schedule_date: string;
          start_time: string | null;
          end_time: string | null;
          day_off: boolean;
          tasks?: string | null;
        }> | null;

        setDays(
          weekDays.map((d) => {
            const iso = format(d, "yyyy-MM-dd");
            const existing = (reloadScheduleData || []).find(
              (row: any) => row.schedule_date === iso
            );
            return {
              schedule_date: iso,
              start_time: existing?.start_time || "",
              end_time: existing?.end_time || "",
              day_off: existing?.day_off || false,
              tasks: existing?.tasks || "",
            };
          })
        );
      }
    } catch (err: any) {
      console.error("Save failed:", err);

      // Check for constraint violation or time validation errors
      const errorMessage = err?.message || "";
      let friendlyMessage = "Failed to save schedule. Please try again.";

      if (
        errorMessage.includes("employee_week_schedules_time_check") ||
        errorMessage.includes("start_time must be before end_time") ||
        errorMessage.includes("end time must be later than the start time") ||
        errorMessage.includes("violates check constraint")
      ) {
        friendlyMessage = "The end time must be later than the start time. Please check your schedule times.";
      } else if (errorMessage) {
        friendlyMessage = errorMessage;
      }

      toast.error(friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClearDay = async (dayIndex: number) => {
    if (isLocked) {
      toast.error("This week is locked. Edits are only allowed until Monday.");
      return;
    }
    const day = days[dayIndex];
    if (!day || !day.schedule_date) return;

    setLoading(true);
    try {
      // Delete from database
      const { error } = await supabase
        .from("employee_week_schedules")
        .delete()
        .eq("employee_id", employee.id)
        .eq("schedule_date", day.schedule_date);

      if (error) throw error;

      // Clear local state for this day
      setDays((prev) => {
        const next = [...prev];
        next[dayIndex] = {
          ...next[dayIndex],
          start_time: "",
          end_time: "",
          day_off: false,
          tasks: "",
        };
        return next;
      });

      toast.success(
        `Schedule cleared for ${format(
          new Date(day.schedule_date),
          "EEEE, MMM d"
        )}`
      );
    } catch (err: any) {
      console.error("Failed to clear day", err);
      toast.error(err?.message || "Failed to clear day schedule");
    }
    setLoading(false);
  };

  const handleClearWeek = async () => {
    if (isLocked) {
      toast.error("This week is locked. Edits are only allowed until Monday.");
      return;
    }
    setLoading(true);
    const weekStartIso = format(
      startOfWeek(weekStart, { weekStartsOn: 1 }),
      "yyyy-MM-dd"
    );
    const weekEndIso = format(addDays(new Date(weekStartIso), 6), "yyyy-MM-dd");
    try {
      const { error } = await supabase
        .from("employee_week_schedules")
        .delete()
        .eq("employee_id", employee.id)
        .gte("schedule_date", weekStartIso)
        .lte("schedule_date", weekEndIso);
      if (error) throw error;

      // Clear local state
      setDays(
        weekDays.map((d) => ({
          schedule_date: format(d, "yyyy-MM-dd"),
          start_time: "",
          end_time: "",
          day_off: false,
          tasks: "",
        }))
      );

      toast.success("Weekly schedule cleared");
    } catch (err: any) {
      console.error("Failed to clear week", err);
      toast.error(err?.message || "Failed to clear schedule");
    }
    setLoading(false);
  };

  // Show loading state while checking access
  if (checkingAccess) {
    return (
      <VStack gap="6" className="w-full pb-24">
        <CardSection>
          <VStack gap="4" align="center" className="py-8">
            <Icon name="ArrowsClockwise" size={IconSizes.lg} className="animate-spin text-muted-foreground" />
            <BodySmall className="text-muted-foreground">Checking access...</BodySmall>
          </VStack>
        </CardSection>
      </VStack>
    );
  }

  // If not an Account Supervisor, don't render (should have been redirected)
  if (!isClientBasedAccountSupervisor) {
    return (
      <VStack gap="6" className="w-full pb-24">
        <CardSection>
          <VStack gap="4" align="center" className="py-8">
            <Icon name="WarningCircle" size={IconSizes.lg} className="text-destructive" />
            <H1 className="text-lg">Access Restricted</H1>
            <BodySmall className="text-muted-foreground text-center">
              Schedule access is restricted to Account Supervisors only.
            </BodySmall>
          </VStack>
        </CardSection>
      </VStack>
    );
  }

  return (
    <VStack gap="6" className="w-full pb-24">
      <CardSection
        title={
          <HStack gap="2" align="center">
            <Icon name="CalendarBlank" size={IconSizes.md} />
            Weekly Schedule
          </HStack>
        }
        description={
          isClientBasedAccountSupervisor
            ? "Set your schedule for the selected week (Mon–Sun). Rest days can only be scheduled on Monday, Tuesday, or Wednesday. Edits allowed until end of Monday of that week; after that, contact your Account Manager."
            : "Set your schedule for the selected week (Mon–Sun). Edits allowed until end of Monday of that week; after that, contact your Account Manager."
        }
      >
        <VStack gap="4">
          <VStack gap="2" align="start">
            <Caption>
              Week starting:{" "}
              <span className="font-medium text-foreground">
                {format(
                  startOfWeek(weekStart, { weekStartsOn: 1 }),
                  "yyyy-MM-dd"
                )}
              </span>
            </Caption>
          </VStack>
          <HStack
            gap="4"
            align="end"
            justify="between"
            className="flex-col md:flex-row"
          >
            <VStack gap="2" align="start">
              <Label>Select week (snaps to Monday)</Label>
              <Input
                className="w-full sm:w-64"
                type="date"
                value={format(
                  startOfWeek(weekStart, { weekStartsOn: 1 }),
                  "yyyy-MM-dd"
                )}
                onChange={(e) =>
                  setWeekStart(
                    startOfWeek(new Date(e.target.value), { weekStartsOn: 1 })
                  )
                }
                disabled={loading}
              />
            </VStack>
            <Button
              className="w-full sm:w-auto"
              variant="secondary"
              onClick={handleAutofill}
              disabled={isLocked || loading}
            >
              <Icon name="ArrowsClockwise" size={IconSizes.sm} />
              Auto-fill 8:00–17:00
            </Button>
          </HStack>
          <HStack
            gap="3"
            justify="end"
            align="center"
            className="flex-col sm:flex-row pt-2"
          >
            <Button
              variant="outline"
              onClick={handleClearWeek}
              disabled={isLocked || loading}
              className="w-full sm:w-auto"
            >
              <Icon name="TrashSimple" size={IconSizes.sm} />
              {loading ? "Clearing..." : "Clear Week"}
            </Button>
            <Button
              onClick={() => setShowSaveConfirm(true)}
              disabled={isLocked || loading}
              className="w-full sm:w-auto"
            >
              <Icon name="FloppyDisk" size={IconSizes.sm} />
              {loading ? "Saving..." : "Save Week"}
            </Button>
          </HStack>
          {isLocked && (
            <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3">
              <Caption className="font-medium text-destructive">
                Locked: This week can no longer be edited. Please reach out to
                your Account Manager for changes.
              </Caption>
            </div>
          )}
          {isClientBasedAccountSupervisor && (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
              <Caption className="font-medium text-blue-900">
                <Icon name="Info" size={IconSizes.xs} className="inline mr-1" />
                Account Supervisor Restriction: Rest days can only be scheduled on Monday, Tuesday, or Wednesday.
              </Caption>
            </div>
          )}
        </VStack>
      </CardSection>

      <CardSection>
        <VStack gap="6" className="w-full">
          <div className="w-full grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {weekDays.map((day, idx) => {
              const hasInvalidTimeRange =
                !days[idx]?.day_off &&
                days[idx]?.start_time &&
                days[idx]?.end_time &&
                !isValidTimeRange(days[idx]);

              return (
              <div
                key={day.toISOString()}
                className={`w-full rounded-lg border bg-card p-4 shadow-sm transition-shadow hover:shadow-md ${
                  hasInvalidTimeRange
                    ? "border-destructive/50"
                    : "border-border"
                }`}
              >
                <VStack gap="4" className="w-full">
                  <HStack
                    justify="between"
                    align="start"
                    gap="3"
                    className="w-full flex-nowrap"
                  >
                    <H3 className="whitespace-nowrap flex-shrink-0">
                      {format(day, "EEEE, MMM d")}
                      {!days[idx]?.day_off &&
                        days[idx]?.start_time &&
                        days[idx]?.end_time &&
                        !isValidTimeRange(days[idx]) && (
                          <span className="text-destructive ml-1" title="Invalid time range">
                            *
                          </span>
                        )}
                    </H3>
                    <HStack gap="2" align="center" className="flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleClearDay(idx)}
                        disabled={
                          isLocked ||
                          loading ||
                          (!days[idx]?.start_time &&
                            !days[idx]?.end_time &&
                            !days[idx]?.tasks)
                        }
                        className="h-7 w-7 p-0"
                        title="Clear this day"
                      >
                        <Icon name="X" size={IconSizes.xs} />
                      </Button>
                      {(() => {
                        // Hide "Day off" checkbox for Thursday-Sunday for Account Supervisors
                        if (isClientBasedAccountSupervisor) {
                          const dayDate = new Date(days[idx]?.schedule_date || "");
                          const dayOfWeek = dayDate.getDay();
                          const isRestDayAllowed = dayOfWeek === 1 || dayOfWeek === 2 || dayOfWeek === 3;
                          if (!isRestDayAllowed) {
                            return null; // Don't show checkbox for Thu-Sun
                          }
                        }
                        return (
                          <label
                            htmlFor={`dayoff-${idx}`}
                            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                          >
                            <input
                              id={`dayoff-${idx}`}
                              type="checkbox"
                              className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 flex-shrink-0"
                              checked={!!days[idx]?.day_off}
                              disabled={isLocked}
                              onChange={(e) =>
                                handleChange(
                                  idx,
                                  "day_off",
                                  e.target.checked as any
                                )
                              }
                              title="Mark as rest day"
                            />
                            <Label className="cursor-pointer whitespace-nowrap text-xs">
                              Day off
                            </Label>
                          </label>
                        );
                      })()}
                    </HStack>
                  </HStack>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <VStack gap="2" align="start">
                      <Label htmlFor={`start-${idx}`} className="text-xs">
                        Start
                        {!days[idx]?.day_off &&
                          days[idx]?.start_time &&
                          days[idx]?.end_time &&
                          !isValidTimeRange(days[idx]) && (
                            <span className="text-destructive ml-1">*</span>
                          )}
                      </Label>
                      <Input
                        id={`start-${idx}`}
                        type="time"
                        value={days[idx]?.start_time || ""}
                        disabled={isLocked || days[idx]?.day_off}
                        onChange={(e) =>
                          handleChange(idx, "start_time", e.target.value)
                        }
                        className={
                          !days[idx]?.day_off &&
                          days[idx]?.start_time &&
                          days[idx]?.end_time &&
                          !isValidTimeRange(days[idx])
                            ? "border-destructive focus-visible:ring-destructive"
                            : ""
                        }
                      />
                    </VStack>
                    <VStack gap="2" align="start">
                      <Label htmlFor={`end-${idx}`} className="text-xs">
                        End
                        {!days[idx]?.day_off &&
                          days[idx]?.start_time &&
                          days[idx]?.end_time &&
                          !isValidTimeRange(days[idx]) && (
                            <span className="text-destructive ml-1">*</span>
                          )}
                      </Label>
                      <Input
                        id={`end-${idx}`}
                        type="time"
                        value={days[idx]?.end_time || ""}
                        disabled={isLocked || days[idx]?.day_off}
                        onChange={(e) =>
                          handleChange(idx, "end_time", e.target.value)
                        }
                        className={
                          !days[idx]?.day_off &&
                          days[idx]?.start_time &&
                          days[idx]?.end_time &&
                          !isValidTimeRange(days[idx])
                            ? "border-destructive focus-visible:ring-destructive"
                            : ""
                        }
                      />
                    </VStack>
                  </div>
                  {!days[idx]?.day_off &&
                    days[idx]?.start_time &&
                    days[idx]?.end_time &&
                    !isValidTimeRange(days[idx]) && (
                      <div className="rounded-md border border-destructive/20 bg-destructive/5 p-2">
                        <Caption className="text-destructive text-xs">
                          <Icon
                            name="WarningCircle"
                            size={IconSizes.xs}
                            className="inline mr-1"
                          />
                          Invalid time range: End time must be later than start time
                        </Caption>
                      </div>
                    )}
                  <VStack gap="2" align="start" className="w-full">
                    <Label htmlFor={`tasks-${idx}`} className="text-xs">
                      Tasks for this day
                    </Label>
                    <Textarea
                      id={`tasks-${idx}`}
                      placeholder="Enter tasks you plan to work on..."
                      value={days[idx]?.tasks || ""}
                      disabled={isLocked}
                      onChange={(e) =>
                        handleChange(idx, "tasks", e.target.value)
                      }
                      rows={3}
                      className="resize-none"
                    />
                  </VStack>
                </VStack>
              </div>
            );
            })}
          </div>
        </VStack>
      </CardSection>

      <AlertDialog open={showSaveConfirm} onOpenChange={setShowSaveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save Weekly Schedule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to save your schedule for the week starting{" "}
              <span className="font-medium">
                {format(
                  startOfWeek(weekStart, { weekStartsOn: 1 }),
                  "MMMM d, yyyy"
                )}
              </span>
              ? This will overwrite any existing schedule for this week.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveWeek} disabled={loading}>
              <HStack gap="2" align="center">
                <Icon name="FloppyDisk" size={IconSizes.sm} />
                <span>{loading ? "Saving..." : "Save Schedule"}</span>
              </HStack>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </VStack>
  );
}