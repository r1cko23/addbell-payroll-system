"use client";

import type { ReactNode } from "react";
import { PageTitle, PageSubtitle } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { toTitleCase } from "@/lib/to-title-case";

export type PortalPageHeaderProps = {
  title: string;
  description?: ReactNode;
  className?: string;
};

export function PortalPageHeader({
  title,
  description,
  className,
}: PortalPageHeaderProps) {
  return (
    <header
      className={cn(
        "space-y-1 border-b border-border/70 pb-3 md:space-y-2 md:pb-4 lg:pb-6",
        className
      )}
    >
      <PageTitle>{toTitleCase(title)}</PageTitle>
      {description != null && description !== "" ? (
        typeof description === "string" ? (
          <PageSubtitle className="max-w-2xl text-pretty">{description}</PageSubtitle>
        ) : (
          <div className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </div>
        )
      ) : null}
    </header>
  );
}
