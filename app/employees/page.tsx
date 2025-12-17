"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, format, startOfWeek } from "date-fns";
import { formatPHTime } from "@/utils/format";
import { createClient } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { H1, BodySmall, Caption } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { CardSection } from "@/components/ui/card-section";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { InputGroup } from "@/components/ui/input-group";
import { EmployeeAvatar } from "@/components/EmployeeAvatar";

interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
  profile_picture_url?: string | null;
  gender?: "male" | "female" | null;
  sil_credits?: number;
  offset_hours?: number;
  last_name?: string;
  first_name?: string;
  middle_initial?: string;
  assigned_hotel?: string;
  address?: string | null;
  birth_date?: string | null;
  hire_date?: string | null;
  tin_number?: string | null;
  sss_number?: string | null;
  philhealth_number?: string | null;
  pagibig_number?: string | null;
  hmo_provider?: string | null;
  is_active: boolean;
  created_at: string;
  employee_location_assignments?: {
    location_id: string;
    office_locations?: { id: string; name: string } | null;
  }[];
}

interface Location {
  id: string;
  name: string;
}

type ScheduleRow = {
  id: string;
  employee_id: string;
  employee_name: string;
  schedule_date: string;
  start_time: string;
  end_time: string;
  tasks: string | null;
};

const getColorStyleForEmployee = (employeeId: string) => {
  const hash = employeeId
    .split("")
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const hue = hash % 360;
  const bg = `hsl(${hue}deg 80% 94%)`;
  const border = `hsl(${hue}deg 70% 82%)`;
  const text = `hsl(${hue}deg 45% 28%)`;
  return { bg, border, text };
};

export default function EmployeesPage() {
  const supabase = createClient();
  const { role, isAdmin, loading: roleLoading } = useUserRole();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"directory" | "schedules">(
    "directory"
  );
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState({
    employee_id: "",
    last_name: "",
    first_name: "",
    middle_initial: "",
    assigned_hotel: "",
    locations: [] as string[],
    address: "",
    birth_date: "",
    gender: "",
    hire_date: "",
    tin_number: "",
    sss_number: "",
    philhealth_number: "",
    pagibig_number: "",
    hmo_provider: "",
    paternity_days: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordEmployee, setPasswordEmployee] = useState<Employee | null>(
    null
  );
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [filters, setFilters] = useState<{ employee_id: string }>({
    employee_id: "all",
  });
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [selectedScheduleEntry, setSelectedScheduleEntry] =
    useState<ScheduleRow | null>(null);

  const locationMap = useMemo(() => {
    const map = new Map<string, string>();
    locations.forEach((loc) => map.set(loc.id, loc.name));
    return map;
  }, [locations]);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const scheduleAllowed =
    isAdmin || role === "account_manager" || role === "hr";

  useEffect(() => {
    fetchEmployees();
    fetchLocations();
  }, []);

  useEffect(() => {
    if (activeTab === "schedules" && scheduleAllowed) {
      loadWeek();
    }
  }, [activeTab, weekStart, filters.employee_id, scheduleAllowed]);

  async function fetchEmployees() {
    try {
      const { data, error } = await supabase
        .from("employees")
        .select(
          `*,
          employee_location_assignments (
            location_id,
            office_locations (
              id,
              name
            )
          )`
        )
        .order("last_name", { ascending: true, nullsFirst: true })
        .order("first_name", { ascending: true, nullsFirst: true });

      if (error) throw error;

      setEmployees(data || []);
    } catch (error: any) {
      console.error("Error fetching employees:", error);
      toast.error(
        `Failed to load employees: ${error.message || "Unknown error"}`
      );
    } finally {
      setLoading(false);
    }
  }

  async function fetchLocations() {
    try {
      const { data, error } = await supabase
        .from("office_locations")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setLocations(data || []);
    } catch (error) {
      console.error("Error fetching locations:", error);
    }
  }

  async function loadWeek() {
    setScheduleLoading(true);
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
      setScheduleRows((data || []) as ScheduleRow[]);
    }
    setScheduleLoading(false);
  }

  function openAddModal() {
    setEditingEmployee(null);
    setFormData({
      employee_id: "",
      last_name: "",
      first_name: "",
      middle_initial: "",
      assigned_hotel: "",
      locations: [],
      address: "",
      birth_date: "",
      gender: "",
      hire_date: "",
      tin_number: "",
      sss_number: "",
      philhealth_number: "",
      pagibig_number: "",
      hmo_provider: "",
      paternity_days: "",
    });
    setShowModal(true);
  }

  function openEditModal(employee: Employee) {
    setEditingEmployee(employee);
    setFormData({
      employee_id: employee.employee_id,
      last_name: employee.last_name || "",
      first_name: employee.first_name || "",
      middle_initial: employee.middle_initial || "",
      assigned_hotel: employee.assigned_hotel || "",
      locations:
        employee.employee_location_assignments?.map((a) => a.location_id) || [],
      address: employee.address || "",
      birth_date: employee.birth_date
        ? new Date(employee.birth_date).toISOString().slice(0, 10)
        : "",
      gender: (employee as any).gender || "",
      hire_date: employee.hire_date
        ? new Date(employee.hire_date).toISOString().slice(0, 10)
        : "",
      tin_number: employee.tin_number || "",
      sss_number: employee.sss_number || "",
      philhealth_number: employee.philhealth_number || "",
      pagibig_number: employee.pagibig_number || "",
      hmo_provider: employee.hmo_provider || "",
      paternity_days: "",
    });
    setShowModal(true);
  }

  const toggleLocationSelection = (locationId: string) => {
    setFormData((prev) => {
      const exists = prev.locations.includes(locationId);
      return {
        ...prev,
        locations: exists
          ? prev.locations.filter((id) => id !== locationId)
          : [...prev.locations, locationId],
      };
    });
  };

  async function saveEmployeeLocations(
    employeeId: string,
    locationIds: string[]
  ) {
    const { error: deleteError } = await supabase
      .from("employee_location_assignments")
      .delete()
      .eq("employee_id", employeeId);

    if (deleteError) throw deleteError;

    if (locationIds.length === 0) {
      return;
    }

    const inserts = locationIds.map((location_id) => ({
      employee_id: employeeId,
      location_id,
    }));

    const { error: insertError } = await supabase
      .from("employee_location_assignments")
      .insert(inserts);

    if (insertError) throw insertError;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (formData.locations.length === 0) {
      toast.error("Please assign at least one location");
      return;
    }

    setSubmitting(true);

    try {
      const middleInitial = formData.middle_initial
        ? ` ${formData.middle_initial}.`
        : "";
      const full_name = `${formData.first_name}${middleInitial} ${formData.last_name}`;

      const primaryLocationName =
        formData.locations.length > 0
          ? locationMap.get(formData.locations[0]) ||
            locations.find((loc) => loc.id === formData.locations[0])?.name ||
            null
          : null;

      const employeeData = {
        employee_id: formData.employee_id,
        full_name: full_name.trim(),
        last_name: formData.last_name,
        first_name: formData.first_name,
        middle_initial: formData.middle_initial || null,
        assigned_hotel: primaryLocationName,
        address: formData.address || null,
        birth_date: formData.birth_date || null,
        hire_date: formData.hire_date || null,
        tin_number: formData.tin_number || null,
        sss_number: formData.sss_number || null,
        philhealth_number: formData.philhealth_number || null,
        pagibig_number: formData.pagibig_number || null,
        hmo_provider: formData.hmo_provider || null,
        gender: formData.gender || null,
        paternity_credits:
          formData.gender === "male"
            ? parseFloat(formData.paternity_days || "0") || 0
            : 0,
        offset_hours: editingEmployee?.offset_hours ?? 0,
      };

      let employeeId = editingEmployee ? editingEmployee.id : "";

      if (editingEmployee) {
        const { error } = await supabase
          .from("employees")
          .update(employeeData)
          .eq("id", editingEmployee.id);

        if (error) throw error;
        await saveEmployeeLocations(editingEmployee.id, formData.locations);
        toast.success("Employee updated successfully!", {
          description: `${full_name} • ${formData.employee_id}`,
        });
      } else {
        const { data: inserted, error } = await supabase
          .from("employees")
          .insert([
            {
              ...employeeData,
              portal_password: formData.employee_id,
            },
          ])
          .select("id")
          .single();

        if (error) throw error;
        employeeId = inserted?.id || "";
        if (employeeId) {
          await saveEmployeeLocations(employeeId, formData.locations);
        }
        toast.success("Employee added successfully!", {
          description: `${full_name} • Portal password set to Employee ID`,
        });
      }

      setShowModal(false);
      fetchEmployees();
    } catch (error: any) {
      console.error("Error saving employee:", error);
      toast.error(error.message || "Failed to save employee");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleEmployeeStatus(employee: Employee) {
    try {
      const { error } = await supabase
        .from("employees")
        .update({ is_active: !employee.is_active })
        .eq("id", employee.id);

      if (error) throw error;

      toast.success(
        `Employee ${
          employee.is_active ? "deactivated" : "activated"
        } successfully!`,
        {
          description: `${employee.full_name} • ${employee.employee_id}`,
        }
      );
      fetchEmployees();
    } catch (error: any) {
      console.error("Error toggling employee status:", error);
      toast.error("Failed to update employee status");
    }
  }

  function openPasswordModal(employee: Employee) {
    setPasswordEmployee(employee);
    setNewPassword("");
    setConfirmPassword("");
    setShowPasswordModal(true);
  }

  async function handlePasswordUpdate(e: React.FormEvent) {
    e.preventDefault();

    if (!passwordEmployee) return;

    if (!newPassword.trim()) {
      toast.error("Password cannot be empty");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (newPassword.length < 4) {
      toast.error("Password must be at least 4 characters long");
      return;
    }

    setPasswordSubmitting(true);

    try {
      const { error } = await supabase
        .from("employees")
        .update({ portal_password: newPassword.trim() })
        .eq("id", passwordEmployee.id);

      if (error) throw error;

      toast.success("Portal password updated successfully!", {
        description: `${passwordEmployee.full_name} • ${passwordEmployee.employee_id}`,
      });
      setShowPasswordModal(false);
      fetchEmployees();
    } catch (error: any) {
      console.error("Error updating password:", error);
      toast.error(error.message || "Failed to update password");
    } finally {
      setPasswordSubmitting(false);
    }
  }

  async function resetPasswordToDefault(employee: Employee) {
    if (
      !confirm(
        "Reset password to Employee ID? This will set the password to: " +
          employee.employee_id
      )
    ) {
      return;
    }

    setPasswordSubmitting(true);

    try {
      const { error } = await supabase
        .from("employees")
        .update({ portal_password: employee.employee_id })
        .eq("id", employee.id);

      if (error) throw error;

      toast.success("Password reset to Employee ID");
      setShowPasswordModal(false);
      fetchEmployees();
    } catch (error: any) {
      console.error("Error resetting password:", error);
      toast.error(error.message || "Failed to reset password");
    } finally {
      setPasswordSubmitting(false);
    }
  }

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employee_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupedSchedules = weekDays.map((d) => {
    const iso = format(d, "yyyy-MM-dd");
    return {
      date: iso,
      label: format(d, "EEE, MMM d"),
      entries: scheduleRows.filter((r) => r.schedule_date === iso),
    };
  });

  return (
    <DashboardLayout>
      <VStack gap="8" className="w-full pb-24">
        {/* Header Section */}
        <HStack justify="between" align="center">
          <VStack gap="2" align="start">
            <H1>Employee Management</H1>
            <BodySmall>Manage employee records and view schedules.</BodySmall>
          </VStack>
          <Button onClick={openAddModal}>
            <Icon name="Plus" size={IconSizes.sm} />
            Add Employee
          </Button>
        </HStack>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "directory" | "schedules")}
          className="space-y-4"
        >
          <TabsList>
            <TabsTrigger value="directory">Directory</TabsTrigger>
            <TabsTrigger value="schedules">Schedules</TabsTrigger>
          </TabsList>

          <TabsContent value="directory" className="space-y-4">
            <CardSection
              title="Directory"
              description="Search, edit, and manage employee portal access."
            >
              <HStack justify="between" align="end" gap="4">
                <div className="relative flex-1 max-w-md">
                  <Icon
                    name="MagnifyingGlass"
                    size={IconSizes.sm}
                    className="absolute left-3 top-2.5 text-muted-foreground"
                  />
                  <Input
                    type="search"
                    placeholder="Search by name or employee ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <HStack gap="2" align="center">
                  <Icon
                    name="User"
                    size={IconSizes.sm}
                    className="text-muted-foreground"
                  />
                  <Caption>{filteredEmployees.length} employees</Caption>
                </HStack>
              </HStack>

              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
                </div>
              ) : (
                <div className="overflow-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee ID</TableHead>
                        <TableHead>Employee</TableHead>
                        <TableHead>Assigned Locations</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEmployees.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center">
                            {searchTerm
                              ? "No employees found matching your search."
                              : "No employees yet. Add your first employee!"}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredEmployees.map((employee) => (
                          <TableRow key={employee.id}>
                            <TableCell className="font-semibold">
                              {employee.employee_id}
                            </TableCell>
                            <TableCell>
                              <HStack gap="3" align="center">
                                <EmployeeAvatar
                                  profilePictureUrl={
                                    employee.profile_picture_url
                                  }
                                  fullName={employee.full_name}
                                  size="sm"
                                />
                                <span>{employee.full_name}</span>
                              </HStack>
                            </TableCell>
                            <TableCell className="max-w-xl text-sm text-muted-foreground">
                              {(() => {
                                const locationNames =
                                  employee.employee_location_assignments
                                    ?.map(
                                      (assignment) =>
                                        assignment.office_locations?.name ||
                                        locationMap.get(
                                          assignment.location_id
                                        ) ||
                                        null
                                    )
                                    .filter((name): name is string =>
                                      Boolean(name)
                                    ) || [];

                                if (locationNames.length > 0) {
                                  return locationNames.join(", ");
                                }

                                if (employee.assigned_hotel) {
                                  return employee.assigned_hotel;
                                }

                                return "—";
                              })()}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  employee.is_active
                                    ? "bg-emerald-100 text-emerald-900 border-emerald-200"
                                    : "bg-slate-100 text-slate-800 border-slate-200"
                                }
                              >
                                {employee.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <HStack
                                gap="2"
                                justify="end"
                                className="whitespace-nowrap"
                              >
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => openEditModal(employee)}
                                >
                                  <Icon
                                    name="PencilSimple"
                                    size={IconSizes.sm}
                                  />
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openPasswordModal(employee)}
                                  title="Manage portal account"
                                >
                                  <Icon name="Key" size={IconSizes.sm} />
                                  Portal
                                </Button>
                                <Button
                                  size="sm"
                                  variant={
                                    employee.is_active
                                      ? "destructive"
                                      : "default"
                                  }
                                  onClick={() => toggleEmployeeStatus(employee)}
                                >
                                  <Icon name="Power" size={IconSizes.sm} />
                                  {employee.is_active
                                    ? "Deactivate"
                                    : "Activate"}
                                </Button>
                              </HStack>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardSection>
          </TabsContent>

          <TabsContent value="schedules" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Schedules</CardTitle>
                <CardDescription>
                  Weekly schedules for account managers, HR, and admins.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {roleLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
                  </div>
                ) : !scheduleAllowed ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    Only account managers, HR, or admins can view schedules.
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                      <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="space-y-1.5">
                          <Label>Week starting (Mon)</Label>
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
                        </div>
                        <div className="space-y-1.5">
                          <Label>Employee</Label>
                          <Select
                            value={filters.employee_id}
                            onValueChange={(value) =>
                              setFilters({ employee_id: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="All employees" />
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
                      </div>
                      <Button
                        className="w-full sm:w-auto"
                        variant="secondary"
                        onClick={loadWeek}
                        disabled={scheduleLoading}
                      >
                        <Icon name="ArrowsClockwise" size={IconSizes.sm} />
                        {scheduleLoading ? "Refreshing..." : "Refresh"}
                      </Button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      {groupedSchedules.map((col) => (
                        <Card key={col.date} className="border-muted/60">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base">
                              {col.label}
                            </CardTitle>
                            <CardDescription>{col.date}</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {col.entries.length === 0 ? (
                              <p className="text-sm text-muted-foreground">
                                No schedules
                              </p>
                            ) : (
                              col.entries.map((entry) => {
                                const color = getColorStyleForEmployee(
                                  entry.employee_id
                                );
                                return (
                                  <div
                                    key={entry.id}
                                    onClick={() =>
                                      setSelectedScheduleEntry(entry)
                                    }
                                    className="rounded-md border px-3 py-2 text-sm cursor-pointer transition-all hover:shadow-md"
                                    style={{
                                      backgroundColor: color.bg,
                                      borderColor: color.border,
                                      color: color.text,
                                    }}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="font-semibold">
                                        {entry.employee_name}
                                      </span>
                                      <Badge
                                        variant="outline"
                                        className="bg-white/60 text-xs"
                                      >
                                        Shift
                                      </Badge>
                                    </div>
                                    <HStack
                                      gap="2"
                                      align="center"
                                      className="mt-1 text-xs"
                                    >
                                      <Icon
                                        name="CalendarBlank"
                                        size={IconSizes.sm}
                                      />
                                      {formatPHTime(
                                        new Date(entry.schedule_date),
                                        "MMM dd"
                                      )}
                                    </HStack>
                                    {entry.start_time && entry.end_time ? (
                                      <HStack
                                        gap="2"
                                        align="center"
                                        className="mt-1 text-xs"
                                      >
                                        <Icon
                                          name="Clock"
                                          size={IconSizes.sm}
                                        />
                                        {`${formatPHTime(
                                          new Date(
                                            `${entry.schedule_date}T${entry.start_time}`
                                          ),
                                          "h:mm a"
                                        )} - ${formatPHTime(
                                          new Date(
                                            `${entry.schedule_date}T${entry.end_time}`
                                          ),
                                          "h:mm a"
                                        )}`}
                                      </HStack>
                                    ) : (
                                      <HStack
                                        gap="2"
                                        align="center"
                                        className="mt-1 text-xs text-muted-foreground"
                                      >
                                        <Icon
                                          name="Clock"
                                          size={IconSizes.sm}
                                        />
                                        No schedule set
                                      </HStack>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog
          open={!!selectedScheduleEntry}
          onOpenChange={(open) => !open && setSelectedScheduleEntry(null)}
        >
          <DialogContent className="overflow-x-hidden max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {selectedScheduleEntry?.employee_name} -{" "}
                {selectedScheduleEntry &&
                  format(
                    new Date(selectedScheduleEntry.schedule_date),
                    "EEEE, MMM d, yyyy"
                  )}
              </DialogTitle>
              <DialogDescription>Schedule details and tasks</DialogDescription>
            </DialogHeader>
            {selectedScheduleEntry && (
              <div className="mt-4 space-y-4 min-w-0">
                <div className="min-w-0 w-full">
                  <Label className="text-sm font-medium">Schedule</Label>
                  {selectedScheduleEntry.start_time &&
                  selectedScheduleEntry.end_time ? (
                    <p className="mt-2 text-sm">
                      {formatPHTime(
                        new Date(
                          `${selectedScheduleEntry.schedule_date}T${selectedScheduleEntry.start_time}`
                        ),
                        "h:mm a"
                      )}{" "}
                      -{" "}
                      {formatPHTime(
                        new Date(
                          `${selectedScheduleEntry.schedule_date}T${selectedScheduleEntry.end_time}`
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
                  {selectedScheduleEntry.tasks ? (
                    <div className="mt-2 min-w-0 w-full overflow-hidden">
                      <p className="text-sm whitespace-pre-wrap break-words bg-muted p-3 rounded-md overflow-wrap-anywhere word-break-break-all max-w-full">
                        {selectedScheduleEntry.tasks}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground italic">
                      No tasks submitted for this day
                    </p>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </VStack>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4">
            <DialogTitle>
              {editingEmployee ? "Edit Employee" : "Add New Employee"}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={handleSubmit}
            className="flex flex-col flex-1 min-h-0"
          >
            <div className="space-y-4 overflow-y-auto flex-1 px-6 pr-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="employee-id">Employee ID</Label>
                  <Input
                    id="employee-id"
                    required
                    value={formData.employee_id}
                    onChange={(e) =>
                      setFormData({ ...formData, employee_id: e.target.value })
                    }
                    disabled={!!editingEmployee}
                    placeholder="EMP001"
                  />
                  <p className="text-xs text-muted-foreground">
                    Unique identifier. Immutable after creation.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hire-date">Hire Date</Label>
                  <Input
                    id="hire-date"
                    type="date"
                    value={formData.hire_date}
                    onChange={(e) =>
                      setFormData({ ...formData, hire_date: e.target.value })
                    }
                    required
                    disabled={!!editingEmployee && !isAdmin}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="last-name">Last Name</Label>
                  <Input
                    id="last-name"
                    required
                    value={formData.last_name}
                    onChange={(e) =>
                      setFormData({ ...formData, last_name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="first-name">First Name</Label>
                  <Input
                    id="first-name"
                    required
                    value={formData.first_name}
                    onChange={(e) =>
                      setFormData({ ...formData, first_name: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="middle-initial">Middle Initial</Label>
                  <Input
                    id="middle-initial"
                    value={formData.middle_initial}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        middle_initial: e.target.value
                          .toUpperCase()
                          .slice(0, 1),
                      })
                    }
                    placeholder="M"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="birth-date">Birth Date</Label>
                  <Input
                    id="birth-date"
                    type="date"
                    value={formData.birth_date}
                    onChange={(e) =>
                      setFormData({ ...formData, birth_date: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(value) =>
                      setFormData({ ...formData, gender: value })
                    }
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Used to auto-allocate maternity/paternity leave.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    placeholder="Residential address"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Assigned Locations</Label>
                <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                  {locations.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No active locations configured yet. Add locations first.
                    </p>
                  ) : (
                    locations.map((loc) => {
                      const checked = formData.locations.includes(loc.id);
                      return (
                        <label
                          key={loc.id}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                            checked
                              ? "border-emerald-200 bg-emerald-50"
                              : "border-border"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                            checked={checked}
                            onChange={() => toggleLocationSelection(loc.id)}
                          />
                          <span>{loc.name}</span>
                        </label>
                      );
                    })
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Select at least one location. The first selected becomes the
                  primary location.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tin">TIN #</Label>
                  <Input
                    id="tin"
                    value={formData.tin_number}
                    onChange={(e) =>
                      setFormData({ ...formData, tin_number: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sss">SSS #</Label>
                  <Input
                    id="sss"
                    value={formData.sss_number}
                    onChange={(e) =>
                      setFormData({ ...formData, sss_number: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="philhealth">PhilHealth #</Label>
                  <Input
                    id="philhealth"
                    value={formData.philhealth_number}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        philhealth_number: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pagibig">Pag-IBIG #</Label>
                  <Input
                    id="pagibig"
                    value={formData.pagibig_number}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        pagibig_number: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hmo">HMO</Label>
                <Input
                  id="hmo"
                  value={formData.hmo_provider}
                  onChange={(e) =>
                    setFormData({ ...formData, hmo_provider: e.target.value })
                  }
                  placeholder="Provider name"
                />
              </div>

              <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                <p className="text-sm font-semibold text-foreground">
                  Leave Allocations (auto-managed)
                </p>
                <p className="text-xs text-muted-foreground">
                  SIL: 10 days after first anniversary (usable until Dec 31),
                  then prorated monthly each year. Maternity: 105 days when
                  gender is female.
                </p>
                {formData.gender === "male" && (
                  <div className="space-y-2">
                    <Label htmlFor="paternity">Paternity Leave (days)</Label>
                    <Input
                      id="paternity"
                      type="number"
                      min="0"
                      step="0.5"
                      value={formData.paternity_days}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          paternity_days: e.target.value,
                        })
                      }
                      placeholder="e.g., 7"
                    />
                  </div>
                )}
              </div>
            </div>
            <DialogFooter className="flex items-center justify-end gap-2 flex-shrink-0 pt-4 pb-6 px-6 border-t bg-background">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting
                  ? "Saving..."
                  : editingEmployee
                  ? "Update"
                  : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Manage Portal Account
              {passwordEmployee?.full_name
                ? ` - ${passwordEmployee.full_name}`
                : ""}
            </DialogTitle>
          </DialogHeader>
          {passwordEmployee && (
            <form onSubmit={handlePasswordUpdate} className="space-y-4">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
                <p className="text-emerald-900">
                  <strong>Employee ID:</strong> {passwordEmployee.employee_id}
                </p>
                <p className="text-xs text-emerald-800 mt-1">
                  Default password is the employee ID.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  minLength={4}
                  required
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={passwordSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  minLength={4}
                  required
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={passwordSubmitting}
                />
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                Employee will use this password to sign in at /employee-login.
              </div>

              <DialogFooter className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    passwordEmployee && resetPasswordToDefault(passwordEmployee)
                  }
                  disabled={passwordSubmitting}
                >
                  <Icon
                    name="ClockClockwise"
                    size={IconSizes.sm}
                    className="mr-2"
                  />
                  Reset to default
                </Button>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowPasswordModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={passwordSubmitting}>
                    {passwordSubmitting ? "Saving..." : "Update password"}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
