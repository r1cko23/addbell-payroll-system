'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Clock, LogIn, LogOut, User, Calendar, MapPin, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
}

interface ClockEntry {
  id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  clock_in_location: string | null;
  clock_out_location: string | null;
  status: 'clocked_in' | 'clocked_out' | 'approved' | 'rejected';
  total_hours: number | null;
  regular_hours: number | null;
  overtime_hours: number | null;
  employee_notes: string | null;
}

export default function ClockPage() {
  const supabase = createClient();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [currentEntry, setCurrentEntry] = useState<ClockEntry | null>(null);
  const [todayEntries, setTodayEntries] = useState<ClockEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch employees
  useEffect(() => {
    fetchEmployees();
  }, []);

  // Check clock status when employee is selected
  useEffect(() => {
    if (selectedEmployeeId) {
      checkClockStatus();
      fetchTodayEntries();
    } else {
      setCurrentEntry(null);
      setTodayEntries([]);
    }
  }, [selectedEmployeeId]);

  // Get location on component mount and keep it updated
  useEffect(() => {
    if (navigator.geolocation) {
      // Get initial location
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          toast.success('📍 Location detected', { duration: 2000 });
        },
        (error) => {
          console.log('Location not available:', error);
          toast.error('⚠️ Location access denied - clock in/out will work but without GPS', { duration: 3000 });
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        }
      );
    } else {
      toast.error('⚠️ Your browser doesn\'t support location tracking');
    }
  }, []);

  async function fetchEmployees() {
    const { data, error } = await supabase
      .from('employees')
      .select('id, employee_id, full_name')
      .eq('is_active', true)
      .order('full_name');

    if (error) {
      console.error('Error fetching employees:', error);
      toast.error('Failed to load employees');
      return;
    }

    setEmployees(data || []);
  }

  async function checkClockStatus() {
    if (!selectedEmployeeId) return;

    const { data, error } = await supabase
      .from('time_clock_entries')
      .select('*')
      .eq('employee_id', selectedEmployeeId)
      .eq('status', 'clocked_in')
      .order('clock_in_time', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking clock status:', error);
      return;
    }

    setCurrentEntry(data || null);
  }

  async function fetchTodayEntries() {
    if (!selectedEmployeeId) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data, error } = await supabase
      .from('time_clock_entries')
      .select('*')
      .eq('employee_id', selectedEmployeeId)
      .gte('clock_in_time', today.toISOString())
      .lt('clock_in_time', tomorrow.toISOString())
      .order('clock_in_time', { ascending: false });

    if (error) {
      console.error('Error fetching today entries:', error);
      return;
    }

    setTodayEntries(data || []);
  }

  async function handleClockIn() {
    if (!selectedEmployeeId) {
      toast.error('Please select an employee');
      return;
    }

    if (currentEntry) {
      toast.error('Already clocked in! Please clock out first.');
      return;
    }

    setLoading(true);

    const locationString = location 
      ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`
      : null;

    const { data, error } = await supabase
      .from('time_clock_entries')
      .insert({
        employee_id: selectedEmployeeId,
        clock_in_time: new Date().toISOString(),
        clock_in_location: locationString,
        clock_in_ip: null, // Could get from API
        clock_in_device: navigator.userAgent.substring(0, 255),
        employee_notes: notes || null,
        status: 'clocked_in',
      })
      .select()
      .single();

    setLoading(false);

    if (error) {
      console.error('Error clocking in:', error);
      toast.error('Failed to clock in');
      return;
    }

    setCurrentEntry(data);
    setNotes('');
    toast.success('Clocked in successfully! ✅');
    fetchTodayEntries(); // Refresh today's entries
  }

  async function handleClockOut() {
    if (!currentEntry) {
      toast.error('You are not clocked in');
      return;
    }

    setLoading(true);

    const locationString = location 
      ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`
      : null;

    const { error } = await supabase
      .from('time_clock_entries')
      .update({
        clock_out_time: new Date().toISOString(),
        clock_out_location: locationString,
        clock_out_device: navigator.userAgent.substring(0, 255),
        employee_notes: notes || currentEntry.employee_notes,
      })
      .eq('id', currentEntry.id);

    setLoading(false);

    if (error) {
      console.error('Error clocking out:', error);
      toast.error('Failed to clock out');
      return;
    }

    toast.success('Clocked out successfully! 👋');
    setCurrentEntry(null);
    setNotes('');
    fetchTodayEntries(); // Refresh today's entries
  }

  const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Time Clock</h1>
          <p className="text-muted-foreground mt-2">
            Clock in and out to track your working hours
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Clock In/Out Card */}
          <Card className="p-6">
            <div className="space-y-6">
              {/* Current Time Display */}
              <div className="text-center space-y-2">
                <Clock className="h-16 w-16 mx-auto text-primary" />
                <div className="text-4xl font-bold">
                  {currentTime.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </div>
                <div className="text-sm text-muted-foreground">
                  {currentTime.toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
              </div>

              {/* Employee Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Employee</label>
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="w-full p-2 border rounded-md"
                  disabled={loading}
                >
                  <option value="">-- Select Employee --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.employee_id} - {emp.full_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any notes about today's shift..."
                  className="w-full p-2 border rounded-md resize-none"
                  rows={2}
                  disabled={loading || !selectedEmployeeId}
                />
              </div>

              {/* Location Status */}
              <div className="p-3 bg-muted rounded-lg border">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className={`h-4 w-4 ${location ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className="font-medium">
                    {location ? 'GPS Location Detected' : 'Location Not Available'}
                  </span>
                </div>
                {location && (
                  <div className="mt-2 space-y-1">
                    <div className="text-xs text-muted-foreground">
                      📍 Lat: {location.lat.toFixed(6)}, Lng: {location.lng.toFixed(6)}
                    </div>
                    <a
                      href={`https://www.google.com/maps?q=${location.lat},${location.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      View on Google Maps →
                    </a>
                  </div>
                )}
                {!location && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Clock in/out will still work, but location won't be recorded
                  </p>
                )}
              </div>

              {/* Clock In/Out Buttons */}
              <div className="space-y-3">
                {!currentEntry ? (
                  <Button
                    onClick={handleClockIn}
                    disabled={!selectedEmployeeId || loading}
                    className="w-full h-14 text-lg"
                  >
                    <LogIn className="h-6 w-6 mr-2" />
                    Clock In
                  </Button>
                ) : (
                  <Button
                    onClick={handleClockOut}
                    disabled={loading}
                    variant="destructive"
                    className="w-full h-14 text-lg"
                  >
                    <LogOut className="h-6 w-6 mr-2" />
                    Clock Out
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {/* Status Card */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <User className="h-5 w-5" />
              Current Status
            </h3>

            {!selectedEmployee ? (
              <div className="text-center py-12 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Select an employee to see status</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Employee Info */}
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-sm text-muted-foreground">Employee</div>
                  <div className="font-semibold text-lg">
                    {selectedEmployee.full_name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    ID: {selectedEmployee.employee_id}
                  </div>
                </div>

                {/* Clock Status */}
                {currentEntry ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-green-600 font-semibold">
                      <div className="h-3 w-3 bg-green-600 rounded-full animate-pulse" />
                      Currently Clocked In
                    </div>

                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-green-600" />
                        <span className="text-muted-foreground">Clocked in:</span>
                      </div>
                      <div className="font-semibold">
                        {new Date(currentEntry.clock_in_time).toLocaleTimeString()}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(currentEntry.clock_in_time), {
                          addSuffix: true,
                        })}
                      </div>
                    </div>

                    {currentEntry.employee_notes && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="text-xs text-muted-foreground mb-1">
                          Notes:
                        </div>
                        <div className="text-sm">{currentEntry.employee_notes}</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="h-16 w-16 bg-gray-100 rounded-full mx-auto mb-3 flex items-center justify-center">
                      <Clock className="h-8 w-8 text-gray-400" />
                    </div>
                    <div className="font-semibold text-muted-foreground">
                      Not Clocked In
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Click "Clock In" to start tracking time
                    </p>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Today's Entries */}
        {selectedEmployee && todayEntries.length > 0 && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Today's Clock Entries ({todayEntries.length})
            </h3>

            <div className="space-y-3">
              {todayEntries.map((entry, index) => (
                <div
                  key={entry.id}
                  className={`p-4 rounded-lg border ${
                    entry.status === 'clocked_in'
                      ? 'bg-green-50 border-green-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-sm">Shift {todayEntries.length - index}</span>
                        {entry.status === 'clocked_in' && (
                          <span className="px-2 py-0.5 bg-green-600 text-white text-xs rounded-full flex items-center gap-1">
                            <div className="h-2 w-2 bg-white rounded-full animate-pulse" />
                            Active Now
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Clock In:</span>
                          <div className="font-medium">
                            {new Date(entry.clock_in_time).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                          {entry.clock_in_location && (
                            <a
                              href={`https://www.google.com/maps?q=${entry.clock_in_location}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                            >
                              <MapPin className="h-3 w-3" />
                              View location
                            </a>
                          )}
                        </div>

                        <div>
                          <span className="text-muted-foreground">Clock Out:</span>
                          <div className="font-medium">
                            {entry.clock_out_time ? (
                              new Date(entry.clock_out_time).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            ) : (
                              <span className="text-green-600">Still working...</span>
                            )}
                          </div>
                          {entry.clock_out_location && (
                            <a
                              href={`https://www.google.com/maps?q=${entry.clock_out_location}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                            >
                              <MapPin className="h-3 w-3" />
                              View location
                            </a>
                          )}
                        </div>

                        {entry.total_hours && (
                          <>
                            <div>
                              <span className="text-muted-foreground">Total Hours:</span>
                              <div className="font-bold text-lg">
                                {entry.total_hours.toFixed(2)}h
                              </div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Breakdown:</span>
                              <div className="text-xs space-y-0.5">
                                <div>Regular: {entry.regular_hours?.toFixed(2) || 0}h</div>
                                {entry.overtime_hours && entry.overtime_hours > 0 && (
                                  <div className="text-orange-600 font-medium">
                                    OT: {entry.overtime_hours.toFixed(2)}h
                                  </div>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                      {entry.employee_notes && (
                        <div className="mt-2 p-2 bg-white rounded border text-sm">
                          <span className="text-muted-foreground text-xs">Note:</span>
                          <div className="mt-1">{entry.employee_notes}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-blue-900">Total Hours Today:</span>
                  <span className="text-xl font-bold text-blue-900">
                    {todayEntries
                      .reduce((sum, entry) => sum + (entry.total_hours || 0), 0)
                      .toFixed(2)}h
                  </span>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Help Text */}
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-1">How it works:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800">
                <li>Select your name from the dropdown</li>
                <li>Click "Clock In" when you start work</li>
                <li>Click "Clock Out" when you finish work</li>
                <li><strong>Multiple shifts per day?</strong> Just clock in/out again!</li>
                <li>Your hours will be automatically calculated</li>
                <li>GPS location is recorded for verification</li>
                <li>HR can review and approve your time entries</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}

