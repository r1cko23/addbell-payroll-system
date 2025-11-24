'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { toast } from 'sonner';
import { Clock, Check, X, User, Calendar, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';

interface OTRequest {
  id: string;
  employee_id: string;
  ot_date: string;
  ot_hours: number;
  work_description: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  created_at: string;
  employees: {
    employee_id: string;
    full_name: string;
  };
}

export default function OvertimeApprovalPage() {
  const supabase = createClient();
  const [requests, setRequests] = useState<OTRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  const [selectedRequest, setSelectedRequest] = useState<OTRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedWeek, { weekStartsOn: 1 });

  useEffect(() => {
    fetchOTRequests();
  }, [selectedWeek, statusFilter]);

  async function fetchOTRequests() {
    setLoading(true);

    let query = supabase
      .from('overtime_requests')
      .select(`
        *,
        employees (
          employee_id,
          full_name
        )
      `)
      .gte('ot_date', format(weekStart, 'yyyy-MM-dd'))
      .lte('ot_date', format(weekEnd, 'yyyy-MM-dd'))
      .order('created_at', { ascending: false });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;

    setLoading(false);

    if (error) {
      console.error('Error fetching OT requests:', error);
      toast.error('Failed to load OT requests');
      return;
    }

    setRequests(data || []);
  }

  async function handleApprove(requestId: string) {
    const { error } = await supabase
      .from('overtime_requests')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (error) {
      console.error('Error approving OT:', error);
      toast.error('Failed to approve OT request');
      return;
    }

    toast.success('✅ OT request approved');
    fetchOTRequests();
    setSelectedRequest(null);
  }

  async function handleReject(requestId: string) {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    const { error } = await supabase
      .from('overtime_requests')
      .update({
        status: 'rejected',
        rejection_reason: rejectionReason.trim(),
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (error) {
      console.error('Error rejecting OT:', error);
      toast.error('Failed to reject OT request');
      return;
    }

    toast.success('OT request rejected');
    fetchOTRequests();
    setSelectedRequest(null);
    setRejectionReason('');
  }

  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
    totalHours: requests.filter(r => r.status === 'approved').reduce((sum, r) => sum + r.ot_hours, 0),
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Overtime Approval</h1>
          <p className="text-muted-foreground mt-2">
            Review and approve employee overtime requests
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Total Requests</div>
            <div className="text-2xl font-bold mt-1">{stats.total}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Pending</div>
            <div className="text-2xl font-bold mt-1 text-yellow-600">
              {stats.pending}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Approved</div>
            <div className="text-2xl font-bold mt-1 text-green-600">
              {stats.approved}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Rejected</div>
            <div className="text-2xl font-bold mt-1 text-red-600">
              {stats.rejected}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Approved Hours</div>
            <div className="text-2xl font-bold mt-1 text-blue-600">
              {stats.totalHours.toFixed(1)}h
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Week Navigation */}
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedWeek(subWeeks(selectedWeek, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-sm font-medium min-w-[200px] text-center">
                {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedWeek(addWeeks(selectedWeek, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedWeek(new Date())}
              >
                Today
              </Button>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="p-2 border rounded-md text-sm"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Requests List */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-3 text-sm font-medium">Employee</th>
                  <th className="text-left p-3 text-sm font-medium">Date</th>
                  <th className="text-right p-3 text-sm font-medium">OT Hours</th>
                  <th className="text-left p-3 text-sm font-medium">Work Description</th>
                  <th className="text-center p-3 text-sm font-medium">Status</th>
                  <th className="text-center p-3 text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-muted-foreground">
                      <Clock className="h-8 w-8 animate-spin mx-auto mb-2" />
                      Loading...
                    </td>
                  </tr>
                ) : requests.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-muted-foreground">
                      No OT requests found for this period
                    </td>
                  </tr>
                ) : (
                  requests.map((request) => (
                    <tr key={request.id} className="hover:bg-muted/50">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">
                              {request.employees.full_name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {request.employees.employee_id}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="text-sm">
                          {format(new Date(request.ot_date), 'MMM d, yyyy')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(request.ot_date), 'EEEE')}
                        </div>
                      </td>
                      <td className="p-3 text-right font-bold text-orange-600">
                        {request.ot_hours}h
                      </td>
                      <td className="p-3">
                        <div className="text-sm max-w-xs">
                          {request.work_description.startsWith('Auto-detected:') ? (
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                                AUTO
                              </span>
                              <span className="truncate">{request.work_description}</span>
                            </div>
                          ) : (
                            <div className="truncate">{request.work_description}</div>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          request.status === 'approved' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {request.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-2">
                          {request.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleApprove(request.id)}
                                className="text-green-600 hover:bg-green-50"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setSelectedRequest(request)}
                                className="text-red-600 hover:bg-red-50"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {request.status !== 'pending' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedRequest(request)}
                            >
                              View
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Review Modal */}
        {selectedRequest && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-2xl p-6">
              <h3 className="text-lg font-semibold mb-4">Review OT Request</h3>

              <div className="space-y-4">
                {/* Employee Info */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                  <div>
                    <div className="text-sm text-muted-foreground">Employee</div>
                    <div className="font-medium">{selectedRequest.employees.full_name}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Employee ID</div>
                    <div className="font-medium">{selectedRequest.employees.employee_id}</div>
                  </div>
                </div>

                {/* OT Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Date</div>
                    <div className="font-medium">
                      {format(new Date(selectedRequest.ot_date), 'MMMM d, yyyy')}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">OT Hours</div>
                    <div className="font-bold text-2xl text-orange-600">
                      {selectedRequest.ot_hours}h
                    </div>
                  </div>
                </div>

                {/* Work Description */}
                <div>
                  <div className="text-sm text-muted-foreground mb-1 flex items-center gap-2">
                    Work Description
                    {selectedRequest.work_description.startsWith('Auto-detected:') && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded font-semibold">
                        AUTO-DETECTED
                      </span>
                    )}
                  </div>
                  <div className={`p-3 rounded border ${
                    selectedRequest.work_description.startsWith('Auto-detected:')
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-muted'
                  }`}>
                    {selectedRequest.work_description}
                  </div>
                  {selectedRequest.work_description.startsWith('Auto-detected:') && (
                    <p className="text-xs text-blue-600 mt-2">
                      ℹ️ This OT was automatically detected when the employee clocked out after scheduled hours.
                      Please verify and approve if the overtime was authorized.
                    </p>
                  )}
                </div>

                {/* Rejection Reason (if applicable) */}
                {selectedRequest.status === 'rejected' && selectedRequest.rejection_reason && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Rejection Reason</div>
                    <div className="p-3 bg-red-50 rounded border border-red-200 text-red-900">
                      {selectedRequest.rejection_reason}
                    </div>
                  </div>
                )}

                {/* Rejection Reason Input (for pending) */}
                {selectedRequest.status === 'pending' && (
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Rejection Reason (if rejecting)
                    </label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Provide reason for rejection..."
                      className="w-full p-3 border rounded-md resize-none"
                      rows={3}
                    />
                  </div>
                )}

                {/* Actions */}
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
                  {selectedRequest.status === 'pending' && (
                    <>
                      <Button
                        variant="danger"
                        onClick={() => handleReject(selectedRequest.id)}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                      <Button onClick={() => handleApprove(selectedRequest.id)}>
                        <Check className="h-4 w-4 mr-2" />
                        Approve
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

