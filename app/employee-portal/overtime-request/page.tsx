'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { toast } from 'sonner';
import { Clock, ArrowLeft, CheckCircle, XCircle, Hourglass } from 'lucide-react';
import { format } from 'date-fns';

interface EmployeeSession {
  id: string;
  employee_id: string;
  full_name: string;
}

interface OTRequest {
  id: string;
  ot_date: string;
  ot_hours: number;
  work_description: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  created_at: string;
}

export default function OvertimeRequestPage() {
  const router = useRouter();
  const supabase = createClient();
  const [employee, setEmployee] = useState<EmployeeSession | null>(null);
  const [requests, setRequests] = useState<OTRequest[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [otDate, setOtDate] = useState('');
  const [otHours, setOtHours] = useState('');
  const [workDescription, setWorkDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const sessionData = localStorage.getItem('employee_session');
    if (!sessionData) {
      router.push('/employee-login');
      return;
    }

    const emp = JSON.parse(sessionData) as EmployeeSession;
    setEmployee(emp);
    fetchOTRequests(emp.id);
  }, [router]);

  async function fetchOTRequests(employeeId: string) {
    setLoading(true);
    const { data, error } = await supabase
      .from('overtime_requests')
      .select('*')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching OT requests:', error);
      toast.error('Failed to load OT requests');
    } else {
      setRequests(data || []);
    }
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!employee || !otDate || !otHours || !workDescription.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    const hours = parseFloat(otHours);
    if (isNaN(hours) || hours <= 0 || hours > 12) {
      toast.error('OT hours must be between 0 and 12');
      return;
    }

    setSubmitting(true);

    const { error } = await supabase
      .from('overtime_requests')
      .insert({
        employee_id: employee.id,
        ot_date: otDate,
        ot_hours: hours,
        work_description: workDescription.trim(),
        status: 'pending',
      });

    setSubmitting(false);

    if (error) {
      console.error('Error submitting OT request:', error);
      toast.error('Failed to submit OT request');
      return;
    }

    toast.success('✅ OT request submitted successfully!');
    setOtDate('');
    setOtHours('');
    setWorkDescription('');
    fetchOTRequests(employee.id);
  }

  if (loading || !employee) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const approvedCount = requests.filter(r => r.status === 'approved').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="secondary"
              onClick={() => router.push('/employee-portal')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Overtime Request</h1>
              <p className="text-sm text-gray-600">{employee.full_name}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="text-sm text-gray-600">Pending</div>
            <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">Approved</div>
            <div className="text-2xl font-bold text-green-600">{approvedCount}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">Total Requests</div>
            <div className="text-2xl font-bold text-gray-800">{requests.length}</div>
          </Card>
        </div>

        {/* Request Form */}
        <Card className="p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5" />
            File Overtime Request
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Date
              </label>
              <input
                type="date"
                value={otDate}
                onChange={(e) => setOtDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                OT Hours
              </label>
              <input
                type="number"
                value={otHours}
                onChange={(e) => setOtHours(e.target.value)}
                placeholder="e.g., 2.5"
                step="0.5"
                min="0.5"
                max="12"
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Maximum 12 hours</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Work Description
              </label>
              <textarea
                value={workDescription}
                onChange={(e) => setWorkDescription(e.target.value)}
                placeholder="Describe the work you performed during overtime..."
                rows={4}
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 resize-none"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Please provide details about the work performed
              </p>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full py-3 text-lg font-semibold"
            >
              {submitting ? 'Submitting...' : 'Submit OT Request'}
            </Button>
          </form>
        </Card>

        {/* Requests List */}
        <Card className="p-6">
          <h2 className="text-lg font-bold mb-4">My OT Requests</h2>

          {requests.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No overtime requests yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className={`p-4 rounded-lg border-2 ${
                    request.status === 'pending' ? 'bg-yellow-50 border-yellow-300' :
                    request.status === 'approved' ? 'bg-green-50 border-green-300' :
                    'bg-red-50 border-red-300'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-bold text-lg">
                          {format(new Date(request.ot_date), 'MMM dd, yyyy')}
                        </span>
                        <span className="text-lg font-bold text-blue-600">
                          {request.ot_hours}h OT
                        </span>
                      </div>

                      <div className="text-sm text-gray-700 mb-2">
                        <strong>Work Description:</strong>
                        <div className="mt-1 text-gray-600">{request.work_description}</div>
                      </div>

                      {request.status === 'rejected' && request.rejection_reason && (
                        <div className="mt-2 p-2 bg-red-100 rounded border border-red-200 text-sm">
                          <strong className="text-red-900">Rejection Reason:</strong>
                          <div className="text-red-800 mt-1">{request.rejection_reason}</div>
                        </div>
                      )}
                    </div>

                    <div className="ml-4">
                      {request.status === 'pending' && (
                        <span className="flex items-center gap-2 px-3 py-1 bg-yellow-100 text-yellow-800 text-sm font-bold rounded-full">
                          <Hourglass className="h-4 w-4" />
                          PENDING
                        </span>
                      )}
                      {request.status === 'approved' && (
                        <span className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 text-sm font-bold rounded-full">
                          <CheckCircle className="h-4 w-4" />
                          APPROVED
                        </span>
                      )}
                      {request.status === 'rejected' && (
                        <span className="flex items-center gap-2 px-3 py-1 bg-red-100 text-red-800 text-sm font-bold rounded-full">
                          <XCircle className="h-4 w-4" />
                          REJECTED
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 mt-2">
                    Filed: {format(new Date(request.created_at), 'MMM dd, yyyy h:mm a')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

