"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getFundRequestReturnFieldLabel,
  listFundRequestReturnFormFields,
  type FundRequestReturnCorrectionInput,
  type FundRequestReturnFieldKey,
} from "@/lib/fund-request-return-correction";
import { cn } from "@/lib/utils";

type FundRequestReturnCorrectionFormProps = {
  value: FundRequestReturnCorrectionInput;
  onChange: (value: FundRequestReturnCorrectionInput) => void;
  className?: string;
};

function toggleField(
  fields: FundRequestReturnFieldKey[],
  key: FundRequestReturnFieldKey,
  checked: boolean
): FundRequestReturnFieldKey[] {
  if (checked) {
    return fields.includes(key) ? fields : [...fields, key];
  }
  return fields.filter((field) => field !== key);
}

export function FundRequestReturnCorrectionForm({
  value,
  onChange,
  className,
}: FundRequestReturnCorrectionFormProps) {
  const formFields = listFundRequestReturnFormFields();
  const othersSelected = value.fields.includes("others");

  return (
    <div className={cn("space-y-3", className)}>
      <div className="space-y-2">
        <Label>Fields to correct</Label>
        <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border p-3">
          {formFields.map((field) => {
            const checked = value.fields.includes(field.key);
            const id = `return-field-${field.key}`;
            return (
              <div key={field.key} className="flex items-start gap-2">
                <Checkbox
                  id={id}
                  checked={checked}
                  onCheckedChange={(next) =>
                    onChange({
                      ...value,
                      fields: toggleField(value.fields, field.key, next === true),
                    })
                  }
                />
                <Label htmlFor={id} className="cursor-pointer text-sm font-normal leading-5">
                  {field.label}
                </Label>
              </div>
            );
          })}
          <div className="flex items-start gap-2 border-t pt-2">
            <Checkbox
              id="return-field-others"
              checked={othersSelected}
              onCheckedChange={(next) =>
                onChange({
                  ...value,
                  fields: toggleField(value.fields, "others", next === true),
                })
              }
            />
            <Label
              htmlFor="return-field-others"
              className="cursor-pointer text-sm font-normal leading-5"
            >
              {getFundRequestReturnFieldLabel("others")}
            </Label>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Select one or more form values. Choose Others for a typed reason with
          no red highlights.
        </p>
      </div>
      {othersSelected ? (
        <div className="space-y-2">
          <Label htmlFor="return-other-reason">Others reason</Label>
          <Input
            id="return-other-reason"
            value={value.otherReason}
            onChange={(event) =>
              onChange({ ...value, otherReason: event.target.value })
            }
            placeholder="Type the reason"
          />
        </div>
      ) : null}
    </div>
  );
}
