"use client";

import Link from "next/link";
import type { DashboardQueueItem } from "@/lib/fetch-dashboard-approval-queue";
import { QUEUE_TYPE_LABELS } from "@/lib/fetch-dashboard-approval-queue";
import type { ManagerQueueType } from "@/lib/manager-approval-queue";
import { ApprovalQueueRequestCard } from "@/components/approval/ApprovalQueueRequestCard";

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
    <div className="space-y-5">
      {(["leave", "overtime", "ftl"] as const).map((type) => {
        const typeItems = grouped[type];
        if (typeItems.length === 0) return null;
        return (
          <div key={type} className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground">
                {QUEUE_TYPE_LABELS[type]} ({typeItems.length})
              </p>
              <Link
                href={queueHrefByType[type]}
                className="text-xs font-medium text-primary hover:underline"
              >
                View all
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {typeItems.map((item) => (
                <ApprovalQueueRequestCard
                  key={`${item.queueType}-${item.id}`}
                  queueType={item.queueType}
                  employeeName={item.employeeName}
                  employeeCode={item.employeeCode}
                  requestDateLabel={item.requestDateLabel}
                  reason={item.reason}
                  filedAtLabel={item.filedAtLabel}
                  href={item.href}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
