"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

type EmployeeOption = { id: string; full_name: string };
type ScheduleRow = {
  id: string;
  employee_id: string;
  employee_name: string;
  schedule_date: string;
  start_time: string;
  end_time: string;
  tasks: string | null;
  day_off: boolean;
};
type DayEntry = {
  schedule_date: string;
  start_time: string;
  end_time: string;
  day_off: boolean;
  tasks: string;
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
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [editingWeekSchedule, setEditingWeekSchedule] = useState<DayEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingEmployeeType, setEditingEmployeeType] = useState<"office-based" | "client-based" | null>(null);
  const [editingEmployeePosition, setEditingEmployeePosition] = useState<string | null>(null);

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

  const loadWeek = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc(
      "get_week_schedule_for_manager",
      {
        p_week_start: format(weekStart, "yyyy-MM-dd"),
        p_employee_id:
          filters.employee_id === "all" ? null : filters.employee_id,
      } as any
    );
    if (error) {
      toast.error(error.message || "Failed to load schedules");
    } else {
      setRows((data || []) as ScheduleRow[]);
    }
    setLoading(false);
  }, [supabase, weekStart, filters.employee_id]);

  useEffect(() => {
    loadWeek();
  }, [loadWeek]);

  // Get all unique employees and sort alphabetically
  // IMPORTANT: Hooks must be called before any early returns
  const allEmployees = useMemo(() => {
    const uniqueEmployees = new Map<string, { id: string; name: string }>();
    rows.forEach((row) => {
      if (!uniqueEmployees.has(row.employee_id)) {
        uniqueEmployees.set(row.employee_id, {
          id: row.employee_id,
          name: row.employee_name,
        });
      }
    });
    return Array.from(uniqueEmployees.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [rows]);

  // Group by day and create a map for quick lookup
  const grouped = useMemo(() => {
    const dayMap = new Map<string, Map<string, ScheduleRow>>();
    
    // Initialize map for all days
    weekDays.forEach((d) => {
      const iso = format(d, "yyyy-MM-dd");
      dayMap.set(iso, new Map());
    });
    
    // Populate map with entries
    rows.forEach((row) => {
      const dayEntries = dayMap.get(row.schedule_date);
      if (dayEntries) {
        dayEntries.set(row.employee_id, row);
      }
    });
    
    // Convert to array format with consistent ordering
    return weekDays.map((d) => {
      const iso = format(d, "yyyy-MM-dd");
      const dayEntries = dayMap.get(iso) || new Map();
      
      // Create entries in alphabetical order, filling in missing employees
      const orderedEntries = allEmployees.map((emp) => {
        const entry = dayEntries.get(emp.id);
        return entry || null; // null means no schedule for this employee on this day
      });
      
      return {
        date: iso,
        label: format(d, "EEE, MMM d"),
        entries: orderedEntries.filter((e): e is ScheduleRow => e !== null),
        orderedEntries, // Include null entries for consistent positioning
      };
    });
  }, [weekDays, rows, allEmployees]);

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

  return (
    <DashboardLayout>
      <VStack gap="4" className="w-full pb-24">
        <HStack
          justify="between"
          align="center"
          className="flex-col md:flex-row gap-3"
        >
          <VStack gap="1" align="start">
            <H1 className="text-xl">Weekly Schedules</H1>
            <BodySmall className="text-xs text-muted-foreground">
              View employee schedules (Mon–Sun)
            </BodySmall>
          </VStack>
          <Card className="w-full md:w-auto">
            <CardContent className="p-3">
              <HStack gap="3" align="end" className="flex-col md:flex-row">
                <InputGroup
                  label="Week"
                  className="w-full sm:w-48"
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
                    className="text-sm"
                  />
                </InputGroup>
                <div className="space-y-1.5 w-full sm:w-48">
                  <Label className="text-xs font-medium">Employee</Label>
                  <Select
                    value={filters.employee_id}
                    onValueChange={(val) =>
                      setFilters((f) => ({ ...f, employee_id: val }))
                    }
                  >
                    <SelectTrigger className="text-sm h-9">
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
                  size="sm"
                  className="h-9"
                >
                  <Icon name="ArrowsClockwise" size={IconSizes.xs} />
                  {loading ? "..." : "Refresh"}
                </Button>
              </HStack>
            </CardContent>
          </Card>
        </HStack>

        <CardSection className="overflow-auto p-3">
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3 min-w-fit">
            {grouped.map((col) => (
              <div
                key={col.date}
                className="border border-border rounded-lg p-2.5 bg-card min-h-[200px] min-w-[140px]"
              >
                <p className="text-xs font-semibold text-foreground mb-2.5 px-0.5 sticky top-0 bg-card pb-1">
                  {col.label}
                </p>
                {allEmployees.length === 0 ? (
                  <Caption className="text-xs px-0.5 text-muted-foreground">No schedules</Caption>
                ) : (
                  <VStack gap="2">
                    {allEmployees.map((emp, idx) => {
                      const entry = col.orderedEntries?.[idx] || null;
                      if (!entry) {
                        // Empty cell for employee with no schedule on this day
                        return (
                          <div
                            key={`${col.date}-${emp.id}-empty`}
                            className="border border-transparent rounded-md px-2.5 py-2 w-full min-h-[60px]"
                            aria-label={`${emp.name} - No schedule`}
                          />
                        );
                      }
                      
                      const color = getColorStyleForEmployee(entry.employee_id);
                      const isDayOff = entry.day_off;
                      return (
                        <div
                          key={entry.id}
                          onClick={() => {
                            // Regular click: just view the schedule (read-only)
                            setSelectedEntry(entry);
                            setIsEditMode(false);
                            setEditingEmployeeId(null);
                            setEditingWeekSchedule([]);
                          }}
                          className={`border rounded-md px-2.5 py-2 cursor-pointer transition-all hover:shadow-md w-full ${
                            isDayOff ? "border-dashed border-2" : ""
                          }`}
                          style={{
                            backgroundColor: color.bg,
                            borderColor: isDayOff ? color.border : color.border,
                            color: color.text,
                          }}
                          title={entry.employee_name}
                        >
                          <VStack gap="2" align="start" className="w-full">
                            <HStack gap="2" align="start" justify="between" className="w-full">
                              <p className="font-semibold text-xs leading-snug break-words flex-1 min-w-0 pr-1.5">
                                {entry.employee_name}
                              </p>
                              {isDayOff && (
                                <Badge 
                                  variant="outline" 
                                  className="text-[10px] font-semibold border-2 border-current shrink-0 opacity-80 px-1.5 py-0.5 h-5 flex items-center whitespace-nowrap"
                                >
                                  <Icon name="CalendarX" size={16} className="mr-0.5 shrink-0" />
                                  Off
                                </Badge>
                              )}
                            </HStack>
                            {isDayOff ? (
                              <HStack gap="2" align="center" className="w-full">
                                <Icon
                                  name="Moon"
                                  size={16}
                                  className="shrink-0 opacity-70"
                                />
                                <Caption className="text-[11px] font-medium italic">
                                  Rest day
                                </Caption>
                              </HStack>
                            ) : entry.start_time && entry.end_time ? (
                              <Caption className="text-[11px] leading-snug">
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
                              <Caption className="text-[11px] text-muted-foreground">
                                No schedule
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
          onOpenChange={(open) => {
            if (!open) {
              setSelectedEntry(null);
              setEditingEmployeeId(null);
              setEditingWeekSchedule([]);
              setIsEditMode(false);
              setEditingEmployeeType(null);
              setEditingEmployeePosition(null);
            }
          }}
        >
          <DialogContent className="overflow-x-hidden max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="pb-3">
              <DialogTitle className="text-base">
                {isEditMode ? "Edit" : "View"} Schedule for {selectedEntry?.employee_name}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Week of {format(weekStart, "MMM d, yyyy")}
              </DialogDescription>
            </DialogHeader>
            
            {selectedEntry && !isEditMode && (
              // View Mode: Read-only display
              <VStack gap="4" className="min-w-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 w-full">
                  {weekDays.map((day) => {
                    const dayStr = format(day, "yyyy-MM-dd");
                    const dayEntry = rows.find(
                      (r) => r.employee_id === selectedEntry.employee_id && r.schedule_date === dayStr
                    );
                    const isCurrentDay = dayStr === selectedEntry.schedule_date;
                    
                    return (
                      <Card
                        key={dayStr}
                        className={`p-3 ${
                          isCurrentDay ? "border-primary-500 border-2" : ""
                        }`}
                      >
                        <VStack gap="2" align="start">
                          <Label className="text-xs font-medium">
                            {format(day, "EEE, MMM d")}
                          </Label>
                          {dayEntry?.day_off ? (
                            <div className="p-2 rounded-md bg-muted/50 border border-dashed border-2 w-full">
                              <HStack gap="2" align="center">
                                <Icon name="Moon" size={IconSizes.xs} className="shrink-0 opacity-70" />
                                <p className="text-xs font-medium italic">Rest day</p>
                              </HStack>
                            </div>
                          ) : dayEntry?.start_time && dayEntry?.end_time ? (
                            <>
                              <div className="text-xs">
                                <span className="font-medium">Time:</span>{" "}
                                {formatPHTime(
                                  new Date(`${dayStr}T${dayEntry.start_time}`),
                                  "h:mm a"
                                )}{" "}
                                -{" "}
                                {formatPHTime(
                                  new Date(`${dayStr}T${dayEntry.end_time}`),
                                  "h:mm a"
                                )}
                              </div>
                              {dayEntry.tasks && (
                                <div className="text-xs w-full">
                                  <span className="font-medium">Tasks:</span>
                                  <p className="text-muted-foreground mt-1 whitespace-pre-wrap break-words">
                                    {dayEntry.tasks}
                                  </p>
                                </div>
                              )}
                            </>
                          ) : (
                            <p className="text-xs text-muted-foreground italic">No schedule</p>
                          )}
                        </VStack>
                      </Card>
                    );
                  })}
                </div>
                {(isAdmin || role === "account_manager") && (
                  <HStack justify="end" gap="2" className="w-full pt-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedEntry(null);
                        setIsEditMode(false);
                      }}
                    >
                      Close
                    </Button>
                    <Button
                      onClick={async () => {
                        // Load full week schedule for editing
                        setIsEditMode(true);
                        setEditingEmployeeId(selectedEntry.employee_id);
                        setEditingWeekSchedule([]);
                        
                        // Fetch employee type and position
                        const { data: empData } = await supabase
                          .from("employees")
                          .select("employee_type, position")
                          .eq("id", selectedEntry.employee_id)
                          .single<{ employee_type: "office-based" | "client-based" | null; position: string | null }>();
                        
                        if (empData) {
                          setEditingEmployeeType(empData.employee_type);
                          setEditingEmployeePosition(empData.position);
                        }
                        
                        const weekStartIso = format(weekStart, "yyyy-MM-dd");
                        const { data: weekData, error } = await supabase.rpc(
                          "get_week_schedule_for_manager",
                          {
                            p_week_start: weekStartIso,
                            p_employee_id: selectedEntry.employee_id,
                          } as any
                        );
                        
                        if (!error && weekData) {
                          const scheduleMap = new Map(
                            (weekData as ScheduleRow[]).map((r) => [r.schedule_date, r])
                          );
                          const weekSchedule: DayEntry[] = weekDays.map((day) => {
                            const iso = format(day, "yyyy-MM-dd");
                            const existing = scheduleMap.get(iso);
                            return {
                              schedule_date: iso,
                              start_time: existing?.start_time || "",
                              end_time: existing?.end_time || "",
                              day_off: existing?.day_off || false,
                              tasks: existing?.tasks || "",
                            };
                          });
                          setEditingWeekSchedule(weekSchedule);
                        }
                      }}
                    >
                      <Icon name="PencilSimple" size={IconSizes.xs} className="mr-2" />
                      Edit Schedule
                    </Button>
                  </HStack>
                )}
              </VStack>
            )}
            
            {selectedEntry && isEditMode && (
              // Edit Mode: Editable form
              <VStack gap="4" className="min-w-0">
                {editingEmployeeId !== selectedEntry.employee_id ? (
                  // Loading week schedule
                  <div className="flex items-center justify-center py-8">
                    <Icon
                      name="ArrowsClockwise"
                      size={IconSizes.lg}
                      className="animate-spin text-muted-foreground"
                    />
                  </div>
                ) : (
                  // Edit form
                  <VStack gap="4" className="w-full">
                        {(() => {
                          const isClientBasedAccountSupervisor = 
                            (editingEmployeeType === "client-based" || 
                             (editingEmployeePosition?.toUpperCase().includes("ACCOUNT SUPERVISOR") ?? false));
                          
                          return (
                            <>
                              {isClientBasedAccountSupervisor && (
                                <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
                                  <Caption className="font-medium text-blue-900">
                                    <Icon name="Info" size={IconSizes.xs} className="inline mr-1" />
                                    Account Supervisor Restriction: Rest days can only be scheduled on Monday, Tuesday, or Wednesday.
                                  </Caption>
                                </div>
                              )}
                              {weekDays.map((day, idx) => {
                                const dayEntry = editingWeekSchedule[idx] || {
                                  schedule_date: format(day, "yyyy-MM-dd"),
                                  start_time: "",
                                  end_time: "",
                                  day_off: false,
                                  tasks: "",
                                };
                                const isCurrentDay = dayEntry.schedule_date === selectedEntry.schedule_date;
                                const dayDate = new Date(dayEntry.schedule_date);
                                const dayOfWeek = dayDate.getDay(); // 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
                                const isRestDayAllowed = !isClientBasedAccountSupervisor || (dayOfWeek === 1 || dayOfWeek === 2 || dayOfWeek === 3);
                                
                                return (
                                  <Card key={dayEntry.schedule_date} className={`w-full ${isCurrentDay ? "border-2 border-primary" : ""}`}>
                                    <CardContent className="p-4">
                                      <VStack gap="3" className="w-full">
                                        <HStack gap="2" align="center" justify="between" className="w-full">
                                          <Label className="text-sm font-semibold">
                                            {format(day, "EEEE, MMM d")}
                                          </Label>
                                          {/* Hide "Day Off" checkbox for Thursday-Sunday for Account Supervisors */}
                                          {isRestDayAllowed && (
                                            <div className="flex items-center gap-2">
                                              <Checkbox
                                                id={`dayoff-${idx}`}
                                                checked={dayEntry.day_off}
                                                onCheckedChange={(checked) => {
                                                  const newSchedule = [...editingWeekSchedule];
                                                  newSchedule[idx] = {
                                                    ...dayEntry,
                                                    day_off: checked === true,
                                                    start_time: checked ? "" : dayEntry.start_time,
                                                    end_time: checked ? "" : dayEntry.end_time,
                                                  };
                                                  setEditingWeekSchedule(newSchedule);
                                                }}
                                                title="Mark as rest day"
                                              />
                                              <Label
                                                htmlFor={`dayoff-${idx}`}
                                                className="text-xs font-medium cursor-pointer"
                                              >
                                                Day Off
                                              </Label>
                                            </div>
                                          )}
                                        </HStack>
                                  
                                  {dayEntry.day_off ? (
                                    <div className="p-2 rounded-md bg-muted/50 border border-dashed border-2">
                                      <HStack gap="2" align="center">
                                        <Icon name="Moon" size={IconSizes.xs} className="shrink-0 opacity-70" />
                                        <p className="text-xs font-medium italic">
                                          Rest day - No schedule set
                                        </p>
                                      </HStack>
                                    </div>
                                  ) : (
                                    <HStack gap="2" className="w-full">
                                      <div className="flex-1">
                                        <Label className="text-xs font-medium mb-1 block">Start Time</Label>
                                        <Input
                                          type="time"
                                          value={dayEntry.start_time}
                                          onChange={(e) => {
                                            const newSchedule = [...editingWeekSchedule];
                                            newSchedule[idx] = {
                                              ...dayEntry,
                                              start_time: e.target.value,
                                            };
                                            setEditingWeekSchedule(newSchedule);
                                          }}
                                          className="text-sm"
                                        />
                                      </div>
                                      <div className="flex-1">
                                        <Label className="text-xs font-medium mb-1 block">End Time</Label>
                                        <Input
                                          type="time"
                                          value={dayEntry.end_time}
                                          onChange={(e) => {
                                            const newSchedule = [...editingWeekSchedule];
                                            newSchedule[idx] = {
                                              ...dayEntry,
                                              end_time: e.target.value,
                                            };
                                            setEditingWeekSchedule(newSchedule);
                                          }}
                                          className="text-sm"
                                        />
                                      </div>
                                    </HStack>
                                  )}
                                  
                                  {!dayEntry.day_off && (
                                    <div className="w-full">
                                      <Label className="text-xs font-medium mb-1 block">Tasks</Label>
                                      <Textarea
                                        value={dayEntry.tasks}
                                        onChange={(e) => {
                                          const newSchedule = [...editingWeekSchedule];
                                          newSchedule[idx] = {
                                            ...dayEntry,
                                            tasks: e.target.value,
                                          };
                                          setEditingWeekSchedule(newSchedule);
                                        }}
                                        placeholder="Enter tasks for this day..."
                                        className="text-xs min-h-[60px]"
                                      />
                                    </div>
                                  )}
                                </VStack>
                              </CardContent>
                            </Card>
                          );
                        })}
                            </>
                          );
                        })()}
                        
                        <HStack gap="2" justify="end" className="w-full pt-2">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setIsEditMode(false);
                              setEditingEmployeeId(null);
                              setEditingWeekSchedule([]);
                              setEditingEmployeeType(null);
                              setEditingEmployeePosition(null);
                            }}
                            disabled={saving}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={async () => {
                              // Check if employee is client-based Account Supervisor
                              const isClientBasedAccountSupervisor = 
                                (editingEmployeeType === "client-based" || 
                                 (editingEmployeePosition?.toUpperCase().includes("ACCOUNT SUPERVISOR") ?? false));
                              
                              // For Account Supervisors: Validate rest days are only Mon-Wed
                              if (isClientBasedAccountSupervisor) {
                                for (const day of editingWeekSchedule) {
                                  if (day.day_off) {
                                    const dayDate = new Date(day.schedule_date);
                                    const dayOfWeek = dayDate.getDay();
                                    
                                    if (dayOfWeek !== 1 && dayOfWeek !== 2 && dayOfWeek !== 3) {
                                      const dayName = format(dayDate, "EEEE, MMM d");
                                      toast.error(
                                        `Account Supervisors can only schedule rest days on Monday, Tuesday, or Wednesday. ${dayName} is not allowed.`
                                      );
                                      return;
                                    }
                                  }
                                }
                              }
                              
                              // Validate time ranges
                              for (const day of editingWeekSchedule) {
                                if (!day.day_off && day.start_time && day.end_time) {
                                  if (day.start_time >= day.end_time) {
                                    toast.error(
                                      `Invalid time range on ${format(new Date(day.schedule_date), "EEEE, MMM d")}: End time must be later than start time.`
                                    );
                                    return;
                                  }
                                }
                              }
                              
                              setSaving(true);
                              const weekStartIso = format(weekStart, "yyyy-MM-dd");
                              // Ensure we have exactly 7 days (one for each day of the week)
                              if (editingWeekSchedule.length !== 7) {
                                toast.error("Schedule must include all 7 days of the week");
                                setSaving(false);
                                return;
                              }
                              
                              // Convert empty strings to empty string (not null) for JSON payload
                              // Database function expects empty strings '' which it converts to NULL
                              // IMPORTANT: Include ALL 7 days of the week, even if some have no schedule
                              const entries = editingWeekSchedule.map((d) => {
                                // If day_off is true, ensure times are empty strings
                                // If day_off is false and times are empty, that's OK (both NULL is valid)
                                const startTime = d.day_off ? '' : (d.start_time && d.start_time.trim() ? d.start_time : '');
                                const endTime = d.day_off ? '' : (d.end_time && d.end_time.trim() ? d.end_time : '');
                                
                                return {
                                  schedule_date: d.schedule_date,
                                  start_time: startTime,
                                  end_time: endTime,
                                  tasks: d.day_off ? '' : (d.tasks && d.tasks.trim() ? d.tasks : ''),
                                  day_off: d.day_off || false,
                                };
                              });
                              
                              // Log the payload for debugging
                              console.log('Saving schedule entries:', JSON.stringify(entries, null, 2));
                              
                              try {
                                const { error } = await supabase.rpc("replace_week_schedule", {
                                  p_employee_id: selectedEntry.employee_id,
                                  p_week_start: weekStartIso,
                                  p_entries: entries,
                                } as any);
                                
                                if (error) {
                                  console.error('Schedule save error:', error);
                                  toast.error(error.message || "Failed to save schedule");
                                } else {
                                  toast.success("Schedule updated successfully!");
                                  setIsEditMode(false);
                                  setEditingEmployeeId(null);
                                  setEditingWeekSchedule([]);
                                  loadWeek();
                                }
                              } catch (err: any) {
                                toast.error(err.message || "Failed to save schedule");
                              } finally {
                                setSaving(false);
                              }
                            }}
                            disabled={saving}
                          >
                            {saving ? "Saving..." : "Save Changes"}
                          </Button>
                        </HStack>
                      </VStack>
                    )}
                  </VStack>
                )}
          </DialogContent>
        </Dialog>
      </VStack>
    </DashboardLayout>
  );
}
