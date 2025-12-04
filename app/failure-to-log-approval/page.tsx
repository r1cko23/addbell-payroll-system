'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { AlertCircle, Check, X, User, Calendar, Filter } from 'lucide-react';
import { formatPHTime } from '@/utils/format';

interface FailureToLog {
  id: string;
  employee_id: string;
  time_entry_id: string;
  missed_date: string;
  actual_clock_out_time: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  created_at: string;
  employees: {
    employee_id: string;
    full_name: string;
  };
  time_clock_entries?: {
    clock_in_time: string;
    clock_out_time: string | null;
  };
}

export default function FailureToLogApprovalPage() {
  const supabase = createClient();
  const [requests, setRequests] = useState<FailureToLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedRequest, setSelectedRequest] = useState<FailureToLog | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    fetchRequests();
  }, [statusFilter]);

  async function fetchRequests() {
    setLoading(true);

    let query = supabase
      .from('failure_to_log')
      .select(`
        *,
        employees (
          employee_id,
          full_name
        ),
        time_clock_entries (
          clock_in_time,
          clock_out_time
        )
      `)
      .order('created_at', { ascending: false });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;

    setLoading(false);

    if (error) {
      console.error('Error fetching failure to log requests:', error);
      toast.error('Failed to load requests');
      return;
    }

    setRequests(data || []);
  }

  async function handleApprove(requestId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // First, get the failure to log request details
    const { data: request, error: fetchError } = await supabase
      .from('failure_to_log')
      .select('time_entry_id, actual_clock_out_time')
      .eq('id', requestId)
      .single();

    if (fetchError || !request) {
      console.error('Error fetching request:', fetchError);
      toast.error('Failed to fetch request details');
      return;
    }

    // Update the time_clock_entries table with the actual clock out time
    const { error: updateTimeEntryError } = await supabase
      .from('time_clock_entries')
      .update({
        clock_out_time: request.actual_clock_out_time,
        status: 'clocked_out',
        // The trigger will automatically calculate hours now that clock_out_time is set
      })
      .eq('id', request.time_entry_id);

    if (updateTimeEntryError) {
      console.error('Error updating time entry:', updateTimeEntryError);
      toast.error('Failed to update time entry');
      return;
    }

    // Now update the failure to log request status
    const { error } = await supabase
      .from('failure_to_log')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        account_manager_id: user.id,
      })
      .eq('id', requestId);

    if (error) {
      console.error('Error approving request:', error);
      toast.error('Failed to approve request');
      return;
    }

    toast.success('✅ Request approved and time entry updated');
    fetchRequests();
    setSelectedRequest(null);
  }

  async function handleReject(requestId: string) {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('failure_to_log')
      .update({
        status: 'rejected',
        rejection_reason: rejectionReason.trim(),
        account_manager_id: user.id,
      })
      .eq('id', requestId);

    if (error) {
      console.error('Error rejecting request:', error);
      toast.error('Failed to reject request');
      return;
    }

    toast.success('Request rejected');
    fetchRequests();
    setSelectedRequest(null);
    setRejectionReason('');
  }

  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Failure to Log Approval</h1>
          <p className="text-muted-foreground mt-2">
            Review and approve employee failure to log requests
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Total Requests</div>
              <div className="text-2xl font-bold mt-1">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Pending</div>
              <div className="text-2xl font-bold mt-1 text-yellow-600">{stats.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Approved</div>
              <div className="text-2xl font-bold mt-1 text-green-600">{stats.approved}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Rejected</div>
              <div className="text-2xl font-bold mt-1 text-red-600">{stats.rejected}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Filter className="h-5 w-5 text-muted-foreground" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Requests List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : requests.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No requests found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <Card
                key={request.id}
                className="hover:shadow-md transition-shadow"
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div 
                      className="flex-1 cursor-pointer"
                      onClick={() => setSelectedRequest(request)}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <User className="h-5 w-5 text-muted-foreground" />
                        <span className="font-bold text-lg">
                          {request.employees?.full_name || 'Unknown'}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          ({request.employees?.employee_id})
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          Missed: {formatPHTime(request.missed_date, 'MMM dd, yyyy')}
                        </div>
                        <div>
                          Actual: {formatPHTime(request.actual_clock_out_time, 'MMM dd, h:mm a')}
                        </div>
                      </div>
                      <div className="text-sm">
                        <strong>Reason:</strong> {request.reason}
                      </div>
                    </div>
                    <div className="ml-4 flex flex-col items-end gap-2">
                      {request.status === 'pending' && (
                        <>
                          <Badge variant="warning">PENDING</Badge>
                          <div className="flex gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRequest(request);
                                setRejectionReason('');
                              }}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleApprove(request.id);
                              }}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                          </div>
                        </>
                      )}
                      {request.status === 'approved' && (
                        <Badge variant="success">APPROVED</Badge>
                      )}
                      {request.status === 'rejected' && (
                        <Badge variant="destructive">REJECTED</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Detail Modal */}
        {selectedRequest && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle>Request Details</CardTitle>
              </CardHeader>
              <CardContent className="p-6">

                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Employee</div>
                    <div className="font-bold text-lg">
                      {selectedRequest.employees?.full_name} ({selectedRequest.employees?.employee_id})
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-muted-foreground">Missed Date</div>
                    <div className="font-semibold">
                      {formatPHTime(selectedRequest.missed_date, 'MMMM dd, yyyy')}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-muted-foreground">Actual Clock Out Time</div>
                    <div className="font-semibold">
                      {formatPHTime(selectedRequest.actual_clock_out_time, 'MMMM dd, yyyy h:mm a')}
                    </div>
                  </div>

                  {selectedRequest.time_clock_entries && (
                    <div>
                      <div className="text-sm text-muted-foreground">Time Entry</div>
                      <div className="font-semibold">
                        Clock In: {formatPHTime(selectedRequest.time_clock_entries.clock_in_time, 'MMM dd, h:mm a')}
                        {selectedRequest.time_clock_entries.clock_out_time && (
                          <> | Clock Out: {formatPHTime(selectedRequest.time_clock_entries.clock_out_time, 'h:mm a')}</>
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="text-sm text-muted-foreground">Reason</div>
                    <div className="p-3 bg-muted rounded-md">{selectedRequest.reason}</div>
                  </div>

                  <div>
                    <div className="text-sm text-muted-foreground">Submitted</div>
                    <div className="text-sm">
                      {formatPHTime(selectedRequest.created_at, 'MMMM dd, yyyy h:mm a')}
                    </div>
                  </div>

                  {selectedRequest.status === 'rejected' && selectedRequest.rejection_reason && (
                    <div>
                      <div className="text-sm text-muted-foreground">Rejection Reason</div>
                      <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-900">
                        {selectedRequest.rejection_reason}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  {selectedRequest.status === 'pending' && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="rejection-reason">Rejection Reason (if rejecting)</Label>
                        <textarea
                          id="rejection-reason"
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          placeholder="Provide reason for rejection..."
                          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                          rows={3}
                        />
                      </div>

                      <div className="flex justify-end gap-3 pt-4">
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setSelectedRequest(null);
                            setRejectionReason('');
                          }}
                        >
                          Close
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => handleReject(selectedRequest.id)}
                        >
                          <X className="h-4 w-4 mr-2" />
                          Reject
                        </Button>
                        <Button onClick={() => handleApprove(selectedRequest.id)}>
                          <Check className="h-4 w-4 mr-2" />
                          Approve
                        </Button>
                      </div>
                    </>
                  )}

                  {selectedRequest.status !== 'pending' && (
                    <div className="flex justify-end pt-4">
                      <Button
                        variant="secondary"
                        onClick={() => setSelectedRequest(null)}
                      >
                        Close
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
