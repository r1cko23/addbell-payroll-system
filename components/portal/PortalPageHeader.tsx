"use client";

import type { ReactNode } from "react";
import { PageTitle, BodySmall } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

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
        "space-y-2 border-b border-border/70 pb-4 sm:pb-6",
        className
      )}
    >
      <PageTitle>{title}</PageTitle>
      {description != null && description !== "" ? (
        typeof description === "string" ? (
          <BodySmall className="max-w-2xl text-muted-foreground">
            {description}
          </BodySmall>
        ) : (
          <div className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </div>
        )
      ) : null}
    </header>
  );
}
