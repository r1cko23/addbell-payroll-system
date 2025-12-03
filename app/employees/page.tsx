'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input, Select } from '@/components/Input';
import { Modal } from '@/components/Modal';
import { Badge } from '@/components/Badge';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import toast from 'react-hot-toast';

interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
  last_name?: string;
  first_name?: string;
  middle_initial?: string;
  assigned_hotel?: string;
  is_active: boolean;
  created_at: string;
}

interface Location {
  id: string;
  name: string;
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState({
    employee_id: '',
    last_name: '',
    first_name: '',
    middle_initial: '',
    assigned_hotel: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordEmployee, setPasswordEmployee] = useState<Employee | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    fetchEmployees();
    fetchLocations();
  }, []);

  async function fetchEmployees() {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('last_name', { nullsFirst: false })
        .order('first_name', { nullsFirst: false });

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  }

  async function fetchLocations() {
    try {
      const { data, error } = await supabase
        .from('office_locations')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      setLocations(data || []);
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  }

  function openAddModal() {
    setEditingEmployee(null);
    setFormData({
      employee_id: '',
      last_name: '',
      first_name: '',
      middle_initial: '',
      assigned_hotel: '',
    });
    setShowModal(true);
  }

  function openEditModal(employee: Employee) {
    setEditingEmployee(employee);
    setFormData({
      employee_id: employee.employee_id,
      last_name: employee.last_name || '',
      first_name: employee.first_name || '',
      middle_initial: employee.middle_initial || '',
      assigned_hotel: employee.assigned_hotel || '',
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Build full_name from separate fields
      const middleInitial = formData.middle_initial ? ` ${formData.middle_initial}.` : '';
      const full_name = `${formData.first_name}${middleInitial} ${formData.last_name}`;

      const employeeData = {
        employee_id: formData.employee_id,
        full_name: full_name.trim(),
        last_name: formData.last_name,
        first_name: formData.first_name,
        middle_initial: formData.middle_initial || null,
        assigned_hotel: formData.assigned_hotel || null,
      };

      if (editingEmployee) {
        // Update existing employee
        const { error } = await supabase
          .from('employees')
          .update(employeeData)
          .eq('id', editingEmployee.id);

        if (error) throw error;
        toast.success('Employee updated successfully');
      } else {
        // Create new employee - set default portal password to employee_id
        const { error } = await supabase
          .from('employees')
          .insert([{
            ...employeeData,
            portal_password: formData.employee_id // Default password is employee_id
          }]);

        if (error) throw error;
        toast.success('Employee added successfully. Portal password set to Employee ID.');
      }

      setShowModal(false);
      fetchEmployees();
    } catch (error: any) {
      console.error('Error saving employee:', error);
      toast.error(error.message || 'Failed to save employee');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleEmployeeStatus(employee: Employee) {
    try {
      const { error } = await supabase
        .from('employees')
        .update({ is_active: !employee.is_active })
        .eq('id', employee.id);

      if (error) throw error;
      
      toast.success(
        `Employee ${employee.is_active ? 'deactivated' : 'activated'} successfully`
      );
      fetchEmployees();
    } catch (error: any) {
      console.error('Error toggling employee status:', error);
      toast.error('Failed to update employee status');
    }
  }

  function openPasswordModal(employee: Employee) {
    setPasswordEmployee(employee);
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswordModal(true);
  }

  async function handlePasswordUpdate(e: React.FormEvent) {
    e.preventDefault();
    
    if (!passwordEmployee) return;

    if (!newPassword.trim()) {
      toast.error('Password cannot be empty');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (newPassword.length < 4) {
      toast.error('Password must be at least 4 characters long');
      return;
    }

    setPasswordSubmitting(true);

    try {
      const { error } = await supabase
        .from('employees')
        .update({ portal_password: newPassword.trim() })
        .eq('id', passwordEmployee.id);

      if (error) throw error;

      toast.success('Portal password updated successfully');
      setShowPasswordModal(false);
      fetchEmployees();
    } catch (error: any) {
      console.error('Error updating password:', error);
      toast.error(error.message || 'Failed to update password');
    } finally {
      setPasswordSubmitting(false);
    }
  }

  async function resetPasswordToDefault(employee: Employee) {
    if (!confirm('Reset password to Employee ID? This will set the password to: ' + employee.employee_id)) {
      return;
    }

    setPasswordSubmitting(true);

    try {
      const { error } = await supabase
        .from('employees')
        .update({ portal_password: employee.employee_id })
        .eq('id', employee.id);

      if (error) throw error;

      toast.success('Password reset to Employee ID');
      setShowPasswordModal(false);
      fetchEmployees();
    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast.error(error.message || 'Failed to reset password');
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
            <h1 className="text-3xl font-bold text-gray-900">Employee Management</h1>
            <p className="text-gray-600 mt-1">
              Manage employee records
            </p>
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
                      Assigned Hotel
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                        {searchTerm
                          ? 'No employees found matching your search'
                          : 'No employees yet. Add your first employee!'}
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {employee.assigned_hotel || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge variant={employee.is_active ? 'success' : 'default'}>
                            {employee.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
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
                            variant={employee.is_active ? 'secondary' : 'primary'}
                            onClick={() => toggleEmployeeStatus(employee)}
                          >
                            {employee.is_active ? 'Deactivate' : 'Activate'}
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
        title={editingEmployee ? 'Edit Employee' : 'Add New Employee'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} isLoading={submitting}>
              {editingEmployee ? 'Update' : 'Create'}
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

          <Input
            label="Middle Initial"
            value={formData.middle_initial}
            onChange={(e) =>
              setFormData({ ...formData, middle_initial: e.target.value.toUpperCase().slice(0, 1) })
            }
            helperText="Optional - just the initial (e.g., M)"
          />

          <Select
            label="Assigned Hotel/Location"
            value={formData.assigned_hotel}
            onChange={(e) =>
              setFormData({ ...formData, assigned_hotel: e.target.value })
            }
            options={[
              { value: '', label: '-- Select Location --' },
              ...locations.map((loc) => ({
                value: loc.name,
                label: loc.name,
              })),
            ]}
            helperText="Select the primary work location"
          />
        </form>
      </Modal>

      {/* Portal Password Management Modal */}
      <Modal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        title={`Manage Portal Account - ${passwordEmployee?.full_name}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowPasswordModal(false)}>
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
            <Button onClick={handlePasswordUpdate} isLoading={passwordSubmitting}>
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
                Default password is the Employee ID. Employees can use this to login to the portal.
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
                  <strong>Note:</strong> The employee will need to use this password to login at{' '}
                  <code className="bg-yellow-100 px-1 rounded">/employee-login</code>
                </p>
              </div>
            </form>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}
