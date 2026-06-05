"use client";

import type { ReactNode } from "react";
import { H1, PageSubtitle } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { toTitleCase } from "@/lib/to-title-case";

export type DashboardPageHeaderProps = {
  title: string;
  description?: ReactNode;
  /** Row above the title (e.g. back link) */
  above?: ReactNode;
  actions?: ReactNode;
  className?: string;
  titleClassName?: string;
};

export function DashboardPageHeader({
  title,
  description,
  above,
  actions,
  className,
  titleClassName,
}: DashboardPageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 border-b border-border/70 pb-6 sm:flex-row sm:items-start sm:justify-between sm:gap-8",
        className
      )}
    >
      <div className="min-w-0 space-y-2">
        {above ? <div className="pb-0.5">{above}</div> : null}
        <H1
          className={cn(
            "text-2xl font-semibold tracking-tight text-foreground sm:text-3xl",
            titleClassName
          )}
        >
          {toTitleCase(title)}
        </H1>
        {description != null && description !== "" ? (
          typeof description === "string" ? (
            <PageSubtitle className="max-w-2xl">{description}</PageSubtitle>
          ) : (
            <div className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {description}
            </div>
          )
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-col gap-2 sm:items-end sm:pt-1">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
