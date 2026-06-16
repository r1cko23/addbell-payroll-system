import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FundRequestBankDetailsForm } from "@/lib/fund-request-bank-details";
import { cn } from "@/lib/utils";

type FundRequestBankDetailsFieldsProps = {
  value: FundRequestBankDetailsForm;
  onChange: (value: FundRequestBankDetailsForm) => void;
  idPrefix?: string;
  className?: string;
};

export function FundRequestBankDetailsFields({
  value,
  onChange,
  idPrefix = "bank-details",
  className,
}: FundRequestBankDetailsFieldsProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Bank Details
      </h4>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="min-w-0">
          <Label htmlFor={`${idPrefix}-account-name`} className="text-xs" required>
            Account Name
          </Label>
          <Input
            id={`${idPrefix}-account-name`}
            value={value.accountName}
            onChange={(event) =>
              onChange({ ...value, accountName: event.target.value })
            }
            className="mt-1 h-9"
            required
          />
        </div>
        <div className="min-w-0">
          <Label htmlFor={`${idPrefix}-account-number`} className="text-xs">
            Account Number
          </Label>
          <Input
            id={`${idPrefix}-account-number`}
            value={value.accountNumber}
            onChange={(event) =>
              onChange({ ...value, accountNumber: event.target.value })
            }
            className="mt-1 h-9"
          />
        </div>
        <div className="min-w-0">
          <Label htmlFor={`${idPrefix}-bank`} className="text-xs">
            Bank
          </Label>
          <Input
            id={`${idPrefix}-bank`}
            value={value.bank}
            onChange={(event) =>
              onChange({ ...value, bank: event.target.value })
            }
            className="mt-1 h-9"
          />
        </div>
      </div>
    </div>
  );
}
