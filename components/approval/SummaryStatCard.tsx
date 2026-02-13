"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SummaryStatCardProps {
  label: string;
  value: number | string;
  highlight?: "pending" | "success" | "destructive" | "warning";
  className?: string;
}

export function SummaryStatCard({
  label,
  value,
  highlight,
  className,
}: SummaryStatCardProps) {
  const highlightClasses = {
    pending: "text-yellow-600 dark:text-yellow-500",
    success: "text-emerald-600 dark:text-emerald-500",
    destructive: "text-red-600 dark:text-red-500",
    warning: "text-orange-600 dark:text-orange-500",
  };

  const valueClass = highlight
    ? highlightClasses[highlight]
    : "text-foreground";

  return (
    <Card className={cn("", className)}>
      <CardContent className="p-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground font-medium">{label}</p>
          <p className={cn("text-2xl font-bold", valueClass)}>
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}