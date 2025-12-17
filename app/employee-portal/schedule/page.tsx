"use client";

import { useEffect, useMemo, useState } from "react";
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
  // Default to next week (Mon) but allow selecting any week (snaps to Monday)
  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeek(addDays(new Date(), 7), { weekStartsOn: 1 })
  );
  const [days, setDays] = useState<DayEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const weekMonday = startOfWeek(weekStart, { weekStartsOn: 1 });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Locked if the selected week is already past Monday (today > Monday of that week)
  const isLocked = today.getTime() > weekMonday.getTime();

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
  }, [weekStart]);

  useEffect(() => {
    const loadWeek = async () => {
      setLoading(true);
      const monday = startOfWeek(weekStart, { weekStartsOn: 1 });
      const { data, error } = await supabase.rpc("get_my_week_schedule", {
        p_employee_id: employee.id,
        p_week_start: format(monday, "yyyy-MM-dd"),
      });
      if (error) {
        console.error("Failed to load week schedule", error);
      } else {
        setDays(
          weekDays.map((d) => {
            const iso = format(d, "yyyy-MM-dd");
            const existing = (data || []).find(
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

  const handleChange = (
    idx: number,
    field: keyof DayEntry,
    value: string | boolean
  ) => {
    setDays((prev) => {
      const next = [...prev];
      // If switching to day_off, clear times
      if (field === "day_off") {
        const isOff = value === true || value === "true";
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
      });

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
          }
        );
        if (!reloadError && updatedData) {
          setDays(
            weekDays.map((d) => {
              const iso = format(d, "yyyy-MM-dd");
              const existing = (updatedData || []).find(
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
        const { error: insErr } = await supabase
          .from("employee_week_schedules")
          .insert(
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
        }
      );
      if (!reloadError && updatedData) {
        setDays(
          weekDays.map((d) => {
            const iso = format(d, "yyyy-MM-dd");
            const existing = (updatedData || []).find(
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
      toast.error(err?.message || "Failed to save schedule. Please try again.");
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

  return (
    <VStack gap="6" className="w-full pb-24">
      <CardSection
        title={
          <HStack gap="2" align="center">
            <Icon name="CalendarBlank" size={IconSizes.md} />
            Weekly Schedule
          </HStack>
        }
        description="Set your schedule for the selected week (Mon–Sun). Edits allowed until end of Monday of that week; after that, contact your Account Manager."
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
        </VStack>
      </CardSection>

      <CardSection>
        <VStack gap="6" className="w-full">
          <div className="w-full grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {weekDays.map((day, idx) => (
              <div
                key={day.toISOString()}
                className="w-full rounded-lg border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
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
                        />
                        <Label className="cursor-pointer whitespace-nowrap text-xs">
                          Day off
                        </Label>
                      </label>
                    </HStack>
                  </HStack>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <VStack gap="2" align="start">
                      <Label htmlFor={`start-${idx}`} className="text-xs">
                        Start
                      </Label>
                      <Input
                        id={`start-${idx}`}
                        type="time"
                        value={days[idx]?.start_time || ""}
                        disabled={isLocked || days[idx]?.day_off}
                        onChange={(e) =>
                          handleChange(idx, "start_time", e.target.value)
                        }
                      />
                    </VStack>
                    <VStack gap="2" align="start">
                      <Label htmlFor={`end-${idx}`} className="text-xs">
                        End
                      </Label>
                      <Input
                        id={`end-${idx}`}
                        type="time"
                        value={days[idx]?.end_time || ""}
                        disabled={isLocked || days[idx]?.day_off}
                        onChange={(e) =>
                          handleChange(idx, "end_time", e.target.value)
                        }
                      />
                    </VStack>
                  </div>
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
            ))}
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
