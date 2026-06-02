"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import type { ManagerQueueType } from "@/lib/manager-approval-queue";
import { QUEUE_TYPE_BADGE_LABELS } from "@/lib/fetch-dashboard-approval-queue";

const TYPE_STYLES: Record<ManagerQueueType, { badge: string; border: string }> = {
  leave: {
    badge: "bg-violet-100 text-violet-800 border-violet-200",
    border: "border-violet-200/80 hover:border-violet-400",
  },
  overtime: {
    badge: "bg-sky-100 text-sky-800 border-sky-200",
    border: "border-sky-200/80 hover:border-sky-400",
  },
  ftl: {
    badge: "bg-amber-100 text-amber-900 border-amber-200",
    border: "border-amber-200/80 hover:border-amber-400",
  },
};

export type ApprovalQueueRequestCardProps = {
  queueType: ManagerQueueType;
  employeeName: string;
  employeeCode?: string | null;
  requestDateLabel: string;
  reason?: string | null;
  filedAtLabel?: string | null;
  href?: string;
  onClick?: () => void;
  className?: string;
};

export function ApprovalQueueRequestCard({
  queueType,
  employeeName,
  employeeCode,
  requestDateLabel,
  reason,
  filedAtLabel,
  href,
  onClick,
  className = "",
}: ApprovalQueueRequestCardProps) {
  const styles = TYPE_STYLES[queueType];
  const interactive = Boolean(href || onClick);

  const body = (
    <div
      className={`flex flex-col gap-2.5 rounded-xl border bg-background/95 p-3.5 shadow-sm transition ${
        styles.border
      } ${interactive ? "hover:bg-primary/[0.04] hover:shadow-md cursor-pointer" : ""} ${className}`}
      role={interactive && !href ? "button" : undefined}
      tabIndex={interactive && !href ? 0 : undefined}
      onClick={href ? undefined : onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Badge
            variant="outline"
            className={`shrink-0 text-[10px] font-semibold uppercase leading-tight tracking-wide ${styles.badge}`}
          >
            {QUEUE_TYPE_BADGE_LABELS[queueType]}
          </Badge>
        </div>
        {filedAtLabel ? (
          <span className="shrink-0 text-[10px] text-muted-foreground whitespace-nowrap">
            Filed {filedAtLabel}
          </span>
        ) : null}
      </div>

      <div className="min-w-0 space-y-0.5">
        <p className="truncate text-sm font-semibold leading-snug text-foreground">
          {employeeName}
        </p>
        {employeeCode ? (
          <p className="font-mono text-[10px] text-muted-foreground">{employeeCode}</p>
        ) : null}
      </div>

      <div className="flex items-start gap-1.5 text-sm font-medium text-foreground">
        <Icon
          name="CalendarBlank"
          size={IconSizes.sm}
          className="mt-0.5 shrink-0 text-muted-foreground"
        />
        <span className="leading-snug">{requestDateLabel}</span>
      </div>

      <div className="rounded-lg border border-dashed border-border/80 bg-muted/30 px-2.5 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Reason
        </p>
        <p
          className={`mt-0.5 text-xs leading-relaxed ${
            reason ? "text-foreground line-clamp-2" : "italic text-muted-foreground"
          }`}
          title={reason || undefined}
        >
          {reason || "No reason provided"}
        </p>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
        {body}
      </Link>
    );
  }

  return body;
}
