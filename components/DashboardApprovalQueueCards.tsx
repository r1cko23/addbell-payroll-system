"use client";

import Link from "next/link";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import type { DashboardQueueItem } from "@/lib/fetch-dashboard-approval-queue";
import { QUEUE_TYPE_LABELS } from "@/lib/fetch-dashboard-approval-queue";
import type { ManagerQueueType } from "@/lib/manager-approval-queue";

const TYPE_STYLES: Record<
  ManagerQueueType,
  { badge: string; border: string }
> = {
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

type Props = {
  items: DashboardQueueItem[];
  queueHrefByType: Record<ManagerQueueType, string>;
};

export function DashboardApprovalQueueCards({ items, queueHrefByType }: Props) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        No requests waiting for your action right now.
      </p>
    );
  }

  const grouped: Record<ManagerQueueType, DashboardQueueItem[]> = {
    leave: [],
    overtime: [],
    ftl: [],
  };
  items.forEach((item) => grouped[item.queueType].push(item));

  return (
    <div className="space-y-4">
      {(["leave", "overtime", "ftl"] as const).map((type) => {
        const typeItems = grouped[type];
        if (typeItems.length === 0) return null;
        return (
          <div key={type} className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {QUEUE_TYPE_LABELS[type]} ({typeItems.length})
              </p>
              <Link
                href={queueHrefByType[type]}
                className="text-xs font-medium text-primary hover:underline"
              >
                View all
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {typeItems.map((item) => (
                <Link
                  key={`${item.queueType}-${item.id}`}
                  href={item.href}
                  className={`group flex items-start gap-3 rounded-xl border bg-background/90 p-3 shadow-sm transition hover:bg-primary/5 ${TYPE_STYLES[item.queueType].border}`}
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon name="CaretRight" size={IconSizes.sm} />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-semibold ${TYPE_STYLES[item.queueType].badge}`}
                      >
                        {QUEUE_TYPE_LABELS[item.queueType]}
                      </Badge>
                      {item.employeeCode ? (
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {item.employeeCode}
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-sm font-semibold leading-tight">
                      {item.employeeName}
                    </p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {item.summary}
                    </p>
                    {item.sortAt ? (
                      <p className="text-[10px] text-muted-foreground">
                        Filed {format(new Date(item.sortAt), "MMM d, h:mm a")}
                      </p>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
