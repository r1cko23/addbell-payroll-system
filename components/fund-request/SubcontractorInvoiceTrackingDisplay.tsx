import { FundRequestField } from "@/components/fund-request/FundRequestField";
import { cn } from "@/lib/utils";
import {
  formatSubcontractorInvoiceStatusLabel,
  parseProgressBillingFromProjectDetails,
  resolveProgressBillingInvoiceNumber,
  subcontractorInvoiceStatusToneClass,
  SUBCONTRACTOR_PAYMENT_SCHEMES,
  type ProgressBillingSelection,
} from "@/lib/subcontractor-progress-billing";
import { FUND_REQUEST_FIELD_LABELS } from "@/types/fund-request";

const tableShellClass = "overflow-x-auto rounded-md border border-border/80";
const tableClass = "w-full min-w-[480px] border-collapse text-sm";
const headCellClass =
  "border-b border-border/80 bg-muted/40 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground";
const bodyCellClass =
  "border-b border-border/60 px-3 py-3 align-top text-sm leading-snug last:border-b-0";

function InvoiceStatusValue({
  status,
}: {
  status: ProgressBillingSelection["invoice_status"];
}) {
  if (!status) return <>—</>;

  return (
    <span
      className={cn(
        "inline-flex rounded-md border px-2 py-0.5 text-xs font-medium",
        subcontractorInvoiceStatusToneClass(status)
      )}
    >
      {formatSubcontractorInvoiceStatusLabel(status)}
    </span>
  );
}

function SubcontractorInvoiceTrackingCard({
  progressBilling,
}: {
  progressBilling: ProgressBillingSelection;
}) {
  const invoiceNumber = resolveProgressBillingInvoiceNumber(progressBilling);

  return (
    <div className="grid grid-cols-1 gap-3 rounded-md border border-border/80 p-3 sm:grid-cols-2">
      <FundRequestField
        label={FUND_REQUEST_FIELD_LABELS.progressBillingMilestone}
        value={progressBilling.milestone}
      />
      <FundRequestField
        label={FUND_REQUEST_FIELD_LABELS.billingInvoiceNumber}
        value={invoiceNumber || "—"}
      />
      <div className="space-y-1 sm:col-span-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {FUND_REQUEST_FIELD_LABELS.billingInvoiceStatus}
        </p>
        <InvoiceStatusValue status={progressBilling.invoice_status} />
      </div>
    </div>
  );
}

function SubcontractorInvoiceTrackingTable({
  progressBilling,
}: {
  progressBilling: ProgressBillingSelection;
}) {
  const invoiceNumber = resolveProgressBillingInvoiceNumber(progressBilling);
  const schemeLabel =
    SUBCONTRACTOR_PAYMENT_SCHEMES[progressBilling.payment_scheme]?.label;

  return (
    <div className={tableShellClass}>
      <table className={tableClass}>
        <thead>
          <tr>
            <th className={headCellClass}>
              {FUND_REQUEST_FIELD_LABELS.progressBillingMilestone}
            </th>
            <th className={headCellClass}>
              {FUND_REQUEST_FIELD_LABELS.billingInvoiceNumber}
            </th>
            <th className={headCellClass}>
              {FUND_REQUEST_FIELD_LABELS.billingInvoiceStatus}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={bodyCellClass}>
              <div>{progressBilling.milestone}</div>
              {schemeLabel ? (
                <p className="mt-0.5 text-xs text-muted-foreground">{schemeLabel}</p>
              ) : null}
            </td>
            <td className={cn(bodyCellClass, "uppercase")}>
              {invoiceNumber || "—"}
            </td>
            <td className={bodyCellClass}>
              <InvoiceStatusValue status={progressBilling.invoice_status} />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

type SubcontractorInvoiceTrackingDisplayProps = {
  projectDetails: unknown;
};

export function SubcontractorInvoiceTrackingDisplay({
  projectDetails,
}: SubcontractorInvoiceTrackingDisplayProps) {
  const progressBilling = parseProgressBillingFromProjectDetails(projectDetails);
  if (!progressBilling) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Billing Invoice Tracking
      </h4>
      <div className="hidden md:block">
        <SubcontractorInvoiceTrackingTable progressBilling={progressBilling} />
      </div>
      <div className="md:hidden">
        <SubcontractorInvoiceTrackingCard progressBilling={progressBilling} />
      </div>
    </div>
  );
}
