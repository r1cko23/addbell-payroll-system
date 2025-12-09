"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, format, startOfWeek } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { toast } from "react-hot-toast";

type EmployeeOption = { id: string; full_name: string };
type ScheduleRow = {
  id: string;
  employee_id: string;
  employee_name: string;
  schedule_date: string;
  start_time: string;
  end_time: string;
};

export default function SchedulesPage() {
  const supabase = createClient();
  const { role, isAdmin, loading: roleLoading } = useUserRole();

  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [filters, setFilters] = useState<{ employee_id: string }>({
    employee_id: "",
  });
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(false);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  useEffect(() => {
    const loadMeta = async () => {
      const { data: emps } = await supabase
        .from("employees")
        .select("id, full_name")
        .order("full_name");
      setEmployees(emps || []);
    };
    loadMeta();
  }, [supabase]);

  const loadWeek = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc(
      "get_week_schedule_for_manager",
      {
        p_week_start: format(weekStart, "yyyy-MM-dd"),
        p_employee_id: filters.employee_id || null,
      }
    );
    if (error) {
      toast.error(error.message || "Failed to load schedules");
    } else {
      setRows((data || []) as ScheduleRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadWeek();
  }, [weekStart, filters.location_id, filters.employee_id]);

  if (roleLoading) {
    return (
      <DashboardLayout>
        <div className="p-6">Loading...</div>
      </DashboardLayout>
    );
  }

  if (!isAdmin && role !== "account_manager") {
    return (
      <DashboardLayout>
        <div className="p-6 text-sm text-gray-600">
          Only Account Managers or Admins can view schedules.
        </div>
      </DashboardLayout>
    );
  }

  const grouped = weekDays.map((d) => {
    const iso = format(d, "yyyy-MM-dd");
    return {
      date: iso,
      label: format(d, "EEE, MMM d"),
      entries: rows.filter((r) => r.schedule_date === iso),
    };
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Weekly Schedules
            </h1>
            <p className="text-sm text-muted-foreground">
              View employee schedules; color-coded by location.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">Week starting (Mon)</span>
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
              />
            </div>
            <select
              className="rounded-md border px-3 py-2 text-sm"
              value={filters.employee_id}
              onChange={(e) =>
                setFilters((f) => ({ ...f, employee_id: e.target.value }))
              }
            >
              <option value="">All employees</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name}
                </option>
              ))}
            </select>
            <Button variant="secondary" onClick={loadWeek} isLoading={loading}>
              Refresh
            </Button>
          </div>
        </div>

        <Card className="p-4 overflow-auto">
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {grouped.map((col) => (
              <div
                key={col.date}
                className="border rounded-lg p-3 bg-white min-h-[240px]"
              >
                <div className="text-sm font-semibold text-gray-800 mb-2">
                  {col.label}
                </div>
                {col.entries.length === 0 ? (
                  <p className="text-xs text-gray-500">No schedules</p>
                ) : (
                  <div className="space-y-2">
                    {col.entries.map((entry) => (
                      <div
                        key={entry.id}
                        className="border rounded-md px-3 py-2 text-xs flex flex-col gap-1 bg-emerald-50 border-emerald-200 text-emerald-800"
                      >
                        <div className="font-semibold text-sm">
                          {entry.employee_name}
                        </div>
                        <div>
                          {entry.start_time} - {entry.end_time}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
