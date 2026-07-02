"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BodySmall, Caption } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/lib/hooks/use-debounce";
import {
  SUBCONTRACTOR_PAYMENT_SCHEMES,
  formatSubcontractorInvoiceStatusLabel,
  subcontractorInvoiceStatusToneClass,
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

const PO_LOOKUP_DEBOUNCE_MS = 600;

function makeInvoiceLookupKey(
  scheme: SubcontractorPaymentScheme,
  milestone: string,
  poNumber: string
): string {
  return `${scheme}|${milestone}|${poNumber.trim().toUpperCase()}`;
}

function applyInvoiceToSelection(
  scheme: SubcontractorPaymentScheme,
  milestone: string,
  invoice: { status: SubcontractorInvoiceStatus; invoiceNumber: string | null }
): ProgressBillingSelection {
  return {
    payment_scheme: scheme,
    milestone,
    invoice_status: invoice.status,
    invoice_number: invoice.invoiceNumber,
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
  const debouncedPoNumber = useDebounce(poNumber, PO_LOOKUP_DEBOUNCE_MS);
  const lastLookupKeyRef = useRef("");

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
        invoice_number: null,
      });
      setLookupError("Enter a P.O. number in the project reference section first.");
      return;
    }

    const cached = getClientCachedInvoiceLookup(po);
    if (cached) {
      onSelectionChange(applyInvoiceToSelection(scheme, milestone, cached));
      setLookupError(null);
      lastLookupKeyRef.current = makeInvoiceLookupKey(scheme, milestone, po);
      return;
    }

    const lookupKey = makeInvoiceLookupKey(scheme, milestone, po);
    lastLookupKeyRef.current = lookupKey;
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
        invoice_number: null,
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
        invoice_number: null,
      });
      setLookupError("Enter a P.O. number in the project reference section first.");
      return;
    }

    const cached = getClientCachedInvoiceLookup(po);
    if (cached) {
      onSelectionChange(applyInvoiceToSelection(scheme, milestone, cached));
      setLookupError(null);
      lastLookupKeyRef.current = makeInvoiceLookupKey(scheme, milestone, po);
      return;
    }

    lastLookupKeyRef.current = makeInvoiceLookupKey(scheme, milestone, po);
    void runInvoiceLookup(scheme, milestone);
  };

  useEffect(() => {
    if (!selection?.payment_scheme || !selection.milestone) return;

    const po = debouncedPoNumber.trim();
    if (!po || po.toUpperCase() === "N/A") return;

    const lookupKey = makeInvoiceLookupKey(
      selection.payment_scheme,
      selection.milestone,
      po
    );
    if (lastLookupKeyRef.current === lookupKey) return;

    const cached = getClientCachedInvoiceLookup(po);
    if (cached) {
      lastLookupKeyRef.current = lookupKey;
      if (
        selection.invoice_status !== cached.status ||
        selection.invoice_number !== cached.invoiceNumber
      ) {
        onSelectionChange(
          applyInvoiceToSelection(
            selection.payment_scheme,
            selection.milestone,
            cached
          )
        );
      }
      setLookupError(null);
      return;
    }

    lastLookupKeyRef.current = lookupKey;
    void runInvoiceLookup(selection.payment_scheme, selection.milestone);
  }, [debouncedPoNumber, selection?.payment_scheme, selection?.milestone]);

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
            subcontractorInvoiceStatusToneClass(selection.invoice_status)
          )}
        >
          <span className="font-medium">
            {formatSubcontractorInvoiceStatusLabel(selection.invoice_status)}
          </span>
          {selection.invoice_number ? (
            <Caption className="mt-0.5 block">
              Invoice Number: {selection.invoice_number}
            </Caption>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-1.5">
        <h4 className="text-sm font-semibold border-b pb-2 mb-2">
          BILLING DETAILS
        </h4>
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
    </div>
  );
}
