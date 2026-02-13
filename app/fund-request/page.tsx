'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useProfile } from '@/lib/hooks/useProfile';
import { useEmployeeSession } from '@/contexts/EmployeeSessionContext';
import { format } from 'date-fns';
import type { FundRequestRow } from '@/types/fund-request';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending (PM)',
  project_manager_approved: 'PM Approved (PO)',
  purchasing_officer_approved: 'PO Approved (Management)',
  management_approved: 'Approved',
  rejected: 'Rejected',
};

export default function FundRequestListPage() {
  const pathname = usePathname();
  const { profile, loading: profileLoading } = useProfile();
  const session = useEmployeeSession();
  const isPortal = (pathname?.startsWith('/app') || pathname?.startsWith('/employee-portal')) ?? false;
  const [rows, setRows] = useState<FundRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const employeeId = session?.employee?.id ?? null;

  useEffect(() => {
    if (!employeeId && !profile && !profileLoading) return;
    const fetchData = async () => {
      let query = supabase
        .from('fund_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (employeeId) query = query.eq('requested_by', employeeId);
      const { data } = await query;
      setRows((data as FundRequestRow[]) ?? []);
      setLoading(false);
    };
    fetchData();
  }, [employeeId, profile, profileLoading, supabase]);

  const loadingState = profileLoading && !session?.employee?.id;
  if (loadingState) return <div className="animate-pulse h-8 w-48 bg-slate-200 rounded" />;

  const canCreate = Boolean(employeeId);
  const base = pathname?.startsWith('/employee-portal') ? '/employee-portal/fund-request' : isPortal ? '/app/fund-request' : '/fund-request';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Fund Request</h1>
        {canCreate && (
          <Link
            href={`${base}/new`}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            New fund request
          </Link>
        )}
      </div>
      <p className="text-muted-foreground text-sm">
        Request funds for materials, subcontractor payment, project funds, or liquidation. Flow: Requester → Project Manager → Purchasing Officer → Upper Management.
      </p>
      <div className="rounded-xl border bg-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No fund requests yet.</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Purpose</th>
                <th className="px-4 py-3 font-medium">Total (PHP)</th>
                <th className="px-4 py-3 font-medium">Date needed</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">{format(new Date(r.request_date), 'MMM d, yyyy')}</td>
                  <td className="px-4 py-3 max-w-[200px] truncate">{r.purpose}</td>
                  <td className="px-4 py-3 font-medium">₱{Number(r.total_requested_amount).toLocaleString()}</td>
                  <td className="px-4 py-3">{format(new Date(r.date_needed), 'MMM d')}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.status === 'management_approved'
                          ? 'bg-green-100 text-green-800'
                          : r.status === 'rejected'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {STATUS_LABELS[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`${base}/${r.id}`} className="text-primary font-medium hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}