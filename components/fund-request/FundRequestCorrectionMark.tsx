"use client";

import { Input } from "@/components/ui/input";
import {
  formatFundRequestReturnChange,
  getFundRequestReturnFieldChange,
  getFundRequestReturnFieldLabel,
  isFundRequestReturnFieldEditable,
  isFundRequestReturnFieldFlagged,
  type FundRequestReturnCorrection,
  type FundRequestReturnFieldKey,
} from "@/lib/fund-request-return-correction";
import { cn } from "@/lib/utils";

type FundRequestCorrectionMarkProps = {
  field: FundRequestReturnFieldKey;
  correction: FundRequestReturnCorrection | null;
  /** PO still working the return — red highlight, optional edit. */
  returned?: boolean;
  /** After PO resubmit — green old → new when this field changed. */
  showChanges?: boolean;
  editable?: boolean;
  editValue?: string;
  onEditValueChange?: (value: string) => void;
  editType?: "text" | "number" | "date";
  className?: string;
  children: React.ReactNode;
};

export function FundRequestCorrectionMark({
  field,
  correction,
  returned = false,
  showChanges = false,
  editable = false,
  editValue,
  onEditValueChange,
  editType = "text",
  className,
  children,
}: FundRequestCorrectionMarkProps) {
  return (
    <FundRequestCorrectionGroup
      fields={[field]}
      correction={correction}
      returned={returned}
      showChanges={showChanges}
      className={className}
    >
      {children}
      {returned &&
      isFundRequestReturnFieldFlagged(correction, field) &&
      editable &&
      isFundRequestReturnFieldEditable(field) ? (
        <Input
          className="mt-2 h-10 border-red-300 bg-white"
          type={editType}
          value={editValue ?? ""}
          onChange={(event) => onEditValueChange?.(event.target.value)}
        />
      ) : null}
    </FundRequestCorrectionGroup>
  );
}

type FundRequestCorrectionGroupProps = {
  fields: FundRequestReturnFieldKey[];
  correction: FundRequestReturnCorrection | null;
  returned?: boolean;
  showChanges?: boolean;
  className?: string;
  children: React.ReactNode;
};

export function FundRequestCorrectionGroup({
  fields,
  correction,
  returned = false,
  showChanges = false,
  className,
  children,
}: FundRequestCorrectionGroupProps) {
  const flagged = fields.some((field) =>
    isFundRequestReturnFieldFlagged(correction, field)
  );
  const changes = showChanges
    ? fields
        .map((field) => {
          const change = getFundRequestReturnFieldChange(correction, field);
          if (!change) return null;
          return { field, change };
        })
        .filter(
          (
            entry
          ): entry is {
            field: FundRequestReturnFieldKey;
            change: { from: string; to: string };
          } => entry != null
        )
    : [];

  if (!flagged && changes.length === 0) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      className={cn(
        "rounded-md border p-2 sm:p-3",
        changes.length > 0
          ? "border-emerald-500 bg-emerald-50"
          : "border-red-400 bg-red-50",
        className
      )}
    >
      {children}
      {changes.map(({ field, change }) => (
        <p
          key={field}
          className="mt-2 text-sm font-semibold text-emerald-800"
        >
          {getFundRequestReturnFieldLabel(field)}:{" "}
          {formatFundRequestReturnChange(change)}
        </p>
      ))}
    </div>
  );
}
