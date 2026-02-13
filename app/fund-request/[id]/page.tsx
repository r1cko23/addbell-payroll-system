'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useProfile } from '@/lib/hooks/useProfile';
import { useEmployeeSession } from '@/contexts/EmployeeSessionContext';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { FundRequestRow } from '@/types/fund-request';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending (Project Manager)',
  project_manager_approved: 'Approved by Project Manager (Purchasing Officer)',
  purchasing_officer_approved: 'Approved by Purchasing Officer (Management)',
  management_approved: 'Approved by Management',
  rejected: 'Rejected',
};

type DetailItem = { description?: string; amount?: number };

export default function FundRequestDetailPage() {
  const params = useParams();
  const pathname = usePathname();
  const { profile, loading: profileLoading } = useProfile();
  const session = useEmployeeSession();
  const supabase = createClient();
  const isPortal = (pathname?.startsWith('/app') || pathname?.startsWith('/employee-portal')) ?? false;
  const base = pathname?.startsWith('/employee-portal') ? '/employee-portal/fund-request' : isPortal ? '/app/fund-request' : '/fund-request';
  const [request, setRequest] = useState<FundRequestRow | null>(null);
  const [requesterName, setRequesterName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = params?.id as string;
    if (!id) return;
    (async () => {
      const { data: req, error } = await supabase
        .from('fund_requests')
        .select('*')
        .eq('id', id)
        .single();
      if (error || !req) {
        setRequest(null);
        setLoading(false);
        return;
      }
      setRequest(req as FundRequestRow);
      const { data: emp } = await supabase
        .from('employees')
        .select('first_name, last_name, employee_id')
        .eq('id', (req as FundRequestRow).requested_by)
        .single();
      const e = emp as { first_name?: string; last_name?: string; employee_id?: string } | null;
      setRequesterName(e ? [e.first_name, e.last_name].filter(Boolean).join(' ') : (req as FundRequestRow).requested_by);
      setLoading(false);
    })();
  }, [params?.id, supabase]);

  const loadingState = profileLoading || loading;
  if (loadingState) return <div className="animate-pulse h-8 w-48 bg-slate-200 rounded" />;
  if (!request) {
    return (
      <div className="space-y-4">
        <Link href={base} className="text-muted-foreground hover:text-foreground text-sm">← Back</Link>
        <p className="text-destructive">Fund request not found.</p>
      </div>
    );
  }

  const details = (request.details as DetailItem[] | null) ?? [];

  return (
    <div className="space-y-6 max-w-3xl">
      <Link href={base} className="text-muted-foreground hover:text-foreground text-sm">← Back to Fund Request</Link>
      <Card>
        <CardHeader>
          <CardTitle>Fund Request</CardTitle>
          <p className="text-sm text-muted-foreground">
            Request date: {format(new Date(request.request_date), 'MMMM d, yyyy')} · Requested by {requesterName}
          </p>
          <span
            className={`inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-medium ${
              request.status === 'management_approved'
                ? 'bg-green-100 text-green-800'
                : request.status === 'rejected'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-amber-100 text-amber-800'
            }`}
          >
            {STATUS_LABELS[request.status] ?? request.status}
          </span>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Purpose</h4>
            <p className="mt-1">{request.purpose}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">P.O. Number</h4>
              <p className="mt-1">{request.po_number ?? '—'}</p>
            </div>
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Project Title</h4>
              <p className="mt-1">{request.project_title ?? '—'}</p>
            </div>
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">P.O. Amount (PHP)</h4>
              <p className="mt-1">{request.po_amount != null ? Number(request.po_amount).toLocaleString() : '—'}</p>
            </div>
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Current Project %</h4>
              <p className="mt-1">{request.current_project_percentage != null ? `${request.current_project_percentage}%` : '—'}</p>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Details of Request</h4>
            <table className="w-full text-sm border rounded-md">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-3 py-2">Details</th>
                  <th className="text-right px-3 py-2">Amount (PHP)</th>
                </tr>
              </thead>
              <tbody>
                {details.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-3 py-4 text-muted-foreground text-center">No line items</td>
                  </tr>
                ) : (
                  details.map((item, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="px-3 py-2">{item.description ?? '—'}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        {item.amount != null ? Number(item.amount).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <p className="mt-2 font-medium">
              Total Requested Amount: PHP {Number(request.total_requested_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Date needed</h4>
              <p className="mt-1">{format(new Date(request.date_needed), 'MMM d, yyyy')}</p>
            </div>
            {request.urgent_reason && (
              <div className="sm:col-span-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Urgent reason</h4>
                <p className="mt-1">{request.urgent_reason}</p>
              </div>
            )}
          </div>
          {request.status === 'rejected' && request.rejection_reason && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
              <h4 className="text-xs font-medium text-destructive uppercase tracking-wide">Rejection reason</h4>
              <p className="mt-1 text-sm">{request.rejection_reason}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
