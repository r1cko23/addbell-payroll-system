'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import {
  Clock,
  Filter,
  Download,
  Check,
  X,
  Edit,
  Calendar,
  User,
  MapPin,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';
import { OfficeLocation, resolveLocationDetails } from '@/lib/location';

interface TimeEntry {
  id: string;
  employee_id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  total_hours: number | null;
  regular_hours: number | null;
  overtime_hours: number | null;
  night_diff_hours: number | null;
  status: 'clocked_in' | 'clocked_out' | 'approved' | 'rejected' | 'auto_approved' | 'pending';
  employee_notes: string | null;
  hr_notes: string | null;
  clock_in_location: string | null;
  clock_out_location: string | null;
  is_manual_entry: boolean;
  employees: {
    employee_id: string;
    full_name: string;
  };
}

export default function TimeEntriesPage() {
  const supabase = createClient();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedEntry, setSelectedEntry] = useState<TimeEntry | null>(null);
  const [hrNotes, setHrNotes] = useState('');
  const [officeLocations, setOfficeLocations] = useState<OfficeLocation[]>([]);

  const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(selectedWeek, { weekStartsOn: 1 }); // Sunday

  useEffect(() => {
    fetchTimeEntries();
  }, [selectedWeek, statusFilter]);

  useEffect(() => {
    const fetchLocations = async () => {
      const { data, error } = await supabase
        .from('office_locations')
        .select('id, name, address, latitude, longitude, radius_meters');

      if (error) {
        console.error('Error loading locations:', error);
        return;
      }

      setOfficeLocations((data || []) as OfficeLocation[]);
    };

    fetchLocations();
  }, [supabase]);

  async function fetchTimeEntries() {
    setLoading(true);

    let query = supabase
      .from('time_clock_entries')
      .select(`
        *,
        employees (
          employee_id,
          full_name
        )
      `)
      .gte('clock_in_time', weekStart.toISOString())
      .lte('clock_in_time', weekEnd.toISOString())
      .order('clock_in_time', { ascending: false });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;

    setLoading(false);

    if (error) {
      console.error('Error fetching time entries:', error);
      toast.error('Failed to load time entries');
      return;
    }

    setEntries(data || []);
  }

  async function handleApprove(entryId: string) {
    const { error } = await supabase
      .from('time_clock_entries')
      .update({
        status: 'approved',
        hr_notes: hrNotes || null,
      })
      .eq('id', entryId);

    if (error) {
      console.error('Error approving entry:', error);
      toast.error('Failed to approve entry');
      return;
    }

    toast.success('Entry approved ✅');
    fetchTimeEntries();
    setSelectedEntry(null);
    setHrNotes('');
  }

  async function handleReject(entryId: string) {
    if (!hrNotes.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    const { error } = await supabase
      .from('time_clock_entries')
      .update({
        status: 'rejected',
        hr_notes: hrNotes,
      })
      .eq('id', entryId);

    if (error) {
      console.error('Error rejecting entry:', error);
      toast.error('Failed to reject entry');
      return;
    }

    toast.success('Entry rejected');
    fetchTimeEntries();
    setSelectedEntry(null);
    setHrNotes('');
  }

  async function exportToCSV() {
    const csv = [
      ['Employee ID', 'Name', 'Clock In', 'Clock Out', 'Total Hours', 'Regular', 'OT', 'Night Diff', 'Status', 'Notes'].join(','),
      ...entries.map(entry => [
        entry.employees.employee_id,
        entry.employees.full_name,
        format(new Date(entry.clock_in_time), 'yyyy-MM-dd HH:mm:ss'),
        entry.clock_out_time ? format(new Date(entry.clock_out_time), 'yyyy-MM-dd HH:mm:ss') : 'Not clocked out',
        entry.total_hours || 0,
        entry.regular_hours || 0,
        entry.overtime_hours || 0,
        entry.night_diff_hours || 0,
        entry.status,
        entry.employee_notes || '',
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `time-entries-${format(weekStart, 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported to CSV');
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      clocked_in: 'bg-blue-100 text-blue-800',
      clocked_out: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      auto_approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };
    const labels = {
      clocked_in: 'CLOCKED IN',
      clocked_out: 'CLOCKED OUT',
      approved: 'APPROVED',
      auto_approved: 'AUTO APPROVED',
      rejected: 'REJECTED',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels] || status.replace('_', ' ').toUpperCase()}
      </span>
    );
  };

  const stats = {
    total: entries.length,
    pending: entries.filter(e => e.status === 'clocked_out').length,
    approved: entries.filter(e => e.status === 'approved' || e.status === 'auto_approved').length,
    totalHours: entries.reduce((sum, e) => sum + (e.total_hours || 0), 0),
  };

  const selectedClockInDetails = selectedEntry
    ? resolveLocationDetails(selectedEntry.clock_in_location, officeLocations)
    : null;
  const selectedClockOutDetails = selectedEntry
    ? resolveLocationDetails(selectedEntry.clock_out_location, officeLocations)
    : null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Time Entries</h1>
            <p className="text-muted-foreground mt-2">
              Review and approve employee time clock entries
            </p>
          </div>
          <Button onClick={exportToCSV} variant="secondary">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Total Entries</div>
            <div className="text-2xl font-bold mt-1">{stats.total}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Pending Review</div>
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
            <div className="text-sm text-muted-foreground">Total Hours</div>
            <div className="text-2xl font-bold mt-1">
              {stats.totalHours.toFixed(1)}h
            </div>
          </Card>
        </div>

        {/* Info Banner */}
        {stats.pending > 0 && (
          <Card className="p-4 bg-blue-50 border-blue-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-900">
                <p className="font-semibold mb-1">
                  ℹ️ Auto-Sync to Timesheet
                </p>
                <p>
                  Approved entries automatically populate the timesheet. 
                  Review and approve <strong>{stats.pending} pending {stats.pending === 1 ? 'entry' : 'entries'}</strong> to make them available for payroll processing.
                </p>
              </div>
            </div>
          </Card>
        )}

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
                <option value="clocked_in">Clocked In</option>
                <option value="clocked_out">Pending Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Entries List */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
                <thead className="bg-muted">
                <tr>
                  <th className="text-left p-3 text-sm font-medium">Employee</th>
                  <th className="text-left p-3 text-sm font-medium">Clock In</th>
                  <th className="text-left p-3 text-sm font-medium">Clock Out</th>
                  <th className="text-right p-3 text-sm font-medium">Hours</th>
                  <th className="text-center p-3 text-sm font-medium">Status</th>
                  <th className="text-center p-3 text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-muted-foreground">
                      <Clock className="h-8 w-8 animate-spin mx-auto mb-2" />
                      Loading...
                    </td>
                  </tr>
                ) : entries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-muted-foreground">
                      <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      No time entries found for this period
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => {
                    const clockInDetails = resolveLocationDetails(entry.clock_in_location, officeLocations);
                    const clockOutDetails = resolveLocationDetails(entry.clock_out_location, officeLocations);

                    return (
                    <tr key={entry.id} className="hover:bg-muted/50">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">
                              {entry.employees.full_name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {entry.employees.employee_id}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="text-sm font-medium">
                          {format(new Date(entry.clock_in_time), 'MMM d, h:mm a')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {clockInDetails.name}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {clockInDetails.address}
                        </div>
                        {clockInDetails.coordinates && (
                          <a
                            href={`https://www.google.com/maps?q=${clockInDetails.coordinates}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-blue-600 hover:underline inline-flex items-center gap-1 mt-1"
                          >
                            <MapPin className="h-3 w-3" />
                            View map
                          </a>
                        )}
                      </td>
                      <td className="p-3">
                        {entry.clock_out_time ? (
                          <>
                            <div className="text-sm font-medium">
                              {format(new Date(entry.clock_out_time), 'MMM d, h:mm a')}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {clockOutDetails.name}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {clockOutDetails.address}
                            </div>
                            {clockOutDetails.coordinates && (
                              <a
                                href={`https://www.google.com/maps?q=${clockOutDetails.coordinates}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] text-blue-600 hover:underline inline-flex items-center gap-1 mt-1"
                              >
                                <MapPin className="h-3 w-3" />
                                View map
                              </a>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-blue-600 font-medium">
                            Still clocked in
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right font-medium">
                        {entry.total_hours?.toFixed(2) || '-'}
                      </td>
                      <td className="p-3 text-center">
                        {getStatusBadge(entry.status)}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-1">
                          {entry.status === 'clocked_out' && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedEntry(entry);
                                  setHrNotes(entry.hr_notes || '');
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {(entry.status === 'approved' || entry.status === 'auto_approved') && (
                            <span className="text-xs text-green-600">✓ Approved</span>
                          )}
                          {entry.status === 'rejected' && (
                            <span className="text-xs text-red-600">✗ Rejected</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Review Modal */}
        {selectedEntry && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-2xl p-6">
              <h3 className="text-lg font-semibold mb-4">Review Time Entry</h3>

              <div className="space-y-4">
                {/* Employee Info */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                  <div>
                    <div className="text-sm text-muted-foreground">Employee</div>
                    <div className="font-medium">
                      {selectedEntry.employees.full_name}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Employee ID</div>
                    <div className="font-medium">
                      {selectedEntry.employees.employee_id}
                    </div>
                  </div>
                </div>

                {/* Time Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Clock In</div>
                    <div className="font-medium">
                      {format(new Date(selectedEntry.clock_in_time), 'MMM d, yyyy h:mm a')}
                    </div>
                    {selectedClockInDetails && (
                      <>
                        <div className="text-xs text-muted-foreground">
                          {selectedClockInDetails.name}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {selectedClockInDetails.address}
                        </div>
                        {selectedClockInDetails.coordinates && (
                          <a
                            href={`https://www.google.com/maps?q=${selectedClockInDetails.coordinates}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1"
                          >
                            <MapPin className="h-3 w-3" />
                            View GPS Location
                          </a>
                        )}
                      </>
                    )}
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Clock Out</div>
                    <div className="font-medium">
                      {selectedEntry.clock_out_time
                        ? format(new Date(selectedEntry.clock_out_time), 'MMM d, yyyy h:mm a')
                        : 'Not clocked out'}
                    </div>
                    {selectedClockOutDetails && (
                      <>
                        <div className="text-xs text-muted-foreground">
                          {selectedClockOutDetails.name}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {selectedClockOutDetails.address}
                        </div>
                        {selectedClockOutDetails.coordinates && (
                          <a
                            href={`https://www.google.com/maps?q=${selectedClockOutDetails.coordinates}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1"
                          >
                            <MapPin className="h-3 w-3" />
                            View GPS Location
                          </a>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Hours Breakdown */}
                <div className="grid grid-cols-4 gap-4 p-4 bg-blue-50 rounded-lg">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Total</div>
                    <div className="text-lg font-bold">{selectedEntry.total_hours?.toFixed(2)}h</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Regular</div>
                    <div className="text-lg font-bold">{selectedEntry.regular_hours?.toFixed(2)}h</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">OT</div>
                    <div className="text-lg font-bold text-orange-600">
                      {selectedEntry.overtime_hours?.toFixed(2)}h
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Night</div>
                    <div className="text-lg font-bold text-purple-600">
                      {selectedEntry.night_diff_hours?.toFixed(2)}h
                    </div>
                  </div>
                </div>

                {/* Employee Notes */}
                {selectedEntry.employee_notes && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Employee Notes</div>
                    <div className="p-3 bg-muted rounded border">
                      {selectedEntry.employee_notes}
                    </div>
                  </div>
                )}

                {/* HR Notes */}
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    HR Notes (Optional)
                  </label>
                  <textarea
                    value={hrNotes}
                    onChange={(e) => setHrNotes(e.target.value)}
                    placeholder="Add any notes or reasons for rejection..."
                    className="w-full p-3 border rounded-md resize-none"
                    rows={3}
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSelectedEntry(null);
                      setHrNotes('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => handleReject(selectedEntry.id)}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                  <Button onClick={() => handleApprove(selectedEntry.id)}>
                    <Check className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

