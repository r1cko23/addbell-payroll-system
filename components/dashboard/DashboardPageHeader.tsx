"use client";

import type { ReactNode } from "react";
import { H1, PageSubtitle } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { toTitleCase } from "@/lib/to-title-case";
import { dbPageHeaderRow } from "@/lib/dashboard-ui";

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
        dbPageHeaderRow,
        "border-b border-border/70 pb-2.5 sm:pb-4 lg:pb-6",
        className
      )}
    >
      <div className="min-w-0 space-y-1.5 sm:space-y-2">
        {above ? <div className="pb-0.5">{above}</div> : null}
        <H1
          className={cn(
            "text-xl font-semibold tracking-tight text-foreground sm:text-2xl lg:text-3xl",
            titleClassName
          )}
        >
          {toTitleCase(title)}
        </H1>
        {description != null && description !== "" ? (
          typeof description === "string" ? (
            <PageSubtitle className="max-w-2xl text-pretty">
              {toTitleCase(description)}
            </PageSubtitle>
          ) : (
            <div className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {description}
            </div>
          )
        ) : null}
      </div>
      {actions ? (
        <div className="w-full shrink-0 sm:w-auto sm:pt-1">{actions}</div>
      ) : null}
    </header>
  );
}
