"use client";

import { ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toTitleCase } from "@/lib/to-title-case";

interface MetricCardProps {
  label: ReactNode;
  value: ReactNode;
  meta?: ReactNode;
  icon?: ReactNode;
  className?: string;
  onClick?: () => void;
  active?: boolean;
}

export function MetricCard({
  label,
  value,
  meta,
  icon,
  className,
  onClick,
  active = false,
}: MetricCardProps) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        "rounded-2xl border bg-card/90 shadow-sm transition-colors hover:bg-card",
        onClick && "cursor-pointer",
        active && "border-primary ring-2 ring-primary/30",
        className
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="text-xs font-medium leading-tight text-muted-foreground whitespace-nowrap sm:text-sm">
          {typeof label === "string" ? toTitleCase(label) : label}
        </div>
        {icon ? (
          <div className="rounded-xl border bg-muted/60 p-2 text-muted-foreground">
            {icon}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="stats-value tabular-nums text-foreground">
          {value}
        </div>
        {meta ? <div className="text-xs text-muted-foreground">{meta}</div> : null}
      </CardContent>
    </Card>
  );
}
