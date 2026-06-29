'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useProfile } from '@/lib/hooks/useProfile';
import { useOptionalEmployeeSession } from '@/contexts/EmployeeSessionContext';
import { DashboardLayout } from '@/components/DashboardLayout';
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
import { FundRequestCutoffHistory } from '@/components/fund-request/FundRequestCutoffHistory';
import { FundRequestAllList } from '@/components/fund-request/FundRequestAllList';
import { FundRequestMyRequests } from '@/components/fund-request/FundRequestMyRequests';

type FundRequestWithProject = FundRequestRow & {
  projects: { name: string; code: string } | null;
};

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

type FundRequestListTab = 'inbox' | 'history' | 'all-requests' | 'my-requests';

function FundRequestListPageContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile, loading: profileLoading } = useProfile();
  const session = useOptionalEmployeeSession();
  const normalizedRole = (profile?.role || '').trim().toLowerCase();
  const isPortal = (pathname?.startsWith('/app') || pathname?.startsWith('/employee-portal')) ?? false;
  const isApprover = isFundRequestApproverRole(normalizedRole) && !isPortal;
  const isUpperManagement = normalizedRole === 'upper_management';
  const isPurchasingOfficer = normalizedRole === 'purchasing_officer';
  const showAllRequestsTab = isPurchasingOfficer;
  const showHistoryTab = isUpperManagement || isPurchasingOfficer;
  const showMyRequestsTab = isApprover && !isUpperManagement;
  const tabParam = searchParams.get('tab');
  const initialTab: FundRequestListTab =
    tabParam === 'inbox' && isApprover
      ? 'inbox'
      : tabParam === 'history' && showHistoryTab
        ? 'history'
        : tabParam === 'all-requests' && showAllRequestsTab
          ? 'all-requests'
          : 'my-requests';
  const [activeTab, setActiveTab] = useState<FundRequestListTab>(initialTab);
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
    if (!isApprover) return;
    if (showHistoryTab && !showMyRequestsTab) {
      const nextTab = searchParams.get('tab');
      setActiveTab(nextTab === 'history' ? 'history' : 'inbox');
      return;
    }
    if (!showMyRequestsTab) {
      setActiveTab('inbox');
      return;
    }
    const nextTab = searchParams.get('tab');
    if (nextTab === 'inbox') {
      setActiveTab('inbox');
      return;
    }
    if (nextTab === 'history' && showHistoryTab) {
      setActiveTab('history');
      return;
    }
    if (nextTab === 'all-requests' && showAllRequestsTab) {
      setActiveTab('all-requests');
      return;
    }
    setActiveTab('my-requests');
  }, [searchParams, isApprover, showMyRequestsTab, showAllRequestsTab, showHistoryTab]);

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
    if (activeTab !== 'all-requests') {
      setLoading(false);
      return;
    }
    const fetchData = async () => {
      const { data } = await supabase
        .from('fund_requests')
        .select('*, projects ( name, code )')
        .order('created_at', { ascending: false });
      setRows((data as FundRequestWithProject[]) ?? []);
      setLoading(false);
    };
    setLoading(true);
    fetchData();
  }, [profileLoading, resolvingLinkedEmployee, supabase, activeTab]);

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
    const tab: FundRequestListTab =
      value === 'inbox'
        ? 'inbox'
        : value === 'history'
          ? 'history'
          : value === 'all-requests'
            ? 'all-requests'
            : 'my-requests';
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'inbox') {
      params.set('tab', 'inbox');
    } else if (tab === 'history') {
      params.set('tab', 'history');
    } else if (tab === 'all-requests') {
      params.set('tab', 'all-requests');
    } else {
      params.delete('tab');
    }
    const query = params.toString();
    router.replace(query ? `${base}?${query}` : base, { scroll: false });
  };

  const allRequestsFilters = (
    <div className="flex flex-col gap-4 border-b px-4 py-4 sm:flex-row">
      <div className="relative min-w-0 flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by purpose or project..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-full min-w-0 sm:w-[220px]">
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
                  ? showMyRequestsTab
                    ? 'Review requests pending your approval or view your submitted requests.'
                    : isUpperManagement
                      ? 'Review pending requests for final approval, or open History to see approved and returned requests by cutoff.'
                      : isPurchasingOfficer
                        ? 'Review pending requests, browse all statuses, or open History for approved and rejected requests by cutoff.'
                        : 'Review requests pending your approval.'
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
        showMyRequestsTab ? (
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="h-auto w-full justify-start overflow-x-auto">
            <TabsTrigger value="inbox">For Approval</TabsTrigger>
            {showHistoryTab ? (
              <TabsTrigger value="history">History</TabsTrigger>
            ) : null}
            {showAllRequestsTab ? (
              <TabsTrigger value="all-requests">All Requests</TabsTrigger>
            ) : null}
            <TabsTrigger value="my-requests">My Requests</TabsTrigger>
          </TabsList>
          <TabsContent value="inbox" className="mt-4">
            <FundRequestInbox />
          </TabsContent>
          {showHistoryTab ? (
            <TabsContent value="history" className="mt-4">
              <FundRequestCutoffHistory
                detailHrefBase={base}
                role={isPurchasingOfficer ? 'purchasing_officer' : 'upper_management'}
              />
            </TabsContent>
          ) : null}
          {showAllRequestsTab ? (
            <TabsContent value="all-requests" className="mt-4">
              <Card className="border-border/80 bg-card/95">
                {allRequestsFilters}
                <CardContent className="p-0">
                  <FundRequestAllList
                    rows={rows}
                    loading={loading}
                    searchTerm={searchTerm}
                    statusFilter={statusFilter}
                    base={base}
                    requesterEmployeeId={employeeId}
                    onRequestDeleted={(requestId) =>
                      setRows((current) => current.filter((row) => row.id !== requestId))
                    }
                  />
                </CardContent>
              </Card>
            </TabsContent>
          ) : null}
          <TabsContent value="my-requests" className="mt-4">
            <FundRequestMyRequests
              detailHrefBase={base}
              requesterEmployeeId={employeeId}
            />
          </TabsContent>
        </Tabs>
        ) : showHistoryTab ? (
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="h-auto w-full justify-start overflow-x-auto">
              <TabsTrigger value="inbox">For Approval</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
            <TabsContent value="inbox" className="mt-4">
              <FundRequestInbox />
            </TabsContent>
            <TabsContent value="history" className="mt-4">
              <FundRequestCutoffHistory detailHrefBase={base} role="upper_management" />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="mt-4">
            <FundRequestInbox />
          </div>
        )
      ) : (
        <FundRequestMyRequests detailHrefBase={base} requesterEmployeeId={employeeId} />
      )}
    </div>
  );

  if (isPortal) return content;
  return <DashboardLayout>{content}</DashboardLayout>;
}
