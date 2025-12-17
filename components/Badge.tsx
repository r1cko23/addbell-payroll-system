"use client";

import React from "react";

import {
  Badge as ShadBadge,
  type BadgeProps as ShadBadgeProps,
} from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type LegacyVariant = "success" | "warning" | "danger" | "info" | "default";

interface BadgeProps extends Omit<ShadBadgeProps, "variant"> {
  variant?: LegacyVariant | ShadBadgeProps["variant"];
  className?: string;
}

const variantClassMap: Record<LegacyVariant, string> = {
  success: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  warning: "bg-amber-50 text-amber-800 border border-amber-200",
  danger: "bg-destructive/10 text-destructive border border-destructive/20",
  info: "bg-blue-50 text-blue-700 border border-blue-200",
  default: "bg-muted text-muted-foreground border border-border",
};

export function Badge({
  children,
  variant = "default",
  className,
  ...props
}: BadgeProps) {
  const isLegacy = (val: unknown): val is LegacyVariant =>
    typeof val === "string" &&
    ["success", "warning", "danger", "info", "default"].includes(val);

  const resolvedVariant: ShadBadgeProps["variant"] = isLegacy(variant)
    ? "outline"
    : variant || "default";
  const extraClass = isLegacy(variant) ? variantClassMap[variant] : undefined;

  return (
    <ShadBadge
      variant={resolvedVariant}
      className={cn("inline-flex items-center gap-1", extraClass, className)}
      {...props}
    >
      {children}
    </ShadBadge>
  );
}
