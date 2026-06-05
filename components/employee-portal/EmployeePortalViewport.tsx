"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  epViewportBlockDesktopOnly,
  epViewportBlockMobileOnly,
  epViewportDesktopOnly,
  epViewportMobileOnly,
} from "@/lib/employee-portal-viewport";

type ViewportProps = {
  children: ReactNode;
  className?: string;
};

/** Mobile-only content (< 768px). Hidden when sidebar is shown. */
export function EpMobileView({ children, className }: ViewportProps) {
  return (
    <div className={cn(epViewportMobileOnly, className)}>{children}</div>
  );
}

/** Tablet/desktop content (≥ 768px). Sidebar navigation, full layouts. */
export function EpDesktopView({ children, className }: ViewportProps) {
  return (
    <div className={cn(epViewportDesktopOnly, className)}>{children}</div>
  );
}

/** Block display variants — use for card stacks where flex display would conflict. */
export function EpMobileBlock({ children, className }: ViewportProps) {
  return (
    <div className={cn(epViewportBlockMobileOnly, className)}>{children}</div>
  );
}

export function EpDesktopBlock({ children, className }: ViewportProps) {
  return (
    <div className={cn(epViewportBlockDesktopOnly, className)}>{children}</div>
  );
}
