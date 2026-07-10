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
import { getActiveFundRequestCutoffAdjustment } from "@/lib/fund-request-cutoff-adjustment-history";
import {
  canUndoFundRequestCutoffMove,
  formatFundRequestCutoffStartLabel,
} from "@/lib/fund-request-cutoff-move";
import type { FundRequestCutoffAdjustmentEntry, FundRequestRow } from "@/types/fund-request";
import { cn } from "@/lib/utils";

type FundRequestUndoCutoffMoveButtonProps = {
  request: Pick<
    FundRequestRow,
    "id" | "request_date" | "created_at" | "status" | "cutoff_adjustment_history"
  >;
  onUndone?: (
    request: FundRequestRow,
    adjustment: FundRequestCutoffAdjustmentEntry
  ) => void;
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
};

export async function undoFundRequestCutoffMove(requestId: string): Promise<
  | {
      request: FundRequestRow;
      adjustment: FundRequestCutoffAdjustmentEntry;
    }
  | { error: string }
> {
  const response = await fetch(`/api/fund-requests/${requestId}/undo-cutoff-move`, {
    method: "POST",
  });
  const payload = (await response.json()) as {
    error?: string;
    request?: FundRequestRow;
    adjustment?: FundRequestCutoffAdjustmentEntry;
  };

  if (!response.ok || !payload.request || !payload.adjustment) {
    return { error: payload.error ?? "Unable to undo cutoff move" };
  }

  return {
    request: payload.request,
    adjustment: payload.adjustment,
  };
}

export function FundRequestUndoCutoffMoveButton({
  request,
  onUndone,
  className,
  size = "sm",
  variant = "outline",
}: FundRequestUndoCutoffMoveButtonProps) {
  const { profile } = useProfile();
  const [open, setOpen] = useState(false);
  const [undoing, setUndoing] = useState(false);

  if (!canUndoFundRequestCutoffMove(request, profile?.role)) {
    return null;
  }

  const activeAdjustment = getActiveFundRequestCutoffAdjustment(request);
  const fromLabel = activeAdjustment
    ? formatFundRequestCutoffStartLabel(activeAdjustment.to_cutoff_start_ymd)
    : "current cutoff";
  const toLabel = activeAdjustment
    ? formatFundRequestCutoffStartLabel(activeAdjustment.from_cutoff_start_ymd)
    : "next cutoff";

  const handleConfirm = async () => {
    setUndoing(true);
    const result = await undoFundRequestCutoffMove(request.id);
    setUndoing(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    setOpen(false);
    toast.success(`Restored to ${toLabel}`);
    onUndone?.(result.request, result.adjustment);
  };

  return (
    <>
      <Button
        type="button"
        size={size}
        variant={variant}
        className={cn("min-h-10", className)}
        disabled={undoing}
        onClick={() => setOpen(true)}
      >
        {undoing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Undo Cutoff Move
      </Button>

      <AlertDialog open={open} onOpenChange={(next) => !undoing && setOpen(next)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Undo cutoff move?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  This request was manually moved into the <strong>{fromLabel}</strong>{" "}
                  batch. Undoing will restore its original filing time and put it back in
                  the <strong>{toLabel}</strong> batch.
                </p>
                <p>All other request details stay the same.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={undoing}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={undoing} onClick={() => void handleConfirm()}>
              {undoing ? "Undoing..." : "Undo move"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
