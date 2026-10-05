"use client";

import { cn } from "@/lib/utils";
import type { AddbellCutoffStep } from "@/lib/payroll/addbell-cutoff-hub";

type Props = {
  steps: AddbellCutoffStep[];
  onStepSelect?: (sectionId: string) => void;
};

export function CutoffStepper({ steps, onStepSelect }: Props) {
  return (
    <ol
      className="flex w-full max-w-full flex-wrap gap-0.5 rounded-md bg-muted p-1"
      aria-label="Cutoff steps"
    >
      {steps.map((step) => {
        const interactive =
          !!onStepSelect &&
          (step.status === "complete" ||
            step.status === "current" ||
            step.status === "attention");
        const selected =
          step.status === "current" || step.status === "attention";

        return (
          <li key={step.id} className="min-w-0 flex-1">
            <button
              type="button"
              disabled={!interactive}
              onClick={() => onStepSelect?.(step.sectionId)}
              title={step.description}
              className={cn(
                "flex w-full items-center justify-center gap-1.5 rounded-[0.375rem] px-2 py-2 text-left text-xs font-medium sm:text-sm",
                selected
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground",
                step.status === "attention" ? "text-amber-800" : null,
                interactive ? "cursor-pointer" : "cursor-default"
              )}
              aria-current={selected ? "step" : undefined}
            >
              <span className="tabular-nums">
                {step.status === "complete" ? "✓" : step.number}
              </span>
              <span className="min-w-0 truncate">{step.title}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
