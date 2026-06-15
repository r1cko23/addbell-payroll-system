import {
  hasFundRequestBankDetails,
  parseSupplierBankDetails,
} from "@/lib/fund-request-bank-details";
import { cn } from "@/lib/utils";

type FundRequestBankDetailsDisplayProps = {
  value: string | null | undefined;
  className?: string;
};

export function FundRequestBankDetailsDisplay({
  value,
  className,
}: FundRequestBankDetailsDisplayProps) {
  if (!hasFundRequestBankDetails(value)) return null;

  const details = parseSupplierBankDetails(value);

  return (
    <div className={cn("space-y-2", className)}>
      <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Bank Details
      </h4>
      <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Account Name</dt>
          <dd className="font-medium">{details.accountName || "—"}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Account Number</dt>
          <dd className="font-medium">{details.accountNumber || "—"}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Bank</dt>
          <dd className="font-medium">{details.bank || "—"}</dd>
        </div>
      </dl>
    </div>
  );
}
