'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useProfile } from '@/lib/hooks/useProfile';
import { useOptionalEmployeeSession } from '@/contexts/EmployeeSessionContext';
import { format } from 'date-fns';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Plus } from 'lucide-react';
import { H1, PageTitle, PageSubtitle } from '@/components/ui/typography';
import { epPageHeaderRow, epPageWrapper } from '@/lib/employee-portal-ui';
import { dbPageWrapper } from '@/lib/dashboard-ui';
import { cn } from '@/lib/utils';
import type { FundRequestRow } from '@/types/fund-request';
import { resolveLinkedEmployee } from '@/lib/resolveLinkedEmployee';
import { isFundRequestApproverRole } from '@/lib/fund-request-approval';
import { FundRequestInbox } from '@/components/fund-request/FundRequestInbox';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending (Operations Manager)',
  project_manager_approved: 'Pending (Purchasing Officer)',
  purchasing_officer_approved: 'Pending (Upper Management)',
  management_approved: 'Approved',
  rejected: 'Rejected',
};

type FundRequestWithProject = FundRequestRow & {
  projects: { name: string; code: string } | null;
};

function FundRequestAllList({
  rows,
  loading,
  searchTerm,
  statusFilter,
  base,
}: {
  rows: FundRequestWithProject[];
  loading: boolean;
  searchTerm: string;
  statusFilter: string;
  base: string;
}) {
  const filteredRows = rows.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchPurpose = (r.purpose || '').toLowerCase().includes(term);
      const matchProject = (r.project_title || r.projects?.name || '').toLowerCase().includes(term);
      if (!matchPurpose && !matchProject) return false;
    }
    return true;
  });

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  }

  if (filteredRows.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        {searchTerm || statusFilter !== 'all'
          ? 'No fund requests match your filters.'
          : 'No fund requests yet.'}
      </div>
    );
  }

  return (
    <>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Project</th>
              <th className="px-4 py-3 font-medium">Purpose</th>
              <th className="px-4 py-3 font-medium text-right">Total (PHP)</th>
              <th className="px-4 py-3 font-medium">Date Needed</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => (
              <tr key={r.id} className="border-b last:border-0 hover:bg-primary/5">
                <td className="px-4 py-3 whitespace-nowrap">{format(new Date(r.request_date), 'MMM d, yyyy')}</td>
                <td className="px-4 py-3 max-w-[180px] truncate">
                  {r.projects?.name || r.project_title || '—'}
                </td>
                <td className="px-4 py-3 max-w-[200px] truncate">{r.purpose}</td>
                <td className="px-4 py-3 font-medium text-right tabular-nums">
                  ₱{Number(r.total_requested_amount).toLocaleString()}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {r.date_needed ? format(new Date(r.date_needed), 'MMM d') : '—'}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant={
                      r.status === 'management_approved' ? 'default'
                      : r.status === 'rejected' ? 'destructive'
                      : 'secondary'
                    }
                    className="whitespace-nowrap text-xs"
                  >
                    {STATUS_LABELS[r.status] ?? r.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Link href={`${base}/${r.id}`} className="text-primary font-medium hover:underline text-sm">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3 p-4">
        {filteredRows.map((r) => (
          <Card key={r.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">
                    {format(new Date(r.request_date), 'MMM d, yyyy')}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {(r.projects?.name || r.project_title || '—').toString()}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 truncate">{r.purpose}</div>
                </div>
                <Badge
                  variant={
                    r.status === 'management_approved'
                      ? 'default'
                      : r.status === 'rejected'
                        ? 'destructive'
                        : 'secondary'
                  }
                  className="max-w-[45%] shrink-0 whitespace-normal text-right text-xs leading-snug sm:max-w-none"
                >
                  {STATUS_LABELS[r.status] ?? r.status}
                </Badge>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="text-sm font-semibold tabular-nums">
                  ₱{Number(r.total_requested_amount).toLocaleString()}
                </div>
                <Link href={`${base}/${r.id}`} className="text-primary font-medium hover:underline text-sm">
                  View
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

export default function FundRequestListPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout>
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        </DashboardLayout>
      }
    >
      <FundRequestListPageContent />
    </Suspense>
  );
}

function FundRequestListPageContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile, loading: profileLoading } = useProfile();
  const session = useOptionalEmployeeSession();
  const normalizedRole = (profile?.role || '').trim().toLowerCase();
  const isPortal = (pathname?.startsWith('/app') || pathname?.startsWith('/employee-portal')) ?? false;
  const isApprover = isFundRequestApproverRole(normalizedRole) && !isPortal;
  const initialTab = searchParams.get('tab') === 'inbox' && isApprover ? 'inbox' : 'all';
  const [activeTab, setActiveTab] = useState<'inbox' | 'all'>(initialTab);
  const [rows, setRows] = useState<FundRequestWithProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [linkedEmployeeId, setLinkedEmployeeId] = useState<string | null>(null);
  const [resolvingLinkedEmployee, setResolvingLinkedEmployee] = useState(false);
  const supabase = createClient();
  const employeeId = session?.employee?.id ?? linkedEmployeeId;
  const canViewAllFromDashboard =
    !isPortal &&
    (normalizedRole === 'operations_manager' ||
      normalizedRole === 'purchasing_officer' ||
      normalizedRole === 'hr' ||
      normalizedRole === 'admin' ||
      normalizedRole === 'upper_management');

  useEffect(() => {
    setActiveTab(searchParams.get('tab') === 'inbox' && isApprover ? 'inbox' : 'all');
  }, [searchParams, isApprover]);

  useEffect(() => {
    if (session?.employee?.id || !profile?.id || isPortal) return;
    let active = true;
    setResolvingLinkedEmployee(true);
    resolveLinkedEmployee(supabase, {
      userId: profile.id,
      email: profile.email,
      fullName: profile.full_name,
    }).then((data) => {
      if (active) {
        setLinkedEmployeeId(data?.id ?? null);
        setResolvingLinkedEmployee(false);
      }
    });
    return () => {
      active = false;
    };
  }, [isPortal, profile?.email, profile?.full_name, profile?.id, session?.employee?.id, supabase]);

  useEffect(() => {
    if (profileLoading || resolvingLinkedEmployee) return;
    const fetchData = async () => {
      const shouldFilterByRequester =
        Boolean(employeeId) &&
        (isPortal || isApprover || !canViewAllFromDashboard);
      if (!employeeId) {
        if (!canViewAllFromDashboard || isApprover) {
          setRows([]);
          setLoading(false);
          return;
        }
      }
      let query = supabase
        .from('fund_requests')
        .select('*, projects ( name, code )')
        .order('created_at', { ascending: false });
      if (shouldFilterByRequester) query = query.eq('requested_by', employeeId);
      const { data } = await query;
      setRows((data as FundRequestWithProject[]) ?? []);
      setLoading(false);
    };
    fetchData();
  }, [
    employeeId,
    profileLoading,
    resolvingLinkedEmployee,
    supabase,
    canViewAllFromDashboard,
    isPortal,
    isApprover,
  ]);

  const loadingState = (profileLoading || resolvingLinkedEmployee) && !session?.employee?.id;
  if (loadingState) return <DashboardLayout><div className="h-8 w-48 animate-pulse rounded bg-muted" /></DashboardLayout>;

  const canCreateFromDashboard =
    normalizedRole === 'operations_manager' ||
    normalizedRole === 'purchasing_officer' ||
    normalizedRole === 'hr' ||
    normalizedRole === 'admin' ||
    normalizedRole === 'upper_management';
  const canCreate = isPortal ? Boolean(employeeId) : canCreateFromDashboard;
  const base = pathname?.startsWith('/employee-portal') ? '/employee-portal/fund-request' : isPortal ? '/app/fund-request' : '/fund-request';

  const handleTabChange = (value: string) => {
    const tab = value === 'inbox' ? 'inbox' : 'all';
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'inbox') {
      params.set('tab', 'inbox');
    } else {
      params.delete('tab');
    }
    const query = params.toString();
    router.replace(query ? `${base}?${query}` : base, { scroll: false });
  };

  const allRequestsFilters = (
    <div className="flex flex-col sm:flex-row gap-4 border-b px-4 py-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by purpose or project..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-full sm:w-[220px]">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="pending">Pending (Operations Manager)</SelectItem>
          <SelectItem value="project_manager_approved">Pending (Purchasing Officer)</SelectItem>
          <SelectItem value="purchasing_officer_approved">Pending (Upper Management)</SelectItem>
          <SelectItem value="management_approved">Approved</SelectItem>
          <SelectItem value="rejected">Rejected</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  const content = (
    <div className={cn('w-full', isPortal ? epPageWrapper : dbPageWrapper)}>
      <div className={isPortal ? epPageHeaderRow : 'flex items-center justify-between gap-4'}>
        <div className="min-w-0">
          {isPortal ? (
            <PageTitle>Fund Requests</PageTitle>
          ) : (
            <>
              <H1>Fund Requests</H1>
              <PageSubtitle className="mt-1">
                {isApprover
                  ? 'Review requests for approval or view your submitted requests.'
                  : 'Materials, subcontractor, project funds, or liquidation.'}
              </PageSubtitle>
            </>
          )}
        </div>
        {canCreate && (
          <Button asChild className={isPortal ? 'min-h-11 w-full sm:min-h-9 sm:w-auto' : undefined}>
            <Link href={`${base}/new`}>
              <Plus className="h-4 w-4 mr-2" />
              New Request
            </Link>
          </Button>
        )}
      </div>

      {isApprover ? (
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList>
            <TabsTrigger value="inbox">For Approval</TabsTrigger>
            <TabsTrigger value="all">My Requests</TabsTrigger>
          </TabsList>
          <TabsContent value="inbox" className="mt-4">
            <FundRequestInbox />
          </TabsContent>
          <TabsContent value="all" className="mt-4">
            <Card className="border-border/80 bg-card/95">
              {allRequestsFilters}
              <CardContent className="p-0">
                <FundRequestAllList
                  rows={rows}
                  loading={loading}
                  searchTerm={searchTerm}
                  statusFilter={statusFilter}
                  base={base}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        <Card className="border-border/80 bg-card/95">
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by purpose or project..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="pending">Pending (Operations Manager)</SelectItem>
                  <SelectItem value="project_manager_approved">Pending (Purchasing Officer)</SelectItem>
                  <SelectItem value="purchasing_officer_approved">Pending (Upper Management)</SelectItem>
                  <SelectItem value="management_approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <FundRequestAllList
              rows={rows}
              loading={loading}
              searchTerm={searchTerm}
              statusFilter={statusFilter}
              base={base}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );

  if (isPortal) return content;
  return <DashboardLayout>{content}</DashboardLayout>;
}
