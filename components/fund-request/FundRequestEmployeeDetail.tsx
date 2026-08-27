'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
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
  isOfficeRelatedFundRequest,
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
import { canRequesterCorrectFundRequestPoNumber } from '@/lib/fund-request-requester-edit';
import { FundRequestUpdatePoNumber } from '@/components/fund-request/FundRequestUpdatePoNumber';
import { resolveFundRequestRequesterInfo } from '@/lib/fund-request-requester';
import { useOptionalEmployeeSession } from '@/contexts/EmployeeSessionContext';
import { Button } from '@/components/ui/button';
import { isSchemaMissingTableOrRelationError } from '@/lib/postgrestSchema';
import { isFundRequestPaymentCheckDocument } from '@/lib/fund-request-payment-check';
import { epPageWrapper, epSubmitRequestButton } from '@/lib/employee-portal-ui';
import { cn } from '@/lib/utils';
import { normalizeUserRole } from '@/lib/user-roles';
import type { FundRequestDetailItem } from '@/lib/fund-request-details';
import { matchMasterlistJobForFundRequestPo } from '@/lib/fund-request-client-po-masterlist';

const STATUS_LABELS = FUND_REQUEST_STATUS_LABELS;

type MasterlistBudgetInfo = {
  jobId: string;
  poNumber: string;
  title: string;
  location: string | null;
};

export function FundRequestEmployeeDetail({
  fundRequestId,
  base,
  backHref,
}: {
  fundRequestId: string;
  base: string;
  backHref?: string;
}) {
  const { profile, loading: profileLoading } = useProfile();
  const session = useOptionalEmployeeSession();
  const supabase = createClient();
  const [request, setRequest] = useState<FundRequestRow | null>(null);
  const [requesterName, setRequesterName] = useState<string>('');
  const [masterlistBudget, setMasterlistBudget] =
    useState<MasterlistBudgetInfo | null>(null);
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

      if (
        !isOfficeRelatedFundRequest(row.reference_mode) &&
        shouldShowFundRequestProjectReferenceFields(row.reference_mode)
      ) {
        const { data: jobs } = await supabase
          .from('po_masterlist_jobs')
          .select('id, po_number, project_title, location, po_amount');
        const match = matchMasterlistJobForFundRequestPo(row, jobs ?? []);
        setMasterlistBudget(
          match
            ? {
                jobId: match.jobId,
                poNumber: match.poNumber,
                title: match.title,
                location: match.location,
              }
            : null
        );
      } else {
        setMasterlistBudget(null);
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
        .select('id, fund_request_id, employee_id, file_name, file_type, file_size, created_at, document_type')
        .eq('fund_request_id', row.id)
        .order('created_at', { ascending: true });
      if (docsError) {
        if (!isSchemaMissingTableOrRelationError(docsError)) {
          console.error('fund_request_documents load:', docsError);
        }
      } else {
        setDocuments(
          ((docRows as FundRequestDocumentSummary[]) ?? []).filter(
            (doc) => !isFundRequestPaymentCheckDocument(doc)
          )
        );
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
        <Link href={backHref ?? base} className="text-muted-foreground hover:text-foreground text-sm">
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
    canRequesterEditFundRequest(request, {
      requesterUserId: profile?.id ?? null,
      requesterIsOperationsManager:
        normalizeUserRole(profile?.role) === 'operations_manager',
    }) &&
    request.requested_by === session?.employee?.id;
  const canUpdatePo =
    canRequesterCorrectFundRequestPoNumber(request, session?.employee?.id) &&
    !isOfficeRelatedFundRequest(request.reference_mode);
  const canAddDocument =
    canRequesterAddDocumentToFundRequest(request, {
      requesterUserId: profile?.id ?? null,
      requesterIsOperationsManager:
        normalizeUserRole(profile?.role) === 'operations_manager',
    }) &&
    request.requested_by === session?.employee?.id;
  const requesterStatus = getFundRequestRequesterStatus(request);

  return (
    <div className={cn('w-full max-w-3xl', epPageWrapper)}>
      <Link href={backHref ?? base} className="text-muted-foreground hover:text-foreground text-sm">
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

          {masterlistBudget && showProjectReferenceFields && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Projects masterlist
              </h4>
              <p className="font-medium uppercase">
                <Link
                  href={`/projects/${masterlistBudget.jobId}`}
                  className="text-primary hover:underline"
                >
                  {masterlistBudget.poNumber} — {masterlistBudget.title}
                </Link>
              </p>
              {masterlistBudget.location && (
                <p className="text-sm uppercase text-muted-foreground">
                  {masterlistBudget.location}
                </p>
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

          {canUpdatePo ? (
            <FundRequestUpdatePoNumber
              request={request}
              onUpdated={(next) =>
                setRequest((prev) =>
                  prev
                    ? {
                        ...prev,
                        po_number: next.po_number,
                        project_details: next.project_details,
                      }
                    : prev
                )
              }
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
