"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, startOfWeek, format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSection } from "@/components/ui/card-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { H1, H3, BodySmall, Caption } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { useEmployeeSession } from "@/contexts/EmployeeSessionContext";
import { toast } from "sonner";

type DayEntry = {
  schedule_date: string;
  start_time: string;
  end_time: string;
  day_off: boolean;
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
      }))
    );
  };

  const handleSubmit = async () => {
    if (isLocked) {
      toast.error("This week is locked. Edits are only allowed until Monday.");
      return;
    }
    setLoading(true);
    const entries = days
      .filter((d) => d.schedule_date)
      .map((d) => ({
        schedule_date: d.schedule_date,
        start_time: d.day_off ? null : d.start_time,
        end_time: d.day_off ? null : d.end_time,
        day_off: d.day_off,
      }));
    const payload = {
      p_employee_id: employee.id,
      p_week_start: format(
        startOfWeek(weekStart, { weekStartsOn: 1 }),
        "yyyy-MM-dd"
      ),
      p_entries: entries,
    };

    // First try RPC; fallback to direct table ops if RPC endpoint is not registered yet (404)
    const { error } = await supabase.rpc("save_week_schedule", payload);

    // If RPC fails for any reason (including 404 path not registered), fallback to direct table writes
    if (error) {
      // Fallback: direct delete + insert
      try {
        const weekStartIso = payload.p_week_start;
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

        const { error: insErr } = await supabase
          .from("employee_week_schedules")
          .insert(
            entries.map((e) => ({
              employee_id: employee.id,
              week_start: weekStartIso,
              schedule_date: e.schedule_date,
              start_time: e.day_off ? null : e.start_time,
              end_time: e.day_off ? null : e.end_time,
              day_off: e.day_off ?? false,
            }))
          );
        if (insErr) throw insErr;
        toast.success("Weekly schedule updated");
      } catch (fallbackErr: any) {
        console.error("Fallback save failed", fallbackErr);
        toast.error(fallbackErr?.message || "Failed to save schedule");
      }
    } else {
      toast.success("Weekly schedule updated");
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
                    className="w-full"
                  >
                    <H3>{format(day, "EEEE, MMM d")}</H3>
                    <label
                      htmlFor={`dayoff-${idx}`}
                      className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    >
                      <input
                        id={`dayoff-${idx}`}
                        type="checkbox"
                        className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                        checked={!!days[idx]?.day_off}
                        disabled={isLocked}
                        onChange={(e) =>
                          handleChange(idx, "day_off", e.target.checked as any)
                        }
                      />
                      <Label className="cursor-pointer">Mark as day off</Label>
                    </label>
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
                </VStack>
              </div>
            ))}
          </div>
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
              onClick={handleSubmit}
              disabled={isLocked || loading}
              className="w-full sm:w-auto"
            >
              <Icon name="FloppyDisk" size={IconSizes.sm} />
              {loading ? "Saving..." : "Save Week"}
            </Button>
          </HStack>
        </VStack>
      </CardSection>
    </VStack>
  );
}
