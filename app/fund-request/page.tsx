'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useProfile } from '@/lib/hooks/useProfile';
import { useOptionalEmployeeSession } from '@/contexts/EmployeeSessionContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus } from 'lucide-react';
import { PageTitle } from '@/components/ui/typography';
import { epPageHeaderRow, epPageWrapper } from '@/lib/employee-portal-ui';
import { dbHeaderActions, dbHeaderButton, dbPageWrapper } from '@/lib/dashboard-ui';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { cn } from '@/lib/utils';
import { resolveLinkedEmployee } from '@/lib/resolveLinkedEmployee';
import { isFundRequestApproverRole } from '@/lib/fund-request-approval';
import { isOperationsManagerRole } from '@/lib/user-roles';
import { FundRequestInbox } from '@/components/fund-request/FundRequestInbox';
import { FundRequestCutoffHistory } from '@/components/fund-request/FundRequestCutoffHistory';
import { FundRequestAllRequests } from '@/components/fund-request/FundRequestAllRequests';
import { FundRequestMyRequests } from '@/components/fund-request/FundRequestMyRequests';

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
  const isAdmin = normalizedRole === 'admin';
  const showAllRequestsTab = isPurchasingOfficer || isAdmin;
  const showHistoryTab = isUpperManagement || isPurchasingOfficer || isAdmin;
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
  const [linkedEmployeeId, setLinkedEmployeeId] = useState<string | null>(null);
  const [resolvingLinkedEmployee, setResolvingLinkedEmployee] = useState(false);
  const supabase = createClient();
  const employeeId = session?.employee?.id ?? linkedEmployeeId;
  const requesterIsOperationsManager = isOperationsManagerRole(normalizedRole);
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

  const fundRequestSubtitle = isApprover
    ? showMyRequestsTab
      ? 'Review requests pending your approval or view your submitted requests.'
      : showHistoryTab
        ? 'Review pending requests, or open History for upper management final approvals and rejections by cutoff.'
        : 'Review requests pending your approval.'
    : 'Materials, subcontractor, project funds, or liquidation.';

  const newRequestButton = canCreate ? (
    <Button asChild className={isPortal ? 'min-h-11 w-full sm:min-h-9 sm:w-auto' : cn(dbHeaderButton)}>
      <Link href={`${base}/new`}>
        <Plus className="h-4 w-4 mr-2" />
        New Request
      </Link>
    </Button>
  ) : null;

  const content = (
    <div className={cn('w-full', isPortal ? epPageWrapper : dbPageWrapper)}>
      {isPortal ? (
        <div className={epPageHeaderRow}>
          <PageTitle>Fund Requests</PageTitle>
          {newRequestButton}
        </div>
      ) : (
        <DashboardPageHeader
          title="Fund Requests"
          description={fundRequestSubtitle}
          actions={
            newRequestButton ? (
              <div className={dbHeaderActions}>{newRequestButton}</div>
            ) : undefined
          }
        />
      )}

      {isApprover ? (
        showMyRequestsTab ? (
        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex w-full flex-col gap-4">
          <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsTrigger value="inbox" className="min-h-10 shrink-0 px-3">
              For Approval
            </TabsTrigger>
            {showHistoryTab ? (
              <TabsTrigger value="history" className="min-h-10 shrink-0 px-3">
                History
              </TabsTrigger>
            ) : null}
            {showAllRequestsTab ? (
              <TabsTrigger value="all-requests" className="min-h-10 shrink-0 px-3">
                All Requests
              </TabsTrigger>
            ) : null}
            <TabsTrigger value="my-requests" className="min-h-10 shrink-0 px-3">
              My Requests
            </TabsTrigger>
          </TabsList>
          <TabsContent value="inbox" className="mt-0">
            <FundRequestInbox />
          </TabsContent>
          {showHistoryTab ? (
            <TabsContent value="history" className="mt-0">
              <FundRequestCutoffHistory detailHrefBase={base} />
            </TabsContent>
          ) : null}
          {showAllRequestsTab ? (
            <TabsContent value="all-requests" className="mt-0">
              <FundRequestAllRequests
                detailHrefBase={base}
                requesterEmployeeId={employeeId}
                requesterUserId={profile?.id ?? null}
                requesterIsOperationsManager={requesterIsOperationsManager}
              />
            </TabsContent>
          ) : null}
          <TabsContent value="my-requests" className="mt-0">
            <FundRequestMyRequests
              detailHrefBase={base}
              requesterEmployeeId={employeeId}
              requesterUserId={profile?.id ?? null}
              requesterIsOperationsManager={requesterIsOperationsManager}
            />
          </TabsContent>
        </Tabs>
        ) : showHistoryTab ? (
          <Tabs value={activeTab} onValueChange={handleTabChange} className="flex w-full flex-col gap-4">
            <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <TabsTrigger value="inbox" className="min-h-10 shrink-0 px-3">
                For Approval
              </TabsTrigger>
              <TabsTrigger value="history" className="min-h-10 shrink-0 px-3">
                History
              </TabsTrigger>
            </TabsList>
            <TabsContent value="inbox" className="mt-0">
              <FundRequestInbox />
            </TabsContent>
            <TabsContent value="history" className="mt-0">
              <FundRequestCutoffHistory detailHrefBase={base} />
            </TabsContent>
          </Tabs>
        ) : (
          <FundRequestInbox />
        )
      ) : (
        <FundRequestMyRequests
          detailHrefBase={base}
          requesterEmployeeId={employeeId}
          requesterUserId={profile?.id ?? null}
          requesterIsOperationsManager={requesterIsOperationsManager}
        />
      )}
    </div>
  );

  if (isPortal) return content;
  return <DashboardLayout>{content}</DashboardLayout>;
}
