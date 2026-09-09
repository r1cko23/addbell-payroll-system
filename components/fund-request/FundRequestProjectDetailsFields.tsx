"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FundRequestProjectDetailRow } from "@/lib/fund-request-project-details";
import { cn } from "@/lib/utils";

type FundRequestProjectDetailsFieldsProps = {
  rows: FundRequestProjectDetailRow[];
  allowMultiple: boolean;
  poPerProject?: boolean;
  onChange: (rows: FundRequestProjectDetailRow[]) => void;
};

const fieldLabelClass =
  "block text-xs font-medium leading-none text-muted-foreground whitespace-nowrap";

export function FundRequestProjectDetailsFields({
  rows,
  allowMultiple,
  poPerProject = false,
  onChange,
}: FundRequestProjectDetailsFieldsProps) {
  const updateRow = (
    index: number,
    field: keyof FundRequestProjectDetailRow,
    value: string
  ) => {
    onChange(
      rows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row
      )
    );
  };

  const addRow = () => {
    onChange([
      ...rows,
      { poNumber: "", title: "", location: "", poAmount: "", completionPercentage: "" },
    ]);
  };

  const removeRow = (index: number) => {
    if (rows.length <= 1) return;
    onChange(rows.filter((_, rowIndex) => rowIndex !== index));
  };

  const desktopGridClass = poPerProject
    ? allowMultiple
      ? "sm:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)_minmax(0,1.05fr)_minmax(0,0.9fr)_72px_2.25rem]"
      : "sm:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)_minmax(0,1.05fr)_minmax(0,0.9fr)_72px]"
    : allowMultiple
      ? "sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)_72px_2.25rem]"
      : "sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)_72px]";

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "hidden gap-2 px-2 sm:grid sm:items-end",
          desktopGridClass
        )}
      >
        {poPerProject ? (
          <Label className={fieldLabelClass} required>
            P.O. Number
          </Label>
        ) : null}
        <Label className={fieldLabelClass} required>
          Project Title
        </Label>
        <Label className={fieldLabelClass} required>
          Project Location
        </Label>
        <Label className={fieldLabelClass} required>
          P.O. Amount
        </Label>
        <Label className={fieldLabelClass} required>
          Completion %
        </Label>
        {allowMultiple ? <span className="sr-only">Remove</span> : null}
      </div>

      {rows.map((row, index) => (
        <div
          key={index}
          className={cn(
            "grid grid-cols-1 gap-2 rounded-md border border-dashed p-2 sm:items-center",
            desktopGridClass
          )}
        >
          {poPerProject ? (
            <div className="space-y-1 sm:space-y-0">
              <Label className={cn(fieldLabelClass, "sm:sr-only")} required>
                P.O. Number
              </Label>
              <Input
                value={row.poNumber}
                onChange={(event) => updateRow(index, "poNumber", event.target.value)}
                placeholder={`P.O. ${index + 1}`}
                className="h-9"
                required
              />
            </div>
          ) : null}
          <div className="space-y-1 sm:space-y-0">
            <Label className={cn(fieldLabelClass, "sm:sr-only")} required>
              Project Title
            </Label>
            <Input
              value={row.title}
              onChange={(event) => updateRow(index, "title", event.target.value)}
              placeholder={`Project title ${index + 1}`}
              className="h-9"
              required
            />
          </div>
          <div className="space-y-1 sm:space-y-0">
            <Label className={cn(fieldLabelClass, "sm:sr-only")} required>
              Project Location
            </Label>
            <Input
              value={row.location}
              onChange={(event) => updateRow(index, "location", event.target.value)}
              placeholder={`Location ${index + 1}`}
              className="h-9"
              required
            />
          </div>
          <div className="space-y-1 sm:space-y-0">
            <Label className={cn(fieldLabelClass, "sm:sr-only")} required>
              P.O. Amount
            </Label>
            <Input
              value={row.poAmount}
              onChange={(event) => updateRow(index, "poAmount", event.target.value)}
              placeholder="0.00"
              inputMode="decimal"
              className="h-9"
              required
            />
          </div>
          <div className="space-y-1 sm:space-y-0">
            <Label className={cn(fieldLabelClass, "sm:sr-only")} required>
              Completion %
            </Label>
            <Input
              value={row.completionPercentage}
              onChange={(event) =>
                updateRow(index, "completionPercentage", event.target.value)
              }
              placeholder="%"
              inputMode="decimal"
              className="h-9"
              required
            />
          </div>
          {allowMultiple ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeRow(index)}
              disabled={rows.length <= 1}
              className="h-9 w-9 shrink-0 justify-self-end text-muted-foreground hover:text-destructive sm:justify-self-center"
              aria-label={`Remove project ${index + 1}`}
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      ))}

      {allowMultiple ? (
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="mr-2 h-4 w-4" />
          Add project
        </Button>
      ) : null}
    </div>
  );
}
