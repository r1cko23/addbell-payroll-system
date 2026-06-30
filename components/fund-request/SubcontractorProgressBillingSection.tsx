"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { BodySmall, Caption } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import {
  SUBCONTRACTOR_PAYMENT_SCHEMES,
  SUBCONTRACTOR_RETENTION_REMARKS_NOTE,
  type ProgressBillingSelection,
  type SubcontractorInvoiceStatus,
  type SubcontractorPaymentScheme,
} from "@/lib/subcontractor-progress-billing";
import {
  fetchSubcontractorInvoiceStatus,
  getClientCachedInvoiceLookup,
  InvoiceLookupNotConfiguredError,
} from "@/lib/subcontractor-invoice-lookup-client";

type DetailRow = { description: string; amount: string };

type SubcontractorProgressBillingSectionProps = {
  poNumber: string;
  details: DetailRow[];
  selection: ProgressBillingSelection | null;
  onSelectionChange: (selection: ProgressBillingSelection | null) => void;
  onDetailsChange: (
    updater: DetailRow[] | ((prev: DetailRow[]) => DetailRow[])
  ) => void;
  onAddDetailRow: () => void;
  onRemoveDetailRow: (index: number) => void;
  detailPlaceholderPrefix: string;
};

function invoiceStatusLabel(status: SubcontractorInvoiceStatus | null | undefined): string {
  if (status === "COPY RECEIVED") return "Copy received";
  if (status === "COPY NOT YET RECEIVED") return "Copy not yet received";
  if (status === "NOT FOUND") return "No matching invoice row found in billing sheets";
  return "";
}

function invoiceStatusClass(status: SubcontractorInvoiceStatus | null | undefined): string {
  if (status === "COPY RECEIVED") return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (status === "COPY NOT YET RECEIVED") return "text-amber-900 bg-amber-50 border-amber-200";
  if (status === "NOT FOUND") return "text-muted-foreground bg-muted/40 border-border";
  return "";
}

function applyInvoiceToSelection(
  scheme: SubcontractorPaymentScheme,
  milestone: string,
  invoice: { status: SubcontractorInvoiceStatus; sheetName: string | null }
): ProgressBillingSelection {
  return {
    payment_scheme: scheme,
    milestone,
    invoice_status: invoice.status,
    invoice_sheet: invoice.sheetName,
  };
}

export function SubcontractorProgressBillingSection({
  poNumber,
  details,
  selection,
  onSelectionChange,
  onDetailsChange,
  onAddDetailRow,
  onRemoveDetailRow,
  detailPlaceholderPrefix,
}: SubcontractorProgressBillingSectionProps) {
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const selectedScheme = selection?.payment_scheme ?? null;
  const selectedMilestone = selection?.milestone ?? "";

  const updateDetail = (
    index: number,
    field: keyof DetailRow,
    value: string
  ) => {
    onDetailsChange((prev) =>
      prev.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row
      )
    );
  };

  const runInvoiceLookup = async (
    scheme: SubcontractorPaymentScheme,
    milestone: string
  ) => {
    const po = poNumber.trim();
    if (!po || po.toUpperCase() === "N/A") {
      onSelectionChange({
        payment_scheme: scheme,
        milestone,
        invoice_status: null,
        invoice_sheet: null,
      });
      setLookupError("Enter a P.O. number in the project reference section first.");
      return;
    }

    const cached = getClientCachedInvoiceLookup(po);
    if (cached) {
      onSelectionChange(applyInvoiceToSelection(scheme, milestone, cached));
      setLookupError(null);
      return;
    }

    setLookupLoading(true);
    setLookupError(null);

    try {
      const result = await fetchSubcontractorInvoiceStatus(po);
      onSelectionChange(applyInvoiceToSelection(scheme, milestone, result));
    } catch (error) {
      onSelectionChange({
        payment_scheme: scheme,
        milestone,
        invoice_status: null,
        invoice_sheet: null,
      });
      if (error instanceof InvoiceLookupNotConfiguredError) {
        setLookupError(error.message);
        return;
      }
      setLookupError(
        error instanceof Error ? error.message : "Could not verify invoice status."
      );
    } finally {
      setLookupLoading(false);
    }
  };

  const handleMilestoneSelect = (
    scheme: SubcontractorPaymentScheme,
    milestone: string
  ) => {
    const po = poNumber.trim();
    if (!po || po.toUpperCase() === "N/A") {
      onSelectionChange({
        payment_scheme: scheme,
        milestone,
        invoice_status: null,
        invoice_sheet: null,
      });
      setLookupError("Enter a P.O. number in the project reference section first.");
      return;
    }

    const cached = getClientCachedInvoiceLookup(po);
    if (cached) {
      onSelectionChange(applyInvoiceToSelection(scheme, milestone, cached));
      setLookupError(null);
      return;
    }

    void runInvoiceLookup(scheme, milestone);
  };

  useEffect(() => {
    if (!selection?.payment_scheme || !selection.milestone) return;

    const po = poNumber.trim();
    if (!po || po.toUpperCase() === "N/A") return;

    const cached = getClientCachedInvoiceLookup(po);
    if (cached) {
      if (
        selection.invoice_status !== cached.status ||
        selection.invoice_sheet !== cached.sheetName
      ) {
        onSelectionChange(
          applyInvoiceToSelection(
            selection.payment_scheme,
            selection.milestone,
            cached
          )
        );
      }
      return;
    }

    if (selection.invoice_status != null && !lookupError) return;
    void runInvoiceLookup(selection.payment_scheme, selection.milestone);
  }, [poNumber]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {(Object.keys(SUBCONTRACTOR_PAYMENT_SCHEMES) as SubcontractorPaymentScheme[]).map(
          (schemeKey) => {
            const scheme = SUBCONTRACTOR_PAYMENT_SCHEMES[schemeKey];
            return (
              <fieldset
                key={schemeKey}
                className="rounded-lg border border-border/80 bg-muted/15 p-3"
              >
                <legend className="px-1 text-sm font-semibold text-foreground">
                  {scheme.label}
                </legend>
                <div className="mt-2 space-y-2">
                  {scheme.milestones.map((milestone) => {
                    const inputId = `${schemeKey}-${milestone}`;
                    const checked =
                      selectedScheme === schemeKey &&
                      selectedMilestone === milestone;

                    return (
                      <label
                        key={milestone}
                        htmlFor={inputId}
                        className={cn(
                          "flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                          checked
                            ? "border-primary bg-primary/5"
                            : "border-transparent hover:bg-muted/40"
                        )}
                      >
                        <input
                          id={inputId}
                          type="radio"
                          name="subcontractor-progress-billing-milestone"
                          className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                          checked={checked}
                          disabled={lookupLoading}
                          onChange={() => handleMilestoneSelect(schemeKey, milestone)}
                        />
                        <span className="leading-snug">{milestone}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            );
          }
        )}
      </div>

      {lookupLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking billing sheet for P.O. {poNumber.trim()}…
        </div>
      ) : null}

      {lookupError ? (
        <BodySmall className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
          {lookupError}
        </BodySmall>
      ) : null}

      {selection?.invoice_status ? (
        <div
          className={cn(
            "rounded-md border px-3 py-2 text-sm",
            invoiceStatusClass(selection.invoice_status)
          )}
        >
          <span className="font-medium">{invoiceStatusLabel(selection.invoice_status)}</span>
          {selection.invoice_sheet ? (
            <Caption className="mt-0.5 block">
              Source sheet: {selection.invoice_sheet}
            </Caption>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-1.5 border-t border-border/70 pt-3">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Billing line items
        </Label>
        {details.map((row, i) => (
          <div
            key={i}
            className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_6.5rem_2.5rem] sm:items-center"
          >
            <Input
              placeholder={`${detailPlaceholderPrefix} ${i + 1}`}
              value={row.description}
              onChange={(e) => updateDetail(i, "description", e.target.value)}
              className="min-w-0"
              required
            />
            <div className="flex items-center gap-2 sm:contents">
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0"
                value={row.amount}
                onChange={(e) => updateDetail(i, "amount", e.target.value)}
                className="min-w-0 flex-1 px-2 sm:flex-none"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onRemoveDetailRow(i)}
                disabled={details.length <= 1}
                className="h-11 w-11 shrink-0 text-muted-foreground hover:text-destructive sm:h-10 sm:w-10"
                aria-label={`Remove item ${i + 1}`}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" onClick={onAddDetailRow}>
          Add item
        </Button>
      </div>

      <BodySmall className="rounded-md border border-border/80 bg-muted/30 px-3 py-2 text-muted-foreground">
        {SUBCONTRACTOR_RETENTION_REMARKS_NOTE}
      </BodySmall>
    </div>
  );
}
