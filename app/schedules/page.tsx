"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, startOfWeek, format } from "date-fns";
import { formatPHTime } from "@/utils/format";
import { createClient } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSection } from "@/components/ui/card-section";
import { H1, BodySmall, Caption } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { Input } from "@/components/ui/input";
import { InputGroup } from "@/components/ui/input-group";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { toast } from "sonner";

type EmployeeOption = { id: string; full_name: string };
type ScheduleRow = {
  id: string;
  employee_id: string;
  employee_name: string;
  schedule_date: string;
  start_time: string;
  end_time: string;
  tasks: string | null;
};

// Deterministic per-employee colors (inline HSL for more variety)
const getColorStyleForEmployee = (employeeId: string) => {
  const hash = employeeId
    .split("")
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const hue = hash % 360;
  const bg = `hsl(${hue}deg 80% 93%)`;
  const border = `hsl(${hue}deg 70% 80%)`;
  const text = `hsl(${hue}deg 45% 30%)`;
  return { bg, border, text };
};

export default function SchedulesPage() {
  const supabase = createClient();
  const { role, isAdmin, loading: roleLoading } = useUserRole();

  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [filters, setFilters] = useState<{ employee_id: string }>({
    employee_id: "all",
  });
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<ScheduleRow | null>(null);

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
        p_employee_id:
          filters.employee_id === "all" ? null : filters.employee_id,
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
  }, [weekStart, filters.employee_id]);

  if (roleLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Icon
            name="ArrowsClockwise"
            size={IconSizes.lg}
            className="animate-spin text-muted-foreground"
          />
        </div>
      </DashboardLayout>
    );
  }

  if (!isAdmin && role !== "account_manager" && role !== "hr") {
    return (
      <DashboardLayout>
        <VStack gap="4" className="w-full">
          <BodySmall>
            Only Account Managers, HR, or Admins can view schedules.
          </BodySmall>
        </VStack>
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
      <VStack gap="8" className="w-full pb-24">
        <HStack
          justify="between"
          align="start"
          className="flex-col md:flex-row gap-4"
        >
          <VStack gap="2" align="start">
            <H1>Weekly Schedules</H1>
            <BodySmall>
              View employee schedules (Mon–Sun). Account managers/HR/admins can
              overwrite weeks.
            </BodySmall>
          </VStack>
          <Card className="w-full md:w-auto">
            <CardContent className="p-6">
              <HStack gap="4" align="end" className="flex-col md:flex-row">
                <InputGroup
                  label="Week starting (Mon)"
                  className="w-full sm:w-56"
                >
                  <Input
                    type="date"
                    value={format(
                      startOfWeek(weekStart, { weekStartsOn: 1 }),
                      "yyyy-MM-dd"
                    )}
                    onChange={(e) =>
                      setWeekStart(
                        startOfWeek(new Date(e.target.value), {
                          weekStartsOn: 1,
                        })
                      )
                    }
                  />
                </InputGroup>
                <div className="space-y-2 w-full sm:w-56">
                  <Label className="text-sm font-medium">Employee</Label>
                  <Select
                    value={filters.employee_id}
                    onValueChange={(val) =>
                      setFilters((f) => ({ ...f, employee_id: val }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All employees</SelectItem>
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="secondary"
                  onClick={loadWeek}
                  disabled={loading}
                >
                  <Icon name="ArrowsClockwise" size={IconSizes.sm} />
                  {loading ? "Refreshing..." : "Refresh"}
                </Button>
              </HStack>
            </CardContent>
          </Card>
        </HStack>

        <CardSection className="overflow-auto">
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
            {grouped.map((col) => (
              <div
                key={col.date}
                className="border border-border rounded-lg p-4 bg-card min-h-[240px]"
              >
                <p className="text-sm font-semibold text-foreground mb-3">
                  {col.label}
                </p>
                {col.entries.length === 0 ? (
                  <Caption>No schedules</Caption>
                ) : (
                  <VStack gap="2">
                    {col.entries.map((entry) => {
                      const color = getColorStyleForEmployee(entry.employee_id);
                      return (
                        <div
                          key={entry.id}
                          onClick={() => setSelectedEntry(entry)}
                          className="border border-border rounded-md px-3 py-2 cursor-pointer transition-all hover:shadow-md"
                          style={{
                            backgroundColor: color.bg,
                            borderColor: color.border,
                            color: color.text,
                          }}
                        >
                          <VStack gap="2" align="start">
                            <p className="font-semibold text-sm">
                              {entry.employee_name}
                            </p>
                            {entry.start_time && entry.end_time ? (
                              <Caption>
                                {formatPHTime(
                                  new Date(
                                    `${entry.schedule_date}T${entry.start_time}`
                                  ),
                                  "h:mm a"
                                )}{" "}
                                -{" "}
                                {formatPHTime(
                                  new Date(
                                    `${entry.schedule_date}T${entry.end_time}`
                                  ),
                                  "h:mm a"
                                )}
                              </Caption>
                            ) : (
                              <Caption className="text-muted-foreground">
                                No schedule set
                              </Caption>
                            )}
                          </VStack>
                        </div>
                      );
                    })}
                  </VStack>
                )}
              </div>
            ))}
          </div>
        </CardSection>

        <Dialog
          open={!!selectedEntry}
          onOpenChange={(open) => !open && setSelectedEntry(null)}
        >
          <DialogContent className="overflow-x-hidden max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {selectedEntry?.employee_name} -{" "}
                {selectedEntry &&
                  format(
                    new Date(selectedEntry.schedule_date),
                    "EEEE, MMM d, yyyy"
                  )}
              </DialogTitle>
              <DialogDescription>Schedule details and tasks</DialogDescription>
            </DialogHeader>
            {selectedEntry && (
              <VStack gap="4" className="mt-4 min-w-0">
                <div className="min-w-0 w-full">
                  <Label className="text-sm font-medium">Schedule</Label>
                  {selectedEntry.start_time && selectedEntry.end_time ? (
                    <p className="mt-2 text-sm">
                      {formatPHTime(
                        new Date(
                          `${selectedEntry.schedule_date}T${selectedEntry.start_time}`
                        ),
                        "h:mm a"
                      )}{" "}
                      -{" "}
                      {formatPHTime(
                        new Date(
                          `${selectedEntry.schedule_date}T${selectedEntry.end_time}`
                        ),
                        "h:mm a"
                      )}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground italic">
                      No schedule set for this day
                    </p>
                  )}
                </div>
                <div className="min-w-0 w-full">
                  <Label className="text-sm font-medium">Tasks</Label>
                  {selectedEntry.tasks ? (
                    <div className="mt-2 min-w-0 w-full overflow-hidden">
                      <p className="text-sm whitespace-pre-wrap break-words bg-muted p-3 rounded-md overflow-wrap-anywhere word-break-break-all max-w-full">
                        {selectedEntry.tasks}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground italic">
                      No tasks submitted for this day
                    </p>
                  )}
                </div>
              </VStack>
            )}
          </DialogContent>
        </Dialog>
      </VStack>
    </DashboardLayout>
  );
}
