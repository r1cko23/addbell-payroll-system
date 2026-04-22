"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import Link from "next/link";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useProfile } from "@/lib/hooks/useProfile";
import { ArrowLeft, Edit, Save, AlertTriangle, MapPin } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";

interface Employee {
  id: string;
  company_id: string | null;
  user_id: string | null;
  company_id_no: string;
  employee_code: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
  date_of_birth: string | null;
  sex: string | null;
  civil_status: string | null;
  mobile: string | null;
  email: string | null;
  address: string | null;
  contact_person: string | null;
  contact_person_relationship: string | null;
  sss_number: string | null;
  philhealth_number: string | null;
  pagibig_number: string | null;
  tin: string | null;
  nbi_clearance_expiration_date: string | null;
  employment_type: string;
  hire_date: string;
  regularization_date: string | null;
  end_of_contract: string | null;
  employment_status: string;
  department_id: string | null;
  position_id: string | null;
  supervisor_id: string | null;
  salary_basis: string;
  base_rate: number;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  created_at: string;
  updated_at: string;
  departments: { name: string } | null;
  positions: { name: string; job_grade: string | null } | null;
}

interface ProjectAssignment {
  id: string;
  role: string | null;
  start_date: string;
  is_active: boolean;
  projects: { name: string; code: string } | null;
}

interface AttendanceRecord {
  id: string;
  work_date: string;
  total_hours: number | null;
  regular_hours: number | null;
  overtime_hours: number | null;
  night_diff_hours: number | null;
  status: string | null;
}

interface ClockOfficeLocation {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  radius_meters: number;
}

const CLOCK_SITE_ORDER = [
  "Addbell Main Office",
  "Techlog Center Philippines",
  "Advance Energy Cavite",
] as const;

export default function EmployeeDetailPage() {
  const params = useParams();
  const employeeId = params.id as string;
  const supabase = createClient();
  const { profile } = useProfile();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [assignments, setAssignments] = useState<ProjectAssignment[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editForm, setEditForm] = useState<Partial<Employee>>({});

  const [clockOffices, setClockOffices] = useState<ClockOfficeLocation[]>([]);
  const [clockSelectedIds, setClockSelectedIds] = useState<string[]>([]);
  const [clockAllowAnywhere, setClockAllowAnywhere] = useState(false);
  const [clockLoading, setClockLoading] = useState(false);
  const [clockSaving, setClockSaving] = useState(false);
  const [portalPasswordInput, setPortalPasswordInput] = useState("");
  const [portalSaving, setPortalSaving] = useState(false);
  const [portalTempPassword, setPortalTempPassword] = useState<string | null>(null);

  useEffect(() => {
    if (!employeeId) return;
    fetchData();
  }, [employeeId]);

  const fetchData = async () => {
    setLoading(true);
    const [empRes, assignRes, attendRes] = await Promise.all([
      supabase
        .from("employees")
        .select("*, departments:department_id ( name ), positions:position_id ( name, job_grade )")
        .eq("id", employeeId)
        .single(),
      supabase
        .from("project_assignments")
        .select("id, role, start_date, is_active, projects:project_id ( name, code )")
        .eq("employee_id", employeeId)
        .order("start_date", { ascending: false }),
      supabase
        .from("attendance_records")
        .select("id, work_date, total_hours, regular_hours, overtime_hours, night_diff_hours, status")
        .eq("employee_id", employeeId)
        .order("work_date", { ascending: false })
        .limit(30),
    ]);
    if (!empRes.error && empRes.data) setEmployee(empRes.data as unknown as Employee);
    setAssignments((assignRes.data as unknown as ProjectAssignment[]) ?? []);
    setAttendance((attendRes.data as unknown as AttendanceRecord[]) ?? []);
    setLoading(false);
  };

  const startEdit = () => {
    if (!employee) return;
    setEditForm({ ...employee });
    setEditing(true);
  };

  const handleSave = async () => {
    if (!employee) return;
    setSaving(true);
    const { error } = await supabase
      .from("employees")
      .update({
        first_name: editForm.first_name,
        middle_name: editForm.middle_name || null,
        last_name: editForm.last_name,
        suffix: editForm.suffix || null,
        date_of_birth: editForm.date_of_birth || null,
        sex: editForm.sex || null,
        civil_status: editForm.civil_status || null,
        mobile: editForm.mobile || null,
        email: editForm.email || null,
        address: editForm.address || null,
        contact_person: editForm.contact_person || null,
        contact_person_relationship: editForm.contact_person_relationship || null,
        sss_number: editForm.sss_number || null,
        philhealth_number: editForm.philhealth_number || null,
        pagibig_number: editForm.pagibig_number || null,
        tin: editForm.tin || null,
        nbi_clearance_expiration_date: editForm.nbi_clearance_expiration_date || null,
        employment_type: editForm.employment_type,
        employment_status: editForm.employment_status,
        salary_basis: editForm.salary_basis,
        base_rate: editForm.base_rate,
        bank_name: editForm.bank_name || null,
        bank_account_name: editForm.bank_account_name || null,
        bank_account_number: editForm.bank_account_number || null,
        regularization_date: editForm.regularization_date || null,
        end_of_contract: editForm.end_of_contract || null,
      } as never)
      .eq("id", employee.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Employee updated.");
      setEditing(false);
      fetchData();
    }
    setSaving(false);
  };

  const canEdit =
    profile?.role === "admin" ||
    profile?.role === "upper_management" ||
    profile?.role === "hr" ||
    profile?.role === "operations_manager";

  const loadClockSites = useCallback(async () => {
    if (!employeeId || !canEdit) return;
    setClockLoading(true);
    try {
      const res = await fetch(
        `/api/hr/employee-location-assignments?employee_id=${encodeURIComponent(employeeId)}`
      );
      const json = (await res.json().catch(() => ({}))) as {
        office_locations?: ClockOfficeLocation[];
        assigned_location_ids?: string[];
        allow_clock_anywhere?: boolean;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error || "Failed to load");
      }
      setClockOffices(json.office_locations ?? []);
      setClockSelectedIds(json.assigned_location_ids ?? []);
      setClockAllowAnywhere(!!json.allow_clock_anywhere);
    } catch {
      toast.error("Could not load bundy clock sites.");
    } finally {
      setClockLoading(false);
    }
  }, [employeeId, canEdit]);

  useEffect(() => {
    loadClockSites();
  }, [loadClockSites]);

  const toggleClockSite = (locationId: string) => {
    setClockSelectedIds((prev) =>
      prev.includes(locationId)
        ? prev.filter((id) => id !== locationId)
        : [...prev, locationId]
    );
  };

  const saveClockSites = async () => {
    if (!employeeId) return;
    setClockSaving(true);
    try {
      const res = await fetch("/api/hr/employee-location-assignments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: employeeId,
          location_ids: clockSelectedIds,
          allow_clock_anywhere: clockAllowAnywhere,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(json.error || "Could not save sites.");
        return;
      }
      toast.success("Clock access updated.");
      await loadClockSites();
    } finally {
      setClockSaving(false);
    }
  };

  const resetPortalPassword = async (useDefaultPassword: boolean) => {
    if (!employeeId) return;
    if (!useDefaultPassword && portalPasswordInput.trim().length < 4) {
      toast.error("Custom portal password must be at least 4 characters long.");
      return;
    }

    setPortalSaving(true);
    try {
      const res = await fetch("/api/hr/employee-portal-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: employeeId,
          new_password: useDefaultPassword ? undefined : portalPasswordInput.trim(),
          use_default_password: useDefaultPassword,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        temporary_password?: string;
      };

      if (!res.ok) {
        toast.error(json.error || "Could not reset portal password.");
        return;
      }

      setPortalTempPassword(json.temporary_password ?? null);
      setPortalPasswordInput("");
      toast.success(
        useDefaultPassword
          ? "Employee portal password reset to company ID no."
          : "Employee portal password updated."
      );
    } catch (error) {
      console.error(error);
      toast.error("Could not reset employee portal password.");
    } finally {
      setPortalSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="animate-pulse h-8 w-48 bg-slate-200 rounded" />
      </DashboardLayout>
    );
  }

  if (!employee) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <Link href="/employees">
            <Button variant="ghost">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <p className="text-destructive">Employee not found.</p>
        </div>
      </DashboardLayout>
    );
  }

  const empFullName = [
    employee.first_name,
    employee.middle_name,
    employee.last_name,
    employee.suffix,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/employees">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{empFullName}</h1>
              <p className="text-muted-foreground text-sm">
                {employee.company_id_no}
                <span className="text-muted-foreground/80"> · time clock {employee.employee_code}</span>
                {" · "}
                {employee.employment_type} · {employee.salary_basis}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={employee.employment_status === "active" ? "default" : "secondary"}
              className="capitalize"
            >
              {employee.employment_status}
            </Badge>
            {canEdit && !editing && (
              <Button size="sm" onClick={startEdit}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
          </div>
        </div>

        {/* NBI Clearance warning: expired or expiring within 30 days */}
        {employee.nbi_clearance_expiration_date && (() => {
          const nbiDate = new Date(employee.nbi_clearance_expiration_date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          nbiDate.setHours(0, 0, 0, 0);
          const daysUntil = differenceInDays(nbiDate, today);
          const isExpired = daysUntil < 0;
          const isExpiringSoon = daysUntil >= 0 && daysUntil <= 30;
          if (!isExpired && !isExpiringSoon) return null;
          return (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-900">
                  {isExpired
                    ? "NBI Clearance has expired"
                    : "NBI Clearance expiring soon"}
                </p>
                <p className="text-sm text-amber-800 mt-1">
                  Expiration date: {format(nbiDate, "MMM d, yyyy")}
                  {isExpired && " — please update to avoid assignment issues."}
                  {isExpiringSoon && !isExpired && ` — ${daysUntil} days remaining.`}
                </p>
              </div>
            </div>
          );
        })()}

        <Tabs defaultValue="personal" className="space-y-4">
          <TabsList>
            <TabsTrigger value="personal">Personal Info</TabsTrigger>
            <TabsTrigger value="employment">Employment</TabsTrigger>
            <TabsTrigger value="government">Government IDs</TabsTrigger>
            <TabsTrigger value="bank">Bank Details</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
            {canEdit && (
              <TabsTrigger value="clock-sites" className="gap-1">
                <MapPin className="h-3.5 w-3.5" />
                Clock access
              </TabsTrigger>
            )}
            {canEdit && <TabsTrigger value="portal-access">Portal Access</TabsTrigger>}
          </TabsList>

          {/* Personal Info */}
          <TabsContent value="personal">
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
              </CardHeader>
              <CardContent>
                {editing ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>First Name *</Label>
                      <Input
                        value={editForm.first_name ?? ""}
                        onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Middle Name</Label>
                      <Input
                        value={editForm.middle_name ?? ""}
                        onChange={(e) => setEditForm({ ...editForm, middle_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Last Name *</Label>
                      <Input
                        value={editForm.last_name ?? ""}
                        onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Suffix</Label>
                      <Input
                        value={editForm.suffix ?? ""}
                        onChange={(e) => setEditForm({ ...editForm, suffix: e.target.value })}
                        placeholder="Jr., Sr., III"
                      />
                    </div>
                    <div>
                      <Label>Date of Birth</Label>
                      <Input
                        type="date"
                        value={editForm.date_of_birth ?? ""}
                        onChange={(e) => setEditForm({ ...editForm, date_of_birth: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Sex</Label>
                      <Select
                        value={editForm.sex ?? ""}
                        onValueChange={(v) => setEditForm({ ...editForm, sex: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Civil Status</Label>
                      <Select
                        value={editForm.civil_status ?? ""}
                        onValueChange={(v) => setEditForm({ ...editForm, civil_status: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="single">Single</SelectItem>
                          <SelectItem value="married">Married</SelectItem>
                          <SelectItem value="widowed">Widowed</SelectItem>
                          <SelectItem value="separated">Separated</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Mobile</Label>
                      <Input
                        value={editForm.mobile ?? ""}
                        onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={editForm.email ?? ""}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Contact person</Label>
                      <Input
                        value={editForm.contact_person ?? ""}
                        onChange={(e) => setEditForm({ ...editForm, contact_person: e.target.value })}
                        placeholder="Name of emergency or designated contact"
                      />
                    </div>
                    <div>
                      <Label>Contact person relationship</Label>
                      <Input
                        value={editForm.contact_person_relationship ?? ""}
                        onChange={(e) => setEditForm({ ...editForm, contact_person_relationship: e.target.value })}
                        placeholder="e.g. Spouse, Parent, Sibling"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Address</Label>
                      <Textarea
                        value={editForm.address ?? ""}
                        onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                        rows={2}
                      />
                    </div>
                    <div className="md:col-span-2 flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => setEditing(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleSave} disabled={saving}>
                        <Save className="h-4 w-4 mr-2" />
                        {saving ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs uppercase">Name</span>
                      <p className="font-medium mt-1">{empFullName}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs uppercase">Date of Birth</span>
                      <p className="mt-1">
                        {employee.date_of_birth
                          ? format(new Date(employee.date_of_birth), "MMM d, yyyy")
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs uppercase">Sex</span>
                      <p className="mt-1 capitalize">{employee.sex || "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs uppercase">Civil Status</span>
                      <p className="mt-1 capitalize">{employee.civil_status || "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs uppercase">Mobile</span>
                      <p className="mt-1">{employee.mobile || "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs uppercase">Email</span>
                      <p className="mt-1">{employee.email || "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs uppercase">Contact person</span>
                      <p className="mt-1">{employee.contact_person || "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs uppercase">Relationship</span>
                      <p className="mt-1">{employee.contact_person_relationship || "—"}</p>
                    </div>
                    <div className="md:col-span-2">
                      <span className="text-muted-foreground text-xs uppercase">Address</span>
                      <p className="mt-1">{employee.address || "—"}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Employment */}
          <TabsContent value="employment">
            <Card>
              <CardHeader>
                <CardTitle>Employment Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs uppercase">Company ID no.</span>
                    <p className="font-medium mt-1 font-mono">{employee.company_id_no}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs uppercase">Time clock / biometric ID</span>
                    <p className="font-medium mt-1 font-mono">{employee.employee_code}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs uppercase">Employment Type</span>
                    <p className="mt-1 capitalize">{employee.employment_type}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs uppercase">Hire Date</span>
                    <p className="mt-1">{format(new Date(employee.hire_date), "MMM d, yyyy")}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs uppercase">Regularization Date</span>
                    <p className="mt-1">
                      {employee.regularization_date
                        ? format(new Date(employee.regularization_date), "MMM d, yyyy")
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs uppercase">End of Contract</span>
                    <p className="mt-1">
                      {employee.end_of_contract
                        ? format(new Date(employee.end_of_contract), "MMM d, yyyy")
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs uppercase">Status</span>
                    <p className="mt-1">
                      <Badge
                        variant={employee.employment_status === "active" ? "default" : "secondary"}
                        className="capitalize"
                      >
                        {employee.employment_status}
                      </Badge>
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs uppercase">Department</span>
                    <p className="mt-1">{employee.departments?.name || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs uppercase">Position</span>
                    <p className="mt-1">{employee.positions?.name || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs uppercase">Salary Basis</span>
                    <p className="mt-1 capitalize">{employee.salary_basis}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs uppercase">Base Rate</span>
                    <p className="mt-1 font-medium">
                      ₱{Number(employee.base_rate).toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Government IDs */}
          <TabsContent value="government">
            <Card>
              <CardHeader>
                <CardTitle>Government IDs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs uppercase">SSS Number</span>
                    <p className="mt-1">{employee.sss_number || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs uppercase">PhilHealth Number</span>
                    <p className="mt-1">{employee.philhealth_number || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs uppercase">Pag-IBIG Number</span>
                    <p className="mt-1">{employee.pagibig_number || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs uppercase">TIN</span>
                    <p className="mt-1">{employee.tin || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs uppercase">NBI Clearance (expiration date)</span>
                    {editing ? (
                      <Input
                        type="date"
                        className="mt-1 max-w-xs"
                        value={editForm.nbi_clearance_expiration_date ?? ""}
                        onChange={(e) =>
                          setEditForm({ ...editForm, nbi_clearance_expiration_date: e.target.value || null })
                        }
                      />
                    ) : (
                      <p className="mt-1">
                        {employee.nbi_clearance_expiration_date
                          ? format(new Date(employee.nbi_clearance_expiration_date), "MMM d, yyyy")
                          : "—"}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bank Details */}
          <TabsContent value="bank">
            <Card>
              <CardHeader>
                <CardTitle>Bank Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs uppercase">Bank Name</span>
                    <p className="mt-1">{employee.bank_name || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs uppercase">Account Name</span>
                    <p className="mt-1">{employee.bank_account_name || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs uppercase">Account Number</span>
                    <p className="mt-1">{employee.bank_account_number || "—"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Projects */}
          <TabsContent value="projects">
            <Card>
              <CardHeader>
                <CardTitle>Project Assignments</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                          No project assignments
                        </TableCell>
                      </TableRow>
                    ) : (
                      assignments.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell>
                            {a.projects ? (
                              <Link
                                href={`/projects/${a.projects.code}`}
                                className="text-primary hover:underline"
                              >
                                {a.projects.code} — {a.projects.name}
                              </Link>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell>{a.role || "—"}</TableCell>
                          <TableCell>{format(new Date(a.start_date), "MMM d, yyyy")}</TableCell>
                          <TableCell>
                            <Badge variant={a.is_active ? "default" : "secondary"}>
                              {a.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bundy GPS: allowed office_locations */}
          {canEdit && (
            <TabsContent value="clock-sites">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle>Clock access</CardTitle>
                      <p className="text-sm text-muted-foreground font-normal mt-1">
                        Select where this employee can clock in or out, or enable clock anywhere
                        for mobile/on-the-go assignments.
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      {clockSelectedIds.length} selected
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {clockLoading ? (
                    <p className="text-sm text-muted-foreground">Loading locations...</p>
                  ) : clockOffices.length === 0 ? (
                    <p className="text-sm text-destructive">Clock locations are not set up yet.</p>
                  ) : (
                    <>
                      <label className="flex items-start gap-3 rounded-lg border bg-background p-3">
                        <Checkbox
                          checked={clockAllowAnywhere}
                          onCheckedChange={(checked) =>
                            setClockAllowAnywhere(Boolean(checked))
                          }
                          className="mt-0.5"
                        />
                        <div className="space-y-0.5 min-w-0">
                          <p className="font-medium text-sm">Allow clock anywhere</p>
                          <p className="text-xs text-muted-foreground">
                            Employee can clock in/out from any location. GPS coordinates are still
                            recorded for audit.
                          </p>
                        </div>
                      </label>
                      <div className="rounded-xl border bg-muted/20 p-3 space-y-2">
                        {[...clockOffices]
                          .sort(
                            (a, b) =>
                              CLOCK_SITE_ORDER.indexOf(
                                a.name as (typeof CLOCK_SITE_ORDER)[number]
                              ) -
                              CLOCK_SITE_ORDER.indexOf(
                                b.name as (typeof CLOCK_SITE_ORDER)[number]
                              )
                          )
                          .map((loc) => {
                            const checked = clockSelectedIds.includes(loc.id);
                            return (
                              <label
                                key={loc.id}
                                className={cn(
                                  "flex items-start gap-3 rounded-lg border bg-background p-3 transition-colors cursor-pointer",
                                  checked
                                    ? "border-primary bg-primary/5 shadow-sm"
                                    : "hover:bg-muted/40"
                                )}
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() => toggleClockSite(loc.id)}
                                  disabled={clockAllowAnywhere}
                                  className="mt-0.5"
                                />
                                <div className="space-y-0.5 min-w-0">
                                  <p className="font-medium text-sm">{loc.name}</p>
                                  {loc.address ? (
                                    <p className="text-xs text-muted-foreground">{loc.address}</p>
                                  ) : null}
                                  <p className="text-xs text-muted-foreground font-mono">
                                    {Number(loc.latitude).toFixed(6)},{" "}
                                    {Number(loc.longitude).toFixed(6)} · {loc.radius_meters}m radius
                                  </p>
                                </div>
                              </label>
                            );
                          })}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={saveClockSites}
                          disabled={clockSaving}
                        >
                          {clockSaving ? "Saving..." : "Save access"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={loadClockSites}
                          disabled={clockLoading || clockSaving}
                        >
                          Reload
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {canEdit && (
            <TabsContent value="portal-access">
              <Card>
                <CardHeader>
                  <CardTitle>Employee Portal Access</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border bg-muted/20 p-4 text-sm">
                    <p className="font-medium">Portal login identifier</p>
                    <p className="mt-1 font-mono">{employee.employee_code}</p>
                    <p className="mt-3 text-muted-foreground">
                      Employees can change their own password inside the employee portal. If they
                      forget it, HR can reset it here.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="custom-portal-password">Set custom temporary password</Label>
                    <Input
                      id="custom-portal-password"
                      type="text"
                      value={portalPasswordInput}
                      onChange={(e) => setPortalPasswordInput(e.target.value)}
                      placeholder="Enter a temporary portal password"
                      disabled={portalSaving}
                    />
                    <p className="text-xs text-muted-foreground">
                      Use at least 4 characters. Share this temporary password with the employee.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={() => resetPortalPassword(true)}
                      disabled={portalSaving}
                    >
                      {portalSaving ? "Saving..." : "Reset to Company ID No."}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => resetPortalPassword(false)}
                      disabled={portalSaving || portalPasswordInput.trim().length < 4}
                    >
                      {portalSaving ? "Saving..." : "Set Custom Password"}
                    </Button>
                  </div>

                  {portalTempPassword && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                      <p className="text-sm font-medium text-emerald-900">
                        Temporary employee portal password
                      </p>
                      <p className="mt-2 font-mono text-emerald-900">{portalTempPassword}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Attendance */}
          <TabsContent value="attendance">
            <Card>
              <CardHeader>
                <CardTitle>Recent Attendance (last 30 records)</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Regular</TableHead>
                      <TableHead className="text-right">OT</TableHead>
                      <TableHead className="text-right">Night Diff</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendance.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                          No attendance records
                        </TableCell>
                      </TableRow>
                    ) : (
                      attendance.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell>
                            {format(new Date(a.work_date), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell className="text-right">
                            {a.regular_hours != null ? Number(a.regular_hours).toFixed(2) : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {a.overtime_hours != null ? Number(a.overtime_hours).toFixed(2) : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {a.night_diff_hours != null ? Number(a.night_diff_hours).toFixed(2) : "—"}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {a.total_hours != null ? Number(a.total_hours).toFixed(2) : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize text-xs">
                              {a.status || "—"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
