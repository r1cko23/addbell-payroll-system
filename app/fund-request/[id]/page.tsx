'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useProfile } from '@/lib/hooks/useProfile';
import { useOptionalEmployeeSession } from '@/contexts/EmployeeSessionContext';
import { format } from 'date-fns';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { FundRequestRow } from '@/types/fund-request';
import { getFundRequestReferenceModeLabel } from '@/types/fund-request';
import type { FundRequestDocumentSummary } from '@/types/fund-request';
import { FundRequestSupportingDocuments } from '@/components/fund-request/FundRequestSupportingDocuments';
import { isSchemaMissingTableOrRelationError } from '@/lib/postgrestSchema';
import { epPageWrapper } from '@/lib/employee-portal-ui';
import { dbPageWrapper } from '@/lib/dashboard-ui';
import { cn } from '@/lib/utils';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending (Operations Manager)',
  project_manager_approved: 'Approved by Operations Manager (Purchasing Officer)',
  purchasing_officer_approved: 'Approved by Purchasing Officer (Upper Management)',
  management_approved: 'Approved by Upper Management',
  rejected: 'Rejected',
};

type DetailItem = { description?: string; amount?: number };
type ProjectInfo = { name: string; code: string; site_address: string | null };

export default function FundRequestDetailPage() {
  const params = useParams();
  const pathname = usePathname();
  const { profile, loading: profileLoading } = useProfile();
  const session = useOptionalEmployeeSession();
  const supabase = createClient();
  const isPortal = (pathname?.startsWith('/app') || pathname?.startsWith('/employee-portal')) ?? false;
  const base = pathname?.startsWith('/employee-portal') ? '/employee-portal/fund-request' : isPortal ? '/app/fund-request' : '/fund-request';
  const [request, setRequest] = useState<FundRequestRow | null>(null);
  const [requesterName, setRequesterName] = useState<string>('');
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
  const [vendorName, setVendorName] = useState<string>("");
  const [documents, setDocuments] = useState<FundRequestDocumentSummary[]>([]);
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
      const row = req as FundRequestRow;
      setRequest(row);
      setVendorName("");

      const promises: Promise<void>[] = [];

      promises.push(
        Promise.resolve(supabase.from('employees').select('first_name, last_name, employee_code').eq('id', row.requested_by).single()
          .then(({ data: emp }) => {
            const e = emp as { first_name?: string; last_name?: string; employee_code?: string } | null;
            setRequesterName(e ? [e.first_name, e.last_name].filter(Boolean).join(' ') : row.requested_by);
          }))
      );

      if (row.project_id) {
        promises.push(
          Promise.resolve(supabase.from('projects').select('name, code, site_address').eq('id', row.project_id).single()
            .then(({ data: proj }) => {
              if (proj) setProjectInfo(proj as ProjectInfo);
            }))
        );
      }

      if (row.vendor_id) {
        promises.push(
          Promise.resolve(
            supabase
              .from("vendors")
              .select("name")
              .eq("id", row.vendor_id)
              .single()
              .then(({ data: vendor }) => {
                setVendorName((vendor as { name?: string } | null)?.name ?? "");
              })
          )
        );
      }

      promises.push(
        Promise.resolve(
          supabase
            .from("fund_request_documents")
            .select("id, fund_request_id, employee_id, file_name, file_type, file_size, created_at")
            .eq("fund_request_id", row.id)
            .order("created_at", { ascending: true })
            .then(({ data, error }) => {
              if (error) {
                if (!isSchemaMissingTableOrRelationError(error)) {
                  console.error("fund_request_documents load:", error);
                }
                return;
              }
              setDocuments((data as FundRequestDocumentSummary[]) ?? []);
            })
        )
      );

      await Promise.all(promises);
      setLoading(false);
    })();
  }, [params?.id, supabase]);

  const loadingState = profileLoading || loading;
  if (loadingState) {
    const skeleton = <div className="h-8 w-48 animate-pulse rounded bg-muted" />;
    return isPortal ? skeleton : <DashboardLayout>{skeleton}</DashboardLayout>;
  }
  if (!request) {
    const notFound = (
      <div className="space-y-4">
        <Link href={base} className="text-muted-foreground hover:text-foreground text-sm">← Back</Link>
        <p className="text-destructive">Fund request not found.</p>
      </div>
    );
    return isPortal ? notFound : <DashboardLayout>{notFound}</DashboardLayout>;
  }

  const details = (request.details as DetailItem[] | null) ?? [];
  const referenceModeLabel = getFundRequestReferenceModeLabel(request.reference_mode);

  const content = (
    <div className={cn('w-full max-w-3xl', isPortal ? epPageWrapper : dbPageWrapper)}>
      <Link href={base} className="text-muted-foreground hover:text-foreground text-sm">← Back to Fund Requests</Link>
      <Card className="border-border/80 bg-card/95">
        <CardHeader>
          <CardTitle>Fund request</CardTitle>
          <p className="text-sm text-muted-foreground">
            Request date: {format(new Date(request.request_date), 'MMMM d, yyyy')} · Requested by {requesterName}
          </p>
          <Badge
            variant={
              request.status === 'management_approved' ? 'default'
              : request.status === 'rejected' ? 'destructive'
              : 'secondary'
            }
            className="w-fit"
          >
            {STATUS_LABELS[request.status] ?? request.status}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Purpose</h4>
            <p className="mt-1">{request.purpose}</p>
          </div>
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Reference basis</h4>
            <p className="mt-1">{referenceModeLabel}</p>
          </div>

          {projectInfo && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Linked Project</h4>
              <p className="font-medium">{projectInfo.code} — {projectInfo.name}</p>
              {projectInfo.site_address && <p className="text-sm text-muted-foreground">{projectInfo.site_address}</p>}
            </div>
          )}

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
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Project Location</h4>
              <p className="mt-1">{request.project_location ?? '—'}</p>
            </div>
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Vendor / Subcontractor</h4>
              <p className="mt-1">{vendorName || '—'}</p>
            </div>
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Vendor P.O. Number</h4>
              <p className="mt-1">{request.vendor_po_number ?? '—'}</p>
            </div>
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Vendor P.O. Amount (PHP)</h4>
              <p className="mt-1">{request.po_amount != null ? Number(request.po_amount).toLocaleString() : '—'}</p>
            </div>
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Vendor Amount %</h4>
              <p className="mt-1">{request.po_amount_percentage != null ? `${request.po_amount_percentage}%` : '—'}</p>
            </div>
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Current Project %</h4>
              <p className="mt-1">{request.current_project_percentage != null ? `${request.current_project_percentage}%` : '—'}</p>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Details of Request</h4>
            <div className="hidden md:block">
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
                      <td
                        colSpan={2}
                        className="px-3 py-4 text-muted-foreground text-center"
                      >
                        No line items
                      </td>
                    </tr>
                  ) : (
                    details.map((item, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-3 py-2">
                          {item.description ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {item.amount != null
                            ? Number(item.amount).toLocaleString()
                            : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="md:hidden space-y-2">
              {details.length === 0 ? (
                <div className="px-3 py-4 text-muted-foreground text-center border rounded-md">
                  No line items
                </div>
              ) : (
                details.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-start justify-between gap-3 px-3 py-2 border rounded-md"
                  >
                    <div className="min-w-0 flex-1 text-sm">
                      {item.description ?? "—"}
                    </div>
                    <div className="text-sm font-mono text-right whitespace-nowrap">
                      {item.amount != null
                        ? Number(item.amount).toLocaleString()
                        : "—"}
                    </div>
                  </div>
                ))
              )}
            </div>
            <p className="mt-2 font-medium">
              Total Requested Amount: PHP {Number(request.total_requested_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {request.remarks && (
              <div className="sm:col-span-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Remarks</h4>
                <p className="mt-1">{request.remarks}</p>
              </div>
            )}
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Date needed</h4>
              <p className="mt-1">{request.date_needed ? format(new Date(request.date_needed), 'MMM d, yyyy') : '—'}</p>
            </div>
            {request.urgent_reason && (
              <div className="sm:col-span-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">If urgent, state reason</h4>
                <p className="mt-1">{request.urgent_reason}</p>
              </div>
            )}
          </div>
          <FundRequestSupportingDocuments documents={documents} />
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

  if (isPortal) return content;
  return <DashboardLayout>{content}</DashboardLayout>;
}
