"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { H1, BodySmall, Caption } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { CardSection } from "@/components/ui/card-section";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";

interface Employee {
  id: string;
  company_id: string | null;
  /** Official company personnel ID (e.g. AX-10001). Shown in HR UI and reports. */
  company_id_no: string;
  /** Digits only; matches ZKTeco user PIN and biometric webhook. */
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
  /** Overtime / approval routing: must match an `overtime_groups` row. */
  overtime_group_id?: string | null;
  departments: { name: string } | null;
  positions: { name: string; job_grade: string | null } | null;
}

interface OvertimeGroupOption {
  id: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
}

interface Position {
  id: string;
  name: string;
  job_grade: string | null;
}

function fullName(emp: Employee): string {
  return [emp.first_name, emp.middle_name, emp.last_name, emp.suffix].filter(Boolean).join(" ");
}

const emptyForm = {
  company_id_no: "",
  employee_code: "",
  first_name: "",
  middle_name: "",
  last_name: "",
  suffix: "",
  date_of_birth: "",
  sex: "",
  civil_status: "",
  mobile: "",
  email: "",
  address: "",
  contact_person: "",
  sss_number: "",
  philhealth_number: "",
  pagibig_number: "",
  tin: "",
  nbi_clearance_expiration_date: "",
  employment_type: "regular",
  hire_date: "",
  regularization_date: "",
  end_of_contract: "",
  employment_status: "active",
  department_id: "",
  position_id: "",
  salary_basis: "monthly",
  base_rate: "",
  bank_name: "",
  bank_account_name: "",
  bank_account_number: "",
  overtime_group_id: "",
};

export default function EmployeesPage() {
  const supabase = createClient();
  const router = useRouter();
  const { role, isAdmin, isHR, canAccessSalaryInfo, loading: roleLoading } = useUserRole();
  const { canRead, loading: permissionsLoading } = usePermissions();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [overtimeGroups, setOvertimeGroups] = useState<OvertimeGroupOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState({ ...emptyForm });
  const [submitting, setSubmitting] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  useEffect(() => {
    if (permissionsLoading) return;
    if (!canRead("employees")) {
      router.replace("/");
    }
  }, [canRead, permissionsLoading, router]);

  useEffect(() => {
    if (permissionsLoading || !canRead("employees")) return;
    fetchEmployees();
    fetchDepartments();
    fetchPositions();
    fetchOvertimeGroups();
  }, [permissionsLoading, canRead]);

  if (!permissionsLoading && !canRead("employees")) {
    return (
      <DashboardLayout>
        <VStack gap="4" className="w-full"><BodySmall>Redirecting…</BodySmall></VStack>
      </DashboardLayout>
    );
  }

  async function fetchEmployees() {
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("*, departments:department_id ( name ), positions:position_id ( name, job_grade )")
        .order("last_name", { ascending: true })
        .order("first_name", { ascending: true });
      if (error) throw error;
      setEmployees((data || []) as Employee[]);
    } catch (error: any) {
      console.error("Error fetching employees:", error);
      toast.error(`Failed to load employees: ${error.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }

  async function fetchDepartments() {
    try {
      const { data, error } = await supabase.from("departments").select("id, name").eq("is_active", true).order("name");
      if (error) throw error;
      setDepartments(data || []);
    } catch { setDepartments([]); }
  }

  async function fetchPositions() {
    try {
      const { data, error } = await supabase.from("positions").select("id, name, job_grade").order("name");
      if (error) throw error;
      setPositions(data || []);
    } catch { setPositions([]); }
  }

  async function fetchOvertimeGroups() {
    try {
      const { data, error } = await supabase
        .from("overtime_groups")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      setOvertimeGroups(data || []);
    } catch {
      setOvertimeGroups([]);
    }
  }

  async function openAddModal() {
    setEditingEmployee(null);
    setFormData({ ...emptyForm });
    setShowModal(true);
    try {
      const { data } = await supabase.from("employees").select("employee_code");
      const max = Math.max(
        0,
        ...(data ?? [])
          .map((e) => parseInt(String(e.employee_code), 10))
          .filter((n) => !Number.isNaN(n))
      );
      setFormData((prev) => ({ ...prev, employee_code: String(max + 1) }));
    } catch {
      setFormData((prev) => ({ ...prev, employee_code: "1" }));
    }
  }

  function openEditModal(employee: Employee) {
    setEditingEmployee(employee);
    setFormData({
      company_id_no: employee.company_id_no,
      employee_code: employee.employee_code,
      first_name: employee.first_name,
      middle_name: employee.middle_name || "",
      last_name: employee.last_name,
      suffix: employee.suffix || "",
      date_of_birth: employee.date_of_birth ? new Date(employee.date_of_birth).toISOString().slice(0, 10) : "",
      sex: employee.sex || "",
      civil_status: employee.civil_status || "",
      mobile: employee.mobile || "",
      email: employee.email || "",
      address: employee.address || "",
      contact_person: employee.contact_person || "",
      sss_number: employee.sss_number || "",
      philhealth_number: employee.philhealth_number || "",
      pagibig_number: employee.pagibig_number || "",
      tin: employee.tin || "",
      nbi_clearance_expiration_date: employee.nbi_clearance_expiration_date
        ? new Date(employee.nbi_clearance_expiration_date).toISOString().slice(0, 10)
        : "",
      employment_type: employee.employment_type,
      hire_date: employee.hire_date ? new Date(employee.hire_date).toISOString().slice(0, 10) : "",
      regularization_date: employee.regularization_date ? new Date(employee.regularization_date).toISOString().slice(0, 10) : "",
      end_of_contract: employee.end_of_contract ? new Date(employee.end_of_contract).toISOString().slice(0, 10) : "",
      employment_status: employee.employment_status,
      department_id: employee.department_id || "",
      position_id: employee.position_id || "",
      salary_basis: employee.salary_basis,
      base_rate: String(employee.base_rate || ""),
      bank_name: employee.bank_name || "",
      bank_account_name: employee.bank_account_name || "",
      bank_account_number: employee.bank_account_number || "",
      overtime_group_id: employee.overtime_group_id || "",
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const companyIdNo = formData.company_id_no.trim();
    const biometricId = formData.employee_code.trim();
    if (!/^\d+$/.test(biometricId)) {
      toast.error("Time clock / biometric ID must be digits only (e.g. 10001).");
      return;
    }
    setSubmitting(true);

    try {
      const employeeData: Record<string, unknown> = {
        company_id_no: companyIdNo,
        employee_code: biometricId,
        first_name: formData.first_name,
        middle_name: formData.middle_name || null,
        last_name: formData.last_name,
        suffix: formData.suffix || null,
        date_of_birth: formData.date_of_birth || null,
        sex: formData.sex || null,
        civil_status: formData.civil_status || null,
        mobile: formData.mobile || null,
        email: formData.email || null,
        address: formData.address || null,
        contact_person: formData.contact_person || null,
        sss_number: formData.sss_number || null,
        philhealth_number: formData.philhealth_number || null,
        pagibig_number: formData.pagibig_number || null,
        tin: formData.tin || null,
        nbi_clearance_expiration_date: formData.nbi_clearance_expiration_date || null,
        employment_type: formData.employment_type,
        hire_date: formData.hire_date,
        regularization_date: formData.regularization_date || null,
        end_of_contract: formData.end_of_contract || null,
        employment_status: formData.employment_status,
        department_id: formData.department_id || null,
        position_id: formData.position_id || null,
        salary_basis: formData.salary_basis,
        base_rate: formData.base_rate ? parseFloat(formData.base_rate) : 0,
        bank_name: formData.bank_name || null,
        bank_account_name: formData.bank_account_name || null,
        bank_account_number: formData.bank_account_number || null,
        overtime_group_id: formData.overtime_group_id ? formData.overtime_group_id : null,
      };

      if (editingEmployee) {
        const { error } = await supabase
          .from("employees")
          .update(employeeData as never)
          .eq("id", editingEmployee.id);
        if (error) throw error;
        toast.success("Employee updated successfully!", {
          description: `${formData.first_name} ${formData.last_name} · ${companyIdNo}`,
        });
      } else {
        const { data: companyData } = await supabase
          .from("companies")
          .select("id")
          .limit(1)
          .single();
        const { error } = await supabase.from("employees").insert([
          {
            ...employeeData,
            company_id: companyData?.id,
            // Default employee portal password to employee code
            portal_password: companyIdNo,
          } as never,
        ]);
        if (error) throw error;
        toast.success("Employee added successfully!", {
          description: `${formData.first_name} ${formData.last_name} · ${companyIdNo}`,
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
    const newStatus = employee.employment_status === "active" ? "inactive" : "active";
    try {
      const { error } = await supabase.from("employees").update({ employment_status: newStatus } as never).eq("id", employee.id);
      if (error) throw error;
      toast.success(`Employee ${newStatus === "active" ? "activated" : "deactivated"} successfully!`, {
        description: `${fullName(employee)} · ${employee.company_id_no}`,
      });
      fetchEmployees();
    } catch (error: any) {
      console.error("Error toggling employee status:", error);
      toast.error("Failed to update employee status");
    }
  }

  const filteredEmployees = employees.filter((emp) => {
    const name = fullName(emp).toLowerCase();
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      name.includes(term) ||
      emp.company_id_no.toLowerCase().includes(term) ||
      emp.employee_code.toLowerCase().includes(term) ||
      (emp.email || "").toLowerCase().includes(term);
    const matchesStatus = statusFilter === "all" || emp.employment_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  async function exportEmployeeMasterlistToPDF() {
    setGeneratingPDF(true);
    try {
      const doc = new jsPDF("landscape", "mm", "a4");
      const pageWidth = doc.internal.pageSize.getWidth();
      let yPos = 15;

      try {
        const logoResponse = await fetch("/addbell-logo.jpg");
        if (logoResponse.ok) {
          const logoBlob = await logoResponse.blob();
          const logoDataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(logoBlob);
          });
          const logoWidth = 50;
          const logoHeight = (logoWidth * 185) / 500;
          doc.addImage(logoDataUrl, "JPEG", 15, yPos, logoWidth, logoHeight);
          yPos += logoHeight + 8;
        }
      } catch { /* continue without logo */ }

      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("ADDBELL TECHNICAL SERVICE INC.", 15, yPos);
      yPos += 8;

      doc.setFontSize(14);
      doc.setFont("helvetica", "normal");
      doc.text("Employee Masterlist", 15, yPos);
      yPos += 6;

      doc.setFontSize(10);
      doc.text(`As of ${format(new Date(), "MMMM d, yyyy")}`, 15, yPos);
      yPos += 10;

      const tableData = employees.map((emp, index) => [
        (index + 1).toString(),
        emp.company_id_no,
        emp.employee_code,
        emp.last_name,
        emp.first_name,
        emp.middle_name || "",
        emp.departments?.name || "",
        emp.positions?.name || "",
        emp.employment_type,
        emp.hire_date ? format(new Date(emp.hire_date), "MM/dd/yyyy") : "",
        emp.date_of_birth ? format(new Date(emp.date_of_birth), "MM/dd/yyyy") : "",
        emp.sss_number || "",
        emp.philhealth_number || "",
        emp.pagibig_number || "",
        emp.tin || "",
        emp.employment_status,
      ]);

      const columns = [
        "#", "Company ID no.", "Time clock ID", "Last Name", "First Name", "Middle", "Department", "Position",
        "Type", "Hire Date", "Birth Date", "SSS", "PhilHealth", "Pag-IBIG", "TIN", "Status",
      ];

      const availableWidth = pageWidth - 10;
      autoTable(doc, {
        head: [columns],
        body: tableData,
        startY: yPos,
        styles: { fontSize: 5.5, cellPadding: 1.2, overflow: "linebreak", lineWidth: 0.1, textColor: [0, 0, 0] },
        headStyles: { fillColor: [34, 139, 34], textColor: 255, fontStyle: "bold", fontSize: 5.5, cellPadding: 1.2 },
        margin: { left: 5, right: 5 },
        tableWidth: availableWidth,
        showHead: "everyPage",
      });

      doc.save(`Employee_Masterlist_${format(new Date(), "yyyy-MM-dd")}.pdf`);
      toast.success("Employee masterlist exported successfully!");
    } catch (error: any) {
      console.error("Error exporting PDF:", error);
      toast.error("Failed to export employee masterlist", { description: error.message || "An error occurred" });
    } finally {
      setGeneratingPDF(false);
    }
  }

  return (
    <DashboardLayout>
      <VStack gap="8" className="w-full pb-24">
        <HStack justify="between" align="center">
          <VStack gap="2" align="start">
            <H1>Employee Management</H1>
            <BodySmall>Manage employee records, departments, and positions.</BodySmall>
          </VStack>
          <Button onClick={openAddModal}>
            <Icon name="Plus" size={IconSizes.sm} />
            Add Employee
          </Button>
        </HStack>

        <div className="space-y-4">
          <CardSection title="Directory" description="Search, view, and manage employee records.">
            <HStack justify="between" align="end" gap="4">
              <div className="relative flex-1 max-w-md">
                <Icon name="MagnifyingGlass" size={IconSizes.sm} className="absolute left-3 top-2.5 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search by name, company ID, time clock ID, or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <HStack gap="2" align="center">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="terminated">Terminated</SelectItem>
                  </SelectContent>
                </Select>
                {(isAdmin || role === "hr") && (
                  <Button variant="secondary" size="sm" onClick={exportEmployeeMasterlistToPDF} disabled={generatingPDF || employees.length === 0}>
                    <Icon name={generatingPDF ? "ArrowsClockwise" : "FilePdf"} size={IconSizes.sm} className={generatingPDF ? "animate-spin" : ""} />
                    {generatingPDF ? "Generating..." : "Export PDF"}
                  </Button>
                )}
                <HStack gap="2" align="center">
                  <Icon name="User" size={IconSizes.sm} className="text-muted-foreground" />
                  <Caption>{filteredEmployees.length} employees</Caption>
                </HStack>
              </HStack>
            </HStack>

            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table className="min-w-full">
                  <TableHeader>
                    <TableRow className="h-10">
                      <TableHead className="w-[120px] whitespace-nowrap py-2 text-xs font-semibold">Company ID</TableHead>
                      <TableHead className="w-[100px] whitespace-nowrap py-2 text-xs font-semibold">Time clock</TableHead>
                      <TableHead className="min-w-[200px] py-2 text-xs font-semibold">Employee</TableHead>
                      <TableHead className="min-w-[140px] py-2 text-xs font-semibold">Department</TableHead>
                      <TableHead className="min-w-[140px] py-2 text-xs font-semibold">Position</TableHead>
                      <TableHead className="min-w-[100px] py-2 text-xs font-semibold">Type</TableHead>
                      <TableHead className="w-[90px] whitespace-nowrap py-2 text-xs font-semibold">Status</TableHead>
                      <TableHead className="text-right w-[160px] whitespace-nowrap py-2 text-xs font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEmployees.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          {searchTerm ? "No employees found matching your search." : "No employees yet. Add your first employee!"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredEmployees.map((employee) => (
                        <TableRow key={employee.id} className="h-auto hover:bg-muted/50">
                          <TableCell className="font-semibold font-mono whitespace-nowrap py-2 text-sm">
                            {employee.company_id_no}
                          </TableCell>
                          <TableCell className="font-mono text-muted-foreground whitespace-nowrap py-2 text-sm">
                            {employee.employee_code}
                          </TableCell>
                          <TableCell className="min-w-[200px] py-2">
                            <Link href={`/employees/${employee.id}`} className="hover:underline text-primary font-medium text-sm">
                              {fullName(employee)}
                            </Link>
                            {employee.email && (
                              <p className="text-xs text-muted-foreground mt-0.5">{employee.email}</p>
                            )}
                          </TableCell>
                          <TableCell className="text-sm py-2">
                            {employee.departments?.name || <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-sm py-2">
                            {employee.positions ? (
                              <div>
                                <span>{employee.positions.name}</span>
                                {employee.positions.job_grade && (
                                  <Badge variant="outline" className="ml-2 text-[10px]">{employee.positions.job_grade}</Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm py-2 capitalize">{employee.employment_type}</TableCell>
                          <TableCell className="py-2">
                            <Badge
                              variant="outline"
                              className={`text-xs capitalize ${
                                employee.employment_status === "active"
                                  ? "bg-emerald-100 text-emerald-900 border-emerald-200"
                                  : employee.employment_status === "terminated"
                                  ? "bg-red-100 text-red-900 border-red-200"
                                  : "bg-slate-100 text-slate-800 border-slate-200"
                              }`}
                            >
                              {employee.employment_status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right w-[160px] py-2">
                            <HStack gap="2" justify="end" className="whitespace-nowrap">
                              <Link href={`/employees/${employee.id}`}>
                                <Button size="sm" variant="ghost" className="h-7 px-2" title="View details">
                                  <Icon name="Eye" size={IconSizes.sm} />
                                </Button>
                              </Link>
                              <Button size="sm" variant="secondary" onClick={() => openEditModal(employee)} className="h-7 px-2" title="Edit employee">
                                <Icon name="PencilSimple" size={IconSizes.sm} />
                              </Button>
                              <Button
                                size="sm"
                                variant={employee.employment_status === "active" ? "destructive" : "default"}
                                onClick={() => toggleEmployeeStatus(employee)}
                                className="h-7 px-2"
                                title={employee.employment_status === "active" ? "Deactivate" : "Activate"}
                              >
                                <Icon name="Power" size={IconSizes.sm} />
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
        </div>
      </VStack>

      {/* Add / Edit Employee Dialog */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4">
            <DialogTitle>{editingEmployee ? "Edit Employee" : "Add New Employee"}</DialogTitle>
            <DialogDescription>
              {editingEmployee ? "Update employee information below." : "Fill in the details to create a new employee record."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="space-y-5 overflow-y-auto flex-1 px-6 pr-4">
              {/* Basic Info */}
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">Basic Information</h3>
                <div className="h-px bg-border" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="company-id-no">Company ID no. *</Label>
                  <Input
                    id="company-id-no"
                    required
                    value={formData.company_id_no}
                    onChange={(e) => setFormData({ ...formData, company_id_no: e.target.value })}
                    placeholder="e.g. AX-10001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employee-code">Time clock / biometric ID *</Label>
                  <Input
                    id="employee-code"
                    required
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={formData.employee_code}
                    onChange={(e) => setFormData({ ...formData, employee_code: e.target.value.replace(/\D/g, "") })}
                    placeholder="1, 2, 3…"
                  />
                  <p className="text-xs text-muted-foreground">
                    Sequential ID for the ZKTeco terminal (suggested next number when you click Add Employee).
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employment-type">Employment Type *</Label>
                  <Select value={formData.employment_type} onValueChange={(v) => setFormData({ ...formData, employment_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="regular">Regular</SelectItem>
                      <SelectItem value="probationary">Probationary</SelectItem>
                      <SelectItem value="contractual">Contractual</SelectItem>
                      <SelectItem value="project_based">Project Based</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hire-date">Hire Date *</Label>
                  <Input id="hire-date" type="date" required value={formData.hire_date}
                    onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })} />
                </div>
              </div>

              {/* Name */}
              <div className="grid gap-4 sm:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="first-name">First Name *</Label>
                  <Input id="first-name" required value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="middle-name">Middle Name</Label>
                  <Input id="middle-name" value={formData.middle_name}
                    onChange={(e) => setFormData({ ...formData, middle_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last-name">Last Name *</Label>
                  <Input id="last-name" required value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="suffix">Suffix</Label>
                  <Input id="suffix" value={formData.suffix}
                    onChange={(e) => setFormData({ ...formData, suffix: e.target.value })} placeholder="Jr., Sr." />
                </div>
              </div>

              {/* Personal */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="date-of-birth">Date of Birth</Label>
                  <Input id="date-of-birth" type="date" value={formData.date_of_birth}
                    onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Sex</Label>
                  <Select value={formData.sex} onValueChange={(v) => setFormData({ ...formData, sex: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Civil Status</Label>
                  <Select value={formData.civil_status} onValueChange={(v) => setFormData({ ...formData, civil_status: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Single</SelectItem>
                      <SelectItem value="married">Married</SelectItem>
                      <SelectItem value="widowed">Widowed</SelectItem>
                      <SelectItem value="separated">Separated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Contact */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="mobile">Mobile</Label>
                  <Input id="mobile" value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })} placeholder="09XX-XXX-XXXX" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="contact-person">Contact person</Label>
                  <Input id="contact-person" value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    placeholder="Name of emergency or designated contact" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea id="address" value={formData.address} rows={2}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
              </div>

              {/* Department & Position */}
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">Department & Position</h3>
                <div className="h-px bg-border" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select value={formData.department_id || "none"} onValueChange={(v) => setFormData({ ...formData, department_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Position</Label>
                  <Select value={formData.position_id || "none"} onValueChange={(v) => setFormData({ ...formData, position_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Select position" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {positions.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}{p.job_grade ? ` (${p.job_grade})` : ""}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Overtime group (approvals)</Label>
                  <Select
                    value={formData.overtime_group_id || "none"}
                    onValueChange={(v) =>
                      setFormData({ ...formData, overtime_group_id: v === "none" ? "" : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="None — assign on Overtime Groups page" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {overtimeGroups.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Caption className="text-muted-foreground">
                    OT, leave, and failure-to-log approvals use this group so the assigned operations approver can act on requests.
                  </Caption>
                </div>
              </div>

              {/* Employment Dates */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Employment Status</Label>
                  <Select value={formData.employment_status} onValueChange={(v) => setFormData({ ...formData, employment_status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="terminated">Terminated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-date">Regularization Date</Label>
                  <Input id="reg-date" type="date" value={formData.regularization_date}
                    onChange={(e) => setFormData({ ...formData, regularization_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eoc-date">End of Contract</Label>
                  <Input id="eoc-date" type="date" value={formData.end_of_contract}
                    onChange={(e) => setFormData({ ...formData, end_of_contract: e.target.value })} />
                </div>
              </div>

              {/* Government IDs */}
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">Government IDs</h3>
                <div className="h-px bg-border" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sss">SSS #</Label>
                  <Input id="sss" value={formData.sss_number} onChange={(e) => setFormData({ ...formData, sss_number: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="philhealth">PhilHealth #</Label>
                  <Input id="philhealth" value={formData.philhealth_number} onChange={(e) => setFormData({ ...formData, philhealth_number: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pagibig">Pag-IBIG #</Label>
                  <Input id="pagibig" value={formData.pagibig_number} onChange={(e) => setFormData({ ...formData, pagibig_number: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tin">TIN</Label>
                  <Input id="tin" value={formData.tin} onChange={(e) => setFormData({ ...formData, tin: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nbi-expiration">NBI Clearance (expiration date)</Label>
                  <Input id="nbi-expiration" type="date" value={formData.nbi_clearance_expiration_date}
                    onChange={(e) => setFormData({ ...formData, nbi_clearance_expiration_date: e.target.value })} />
                </div>
              </div>

              {/* Salary */}
              {canAccessSalaryInfo && (
                <>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-foreground">Compensation</h3>
                    <div className="h-px bg-border" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Salary Basis</Label>
                      <Select value={formData.salary_basis} onValueChange={(v) => setFormData({ ...formData, salary_basis: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="daily">Daily</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="base-rate">Base Rate (₱)</Label>
                      <Input id="base-rate" type="number" step="0.01" min="0" value={formData.base_rate}
                        onChange={(e) => setFormData({ ...formData, base_rate: e.target.value })} placeholder="0.00" />
                    </div>
                  </div>
                </>
              )}

              {/* Bank */}
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">Bank Details</h3>
                <div className="h-px bg-border" />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="bank-name">Bank Name</Label>
                  <Input id="bank-name" value={formData.bank_name} onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank-acct-name">Account Name</Label>
                  <Input id="bank-acct-name" value={formData.bank_account_name} onChange={(e) => setFormData({ ...formData, bank_account_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank-acct-no">Account Number</Label>
                  <Input id="bank-acct-no" value={formData.bank_account_number} onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })} />
                </div>
              </div>
            </div>

            <DialogFooter className="flex items-center justify-end gap-2 flex-shrink-0 pt-4 pb-6 px-6 border-t bg-background">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : editingEmployee ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
