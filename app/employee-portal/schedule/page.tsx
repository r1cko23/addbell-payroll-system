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
            };
          })
        );
      }
      setLoading(false);
    };
    loadWeek();
  }, [employee.id, supabase, weekDays, weekStart]);

  const handleChange = (idx: number, field: keyof DayEntry, value: string) => {
    setDays((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
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
      .filter((d) => d.start_time && d.end_time && d.schedule_date)
      .map((d) => ({
        schedule_date: d.schedule_date,
        start_time: d.start_time,
        end_time: d.end_time,
      }));
    const { error } = await supabase.rpc("replace_week_schedule", {
      p_employee_id: employee.id,
      p_week_start: format(
        startOfWeek(weekStart, { weekStartsOn: 1 }),
        "yyyy-MM-dd"
      ),
      p_entries: entries,
    });
    if (error) {
      toast.error(error.message || "Failed to save schedule");
    } else {
      toast.success("Schedule saved");
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
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="time"
                  label="Start"
                  value={days[idx]?.start_time || ""}
                  disabled={isLocked}
                  onChange={(e) =>
                    handleChange(idx, "start_time", e.target.value)
                  }
                />
                <Input
                  type="time"
                  label="End"
                  value={days[idx]?.end_time || ""}
                  disabled={isLocked}
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
