"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  applyFundRequestDetailAdjustments,
  createEmptyFundRequestDeduction,
  createEmptyFundRequestDetail,
  formatFundRequestDetailAdjustment,
  splitFundRequestDetails,
  type EditableFundRequestDeduction,
  type EditableFundRequestDetail,
  type EditableFundRequestDetailsForm,
  type FundRequestDetailItem,
  type FundRequestEwtRate,
  type FundRequestVatMode,
  toEditableFundRequestDetailsForm,
} from "@/lib/fund-request-details";

interface FundRequestDetailsSectionProps {
  details: FundRequestDetailItem[] | null | undefined;
  totalRequestedAmount: number;
  editable?: boolean;
  saving?: boolean;
  editableDetails?: EditableFundRequestDetail[];
  editableDeductions?: EditableFundRequestDeduction[];
  onEditableDetailsChange?: (rows: EditableFundRequestDetail[]) => void;
  onEditableDeductionsChange?: (rows: EditableFundRequestDeduction[]) => void;
  onSave?: (form: EditableFundRequestDetailsForm) => void | Promise<void>;
}

function VatOptionCheckbox({
  id,
  label,
  checked,
  disabled,
  onCheckedChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
      <Label htmlFor={id} className="cursor-pointer text-xs font-normal">
        {label}
      </Label>
    </div>
  );
}

export function FundRequestDetailsSection({
  details,
  totalRequestedAmount,
  editable = false,
  saving = false,
  editableDetails: controlledDetails,
  editableDeductions: controlledDeductions,
  onEditableDetailsChange,
  onEditableDeductionsChange,
  onSave,
}: FundRequestDetailsSectionProps) {
  const { items: readOnlyItems, deductions: readOnlyDeductions } =
    splitFundRequestDetails(details);
  const initialForm = toEditableFundRequestDetailsForm(details);
  const [internalDetails, setInternalDetails] = useState<EditableFundRequestDetail[]>(
    () => initialForm.items
  );
  const [internalDeductions, setInternalDeductions] = useState<
    EditableFundRequestDeduction[]
  >(() => initialForm.deductions);
  const editableDetails = controlledDetails ?? internalDetails;
  const editableDeductions = controlledDeductions ?? internalDeductions;

  const setEditableDetails = (
    updater:
      | EditableFundRequestDetail[]
      | ((prev: EditableFundRequestDetail[]) => EditableFundRequestDetail[])
  ) => {
    const next = typeof updater === "function" ? updater(editableDetails) : updater;
    if (onEditableDetailsChange) {
      onEditableDetailsChange(next);
    } else {
      setInternalDetails(next);
    }
  };

  const setEditableDeductions = (
    updater:
      | EditableFundRequestDeduction[]
      | ((prev: EditableFundRequestDeduction[]) => EditableFundRequestDeduction[])
  ) => {
    const next =
      typeof updater === "function" ? updater(editableDeductions) : updater;
    if (onEditableDeductionsChange) {
      onEditableDeductionsChange(next);
    } else {
      setInternalDeductions(next);
    }
  };

  useEffect(() => {
    if (!controlledDetails && !controlledDeductions) {
      const form = toEditableFundRequestDetailsForm(details);
      setInternalDetails(form.items);
      setInternalDeductions(form.deductions);
    }
  }, [controlledDetails, controlledDeductions, details]);

  const { itemsSubtotal, deductionsSubtotal, editableTotal } = useMemo(() => {
    const itemsSubtotal = editableDetails.reduce((sum, item) => {
      const amount = Number(item.amount || 0);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);
    const deductionsSubtotal = editableDeductions.reduce((sum, item) => {
      const amount = Number(item.amount || 0);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);

    return {
      itemsSubtotal,
      deductionsSubtotal,
      editableTotal: Math.max(0, itemsSubtotal - deductionsSubtotal),
    };
  }, [editableDetails, editableDeductions]);

  const updateRow = (
    index: number,
    updater: (row: EditableFundRequestDetail) => EditableFundRequestDetail
  ) => {
    setEditableDetails((prev) => {
      const next = [...prev];
      next[index] = applyFundRequestDetailAdjustments(updater(next[index]));
      return next;
    });
  };

  const handleDetailChange = (
    index: number,
    field: "description" | "baseAmount",
    value: string
  ) => {
    updateRow(index, (row) => ({ ...row, [field]: value }));
  };

  const handleDeductionChange = (
    index: number,
    field: keyof EditableFundRequestDeduction,
    value: string
  ) => {
    setEditableDeductions((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleVatModeChange = (
    index: number,
    mode: FundRequestVatMode,
    checked: boolean
  ) => {
    updateRow(index, (row) => ({
      ...row,
      vatMode: checked ? mode : null,
    }));
  };

  const handleEwtRateChange = (
    index: number,
    rate: FundRequestEwtRate,
    checked: boolean
  ) => {
    updateRow(index, (row) => ({
      ...row,
      ewtRate: checked ? rate : null,
    }));
  };

  const handleAddRow = () => {
    setEditableDetails((prev) => [...prev, createEmptyFundRequestDetail()]);
  };

  const handleAddDeduction = () => {
    setEditableDeductions((prev) => [...prev, createEmptyFundRequestDeduction()]);
  };

  const handleRemoveRow = (index: number) => {
    setEditableDetails((prev) => {
      if (prev.length === 1) {
        return [createEmptyFundRequestDetail()];
      }
      return prev.filter((_, rowIndex) => rowIndex !== index);
    });
  };

  const handleRemoveDeduction = (index: number) => {
    setEditableDeductions((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
  };

  const deductionsExceedItems =
    deductionsSubtotal > itemsSubtotal && deductionsSubtotal > 0;

  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Details of Request
      </h4>

      {editable ? (
        <div className="space-y-3 rounded-md border p-3">
          <div className="space-y-3">
            {editableDetails.map((item, index) => {
              const adjustmentLabel = formatFundRequestDetailAdjustment(
                item.vatMode,
                item.ewtRate
              );
              const showAdjustedAmount =
                item.baseAmount.trim() &&
                item.vatMode &&
                item.ewtRate &&
                item.amount.trim();

              return (
                <div
                  key={index}
                  className="space-y-2 rounded-md border border-dashed p-3"
                >
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
                    <Input
                      value={item.description}
                      onChange={(e) =>
                        handleDetailChange(index, "description", e.target.value)
                      }
                      placeholder={`Item ${index + 1}`}
                      className="uppercase"
                      disabled={saving}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => handleRemoveRow(index)}
                      disabled={saving}
                      aria-label={`Remove item ${index + 1}`}
                      className="sm:justify-self-end"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-[160px_1fr]">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Amount</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.baseAmount}
                        onChange={(e) =>
                          handleDetailChange(index, "baseAmount", e.target.value)
                        }
                        placeholder="0.00"
                        disabled={saving}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">
                        VAT / EWT Options
                      </Label>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <VatOptionCheckbox
                          id={`vat-inc-${index}`}
                          label="VAT Inc"
                          checked={item.vatMode === "inclusive"}
                          disabled={saving}
                          onCheckedChange={(checked) =>
                            handleVatModeChange(index, "inclusive", checked)
                          }
                        />
                        <VatOptionCheckbox
                          id={`vat-ex-${index}`}
                          label="VAT Ex"
                          checked={item.vatMode === "exclusive"}
                          disabled={saving}
                          onCheckedChange={(checked) =>
                            handleVatModeChange(index, "exclusive", checked)
                          }
                        />
                        <VatOptionCheckbox
                          id={`ewt-1-${index}`}
                          label="1%"
                          checked={item.ewtRate === 1}
                          disabled={saving}
                          onCheckedChange={(checked) =>
                            handleEwtRateChange(index, 1, checked)
                          }
                        />
                        <VatOptionCheckbox
                          id={`ewt-2-${index}`}
                          label="2%"
                          checked={item.ewtRate === 2}
                          disabled={saving}
                          onCheckedChange={(checked) =>
                            handleEwtRateChange(index, 2, checked)
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {showAdjustedAmount ? (
                    <p className="text-sm text-muted-foreground">
                      Adjusted Amount
                      {adjustmentLabel ? ` (${adjustmentLabel})` : ""}:{" "}
                      <span className="font-medium text-foreground">
                        PHP{" "}
                        {Number(item.amount).toLocaleString("en-PH", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddRow}
              disabled={saving}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add item
            </Button>
          </div>

          <div className="space-y-1 border-t pt-3 text-sm">
            <p>
              Line Items Subtotal: PHP{" "}
              {itemsSubtotal.toLocaleString("en-PH", {
                minimumFractionDigits: 2,
              })}
            </p>
            {deductionsSubtotal > 0 ? (
              <p className="text-destructive">
                Deductions: PHP{" "}
                {deductionsSubtotal.toLocaleString("en-PH", {
                  minimumFractionDigits: 2,
                })}
              </p>
            ) : null}
            <p className="font-medium">
              Updated Total Requested Amount: PHP{" "}
              {editableTotal.toLocaleString("en-PH", {
                minimumFractionDigits: 2,
              })}
            </p>
          </div>

          {deductionsExceedItems ? (
            <p className="text-xs text-destructive">
              Deductions cannot exceed the Line Items Subtotal.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              If applicable: For each line item, select VAT Inc or VAT Ex and the
              EWT rate (1% or 2%). Add deductions before forwarding to Upper
              Management.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            {onSave ? (
              <Button
                type="button"
                size="sm"
                disabled={saving || deductionsExceedItems}
                onClick={() =>
                  void onSave({ items: editableDetails, deductions: editableDeductions })
                }
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save line items"
                )}
              </Button>
            ) : null}
          </div>

          <div className="space-y-3 border-t pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Deductions
              </h5>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddDeduction}
                disabled={saving}
              >
                <Minus className="mr-2 h-4 w-4" />
                Add deduction
              </Button>
            </div>

            {editableDeductions.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No deductions added yet.
              </p>
            ) : (
              <div className="space-y-2">
                {editableDeductions.map((deduction, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_160px_auto]"
                  >
                    <Input
                      value={deduction.description}
                      onChange={(e) =>
                        handleDeductionChange(index, "description", e.target.value)
                      }
                      placeholder={`Deduction ${index + 1}`}
                      className="uppercase"
                      disabled={saving}
                    />
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={deduction.amount}
                      onChange={(e) =>
                        handleDeductionChange(index, "amount", e.target.value)
                      }
                      placeholder="0.00"
                      disabled={saving}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => handleRemoveDeduction(index)}
                      disabled={saving}
                      aria-label={`Remove deduction ${index + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="hidden md:block">
            <table className="w-full rounded-md border text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left">Details</th>
                  <th className="px-3 py-2 text-right">Amount (PHP)</th>
                </tr>
              </thead>
              <tbody>
                {readOnlyItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-3 py-4 text-center text-muted-foreground"
                    >
                      No line items
                    </td>
                  </tr>
                ) : (
                  readOnlyItems.map((item, index) => {
                    const adjustmentLabel = formatFundRequestDetailAdjustment(
                      item.vat_mode,
                      item.ewt_rate
                    );

                    return (
                      <tr key={index} className="border-b last:border-0">
                        <td className="px-3 py-2 uppercase">
                          <div>{item.description ?? "—"}</div>
                          {adjustmentLabel ? (
                            <div className="mt-1 text-xs normal-case text-muted-foreground">
                              {adjustmentLabel}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {item.amount != null
                            ? Number(item.amount).toLocaleString()
                            : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 md:hidden">
            {readOnlyItems.length === 0 ? (
              <div className="rounded-md border px-3 py-4 text-center text-muted-foreground">
                No line items
              </div>
            ) : (
              readOnlyItems.map((item, index) => {
                const adjustmentLabel = formatFundRequestDetailAdjustment(
                  item.vat_mode,
                  item.ewt_rate
                );

                return (
                  <div
                    key={index}
                    className="flex items-start justify-between gap-3 rounded-md border px-3 py-2"
                  >
                    <div className="min-w-0 flex-1 text-sm uppercase">
                      <div>{item.description ?? "—"}</div>
                      {adjustmentLabel ? (
                        <div className="mt-1 text-xs normal-case text-muted-foreground">
                          {adjustmentLabel}
                        </div>
                      ) : null}
                    </div>
                    <div className="whitespace-nowrap text-right font-mono text-sm">
                      {item.amount != null
                        ? Number(item.amount).toLocaleString()
                        : "—"}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {readOnlyDeductions.length > 0 ? (
            <div className="mt-4">
              <h5 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Deductions
              </h5>
              <div className="space-y-2">
                {readOnlyDeductions.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-start justify-between gap-3 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1 text-sm uppercase">
                      {item.description ?? "—"}
                    </div>
                    <div className="whitespace-nowrap text-right font-mono text-sm text-destructive">
                      −
                      {item.amount != null
                        ? Number(item.amount).toLocaleString()
                        : "—"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <p className="mt-2 font-medium">
            Total Requested Amount: PHP{" "}
            {Number(totalRequestedAmount).toLocaleString("en-PH", {
              minimumFractionDigits: 2,
            })}
          </p>
        </>
      )}
    </div>
  );
}
