'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import { 
  Clock, LogOut, User, Calendar, MapPin, 
  FileText, TrendingUp, History
} from 'lucide-react';
import { format, startOfWeek, endOfWeek } from 'date-fns';

interface EmployeeSession {
  id: string;
  employee_id: string;
  full_name: string;
  loginTime: string;
}

interface TimeEntry {
  id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  total_hours: number | null;
  regular_hours: number | null;
  overtime_hours: number | null;
  status: string;
  clock_in_location: string | null;
}

export default function EmployeePortalPage() {
  const router = useRouter();
  const supabase = createClient();
  const [employee, setEmployee] = useState<EmployeeSession | null>(null);
  const [currentEntry, setCurrentEntry] = useState<TimeEntry | null>(null);
  const [weekEntries, setWeekEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    // Check if employee is logged in
    const sessionData = localStorage.getItem('employee_session');
    if (!sessionData) {
      router.push('/employee-login');
      return;
    }

    const emp = JSON.parse(sessionData) as EmployeeSession;
    setEmployee(emp);
    setLoading(false);

    // Get location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => console.log('Location not available:', error),
        { enableHighAccuracy: true }
      );
    }
  }, [router]);

  useEffect(() => {
    if (employee) {
      checkClockStatus();
      fetchWeekEntries();
    }
  }, [employee]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function checkClockStatus() {
    if (!employee) return;

    const { data } = await supabase
      .from('time_clock_entries')
      .select('*')
      .eq('employee_id', employee.id)
      .eq('status', 'clocked_in')
      .order('clock_in_time', { ascending: false })
      .limit(1)
      .single();

    setCurrentEntry(data || null);
  }

  async function fetchWeekEntries() {
    if (!employee) return;

    // Get current pay period (Wednesday to Tuesday)
    const today = new Date();
    const dayOfWeek = today.getDay();
    
    // Calculate days to subtract to get to Wednesday
    let daysToWednesday = dayOfWeek >= 3 ? dayOfWeek - 3 : dayOfWeek + 4;
    
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - daysToWednesday);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // Wednesday to Tuesday (7 days)
    weekEnd.setHours(23, 59, 59, 999);

    const { data } = await supabase
      .from('time_clock_entries')
      .select('*')
      .eq('employee_id', employee.id)
      .gte('clock_in_time', weekStart.toISOString())
      .lte('clock_in_time', weekEnd.toISOString())
      .order('clock_in_time', { ascending: false });

    setWeekEntries(data || []);
  }

  async function handleClockIn() {
    if (!employee) return;

    // GPS is REQUIRED - block if not available
    if (!location) {
      toast.error('📍 Please enable location services to clock in');
      return;
    }

    const locationString = `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`;

    const { data, error } = await supabase
      .from('time_clock_entries')
      .insert({
        employee_id: employee.id,
        clock_in_time: new Date().toISOString(),
        clock_in_location: locationString,
        status: 'clocked_in',
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed to clock in');
      return;
    }

    setCurrentEntry(data);
    toast.success('✅ Clocked in successfully!');
    fetchWeekEntries();
  }

  async function handleClockOut() {
    if (!currentEntry) return;

    // GPS is REQUIRED - block if not available
    if (!location) {
      toast.error('📍 Please enable location services to clock out');
      return;
    }

    const locationString = `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`;

    const { error } = await supabase
      .from('time_clock_entries')
      .update({
        clock_out_time: new Date().toISOString(),
        clock_out_location: locationString,
      })
      .eq('id', currentEntry.id);

    if (error) {
      toast.error('Failed to clock out');
      return;
    }

    toast.success('✅ Clocked out successfully!');
    setCurrentEntry(null);
    fetchWeekEntries();
  }

  function handleLogout() {
    localStorage.removeItem('employee_session');
    router.push('/employee-login');
  }

  if (loading || !employee) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  const totalHoursThisWeek = weekEntries.reduce((sum, entry) => sum + (entry.total_hours || 0), 0);
  const daysWorked = new Set(weekEntries.map(e => format(new Date(e.clock_in_time), 'yyyy-MM-dd'))).size;

  // Calculate Wednesday to Tuesday
  const today = new Date();
  const dayOfWeek = today.getDay();
  let daysToWednesday = dayOfWeek >= 3 ? dayOfWeek - 3 : dayOfWeek + 4;
  const periodStart = new Date(today);
  periodStart.setDate(today.getDate() - daysToWednesday);
  const periodEnd = new Date(periodStart);
  periodEnd.setDate(periodStart.getDate() + 6);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                <User className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">{employee.full_name}</h1>
                <p className="text-sm text-gray-600">ID: {employee.employee_id}</p>
              </div>
            </div>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Clock Section */}
        <Card className="p-6">
          <div className="text-center space-y-4">
            <div className="text-6xl font-bold text-gray-800 font-mono">
              {currentTime.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit' 
              })}
            </div>
            <div className="text-gray-600">
              {currentTime.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>

            {/* Status */}
            {currentEntry ? (
              <div className="inline-block bg-green-50 border-2 border-green-500 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-700 font-bold mb-2">
                  <div className="h-3 w-3 bg-green-600 rounded-full animate-pulse" />
                  CLOCKED IN
                </div>
                <div className="text-sm text-gray-600">
                  Since {new Date(currentEntry.clock_in_time).toLocaleTimeString()}
                </div>
              </div>
            ) : (
              <div className="inline-block bg-gray-50 border-2 border-gray-300 rounded-lg p-4">
                <div className="text-gray-600 font-medium">Not Clocked In</div>
              </div>
            )}

            {/* Buttons */}
            <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto mt-6">
              <button
                onClick={handleClockIn}
                disabled={!!currentEntry || !location}
                className={`
                  py-6 px-8 rounded-xl text-xl font-bold uppercase tracking-wider
                  transition-all duration-200 transform
                  ${currentEntry || !location
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 hover:scale-105 shadow-lg'
                  }
                `}
              >
                TIME IN
              </button>

              <button
                onClick={handleClockOut}
                disabled={!currentEntry || !location}
                className={`
                  py-6 px-8 rounded-xl text-xl font-bold uppercase tracking-wider
                  transition-all duration-200 transform
                  ${!currentEntry || !location
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-br from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 hover:scale-105 shadow-lg'
                  }
                `}
              >
                TIME OUT
              </button>
            </div>

            <div className="mt-4">
              {location ? (
                <div className="inline-flex items-center gap-2 text-sm text-green-600 bg-green-50 px-4 py-2 rounded-full border border-green-200">
                  <MapPin className="h-4 w-4" />
                  <span className="font-medium">GPS Location Active ✓</span>
                </div>
              ) : (
                <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 max-w-md mx-auto">
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="text-left">
                      <div className="font-bold text-red-900 mb-1">
                        📍 Location Required
                      </div>
                      <div className="text-sm text-red-800 mb-2">
                        Please enable location services to use the time clock.
                      </div>
                      <div className="text-xs text-red-700 space-y-1">
                        <div><strong>Chrome:</strong> Click 🔒 in address bar → Site settings → Location → Allow</div>
                        <div><strong>Safari:</strong> Safari → Settings → This Website → Location → Allow</div>
                        <div>Then <strong>refresh this page</strong></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <div className="text-sm text-gray-600">Total Hours</div>
                <div className="text-2xl font-bold text-gray-800">
                  {totalHoursThisWeek.toFixed(1)}h
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Calendar className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <div className="text-sm text-gray-600">Days Worked</div>
                <div className="text-2xl font-bold text-gray-800">{daysWorked}</div>
              </div>
            </div>
          </Card>

          <Card className="p-6 cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/employee-portal/overtime-request')}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <FileText className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <div className="text-sm text-gray-600">File OT</div>
                <div className="text-lg font-bold text-orange-600">
                  Request →
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Time Attendance */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <History className="h-6 w-6" />
              Time Attendance
            </h2>
            <div className="text-sm text-gray-600">
              {format(periodStart, 'MMM d')} - {format(periodEnd, 'MMM d, yyyy')}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b-2 border-gray-200">
                <tr>
                  <th className="text-left p-3 text-sm font-semibold text-gray-700">DATE</th>
                  <th className="text-left p-3 text-sm font-semibold text-gray-700">DAY</th>
                  <th className="text-left p-3 text-sm font-semibold text-gray-700">TIME IN</th>
                  <th className="text-left p-3 text-sm font-semibold text-gray-700">TIME OUT</th>
                  <th className="text-right p-3 text-sm font-semibold text-gray-700">BH</th>
                  <th className="text-right p-3 text-sm font-semibold text-gray-700">OT</th>
                  <th className="text-center p-3 text-sm font-semibold text-gray-700">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {weekEntries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-500">
                      No time records for this period
                    </td>
                  </tr>
                ) : (
                  weekEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="p-3 text-sm">
                        {format(new Date(entry.clock_in_time), 'MMM dd')}
                      </td>
                      <td className="p-3 text-sm">
                        {format(new Date(entry.clock_in_time), 'EEE')}
                      </td>
                      <td className="p-3 text-sm font-medium">
                        {format(new Date(entry.clock_in_time), 'hh:mm a')}
                      </td>
                      <td className="p-3 text-sm font-medium">
                        {entry.clock_out_time 
                          ? format(new Date(entry.clock_out_time), 'hh:mm a')
                          : <span className="text-green-600">Working...</span>
                        }
                      </td>
                      <td className="p-3 text-sm text-right font-semibold">
                        {entry.regular_hours?.toFixed(1) || '-'}
                      </td>
                      <td className="p-3 text-sm text-right font-semibold text-orange-600">
                        {entry.overtime_hours?.toFixed(1) || '0'}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          entry.status === 'clocked_in' ? 'bg-green-100 text-green-800' :
                          entry.status === 'approved' || entry.status === 'auto_approved' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {entry.status === 'clocked_in' ? 'ACTIVE' :
                           entry.status === 'approved' || entry.status === 'auto_approved' ? 'APPROVED' : 'PENDING'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {weekEntries.length > 0 && (
                <tfoot className="bg-gray-50 border-t-2 border-gray-200 font-bold">
                  <tr>
                    <td colSpan={4} className="p-3 text-sm">Days Work: {daysWorked}</td>
                    <td className="p-3 text-sm text-right">
                      {weekEntries.reduce((sum, e) => sum + (e.regular_hours || 0), 0).toFixed(1)}
                    </td>
                    <td className="p-3 text-sm text-right text-orange-600">
                      {weekEntries.reduce((sum, e) => sum + (e.overtime_hours || 0), 0).toFixed(1)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

