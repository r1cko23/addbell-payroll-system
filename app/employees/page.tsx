"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input, Textarea } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { Badge } from "@/components/Badge";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useUserRole } from "@/lib/hooks/useUserRole";
import toast from "react-hot-toast";

interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
  gender?: "male" | "female" | null;
  sil_credits?: number;
  offset_hours?: number;
  last_name?: string;
  first_name?: string;
  middle_initial?: string;
  assigned_hotel?: string;
  address?: string | null;
  birth_date?: string | null;
  gender?: "male" | "female" | null;
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

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
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

  const supabase = createClient();
  const { isAdmin } = useUserRole();
  const locationMap = useMemo(() => {
    const map = new Map<string, string>();
    locations.forEach((loc) => map.set(loc.id, loc.name));
    return map;
  }, [locations]);

  useEffect(() => {
    fetchEmployees();
    fetchLocations();
  }, []);

  async function fetchEmployees() {
    try {
      // Try the nested query first
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

      if (error) {
        console.error("Error with nested query:", error);
        // Fallback: try without nested query
        const { data: simpleData, error: simpleError } = await supabase
          .from("employees")
          .select("*")
          .order("last_name", { ascending: true, nullsFirst: true })
          .order("first_name", { ascending: true, nullsFirst: true });

        if (simpleError) throw simpleError;

        // Fetch locations separately and merge
        const employeesWithLocations = await Promise.all(
          (simpleData || []).map(async (emp) => {
            const { data: locationData } = await supabase
              .from("employee_location_assignments")
              .select(
                `
                location_id,
                office_locations (
                  id,
                  name
                )
              `
              )
              .eq("employee_id", emp.id);

            return {
              ...emp,
              employee_location_assignments: locationData || [],
            };
          })
        );

        setEmployees(employeesWithLocations);
        return;
      }

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
      // Build full_name from separate fields
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
        // Only paternity credits are manually set; SIL and Maternity are auto-calculated
        paternity_credits:
          formData.gender === "male"
            ? parseFloat(formData.paternity_days || "0") || 0
            : 0,
        // Preserve existing offset hours when editing; default to 0 on create
        offset_hours: editingEmployee?.offset_hours ?? 0,
      };

      let employeeId = editingEmployee ? editingEmployee.id : "";

      if (editingEmployee) {
        // Update existing employee
        const { error } = await supabase
          .from("employees")
          .update(employeeData)
          .eq("id", editingEmployee.id);

        if (error) throw error;
        await saveEmployeeLocations(editingEmployee.id, formData.locations);
        toast.success("Employee updated successfully");
      } else {
        // Create new employee - set default portal password to employee_id
        const { data: inserted, error } = await supabase
          .from("employees")
          .insert([
            {
              ...employeeData,
              portal_password: formData.employee_id, // Default password is employee_id
            },
          ])
          .select("id")
          .single();

        if (error) throw error;
        employeeId = inserted?.id || "";
        if (employeeId) {
          await saveEmployeeLocations(employeeId, formData.locations);
        }
        toast.success(
          "Employee added successfully. Portal password set to Employee ID."
        );
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
        } successfully`
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

      toast.success("Portal password updated successfully");
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Employee Management
            </h1>
            <p className="text-gray-600 mt-1">Manage employee records</p>
          </div>
          <Button onClick={openAddModal}>
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add Employee
          </Button>
        </div>

        <Card>
          <div className="mb-4">
            <Input
              type="search"
              placeholder="Search by name or employee ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {loading ? (
            <LoadingSpinner className="py-12" />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Employee ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Full Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Assigned Locations
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky right-0 bg-gray-50 z-10 min-w-[210px]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-12 text-center text-gray-500"
                      >
                        {searchTerm
                          ? "No employees found matching your search"
                          : "No employees yet. Add your first employee!"}
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map((employee) => (
                      <tr key={employee.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {employee.employee_id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {employee.full_name}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 whitespace-normal break-words max-w-xl">
                          {(() => {
                            // First, try to get locations from employee_location_assignments
                            const locationNames =
                              employee.employee_location_assignments
                                ?.map(
                                  (assignment) =>
                                    assignment.office_locations?.name ||
                                    locationMap.get(assignment.location_id) ||
                                    null
                                )
                                .filter((name): name is string =>
                                  Boolean(name)
                                ) || [];

                            // If we have location assignments, show those
                            if (locationNames.length > 0) {
                              return locationNames.join(", ");
                            }

                            // Otherwise, fall back to assigned_hotel if it exists
                            if (employee.assigned_hotel) {
                              return employee.assigned_hotel;
                            }

                            // If neither exists, show dash
                            return "—";
                          })()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge
                            variant={employee.is_active ? "success" : "default"}
                          >
                            {employee.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2 sticky right-0 bg-white z-10 shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.15)]">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditModal(employee)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openPasswordModal(employee)}
                            title="Manage Portal Account"
                          >
                            <svg
                              className="w-4 h-4 mr-1"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                              />
                            </svg>
                            Portal
                          </Button>
                          <Button
                            size="sm"
                            variant={
                              employee.is_active ? "secondary" : "primary"
                            }
                            onClick={() => toggleEmployeeStatus(employee)}
                          >
                            {employee.is_active ? "Deactivate" : "Activate"}
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingEmployee ? "Edit Employee" : "Add New Employee"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} isLoading={submitting}>
              {editingEmployee ? "Update" : "Create"}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Employee ID"
            required
            value={formData.employee_id}
            onChange={(e) =>
              setFormData({ ...formData, employee_id: e.target.value })
            }
            disabled={!!editingEmployee}
            helperText="Unique identifier (e.g., EMP001)"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Last Name"
              required
              value={formData.last_name}
              onChange={(e) =>
                setFormData({ ...formData, last_name: e.target.value })
              }
              helperText="Surname/Family name"
            />

            <Input
              label="First Name"
              required
              value={formData.first_name}
              onChange={(e) =>
                setFormData({ ...formData, first_name: e.target.value })
              }
              helperText="Given name"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Middle Initial"
              value={formData.middle_initial}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  middle_initial: e.target.value.toUpperCase().slice(0, 1),
                })
              }
              helperText="Optional - just the initial (e.g., M)"
            />

            <Input
              type="date"
              label="Birth Date"
              value={formData.birth_date}
              onChange={(e) =>
                setFormData({ ...formData, birth_date: e.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                Gender
              </label>
              <select
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={formData.gender}
                onChange={(e) =>
                  setFormData({ ...formData, gender: e.target.value })
                }
                required
              >
                <option value="" disabled>
                  Select gender
                </option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
              <p className="text-xs text-gray-500">
                Used to auto-allocate maternity/paternity leave.
              </p>
            </div>

            <Input
              type="date"
              label="Hire Date"
              value={formData.hire_date}
              onChange={(e) =>
                setFormData({ ...formData, hire_date: e.target.value })
              }
              helperText="Used for auto SIL accrual eligibility"
              required
              disabled={!!editingEmployee && !isAdmin}
            />
          </div>

          <Textarea
            label="Address"
            rows={3}
            value={formData.address}
            onChange={(e) =>
              setFormData({ ...formData, address: e.target.value })
            }
            helperText="Residential address"
          />

          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-700">
              Assigned Locations
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
              {locations.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No active locations configured yet. Add locations first.
                </p>
              ) : (
                locations.map((loc) => {
                  const checked = formData.locations.includes(loc.id);
                  return (
                    <label
                      key={loc.id}
                      className={`flex items-center gap-2 border rounded-lg px-3 py-2 text-sm ${
                        checked
                          ? "bg-emerald-50 border-emerald-200"
                          : "border-gray-200"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 text-emerald-600 rounded border-gray-300"
                        checked={checked}
                        onChange={() => toggleLocationSelection(loc.id)}
                      />
                      <span className="text-gray-800">{loc.name}</span>
                    </label>
                  );
                })
              )}
            </div>
            <p className="text-xs text-gray-500">
              Select at least one location. The first selected will be treated
              as the primary location.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="TIN #"
              value={formData.tin_number}
              onChange={(e) =>
                setFormData({ ...formData, tin_number: e.target.value })
              }
            />
            <Input
              label="SSS #"
              value={formData.sss_number}
              onChange={(e) =>
                setFormData({ ...formData, sss_number: e.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="PhilHealth #"
              value={formData.philhealth_number}
              onChange={(e) =>
                setFormData({ ...formData, philhealth_number: e.target.value })
              }
            />
            <Input
              label="Pag-IBIG #"
              value={formData.pagibig_number}
              onChange={(e) =>
                setFormData({ ...formData, pagibig_number: e.target.value })
              }
            />
          </div>

          <Input
            label="HMO"
            value={formData.hmo_provider}
            onChange={(e) =>
              setFormData({ ...formData, hmo_provider: e.target.value })
            }
          />

          <div className="space-y-3 border rounded-lg p-4 bg-gray-50">
            <p className="text-sm font-semibold text-gray-700">
              Leave Allocations (auto-managed)
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-gray-700">
                  SIL (auto)
                </p>
                <p className="text-xs text-gray-500">
                  Auto-awarded: 10 days at 1st anniversary (usable until Dec
                  31), then pro-rated monthly (10/12) each year; resets every
                  Jan 1.
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-gray-700">
                  Maternity Leave (auto)
                </p>
                <p className="text-xs text-gray-500">
                  105 days when gender is Female; 0 otherwise.
                </p>
              </div>
              {formData.gender === "male" && (
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  label="Paternity Leave (days)"
                  value={formData.paternity_days}
                  onChange={(e) =>
                    setFormData({ ...formData, paternity_days: e.target.value })
                  }
                  helperText="Enter allocated days (e.g., 7)"
                />
              )}
            </div>
          </div>
        </form>
      </Modal>

      {/* Portal Password Management Modal */}
      <Modal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        title={`Manage Portal Account - ${passwordEmployee?.full_name}`}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowPasswordModal(false)}
            >
              Cancel
            </Button>
            {passwordEmployee && (
              <Button
                variant="ghost"
                onClick={() => resetPasswordToDefault(passwordEmployee)}
                disabled={passwordSubmitting}
              >
                Reset to Default
              </Button>
            )}
            <Button
              onClick={handlePasswordUpdate}
              isLoading={passwordSubmitting}
            >
              Update Password
            </Button>
          </>
        }
      >
        {passwordEmployee && (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <p className="text-sm text-emerald-900">
                <strong>Employee ID:</strong> {passwordEmployee.employee_id}
              </p>
              <p className="text-xs text-emerald-700 mt-1">
                Default password is the Employee ID. Employees can use this to
                login to the portal.
              </p>
            </div>

            <form onSubmit={handlePasswordUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  disabled={passwordSubmitting}
                  required
                  minLength={4}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Minimum 4 characters
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  disabled={passwordSubmitting}
                  required
                  minLength={4}
                />
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-xs text-yellow-800">
                  <strong>Note:</strong> The employee will need to use this
                  password to login at{" "}
                  <code className="bg-yellow-100 px-1 rounded">
                    /employee-login
                  </code>
                </p>
              </div>
            </form>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}
