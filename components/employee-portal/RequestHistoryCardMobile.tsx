"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import {
  epRequestHistoryCardLayout,
  epRequestHistoryCategoryBadgeMobile,
  epRequestHistoryDetailsSection,
  epRequestHistoryMetricMobile,
  epRequestHistoryStatusBlock,
  epRequestHistoryTagsRow,
  epRequestHistoryTitleMobile,
  epRequestHistoryTitleRow,
} from "@/lib/employee-portal-request-history";
import { RequestHistoryCategoryBadges } from "./RequestHistoryCardShared";

export type RequestHistoryCardViewProps = {
  title: string;
  categoryLabel: string;
  subtitle?: string | null;
  metric?: ReactNode;
  statusColumn: ReactNode;
  children?: ReactNode;
};

export function RequestHistoryCardMobile({
  title,
  categoryLabel,
  subtitle,
  metric,
  statusColumn,
  children,
}: RequestHistoryCardViewProps) {
  const showTagsRow = Boolean(subtitle);
  const showInlineCategory = Boolean(categoryLabel) && !subtitle;

  return (
    <div className={epRequestHistoryCardLayout}>
      <div className={epRequestHistoryTitleRow}>
        <span className={epRequestHistoryTitleMobile}>{title}</span>
        <div className="flex shrink-0 items-center gap-2">
          {showInlineCategory ? (
            <Badge variant="outline" className={epRequestHistoryCategoryBadgeMobile}>
              {categoryLabel}
            </Badge>
          ) : null}
          {metric != null ? (
            <span className={epRequestHistoryMetricMobile}>{metric}</span>
          ) : null}
        </div>
      </div>

      {showTagsRow ? (
        <div className={epRequestHistoryTagsRow}>
          <RequestHistoryCategoryBadges
            categoryLabel={categoryLabel}
            subtitle={subtitle}
            className={epRequestHistoryCategoryBadgeMobile}
          />
        </div>
      ) : null}

      <div className={epRequestHistoryStatusBlock} aria-label="Request status">
        {statusColumn}
      </div>

      {children ? (
        <div className={epRequestHistoryDetailsSection}>{children}</div>
      ) : null}
    </div>
  );
}
