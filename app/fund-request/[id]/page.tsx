'use client';

import { Suspense } from 'react';
import { useParams, usePathname, useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/DashboardLayout';
import { FundRequestApprovalDetail } from '@/components/fund-request/FundRequestApprovalDetail';
import { FundRequestEmployeeDetail } from '@/components/fund-request/FundRequestEmployeeDetail';
import {
  buildFundRequestListHref,
  fundRequestListBackLabel,
  parseFundRequestListReturnState,
} from '@/lib/fund-request-list-return';

function FundRequestDetailPageContent() {
  const params = useParams();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isPortal =
    (pathname?.startsWith('/app') || pathname?.startsWith('/employee-portal')) ?? false;
  const base = pathname?.startsWith('/employee-portal')
    ? '/employee-portal/fund-request'
    : isPortal
      ? '/app/fund-request'
      : '/fund-request';
  const fundRequestId = params?.id as string;
  const returnState = parseFundRequestListReturnState(searchParams);
  const defaultStatus = returnState.tab === 'inbox' ? 'pending' : 'all';
  const backHref = buildFundRequestListHref(base, returnState, { defaultStatus });
  const backLabel = fundRequestListBackLabel(returnState);

  if (!fundRequestId) {
    const notFound = <p className="text-destructive">Fund request not found.</p>;
    return isPortal ? notFound : <DashboardLayout>{notFound}</DashboardLayout>;
  }

  if (isPortal) {
    return <FundRequestEmployeeDetail fundRequestId={fundRequestId} base={base} backHref={backHref} />;
  }

  return (
    <DashboardLayout>
      <FundRequestApprovalDetail
        fundRequestId={fundRequestId}
        backHref={backHref}
        backLabel={backLabel}
      />
    </DashboardLayout>
  );
}

export default function FundRequestDetailPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout>
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        </DashboardLayout>
      }
    >
      <FundRequestDetailPageContent />
    </Suspense>
  );
}
