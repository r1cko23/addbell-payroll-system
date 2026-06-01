"use client";

import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BodySmall, Caption } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import {
  epRequestFiledLine,
  epRequestHistoryBodyRow,
  epRequestHistoryCardContent,
  epRequestHistoryCardLayout,
  epRequestHistoryCardMain,
  epRequestHistoryCategoryBadge,
  epRequestHistoryHeaderRow,
  epRequestHistoryMetric,
  epRequestHistoryReasonText,
  epRequestHistorySupportingDocs,
  epRequestHistoryTitle,
  epRequestStatusColumn,
  requestHistoryCardBorderClass,
} from "@/lib/employee-portal-request-history";

type RequestHistoryCardProps = {
  status: string;
  title: string;
  categoryLabel: string;
  secondaryCategoryLabel?: string | null;
  metric?: ReactNode;
  filedAt: string;
  statusColumn: ReactNode;
  children?: ReactNode;
};

export function RequestHistoryCard({
  status,
  title,
  categoryLabel,
  secondaryCategoryLabel,
  metric,
  filedAt,
  statusColumn,
  children,
}: RequestHistoryCardProps) {
  return (
    <Card className={`w-full ${requestHistoryCardBorderClass(status)}`}>
      <CardContent className={epRequestHistoryCardContent}>
        <div className={epRequestHistoryCardLayout}>
          <div className={epRequestHistoryCardMain}>
            <div className={epRequestHistoryHeaderRow}>
              <span className={epRequestHistoryTitle}>{title}</span>
              <Badge variant="outline" className={epRequestHistoryCategoryBadge}>
                {categoryLabel}
              </Badge>
              {secondaryCategoryLabel ? (
                <Badge variant="outline" className={epRequestHistoryCategoryBadge}>
                  {secondaryCategoryLabel}
                </Badge>
              ) : null}
              {metric != null ? (
                <span className={epRequestHistoryMetric}>{metric}</span>
              ) : null}
            </div>
            {children}
          </div>
          <VStack gap="2" align="end" className={epRequestStatusColumn}>
            {statusColumn}
          </VStack>
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
        <Caption key={doc.id} className="text-muted-foreground">
          {renderFileName ? renderFileName(doc) : doc.file_name}
        </Caption>
      ))}
    </VStack>
  );
}
