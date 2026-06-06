"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  dbViewportBlockDesktopOnly,
  dbViewportBlockMobileOnly,
  dbViewportDesktopOnly,
  dbViewportMobileOnly,
} from "@/lib/dashboard-viewport";

type ViewportProps = {
  children: ReactNode;
  className?: string;
};

/** Mobile-only content (< 768px). */
export function DbMobileView({ children, className }: ViewportProps) {
  return (
    <div className={cn(dbViewportMobileOnly, className)}>{children}</div>
  );
}

/** Tablet/desktop content (≥ 768px). */
export function DbDesktopView({ children, className }: ViewportProps) {
  return (
    <div className={cn(dbViewportDesktopOnly, className)}>{children}</div>
  );
}

/** Block display — card stacks where flex would conflict. */
export function DbMobileBlock({ children, className }: ViewportProps) {
  return (
    <div className={cn(dbViewportBlockMobileOnly, className)}>{children}</div>
  );
}

export function DbDesktopBlock({ children, className }: ViewportProps) {
  return (
    <div className={cn(dbViewportBlockDesktopOnly, className)}>{children}</div>
  );
}
