"use client";

import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BodySmall, Caption } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { epCardInteractive } from "@/lib/employee-portal-ui";
import { cn } from "@/lib/utils";
import {
  epRequestFiledLine,
  epRequestHistoryBodyRow,
  epRequestHistoryCardContent,
  epRequestHistoryCardLayout,
  epRequestHistoryCardMain,
  epRequestHistoryCategoryBadge,
  epRequestHistoryDocLink,
  epRequestHistoryHeaderRow,
  epRequestHistoryMetric,
  epRequestHistoryReasonText,
  epRequestHistorySubtitle,
  epRequestHistorySupportingDocs,
  epRequestHistoryStatusColumn,
  epRequestHistoryTitle,
  requestHistoryCardBorderClass,
} from "@/lib/employee-portal-request-history";

type RequestHistoryCardProps = {
  status: string;
  title: string;
  categoryLabel: string;
  /** Shown under the header row (e.g. leave subtype) — avoids crowding with a second badge */
  subtitle?: string | null;
  metric?: ReactNode;
  filedAt: string;
  statusColumn: ReactNode;
  children?: ReactNode;
};

export function RequestHistoryCard({
  status,
  title,
  categoryLabel,
  subtitle,
  metric,
  filedAt,
  statusColumn,
  children,
}: RequestHistoryCardProps) {
  return (
    <Card
      className={cn(
        "w-full",
        requestHistoryCardBorderClass(status),
        epCardInteractive
      )}
    >
      <CardContent className={epRequestHistoryCardContent}>
        <div className={epRequestHistoryCardLayout}>
          <div className={epRequestHistoryCardMain}>
            <div className={epRequestHistoryHeaderRow}>
              <span className={epRequestHistoryTitle}>{title}</span>
              <Badge
                variant="outline"
                className={epRequestHistoryCategoryBadge}
              >
                {categoryLabel}
              </Badge>
              {metric != null ? (
                <span className={epRequestHistoryMetric}>{metric}</span>
              ) : null}
            </div>
            {subtitle ? (
              <p className={epRequestHistorySubtitle}>{subtitle}</p>
            ) : null}
            {children}
          </div>
          <div
            className={epRequestHistoryStatusColumn}
            aria-label="Request status"
          >
            {statusColumn}
          </div>
        </div>
        <div className={epRequestFiledLine}>Filed: {filedAt}</div>
      </CardContent>
    </Card>
  );
}

export function RequestHistoryTimeRow({ children }: { children: ReactNode }) {
  return (
    <div className={epRequestHistoryBodyRow}>
      <strong>Time:</strong> {children}
    </div>
  );
}

export function RequestHistoryReasonRow({
  reason,
}: {
  reason: string | null | undefined;
}) {
  if (!reason?.trim()) return null;
  return (
    <div className={epRequestHistoryBodyRow}>
      <strong>Reason:</strong>
      <div className={epRequestHistoryReasonText}>{reason}</div>
    </div>
  );
}

type SupportingDoc = { id: string; file_name: string };

export function RequestHistorySupportingDocuments({
  documents,
  renderFileName,
}: {
  documents: SupportingDoc[];
  renderFileName?: (doc: SupportingDoc) => ReactNode;
}) {
  if (documents.length === 0) return null;
  return (
    <VStack gap="1" align="start" className={epRequestHistorySupportingDocs}>
      <HStack gap="2" align="center">
        <Icon name="FileText" size={IconSizes.sm} />
        <BodySmall className="font-semibold">
          Supporting document{documents.length > 1 ? "s" : ""}
        </BodySmall>
      </HStack>
      {documents.map((doc) => (
        <Caption key={doc.id} className="max-w-full text-muted-foreground">
          {renderFileName ? (
            renderFileName(doc)
          ) : (
            <span className="break-all">{doc.file_name}</span>
          )}
        </Caption>
      ))}
    </VStack>
  );
}
