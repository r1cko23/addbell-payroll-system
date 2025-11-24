'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { toast } from 'sonner';
import { Clock, User, Lock } from 'lucide-react';

export default function EmployeeLoginPage() {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    
    if (!employeeId.trim()) {
      toast.error('Please enter your Employee ID');
      return;
    }

    if (!password.trim()) {
      toast.error('Please enter your password');
      return;
    }

    setLoading(true);

    try {
      // Call secure authentication function
      const { data, error } = await supabase.rpc('authenticate_employee', {
        p_employee_id: employeeId.trim(),
        p_password: password.trim()
      });

      if (error) {
        console.error('Authentication error:', error);
        toast.error('Login failed. Please try again.');
        setLoading(false);
        return;
      }

      // Check if authentication was successful
      if (!data || data.length === 0 || !data[0].success) {
        const errorMessage = data && data[0] ? data[0].error_message : 'Invalid credentials';
        toast.error(errorMessage);
        setLoading(false);
        return;
      }

      // Parse employee data from response
      const employeeData = data[0].employee_data;

      // Store employee session in localStorage
      localStorage.setItem('employee_session', JSON.stringify({
        id: employeeData.id,
        employee_id: employeeData.employee_id,
        full_name: employeeData.full_name,
        loginTime: new Date().toISOString()
      }));

      toast.success(`Welcome, ${employeeData.full_name}!`);
      router.push('/employee-portal');
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Login failed. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img 
              src="/Official Logo Cropped.jpg" 
              alt="Add-bell Technical Services" 
              className="h-24 w-auto"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Employee Portal
          </h1>
          <p className="text-gray-600">
            Time Clock & Attendance System
          </p>
        </div>

        {/* Login Card */}
        <Card className="p-8 shadow-xl">
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Employee ID
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="Enter your Employee ID"
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-lg"
                  disabled={loading}
                  autoFocus
                  required
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Example: 2014-027
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-lg"
                  disabled={loading}
                  required
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Default password is your Employee ID
              </p>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full py-3 text-lg font-semibold"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                  Logging in...
                </>
              ) : (
                <>
                  <Lock className="h-5 w-5 mr-2" />
                  Login
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-center text-sm text-gray-600">
              Need help? Contact HR
            </p>
          </div>
        </Card>

        {/* Info */}
        <div className="mt-6 text-center">
          <div className="inline-block bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
            <p className="font-semibold mb-2">📋 Employee Access</p>
            <ul className="text-left space-y-1 text-xs">
              <li>✓ Clock In/Out</li>
              <li>✓ View Time Records</li>
              <li>✓ Check Attendance</li>
              <li>✓ View Payslips (current week)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

