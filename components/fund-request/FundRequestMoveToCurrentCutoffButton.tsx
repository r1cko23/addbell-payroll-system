"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useProfile } from "@/lib/hooks/useProfile";
import {
  canMoveFundRequestToCurrentCutoff,
  formatFundRequestCutoffStartLabel,
  getFundRequestProcessingCutoffStartYmd,
  getFundRequestSucceedingCutoffStartYmd,
} from "@/lib/fund-request-cutoff-move";
import type { FundRequestCutoffAdjustmentEntry, FundRequestRow } from "@/types/fund-request";
import { cn } from "@/lib/utils";

type FundRequestMoveToCurrentCutoffButtonProps = {
  request: Pick<FundRequestRow, "id" | "request_date" | "created_at" | "status">;
  onMoved?: (
    request: FundRequestRow,
    adjustment: FundRequestCutoffAdjustmentEntry
  ) => void;
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
};

export async function moveFundRequestToCurrentCutoff(requestId: string): Promise<
  | {
      request: FundRequestRow;
      adjustment: FundRequestCutoffAdjustmentEntry;
    }
  | { error: string }
> {
  const response = await fetch(
    `/api/fund-requests/${requestId}/move-to-current-cutoff`,
    { method: "POST" }
  );
  const payload = (await response.json()) as {
    error?: string;
    request?: FundRequestRow;
    adjustment?: FundRequestCutoffAdjustmentEntry;
  };

  if (!response.ok || !payload.request || !payload.adjustment) {
    return { error: payload.error ?? "Unable to move request to current cutoff" };
  }

  return {
    request: payload.request,
    adjustment: payload.adjustment,
  };
}

export function FundRequestMoveToCurrentCutoffButton({
  request,
  onMoved,
  className,
  size = "sm",
  variant = "outline",
}: FundRequestMoveToCurrentCutoffButtonProps) {
  const { profile } = useProfile();
  const [open, setOpen] = useState(false);
  const [moving, setMoving] = useState(false);

  if (!canMoveFundRequestToCurrentCutoff(request, profile?.role)) {
    return null;
  }

  const fromCutoffStartYmd = getFundRequestSucceedingCutoffStartYmd(request);
  const toCutoffStartYmd = getFundRequestProcessingCutoffStartYmd(request);
  const fromLabel = fromCutoffStartYmd
    ? formatFundRequestCutoffStartLabel(fromCutoffStartYmd)
    : "next cutoff";
  const toLabel = toCutoffStartYmd
    ? formatFundRequestCutoffStartLabel(toCutoffStartYmd)
    : "current cutoff";

  const handleConfirm = async () => {
    setMoving(true);
    const result = await moveFundRequestToCurrentCutoff(request.id);
    setMoving(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    setOpen(false);
    toast.success(`Moved to ${toLabel}`);
    onMoved?.(result.request, result.adjustment);
  };

  return (
    <>
      <Button
        type="button"
        size={size}
        variant={variant}
        className={cn("min-h-10", className)}
        disabled={moving}
        onClick={() => setOpen(true)}
      >
        {moving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Move to Current Cutoff
      </Button>

      <AlertDialog open={open} onOpenChange={(next) => !moving && setOpen(next)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Move to current cutoff?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  This request is currently in the <strong>{fromLabel}</strong> batch
                  because it was filed after the Thursday 10:00 AM deadline.
                </p>
                <p>
                  Move it back to the <strong>{toLabel}</strong> batch for upper
                  management review? All other request details stay the same.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={moving}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={moving} onClick={() => void handleConfirm()}>
              {moving ? "Moving..." : "Move request"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
