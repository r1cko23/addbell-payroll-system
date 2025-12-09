"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, startOfWeek, format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
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

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-gray-900">Weekly Schedule</h1>
          <p className="text-sm text-gray-600">
            Set your schedule for the selected week (Mon–Sun). Edits allowed
            until end of Monday of that week; after that, contact your Account
            Manager.
          </p>
          <p className="text-xs text-gray-500">
            Week starting:{" "}
            {format(startOfWeek(weekStart, { weekStartsOn: 1 }), "yyyy-MM-dd")}
          </p>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">
                Select week (snaps to Monday)
              </label>
              <Input
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
            </div>
            <Button
              variant="secondary"
              onClick={handleAutofill}
              disabled={isLocked || loading}
            >
              Auto-fill 8:00–17:00
            </Button>
          </div>
          {isLocked && (
            <p className="text-xs text-red-600">
              Locked: This week can no longer be edited. Please reach out to
              your Account Manager for changes.
            </p>
          )}
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {weekDays.map((day, idx) => (
            <div
              key={day.toISOString()}
              className="border rounded-lg p-4 space-y-3 bg-white"
            >
              <div className="text-sm font-semibold text-gray-800">
                {format(day, "EEEE, MMM d")}
              </div>
              <div className="flex items-center gap-2">
                <input
                  id={`dayoff-${idx}`}
                  type="checkbox"
                  checked={!!days[idx]?.day_off}
                  disabled={isLocked}
                  onChange={(e) =>
                    handleChange(idx, "day_off", e.target.checked as any)
                  }
                />
                <label
                  htmlFor={`dayoff-${idx}`}
                  className="text-sm text-gray-700 select-none"
                >
                  Mark as day off
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="time"
                  label="Start"
                  value={days[idx]?.start_time || ""}
                  disabled={isLocked || days[idx]?.day_off}
                  onChange={(e) =>
                    handleChange(idx, "start_time", e.target.value)
                  }
                />
                <Input
                  type="time"
                  label="End"
                  value={days[idx]?.end_time || ""}
                  disabled={isLocked || days[idx]?.day_off}
                  onChange={(e) =>
                    handleChange(idx, "end_time", e.target.value)
                  }
                />
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <Button
            onClick={handleSubmit}
            isLoading={loading}
            disabled={isLocked}
          >
            Save Week
          </Button>
        </div>
      </Card>
    </div>
  );
}
