"use client";

import { useEffect, useState } from "react";
import { CaretDown } from "phosphor-react";
import { cn } from "@/lib/utils";
import { toTitleCase } from "@/lib/to-title-case";

type EmployeeFormSectionProps = {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  /** Change when switching employees so section open state resets */
  sectionKey?: string;
  children: React.ReactNode;
};

export function EmployeeFormSection({
  title,
  description,
  defaultOpen = false,
  sectionKey,
  children,
}: EmployeeFormSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    setOpen(defaultOpen);
  }, [sectionKey, defaultOpen]);

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{toTitleCase(title)}</p>
          {description ? (
            <p className="text-xs text-muted-foreground mt-0.5">{toTitleCase(description)}</p>
          ) : null}
        </div>
        <CaretDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
          weight="bold"
        />
      </button>
      {open ? (
        <div className="border-t px-4 py-4 space-y-4">{children}</div>
      ) : null}
    </div>
  );
}
