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
import { formatDateDisplay } from '@/utils/holidays';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'hr';
  is_active: boolean;
  created_at: string;
}

interface Holiday {
  id: string;
  holiday_date: string;
  holiday_name: string;
  holiday_type: 'regular' | 'non-working';
  year: number;
}

export default function SettingsPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showHolidayModal, setShowHolidayModal] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      
      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();
        
        setCurrentUser(userData);
      }

      // Load all users (admin only)
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('*')
        .order('full_name');

      if (usersError) throw usersError;
      setUsers(usersData || []);

      // Load holidays
      const { data: holidaysData, error: holidaysError } = await supabase
        .from('holidays')
        .select('*')
        .eq('year', 2025)
        .order('holiday_date');

      if (holidaysError) throw holidaysError;
      setHolidays(holidaysData || []);
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  const isAdmin = currentUser?.role === 'admin';

  if (loading) {
    return (
      <DashboardLayout>
        <LoadingSpinner size="lg" className="mt-20" />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-1">System configuration and user management</p>
        </div>

        {/* User Info */}
        <Card title="Your Account">
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Name:</span>
              <span className="font-semibold">{currentUser?.full_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Email:</span>
              <span className="font-semibold">{currentUser?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Role:</span>
              <Badge variant={isAdmin ? 'warning' : 'info'}>
                {currentUser?.role?.toUpperCase()}
              </Badge>
            </div>
          </div>
        </Card>

        {/* User Management (Admin Only) */}
        {isAdmin && (
          <Card
            title="User Management"
            subtitle="Manage system users"
            action={
              <Button size="sm" onClick={() => setShowUserModal(true)}>
                + Add User
              </Button>
            }
          >
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {user.full_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <Badge variant={user.role === 'admin' ? 'warning' : 'info'}>
                          {user.role.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <Badge variant={user.is_active ? 'success' : 'default'}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Holidays */}
        <Card
          title="Philippine Holidays 2025"
          subtitle="System automatically detects these holidays"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-gray-700 mb-3">Regular Holidays (2x Pay)</h4>
              <div className="space-y-2">
                {holidays
                  .filter((h) => h.holiday_type === 'regular')
                  .map((holiday) => (
                    <div
                      key={holiday.id}
                      className="flex justify-between items-center p-2 bg-red-50 rounded"
                    >
                      <span className="text-sm">{holiday.holiday_name}</span>
                      <span className="text-xs text-gray-600">
                        {formatDateDisplay(holiday.holiday_date)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-gray-700 mb-3">
                Non-Working Holidays (1.3x Pay)
              </h4>
              <div className="space-y-2">
                {holidays
                  .filter((h) => h.holiday_type === 'non-working')
                  .map((holiday) => (
                    <div
                      key={holiday.id}
                      className="flex justify-between items-center p-2 bg-yellow-50 rounded"
                    >
                      <span className="text-sm">{holiday.holiday_name}</span>
                      <span className="text-xs text-gray-600">
                        {formatDateDisplay(holiday.holiday_date)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </Card>

        {/* System Info */}
        <Card title="System Information">
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Version:</span>
              <span className="font-semibold">2.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Database:</span>
              <span className="font-semibold">Supabase (PostgreSQL)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Hosting:</span>
              <span className="font-semibold">Vercel</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Employees:</span>
              <span className="font-semibold">{users.length}</span>
            </div>
          </div>
        </Card>

        {/* Help */}
        <Card title="Need Help?">
          <div className="space-y-2 text-sm text-gray-600">
            <p>
              📖 <strong>Documentation:</strong> Check SETUP.md and README_V2.md in the project root
            </p>
            <p>
              🚀 <strong>Quick Start:</strong> See QUICKSTART.md for a 30-minute setup guide
            </p>
            <p>
              💡 <strong>Weekly Workflow:</strong> Enter Timesheet → Generate Payslips → Admin
              Approval → Print/Export
            </p>
          </div>
        </Card>
      </div>

      {/* Modals */}
      <Modal
        isOpen={showUserModal}
        onClose={() => setShowUserModal(false)}
        title="Add New User"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowUserModal(false)}>
              Cancel
            </Button>
            <Button onClick={() => toast.info('Feature coming soon!')}>Create User</Button>
          </>
        }
      >
        <p className="text-gray-600">
          To add new users, please use the Supabase dashboard Authentication section, then add them to
          the public.users table.
        </p>
      </Modal>
    </DashboardLayout>
  );
}

