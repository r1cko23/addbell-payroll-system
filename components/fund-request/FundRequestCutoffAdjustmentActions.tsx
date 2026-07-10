"use client";

import type { FundRequestCutoffAdjustmentEntry, FundRequestRow } from "@/types/fund-request";
import { FundRequestMoveToCurrentCutoffButton } from "@/components/fund-request/FundRequestMoveToCurrentCutoffButton";
import { FundRequestUndoCutoffMoveButton } from "@/components/fund-request/FundRequestUndoCutoffMoveButton";
import { cn } from "@/lib/utils";

type FundRequestCutoffAdjustmentActionsProps = {
  request: Pick<
    FundRequestRow,
    "id" | "request_date" | "created_at" | "status" | "cutoff_adjustment_history"
  >;
  onChanged?: (
    request: FundRequestRow,
    adjustment: FundRequestCutoffAdjustmentEntry
  ) => void;
  className?: string;
};

export function FundRequestCutoffAdjustmentActions({
  request,
  onChanged,
  className,
}: FundRequestCutoffAdjustmentActionsProps) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <FundRequestMoveToCurrentCutoffButton request={request} onMoved={onChanged} />
      <FundRequestUndoCutoffMoveButton request={request} onUndone={onChanged} />
    </div>
  );
}
