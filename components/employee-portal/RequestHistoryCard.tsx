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
  epRequestClockReferenceBox,
  epRequestClockReferenceLine,
  epRequestFiledLine,
  epRequestHistoryBodyRow,
  epRequestHistoryCardContent,
  epRequestHistoryCardLayout,
  epRequestHistoryCardMain,
  epRequestHistoryCategoryBadge,
  epRequestHistoryDocLink,
  epRequestHistoryHeaderBadgeGroup,
  epRequestHistoryHeaderRow,
  epRequestHistoryMetric,
  epRequestHistoryReasonText,
  epRequestHistorySubtitle,
  epRequestHistorySupportingDocs,
  epRequestHistoryStatusColumn,
  epRequestHistoryTitle,
  requestHistoryCardBorderClass,
} from "@/lib/employee-portal-request-history";
import {
  EpDesktopBlock,
  EpMobileBlock,
} from "@/components/employee-portal/EmployeePortalViewport";
import { RequestHistoryCardMobile } from "./RequestHistoryCardMobile";

type RequestHistoryCardProps = {
  status: string;
  title: string;
  categoryLabel: string;
  subtitle?: string | null;
  metric?: ReactNode;
  filedAt: string;
  statusColumn: ReactNode;
  children?: ReactNode;
};

/** Original laptop/desktop card body — single responsive layout from md+. */
function RequestHistoryCardDesktopBody({
  title,
  categoryLabel,
  subtitle,
  metric,
  statusColumn,
  children,
}: Omit<RequestHistoryCardProps, "status" | "filedAt">) {
  return (
    <div className={epRequestHistoryCardLayout}>
      <div className={epRequestHistoryCardMain}>
        <div className={epRequestHistoryHeaderRow}>
          <span className={epRequestHistoryTitle}>{title}</span>
          <div className={epRequestHistoryHeaderBadgeGroup}>
            <Badge variant="outline" className={epRequestHistoryCategoryBadge}>
              {categoryLabel}
            </Badge>
            {metric != null ? (
              <span className={epRequestHistoryMetric}>{metric}</span>
            ) : null}
          </div>
        </div>
        {subtitle ? (
          <p className={epRequestHistorySubtitle}>{subtitle}</p>
        ) : null}
        {children}
      </div>
      <div className={epRequestHistoryStatusColumn} aria-label="Request status">
        {statusColumn}
      </div>
    </div>
  );
}

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
  const bodyProps = {
    title,
    categoryLabel,
    subtitle,
    metric,
    statusColumn,
    children,
  };

  return (
    <Card
      className={cn(
        "w-full",
        requestHistoryCardBorderClass(status),
        epCardInteractive
      )}
    >
      <CardContent className={epRequestHistoryCardContent}>
        <EpMobileBlock>
          <RequestHistoryCardMobile {...bodyProps} />
        </EpMobileBlock>
        <EpDesktopBlock>
          <RequestHistoryCardDesktopBody {...bodyProps} />
        </EpDesktopBlock>
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

export function RequestHistoryClockReference({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className={epRequestClockReferenceBox}>
      <BodySmall className="text-xs font-semibold text-primary">
        {title}
      </BodySmall>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

export function RequestHistoryClockReferenceLine({
  label,
  time,
  coordinates,
}: {
  label: string;
  time: string;
  coordinates?: string | null;
}) {
  return (
    <div className={epRequestClockReferenceLine}>
      <strong>{label}:</strong> {time}
      {coordinates ? (
        <>
          <span className="text-muted-foreground max-md:hidden">
            {" "}
            · {coordinates}
          </span>
          <span className="mt-0.5 block break-all text-[11px] text-muted-foreground/90 md:hidden">
            {coordinates}
          </span>
        </>
      ) : null}
    </div>
  );
}

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
