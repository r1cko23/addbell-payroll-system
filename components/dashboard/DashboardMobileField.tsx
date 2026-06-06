import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type DashboardMobileFieldProps = {
  label: string;
  value: ReactNode;
  className?: string;
  valueClassName?: string;
};

/** Label/value row for dashboard mobile list cards. */
export function DashboardMobileField({
  label,
  value,
  className,
  valueClassName,
}: DashboardMobileFieldProps) {
  return (
    <div className={cn("grid grid-cols-2 gap-x-3 gap-y-1 text-xs", className)}>
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("text-right font-medium", valueClassName)}>{value}</span>
    </div>
  );
}
