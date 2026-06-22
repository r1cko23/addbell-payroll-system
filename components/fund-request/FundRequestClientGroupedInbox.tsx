"use client";

import { Fragment, useMemo } from "react";
import Link from "next/link";
import { formatFundRequestFiledAtCompact } from "@/lib/fund-request-history";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BodySmall, Caption } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { cn } from "@/lib/utils";
import {
  groupFundRequestsByClient,
  summarizeFundRequestPayment,
  sumFundRequestNetAmount,
  type FundRequestInboxRow,
} from "@/lib/fund-request-inbox-grouping";
import type { FundRequestRow } from "@/types/fund-request";

type FundRequestClientGroupedInboxProps = {
  rows: FundRequestInboxRow[];
  detailHref: (id: string) => string;
  getRequesterName: (row: FundRequestInboxRow) => string;
  canReturnOn: (row: FundRequestInboxRow) => boolean;
  actingId: string | null;
  rejectId: string | null;
  rejectReason: string;
  onRejectReasonChange: (value: string) => void;
  onStartReject: (id: string) => void;
  onCancelReject: () => void;
  onReject: (id: string, status: FundRequestRow["status"]) => void;
  bulkApproving: boolean;
  onApproveAll: () => void;
};

function formatPhp(amount: number): string {
  return `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
}

export function FundRequestClientGroupedInbox({
  rows,
  detailHref,
  getRequesterName,
  canReturnOn,
  actingId,
  rejectId,
  rejectReason,
  onRejectReasonChange,
  onStartReject,
  onCancelReject,
  onReject,
  bulkApproving,
  onApproveAll,
}: FundRequestClientGroupedInboxProps) {
  const groups = useMemo(() => groupFundRequestsByClient(rows), [rows]);
  const grandTotal = useMemo(() => sumFundRequestNetAmount(rows), [rows]);

  return (
    <Card className="overflow-hidden border-border/80">
      <div className="flex flex-col gap-2 border-b border-amber-300 bg-amber-50 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Caption className="uppercase tracking-wide text-amber-900/80">
            Total amount to pay
          </Caption>
          <p className="text-xl font-bold text-amber-950 sm:text-2xl">
            {formatPhp(grandTotal)}
          </p>
        </div>
        <BodySmall className="shrink-0 text-amber-900/80">
          {rows.length} request{rows.length === 1 ? "" : "s"} · {groups.length} payee
          {groups.length === 1 ? "" : "s"}
        </BodySmall>
      </div>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-xs sm:text-sm">
            <tbody>
              {groups.map((group, groupIndex) => (
                <Fragment key={group.key}>
                  {groupIndex > 0 ? (
                    <tr aria-hidden>
                      <td
                        colSpan={4}
                        className="h-0 border-t-4 border-double border-emerald-700/50 bg-muted/25 p-0"
                      />
                    </tr>
                  ) : null}

                  <tr className="border-y-2 border-emerald-700/70 bg-emerald-50/90">
                    <td
                      colSpan={3}
                      className="border-l-4 border-emerald-700 px-4 py-3 text-sm font-bold uppercase tracking-wide text-emerald-950"
                    >
                      {group.clientName}
                      <span className="ml-2 text-xs font-semibold normal-case text-emerald-800/70">
                        ({group.requests.length} payable
                        {group.requests.length === 1 ? "" : "s"})
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-emerald-950">
                      {formatPhp(group.subtotalNet)}
                    </td>
                  </tr>

                  {group.requests.map((request, index) => {
                    const summary = summarizeFundRequestPayment(request);
                    const requesterName = getRequesterName(request);
                    const showEwt = summary.ewtAmount > 0;
                    const showDeductions = summary.deductionsAmount > 0;
                    const isLastInGroup = index === group.requests.length - 1;
                    const canReturn = canReturnOn(request);

                    return (
                      <Fragment key={request.id}>
                        <tr className="border-t border-dashed border-border/70 bg-background">
                          <td className="w-8 px-3 py-1.5 align-top text-muted-foreground">
                            {index + 1}.
                          </td>
                          <td className="min-w-[220px] px-3 py-1.5 align-top" colSpan={3}>
                            <Link
                              href={detailHref(request.id)}
                              className="group inline-flex items-start gap-1.5 font-medium uppercase leading-snug text-primary hover:underline"
                            >
                              <span>{summary.label}</span>
                              <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
                            </Link>
                            <Caption className="mt-0.5 block text-muted-foreground">
                              {requesterName} · {formatFundRequestFiledAtCompact(request)}
                            </Caption>
                          </td>
                        </tr>

                        <tr className="bg-muted/15">
                          <td />
                          <td className="px-3 py-1 pl-8 text-muted-foreground" colSpan={2}>
                            Amount
                          </td>
                          <td className="px-3 py-1 text-right font-mono text-muted-foreground">
                            {formatPhp(summary.grossAmount)}
                          </td>
                        </tr>

                        {showEwt ? (
                          <tr className="bg-muted/15">
                            <td />
                            <td className="px-3 py-1 pl-8 text-muted-foreground" colSpan={2}>
                              EWT
                            </td>
                            <td className="px-3 py-1 text-right font-mono text-muted-foreground">
                              {formatPhp(summary.ewtAmount)}
                            </td>
                          </tr>
                        ) : null}

                        {showDeductions ? (
                          <tr className="bg-muted/15">
                            <td />
                            <td className="px-3 py-1 pl-8 text-muted-foreground" colSpan={2}>
                              Deductions
                            </td>
                            <td className="px-3 py-1 text-right font-mono text-muted-foreground">
                              {formatPhp(summary.deductionsAmount)}
                            </td>
                          </tr>
                        ) : null}

                        <tr className="bg-emerald-50/70">
                          <td />
                          <td className="px-3 py-1.5 pl-8 font-medium" colSpan={2}>
                            Amount to pay
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono font-semibold">
                            {formatPhp(summary.netAmount)}
                          </td>
                        </tr>

                        <tr
                          className={cn(
                            "bg-background",
                            isLastInGroup
                              ? "border-b-2 border-emerald-700/40"
                              : "border-b border-border/50"
                          )}
                        >
                          <td />
                          <td className="px-3 pb-3 pt-2" colSpan={3}>
                            {canReturn ? (
                              rejectId === request.id ? (
                                <VStack gap="2" className="max-w-md">
                                  <Label className="text-xs">
                                    Return reason (optional)
                                  </Label>
                                  <Input
                                    value={rejectReason}
                                    onChange={(e) =>
                                      onRejectReasonChange(e.target.value)
                                    }
                                    placeholder="Reason for returning to purchasing (optional)"
                                    className="h-8 text-xs"
                                  />
                                  <HStack gap="2">
                                    <Button
                                      type="button"
                                      size="sm"
                                      className="h-7 text-xs"
                                      disabled={actingId === request.id}
                                      onClick={() =>
                                        onReject(request.id, request.status)
                                      }
                                    >
                                      {actingId === request.id ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        "Confirm"
                                      )}
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs"
                                      onClick={onCancelReject}
                                    >
                                      Cancel
                                    </Button>
                                  </HStack>
                                </VStack>
                              ) : (
                                <HStack gap="2" className="flex-wrap">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs"
                                    asChild
                                  >
                                    <Link href={detailHref(request.id)}>Review</Link>
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="h-7 text-xs"
                                    disabled={actingId === request.id}
                                    onClick={() => onStartReject(request.id)}
                                  >
                                    Reject
                                  </Button>
                                </HStack>
                              )
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                asChild
                              >
                                <Link href={detailHref(request.id)}>Review</Link>
                              </Button>
                            )}
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end border-t bg-muted/20 px-4 py-3">
          <Button
            type="button"
            size="sm"
            className="shrink-0"
            disabled={bulkApproving || rows.length === 0}
            onClick={onApproveAll}
          >
            {bulkApproving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Approving…
              </>
            ) : (
              `Approve all (${rows.length})`
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
