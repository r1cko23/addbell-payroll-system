'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useProfile } from '@/lib/hooks/useProfile';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { FundRequestRow } from '@/types/fund-request';
import {
  FUND_REQUEST_FIELD_LABELS,
  FUND_REQUEST_STATUS_LABELS,
  getFundRequestReferenceModeLabel,
  isSubcontractorPaymentPurpose,
  shouldShowFundRequestProjectReferenceFields,
} from '@/types/fund-request';
import { FundRequestField } from '@/components/fund-request/FundRequestField';
import { FundRequestProjectDetailsDisplay } from '@/components/fund-request/FundRequestProjectDetailsDisplay';
import { FundRequestDetailsSection } from '@/components/fund-request/FundRequestDetailsSection';
import type { FundRequestDocumentSummary } from '@/types/fund-request';
import { FundRequestSupportingDocuments } from '@/components/fund-request/FundRequestSupportingDocuments';
import { getFundRequestStatusBadgeClass, getFundRequestStatusBadgeVariant } from '@/lib/fund-request-approval';
import { resolveFundRequestRequesterInfo } from '@/lib/fund-request-requester';
import { isSchemaMissingTableOrRelationError } from '@/lib/postgrestSchema';
import { epPageWrapper } from '@/lib/employee-portal-ui';
import { cn } from '@/lib/utils';
import type { FundRequestDetailItem } from '@/lib/fund-request-details';

const STATUS_LABELS = FUND_REQUEST_STATUS_LABELS;

type ProjectInfo = { name: string; code: string; site_address: string | null };

export function FundRequestEmployeeDetail({
  fundRequestId,
  base,
}: {
  fundRequestId: string;
  base: string;
}) {
  const { loading: profileLoading } = useProfile();
  const supabase = createClient();
  const [request, setRequest] = useState<FundRequestRow | null>(null);
  const [requesterName, setRequesterName] = useState<string>('');
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
  const [vendorName, setVendorName] = useState<string>('');
  const [documents, setDocuments] = useState<FundRequestDocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: req, error } = await supabase
        .from('fund_requests')
        .select('*')
        .eq('id', fundRequestId)
        .single();
      if (error || !req) {
        setRequest(null);
        setLoading(false);
        return;
      }
      const row = req as FundRequestRow;
      setRequest(row);
      setVendorName('');

      const requesterInfo = await resolveFundRequestRequesterInfo(
        supabase,
        row.requested_by
      );
      setRequesterName(requesterInfo.name);

      if (row.project_id) {
        const { data: proj } = await supabase
          .from('projects')
          .select('name, code, site_address')
          .eq('id', row.project_id)
          .single();
        if (proj) setProjectInfo(proj as ProjectInfo);
      }

      if (row.vendor_id) {
        const { data: vendor } = await supabase
          .from('vendors')
          .select('name')
          .eq('id', row.vendor_id)
          .single();
        setVendorName((vendor as { name?: string } | null)?.name ?? '');
      }

      const { data: docRows, error: docsError } = await supabase
        .from('fund_request_documents')
        .select('id, fund_request_id, employee_id, file_name, file_type, file_size, created_at')
        .eq('fund_request_id', row.id)
        .order('created_at', { ascending: true });
      if (docsError) {
        if (!isSchemaMissingTableOrRelationError(docsError)) {
          console.error('fund_request_documents load:', docsError);
        }
      } else {
        setDocuments((docRows as FundRequestDocumentSummary[]) ?? []);
      }

      setLoading(false);
    })();
  }, [fundRequestId, supabase]);

  if (profileLoading || loading) {
    return <div className="h-8 w-48 animate-pulse rounded bg-muted" />;
  }

  if (!request) {
    return (
      <div className="space-y-4">
        <Link href={base} className="text-muted-foreground hover:text-foreground text-sm">
          ← Back
        </Link>
        <p className="text-destructive">Fund request not found.</p>
      </div>
    );
  }

  const details = (request.details as FundRequestDetailItem[] | null) ?? [];
  const referenceModeLabel = getFundRequestReferenceModeLabel(request.reference_mode);
  const showProjectReferenceFields = shouldShowFundRequestProjectReferenceFields(
    request.reference_mode
  );
  const showSubcontractorFields =
    showProjectReferenceFields &&
    isSubcontractorPaymentPurpose(request.purpose);

  return (
    <div className={cn('w-full max-w-3xl', epPageWrapper)}>
      <Link href={base} className="text-muted-foreground hover:text-foreground text-sm">
        ← Back to Fund Requests
      </Link>
      <Card className="border-border/80 bg-card/95">
        <CardHeader>
          <CardTitle>Fund request</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-muted-foreground">
              Requested by {requesterName} on{' '}
              {format(new Date(request.request_date), 'MMMM d, yyyy')}
            </p>
            <Badge
              variant={getFundRequestStatusBadgeVariant(request.status)}
              className={cn('w-fit', getFundRequestStatusBadgeClass(request.status))}
            >
              {STATUS_LABELS[request.status] ?? request.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <FundRequestField label={FUND_REQUEST_FIELD_LABELS.purpose} value={request.purpose} />
          <FundRequestField
            label={FUND_REQUEST_FIELD_LABELS.referenceBasis}
            value={referenceModeLabel}
          />

          {projectInfo && showProjectReferenceFields && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Linked Project
              </h4>
              <p className="font-medium uppercase">
                {projectInfo.code} — {projectInfo.name}
              </p>
              {projectInfo.site_address && (
                <p className="text-sm uppercase text-muted-foreground">{projectInfo.site_address}</p>
              )}
            </div>
          )}

          {showProjectReferenceFields ? (
            <FundRequestProjectDetailsDisplay
              request={request}
              vendorName={vendorName}
              showSubcontractorFields={showSubcontractorFields}
            />
          ) : null}

          <FundRequestDetailsSection
            details={details}
            totalRequestedAmount={request.total_requested_amount}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {request.remarks && (
              <div className="sm:col-span-2">
                <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Remarks
                </h4>
                <p className="mt-1">{request.remarks}</p>
              </div>
            )}
            <div>
              <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Date Needed
              </h4>
              <p className="mt-1">
                {request.date_needed ? format(new Date(request.date_needed), 'MMM d, yyyy') : '—'}
              </p>
            </div>
            {request.urgent_reason && (
              <div className="sm:col-span-2">
                <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Reason for Urgency
                </h4>
                <p className="mt-1">{request.urgent_reason}</p>
              </div>
            )}
          </div>

          <FundRequestSupportingDocuments documents={documents} />

          {request.status === 'rejected' && request.rejection_reason && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3">
              <h4 className="text-xs font-medium uppercase tracking-wide text-destructive">
                Rejection reason
              </h4>
              <p className="mt-1 text-sm">{request.rejection_reason}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
