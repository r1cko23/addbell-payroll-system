'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Calendar, Check, X, User, Filter, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type: 'SIL' | 'LWOP';
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string | null;
  status: 'pending' | 'approved_by_manager' | 'approved_by_hr' | 'rejected' | 'cancelled';
  rejection_reason: string | null;
  account_manager_notes: string | null;
  hr_notes: string | null;
  created_at: string;
  employees: {
    employee_id: string;
    full_name: string;
    sil_credits: number;
  };
}

export default function LeaveApprovalPage() {
  const supabase = createClient();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [notes, setNotes] = useState('');
  const [userRole, setUserRole] = useState<string>('');

  useEffect(() => {
    fetchUserRole();
    fetchRequests();
  }, [statusFilter]);

  async function fetchUserRole() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!error && data) {
      setUserRole(data.role);
    }
  }

  async function fetchRequests() {
    setLoading(true);

    let query = supabase
      .from('leave_requests')
      .select(`
        *,
        employees (
          employee_id,
          full_name,
          sil_credits
        )
      `)
      .order('created_at', { ascending: false });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;

    setLoading(false);

    if (error) {
      console.error('Error fetching leave requests:', error);
      toast.error('Failed to load requests');
      return;
    }

    setRequests(data || []);
  }

  async function handleApprove(requestId: string, level: 'manager' | 'hr') {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const updateData: any = {
      account_manager_notes: notes.trim() || null,
    };

    if (level === 'manager') {
      updateData.status = 'approved_by_manager';
      updateData.account_manager_id = user.id;
      updateData.account_manager_approved_at = new Date().toISOString();
    } else {
      updateData.status = 'approved_by_hr';
      updateData.hr_approved_by = user.id;
      updateData.hr_approved_at = new Date().toISOString();
      updateData.hr_notes = notes.trim() || null;
    }

    const { error } = await supabase
      .from('leave_requests')
      .update(updateData)
      .eq('id', requestId);

    if (error) {
      console.error('Error approving request:', error);
      toast.error('Failed to approve request');
      return;
    }

    toast.success(`✅ Request ${level === 'manager' ? 'approved by manager' : 'approved by HR'}`);
    fetchRequests();
    setSelectedRequest(null);
    setNotes('');
  }

  async function handleReject(requestId: string) {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('leave_requests')
      .update({
        status: 'rejected',
        rejection_reason: rejectionReason.trim(),
        rejected_by: user.id,
        rejected_at: new Date().toISOString(),
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
    approvedByManager: requests.filter(r => r.status === 'approved_by_manager').length,
    approvedByHR: requests.filter(r => r.status === 'approved_by_hr').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  };

  const canApprove = (request: LeaveRequest) => {
    if (userRole === 'account_manager') {
      return request.status === 'pending';
    }
    if (userRole === 'hr' || userRole === 'admin') {
      return request.status === 'approved_by_manager';
    }
    return false;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Leave Approval</h1>
          <p className="text-muted-foreground mt-2">
            Review and approve employee leave requests (SIL/LWOP)
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-5">
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
              <div className="text-sm text-muted-foreground">Approved by Manager</div>
              <div className="text-2xl font-bold mt-1 text-blue-600">{stats.approvedByManager}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Approved by HR</div>
              <div className="text-2xl font-bold mt-1 text-green-600">{stats.approvedByHR}</div>
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
                <option value="approved_by_manager">Approved by Manager</option>
                <option value="approved_by_hr">Approved by HR</option>
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
              <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
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
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <User className="h-5 w-5 text-muted-foreground" />
                        <span className="font-bold text-lg">
                          {request.employees?.full_name || 'Unknown'}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          ({request.employees?.employee_id})
                        </span>
                        <Badge variant={request.leave_type === 'SIL' ? 'info' : 'warning'}>
                          {request.leave_type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2 flex-wrap">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {format(new Date(request.start_date), 'MMM dd')} - {format(new Date(request.end_date), 'MMM dd, yyyy')}
                        </div>
                        <div className="font-semibold text-emerald-600">
                          {request.total_days} {request.total_days === 1 ? 'day' : 'days'}
                        </div>
                        {request.leave_type === 'SIL' && request.employees && (
                          <div className="text-xs">
                            Available Credits: {request.employees.sil_credits}
                          </div>
                        )}
                      </div>
                      {request.reason && (
                        <div className="text-sm">
                          <strong>Reason:</strong> {request.reason}
                        </div>
                      )}
                    </div>
                    <div className="ml-4 flex flex-col items-end gap-2">
                      {request.status === 'pending' && (
                        <>
                          <Badge variant="warning">PENDING</Badge>
                          {canApprove(request) && (
                            <div className="flex gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedRequest(request);
                                  setRejectionReason('');
                                  setNotes('');
                                }}
                              >
                                <X className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleApprove(request.id, userRole === 'account_manager' ? 'manager' : 'hr');
                                }}
                              >
                                <Check className="h-4 w-4 mr-1" />
                                {userRole === 'account_manager' ? 'Approve' : 'Approve (HR)'}
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                      {request.status === 'approved_by_manager' && (
                        <>
                          <Badge variant="info">APPROVED BY MANAGER</Badge>
                          {canApprove(request) && (
                            <div className="flex gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedRequest(request);
                                  setRejectionReason('');
                                  setNotes('');
                                }}
                              >
                                <X className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleApprove(request.id, 'hr');
                                }}
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Approve (HR)
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                      {request.status === 'approved_by_hr' && (
                        <Badge variant="success">APPROVED</Badge>
                      )}
                      {request.status === 'rejected' && (
                        <Badge variant="destructive">REJECTED</Badge>
                      )}
                      {request.status === 'cancelled' && (
                        <Badge variant="secondary">CANCELLED</Badge>
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
                <CardTitle>Leave Request Details</CardTitle>
              </CardHeader>
              <CardContent className="p-6">

                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Employee</div>
                    <div className="font-bold text-lg">
                      {selectedRequest.employees?.full_name} ({selectedRequest.employees?.employee_id})
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Leave Type</div>
                      <div className={`font-semibold px-2 py-1 rounded inline-block ${
                        selectedRequest.leave_type === 'SIL' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
                      }`}>
                        {selectedRequest.leave_type}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Total Days</div>
                      <div className="font-semibold text-emerald-600">
                        {selectedRequest.total_days} {selectedRequest.total_days === 1 ? 'day' : 'days'}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-muted-foreground">Date Range</div>
                    <div className="font-semibold">
                      {format(new Date(selectedRequest.start_date), 'MMMM dd, yyyy')} - {format(new Date(selectedRequest.end_date), 'MMMM dd, yyyy')}
                    </div>
                  </div>

                  {selectedRequest.leave_type === 'SIL' && selectedRequest.employees && (
                    <div>
                      <div className="text-sm text-muted-foreground">Available SIL Credits</div>
                      <div className={`font-semibold ${
                        selectedRequest.employees.sil_credits >= selectedRequest.total_days ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {selectedRequest.employees.sil_credits} credits
                        {selectedRequest.employees.sil_credits < selectedRequest.total_days && (
                          <span className="text-red-600 ml-2">(Insufficient)</span>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedRequest.reason && (
                    <div>
                      <div className="text-sm text-muted-foreground">Reason</div>
                      <div className="p-3 bg-muted rounded-md">{selectedRequest.reason}</div>
                    </div>
                  )}

                  {selectedRequest.account_manager_notes && (
                    <div>
                      <div className="text-sm text-muted-foreground">Manager Notes</div>
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                        {selectedRequest.account_manager_notes}
                      </div>
                    </div>
                  )}

                  {selectedRequest.hr_notes && (
                    <div>
                      <div className="text-sm text-muted-foreground">HR Notes</div>
                      <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                        {selectedRequest.hr_notes}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="text-sm text-muted-foreground">Submitted</div>
                    <div className="text-sm">
                      {format(new Date(selectedRequest.created_at), 'MMMM dd, yyyy h:mm a')}
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
                  {canApprove(selectedRequest) && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="notes">Notes (optional)</Label>
                        <textarea
                          id="notes"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Add notes about this approval..."
                          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                          rows={3}
                        />
                      </div>

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
                            setNotes('');
                          }}
                        >
                          Close
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => handleReject(selectedRequest.id)}
                          disabled={!rejectionReason.trim()}
                        >
                          <X className="h-4 w-4 mr-2" />
                          Reject
                        </Button>
                        <Button 
                          onClick={() => handleApprove(
                            selectedRequest.id, 
                            userRole === 'account_manager' ? 'manager' : 'hr'
                          )}
                        >
                          <Check className="h-4 w-4 mr-2" />
                          {userRole === 'account_manager' ? 'Approve (Manager)' : 'Approve (HR)'}
                        </Button>
                      </div>
                    </>
                  )}

                  {!canApprove(selectedRequest) && (
                    <div className="flex justify-end pt-4">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setSelectedRequest(null);
                          setRejectionReason('');
                          setNotes('');
                        }}
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
