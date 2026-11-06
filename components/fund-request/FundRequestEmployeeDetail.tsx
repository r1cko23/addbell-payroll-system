'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useProfile } from '@/lib/hooks/useProfile';
import { format } from 'date-fns';
import { formatFundRequestSubmittedAtLabel } from '@/lib/fund-request-history';
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
import { FundRequestAddDocument } from '@/components/fund-request/FundRequestAddDocument';
import { getFundRequestStatusBadgeClass, getFundRequestStatusBadgeVariant, canRequesterAddDocumentToFundRequest, canRequesterEditFundRequest, getFundRequestRequesterStatus, isFundRequestRejected } from '@/lib/fund-request-approval';
import { useOptionalEmployeeSession } from '@/contexts/EmployeeSessionContext';
import { Button } from '@/components/ui/button';
import { isFundRequestPaymentCheckDocument } from '@/lib/fund-request-payment-check';
import { epPageWrapper, epSubmitRequestButton } from '@/lib/employee-portal-ui';
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
  const session = useOptionalEmployeeSession();
  const [request, setRequest] = useState<FundRequestRow | null>(null);
  const [requesterName, setRequesterName] = useState<string>('');
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
  const [vendorName, setVendorName] = useState<string>('');
  const [documents, setDocuments] = useState<FundRequestDocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      // Portal users have no Supabase JWT; the portal API scopes this to the signed-in employee.
      const res = await fetch(
        `/api/employee-portal/fund-requests?id=${encodeURIComponent(fundRequestId)}`,
        { cache: 'no-store' }
      );
      const json = (await res.json().catch(() => ({}))) as {
        request?: FundRequestRow;
        requesterName?: string;
        project?: ProjectInfo | null;
        vendorName?: string;
        documents?: FundRequestDocumentSummary[];
      };
      if (!active) return;
      if (!res.ok || !json.request) {
        setRequest(null);
        setLoading(false);
        return;
      }
      setRequest(json.request);
      setRequesterName(json.requesterName ?? '');
      setProjectInfo(json.project ?? null);
      setVendorName(json.vendorName ?? '');
      setDocuments((json.documents ?? []).filter((doc) => !isFundRequestPaymentCheckDocument(doc)));
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [fundRequestId]);

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
  const canEdit =
    canRequesterEditFundRequest(request) &&
    request.requested_by === session?.employee?.id;
  const canAddDocument =
    canRequesterAddDocumentToFundRequest(request) &&
    request.requested_by === session?.employee?.id;
  const requesterStatus = getFundRequestRequesterStatus(request);

  return (
    <div className={cn('w-full max-w-3xl', epPageWrapper)}>
      <Link href={base} className="text-muted-foreground hover:text-foreground text-sm">
        ← Back to Fund Requests
      </Link>
      <Card className="border-border/80 bg-card/95">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <CardTitle>Fund request</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm text-muted-foreground">
                  Requested by {requesterName} on{' '}
                  {formatFundRequestSubmittedAtLabel(request)}
                </p>
                <Badge
                  variant={getFundRequestStatusBadgeVariant(requesterStatus)}
                  className={cn('w-fit', getFundRequestStatusBadgeClass(requesterStatus))}
                >
                  {STATUS_LABELS[requesterStatus] ?? requesterStatus}
                </Badge>
              </div>
            </div>
            {canEdit ? (
              <Button asChild size="sm" variant="outline" className={cn(epSubmitRequestButton, "sm:w-auto")}>
                <Link href={`${base}/${fundRequestId}/edit`}>Edit request</Link>
              </Button>
            ) : null}
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

          <FundRequestSupportingDocuments
            documents={documents}
            requestedBy={request.requested_by}
          />

          {canAddDocument ? (
            <FundRequestAddDocument
              requestId={fundRequestId}
              requestedBy={request.requested_by}
              onUploaded={(document) => {
                setDocuments((current) => [...current, document]);
              }}
            />
          ) : null}

          {isFundRequestRejected(request) && request.rejection_reason && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3">
              <h4 className="text-xs font-medium uppercase tracking-wide text-destructive">
                Rejection reason
              </h4>
              <p className="mt-1 text-sm">{request.rejection_reason}</p>
              <p className="mt-2 text-sm text-destructive">
                This request cannot be edited or resubmitted. File a new request in the current
                cutoff if you still need funds.
              </p>
            </div>
          )}
          {isFundRequestRejected(request) && !request.rejection_reason && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3">
              <p className="text-sm text-destructive">
                This request was rejected and can no longer be edited or resubmitted. File a new
                request in the current cutoff if you still need funds.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
