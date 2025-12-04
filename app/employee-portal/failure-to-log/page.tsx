'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { AlertCircle, ArrowLeft, CheckCircle, XCircle, Hourglass, Clock } from 'lucide-react';
import { formatPHTime } from '@/utils/format';

interface EmployeeSession {
  id: string;
  employee_id: string;
  full_name: string;
}

interface FailureToLog {
  id: string;
  time_entry_id: string;
  missed_date: string;
  actual_clock_out_time: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  created_at: string;
  time_clock_entries?: {
    clock_in_time: string;
    clock_out_time: string | null;
  };
}

export default function FailureToLogPage() {
  const router = useRouter();
  const supabase = createClient();
  const [employee, setEmployee] = useState<EmployeeSession | null>(null);
  const [requests, setRequests] = useState<FailureToLog[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [missedDate, setMissedDate] = useState('');
  const [actualClockOutTime, setActualClockOutTime] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [timeEntries, setTimeEntries] = useState<any[]>([]);
  const [selectedTimeEntryId, setSelectedTimeEntryId] = useState('');

  useEffect(() => {
    const sessionData = localStorage.getItem('employee_session');
    if (!sessionData) {
      router.push('/employee-login');
      return;
    }

    const emp = JSON.parse(sessionData) as EmployeeSession;
    setEmployee(emp);
    fetchFailureToLogRequests(emp.id);
    fetchTimeEntries(emp.id);
  }, [router]);

  async function fetchTimeEntries(employeeId: string) {
    const { data, error } = await supabase
      .from('time_clock_entries')
      .select('id, clock_in_time, clock_out_time, status')
      .eq('employee_id', employeeId)
      .order('clock_in_time', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching time entries:', error);
    } else {
      setTimeEntries(data || []);
    }
  }

  async function fetchFailureToLogRequests(employeeId: string) {
    setLoading(true);
    const { data, error } = await supabase
      .from('failure_to_log')
      .select(`
        *,
        time_clock_entries (
          clock_in_time,
          clock_out_time
        )
      `)
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching failure to log requests:', error);
      toast.error('Failed to load requests');
    } else {
      setRequests(data || []);
    }
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!employee || !missedDate || !actualClockOutTime || !reason.trim() || !selectedTimeEntryId) {
      toast.error('Please fill in all fields');
      return;
    }

    if (!selectedTimeEntryId) {
      toast.error('Please select a time entry');
      return;
    }

    setSubmitting(true);

    const { error } = await supabase
      .from('failure_to_log')
      .insert({
        employee_id: employee.id,
        time_entry_id: selectedTimeEntryId,
        missed_date: missedDate,
        actual_clock_out_time: actualClockOutTime,
        reason: reason.trim(),
        status: 'pending',
      });

    setSubmitting(false);

    if (error) {
      console.error('Error submitting failure to log request:', error);
      toast.error('Failed to submit request');
      return;
    }

    toast.success('✅ Failure to log request submitted successfully!');
    setMissedDate('');
    setActualClockOutTime('');
    setReason('');
    setSelectedTimeEntryId('');
    fetchFailureToLogRequests(employee.id);
    fetchTimeEntries(employee.id);
  }

  if (loading || !employee) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600" />
      </div>
    );
  }

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const approvedCount = requests.filter(r => r.status === 'approved').length;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/employee-portal/bundy')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Failure to Log Request</h1>
            <p className="text-sm text-muted-foreground">{employee.full_name}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Pending</div>
              <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Approved</div>
              <div className="text-2xl font-bold text-green-600">{approvedCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Total Requests</div>
              <div className="text-2xl font-bold">{requests.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Request Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              File Failure to Log Request
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="time-entry">Select Time Entry</Label>
                <select
                  id="time-entry"
                  value={selectedTimeEntryId}
                  onChange={(e) => setSelectedTimeEntryId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  required
                >
                  <option value="">Select a time entry...</option>
                  {timeEntries.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {formatPHTime(entry.clock_in_time, 'MMM dd, yyyy h:mm a')} - {entry.clock_out_time ? formatPHTime(entry.clock_out_time, 'h:mm a') : 'Not clocked out'}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">Select the time entry where you forgot to clock in/out</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="missed-date">Missed Date</Label>
                <Input
                  id="missed-date"
                  type="date"
                  value={missedDate}
                  onChange={(e) => setMissedDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="clock-out-time">Actual Clock Out Time</Label>
                <Input
                  id="clock-out-time"
                  type="datetime-local"
                  value={actualClockOutTime}
                  onChange={(e) => setActualClockOutTime(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">The actual time you clocked out (or should have)</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Reason</Label>
                <textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why you forgot to clock in/out..."
                  rows={4}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Please provide a detailed explanation
                </p>
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full"
                isLoading={submitting}
              >
                Submit Request
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Requests List */}
        <Card>
          <CardHeader>
            <CardTitle>My Failure to Log Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {requests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No failure to log requests yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map((request) => (
                  <Card
                    key={request.id}
                    className={`${
                      request.status === 'pending' ? 'border-yellow-300' :
                      request.status === 'approved' ? 'border-green-300' :
                      'border-red-300'
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <span className="font-bold text-lg">
                              {formatPHTime(request.missed_date, 'MMM dd, yyyy')}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              Actual: {formatPHTime(request.actual_clock_out_time, 'MMM dd, h:mm a')}
                            </span>
                          </div>

                          <div className="text-sm mb-2">
                            <strong>Reason:</strong>
                            <div className="mt-1 text-muted-foreground">{request.reason}</div>
                          </div>

                          {request.status === 'rejected' && request.rejection_reason && (
                            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md text-sm">
                              <strong className="text-red-900">Rejection Reason:</strong>
                              <div className="text-red-800 mt-1">{request.rejection_reason}</div>
                            </div>
                          )}
                        </div>

                        <div className="ml-4">
                          {request.status === 'pending' && (
                            <Badge variant="warning" className="flex items-center gap-2">
                              <Hourglass className="h-4 w-4" />
                              PENDING
                            </Badge>
                          )}
                          {request.status === 'approved' && (
                            <Badge variant="success" className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4" />
                              APPROVED
                            </Badge>
                          )}
                          {request.status === 'rejected' && (
                            <Badge variant="destructive" className="flex items-center gap-2">
                              <XCircle className="h-4 w-4" />
                              REJECTED
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground mt-2">
                        Filed: {formatPHTime(request.created_at, 'MMM dd, yyyy h:mm a')}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

