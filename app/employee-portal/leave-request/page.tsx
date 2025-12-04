'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Calendar, ArrowLeft, CheckCircle, XCircle, Hourglass } from 'lucide-react';
import { format, differenceInDays, addDays } from 'date-fns';

interface EmployeeSession {
  id: string;
  employee_id: string;
  full_name: string;
}

interface LeaveRequest {
  id: string;
  leave_type: 'SIL' | 'LWOP';
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string | null;
  status: 'pending' | 'approved_by_manager' | 'approved_by_hr' | 'rejected' | 'cancelled';
  rejection_reason: string | null;
  created_at: string;
}

interface EmployeeInfo {
  sil_credits: number;
}

export default function LeaveRequestPage() {
  const router = useRouter();
  const supabase = createClient();
  const [employee, setEmployee] = useState<EmployeeSession | null>(null);
  const [employeeInfo, setEmployeeInfo] = useState<EmployeeInfo | null>(null);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [leaveType, setLeaveType] = useState<'SIL' | 'LWOP'>('SIL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [calculatedDays, setCalculatedDays] = useState(0);

  useEffect(() => {
    const sessionData = localStorage.getItem('employee_session');
    if (!sessionData) {
      router.push('/employee-login');
      return;
    }

    const emp = JSON.parse(sessionData) as EmployeeSession;
    setEmployee(emp);
    fetchLeaveRequests(emp.id);
    fetchEmployeeInfo(emp.id);
  }, [router]);

  // Auto-switch to LWOP if SIL credits are zero
  useEffect(() => {
    if (silCredits !== null && silCredits <= 0 && leaveType === 'SIL') {
      setLeaveType('LWOP');
      toast.info('SIL credits are zero. Switched to LWOP (Leave Without Pay).');
    }
  }, [silCredits, leaveType]);

  useEffect(() => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (end >= start) {
        // Calculate business days (excluding weekends)
        let days = 0;
        let current = new Date(start);
        while (current <= end) {
          const dayOfWeek = current.getDay();
          if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday or Saturday
            days++;
          }
          current = addDays(current, 1);
        }
        setCalculatedDays(days);
      } else {
        setCalculatedDays(0);
      }
    } else {
      setCalculatedDays(0);
    }
  }, [startDate, endDate]);

  async function fetchEmployeeInfo(employeeId: string) {
    try {
      // Use RPC function that bypasses RLS
      const { data, error } = await supabase.rpc('get_employee_sil_credits', {
        p_employee_uuid: employeeId
      });

      if (error) {
        console.error('Error fetching employee SIL credits:', error);
        setEmployeeInfo(null);
        return;
      }

      // Use the actual data from database
      if (data && data.length > 0 && data[0].sil_credits !== null && data[0].sil_credits !== undefined) {
        setEmployeeInfo({ sil_credits: Number(data[0].sil_credits) });
      } else {
        // If sil_credits is null/undefined in DB, set to 0
        setEmployeeInfo({ sil_credits: 0 });
      }
    } catch (err) {
      console.error('Error fetching employee info:', err);
      setEmployeeInfo(null);
    }
  }

  async function fetchLeaveRequests(employeeId: string) {
    setLoading(true);
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching leave requests:', error);
      toast.error('Failed to load leave requests');
    } else {
      setRequests(data || []);
    }
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!employee || !startDate || !endDate || !reason.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    if (calculatedDays <= 0) {
      toast.error('Please select valid dates');
      return;
    }

    // Check SIL credits if SIL type
    if (leaveType === 'SIL') {
      if (silCredits === null) {
        toast.error('Unable to verify SIL credits. Please try again.');
        return;
      }
      if (silCredits <= 0) {
        toast.error('You have no SIL credits available. Please select LWOP (Leave Without Pay) instead.');
        return;
      }
      if (silCredits < calculatedDays) {
        toast.error(`Insufficient SIL credits. You have ${silCredits.toFixed(2)} credits but need ${calculatedDays}`);
        return;
      }
    }

    setSubmitting(true);

    const { error } = await supabase
      .from('leave_requests')
      .insert({
        employee_id: employee.id,
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        total_days: calculatedDays,
        reason: reason.trim(),
        status: 'pending',
      });

    setSubmitting(false);

    if (error) {
      console.error('Error submitting leave request:', error);
      toast.error('Failed to submit leave request');
      return;
    }

    toast.success('✅ Leave request submitted successfully!');
    setStartDate('');
    setEndDate('');
    setReason('');
    setCalculatedDays(0);
    fetchLeaveRequests(employee.id);
    fetchEmployeeInfo(employee.id);
  }

  async function handleCancel(requestId: string) {
    if (!confirm('Are you sure you want to cancel this leave request?')) {
      return;
    }

    const { error } = await supabase
      .from('leave_requests')
      .update({ status: 'cancelled' })
      .eq('id', requestId)
      .eq('status', 'pending');

    if (error) {
      console.error('Error cancelling leave request:', error);
      toast.error('Failed to cancel leave request');
      return;
    }

    toast.success('Leave request cancelled');
    if (employee) {
      fetchLeaveRequests(employee.id);
      fetchEmployeeInfo(employee.id);
    }
  }

  if (loading || !employee) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600" />
      </div>
    );
  }

  // Use actual value from database, or null if not loaded/failed
  // Don't use default - we want to show the actual DB value
  const silCredits = employeeInfo?.sil_credits ?? null;

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const approvedCount = requests.filter(r => r.status === 'approved_by_hr').length;

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
            <h1 className="text-2xl font-bold">Leave Request</h1>
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
              <div className="text-sm text-muted-foreground">SIL Credits</div>
              <div className="text-2xl font-bold text-emerald-600">
                {silCredits !== null ? silCredits.toFixed(2) : 'Loading...'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Request Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              File Leave Request
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Leave Type</Label>
                <div className="flex gap-4">
                  <label className={`flex items-center space-x-2 ${silCredits !== null && silCredits <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <input
                      type="radio"
                      value="SIL"
                      checked={leaveType === 'SIL'}
                      onChange={(e) => setLeaveType(e.target.value as 'SIL')}
                      disabled={silCredits !== null && silCredits <= 0}
                      className="h-4 w-4"
                    />
                    <span>SIL (Service Incentive Leave)</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      value="LWOP"
                      checked={leaveType === 'LWOP'}
                      onChange={(e) => setLeaveType(e.target.value as 'LWOP')}
                      className="h-4 w-4"
                    />
                    <span>LWOP (Leave Without Pay)</span>
                  </label>
                </div>
                {leaveType === 'SIL' && (
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Available SIL Credits: <strong>{silCredits !== null ? silCredits.toFixed(2) : 'Loading...'}</strong>
                    </p>
                    {silCredits !== null && silCredits <= 0 && (
                      <p className="text-xs text-red-600 mt-1 font-medium">
                        ⚠️ You have no SIL credits available. Please select LWOP instead.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end-date">End Date</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate || new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>
              </div>

              {calculatedDays > 0 && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="text-sm font-semibold text-blue-900">
                    Calculated Days: <span className="text-lg">{calculatedDays}</span> business days
                  </div>
                  {leaveType === 'SIL' && silCredits !== null && (
                    <div className="text-xs text-blue-700 mt-1">
                      {silCredits >= calculatedDays ? (
                        <span className="text-green-700">✓ Sufficient credits</span>
                      ) : (
                        <span className="text-red-700">✗ Insufficient credits</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="reason">Reason</Label>
                <textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Provide reason for leave request..."
                  rows={4}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={
                  submitting || 
                  calculatedDays <= 0 || 
                  (leaveType === 'SIL' && (silCredits === null || silCredits <= 0 || silCredits < calculatedDays))
                }
                className="w-full"
                isLoading={submitting}
              >
                Submit Leave Request
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Requests List */}
        <Card>
          <CardHeader>
            <CardTitle>My Leave Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {requests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No leave requests yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map((request) => (
                  <Card
                    key={request.id}
                    className={`${
                      request.status === 'pending' ? 'border-yellow-300' :
                      request.status === 'approved_by_hr' ? 'border-green-300' :
                      request.status === 'rejected' ? 'border-red-300' :
                      'border-gray-300'
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <span className="font-bold text-lg">
                              {format(new Date(request.start_date), 'MMM dd')} - {format(new Date(request.end_date), 'MMM dd, yyyy')}
                            </span>
                            <Badge variant={request.leave_type === 'SIL' ? 'info' : 'warning'}>
                              {request.leave_type}
                            </Badge>
                            <span className="text-lg font-bold text-emerald-600">
                              {request.total_days} {request.total_days === 1 ? 'day' : 'days'}
                            </span>
                          </div>

                          {request.reason && (
                            <div className="text-sm mb-2">
                              <strong>Reason:</strong>
                              <div className="mt-1 text-muted-foreground">{request.reason}</div>
                            </div>
                          )}

                          {request.status === 'rejected' && request.rejection_reason && (
                            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md text-sm">
                              <strong className="text-red-900">Rejection Reason:</strong>
                              <div className="text-red-800 mt-1">{request.rejection_reason}</div>
                            </div>
                          )}
                        </div>

                        <div className="ml-4 flex flex-col items-end gap-2">
                          {request.status === 'pending' && (
                            <>
                              <Badge variant="warning" className="flex items-center gap-2">
                                <Hourglass className="h-4 w-4" />
                                PENDING
                              </Badge>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleCancel(request.id)}
                              >
                                Cancel
                              </Button>
                            </>
                          )}
                          {request.status === 'approved_by_manager' && (
                            <Badge variant="info" className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4" />
                              APPROVED BY MANAGER
                            </Badge>
                          )}
                          {request.status === 'approved_by_hr' && (
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
                          {request.status === 'cancelled' && (
                            <Badge variant="secondary" className="flex items-center gap-2">
                              <XCircle className="h-4 w-4" />
                              CANCELLED
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground mt-2">
                        Filed: {format(new Date(request.created_at), 'MMM dd, yyyy h:mm a')}
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
