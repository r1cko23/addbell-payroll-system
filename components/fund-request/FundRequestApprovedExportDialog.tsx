"use client";

import { useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { dbHeaderButton } from "@/lib/dashboard-ui";
import {
  groupFundRequestsByClient,
  sumFundRequestNetAmount,
  type FundRequestInboxRow,
} from "@/lib/fund-request-inbox-grouping";
import {
  canShareFundRequestExportFiles,
  downloadFundRequestExportImages,
  downloadFundRequestExportPng,
  shareOrCopyFundRequestExportImage,
} from "@/lib/fund-request-approved-export-image";
import {
  FundRequestApprovedExportPayeeSheet,
  slugifyFundRequestPayeeFilename,
} from "@/components/fund-request/FundRequestApprovedExportPayeeSheet";

type FundRequestApprovedExportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: FundRequestInboxRow[];
  cutoffLabel: string;
  getRequesterName: (row: FundRequestInboxRow) => string;
};

function formatPhp(amount: number): string {
  return `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
}

export function FundRequestApprovedExportDialog({
  open,
  onOpenChange,
  rows,
  cutoffLabel,
  getRequesterName,
}: FundRequestApprovedExportDialogProps) {
  const captureRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [copyingIndex, setCopyingIndex] = useState<number | null>(null);
  const [downloadingIndex, setDownloadingIndex] = useState<number | null>(null);

  const groups = useMemo(() => groupFundRequestsByClient(rows), [rows]);
  const grandTotal = useMemo(() => sumFundRequestNetAmount(rows), [rows]);
  const generatedAt = format(new Date(), "MMM d, yyyy h:mm a");
  const exportDate = format(new Date(), "yyyy-MM-dd");
  const prefersShare = canShareFundRequestExportFiles();

  function payeeFilename(clientName: string, index: number): string {
    return `fund-requests-${exportDate}-${String(index + 1).padStart(2, "0")}-${slugifyFundRequestPayeeFilename(clientName)}.png`;
  }

  async function handleDownloadPayee(index: number) {
    const element = captureRefs.current[index];
    const group = groups[index];
    if (!element || !group) return;

    setDownloadingIndex(index);
    try {
      if (prefersShare) {
        const result = await shareOrCopyFundRequestExportImage(element, {
          filename: payeeFilename(group.clientName, index),
          title: `${group.clientName} — approved fund requests`,
        });
        if (result === "shared") {
          toast.success(`Share sheet opened for ${group.clientName}`);
          return;
        }
      }
      await downloadFundRequestExportPng(element, payeeFilename(group.clientName, index));
      toast.success(`Downloaded ${group.clientName}`);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      toast.error(
        error instanceof Error ? error.message : "Unable to download screenshot"
      );
    } finally {
      setDownloadingIndex(null);
    }
  }

  async function handleShareOrCopyPayee(index: number) {
    const element = captureRefs.current[index];
    const group = groups[index];
    if (!element || !group) return;

    setCopyingIndex(index);
    try {
      const result = await shareOrCopyFundRequestExportImage(element, {
        filename: payeeFilename(group.clientName, index),
        title: `${group.clientName} — approved fund requests`,
      });
      if (result === "shared") {
        toast.success(`Share sheet opened for ${group.clientName}`);
      } else if (result === "copied") {
        toast.success(`Copied ${group.clientName} — paste in your group chat`);
      } else {
        toast.success(
          `Saved ${group.clientName} screenshot — attach it in your group chat`
        );
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      toast.error(
        error instanceof Error ? error.message : "Unable to share screenshot"
      );
    } finally {
      setCopyingIndex(null);
    }
  }

  async function handleDownloadAll() {
    if (groups.length === 0) return;
    setDownloadingAll(true);
    try {
      const items = groups
        .map((group, index) => {
          const element = captureRefs.current[index];
          if (!element) return null;
          return {
            element,
            filename: payeeFilename(group.clientName, index),
          };
        })
        .filter((item): item is { element: HTMLDivElement; filename: string } =>
          Boolean(item)
        );

      await downloadFundRequestExportImages(
        items,
        `fund-requests-approved-${exportDate}.zip`
      );

      toast.success(
        groups.length === 1
          ? "Downloaded 1 screenshot"
          : `Downloaded ZIP with ${groups.length} payee screenshots`
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to download screenshots"
      );
    } finally {
      setDownloadingAll(false);
    }
  }

  const busy = downloadingAll || copyingIndex !== null || downloadingIndex !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90dvh,90vh)] w-[min(100vw-2rem,40rem)] gap-4 overflow-x-hidden overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Approved requests summary</DialogTitle>
          <DialogDescription>
            One screenshot per payee so each image fits in group chat.{" "}
            {prefersShare
              ? "Tap Share on mobile to send to Viber, Messenger, or WhatsApp."
              : "Copy individually, or download all payees as a ZIP."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end">
          <Button
            type="button"
            className={dbHeaderButton}
            disabled={busy || groups.length === 0}
            onClick={() => void handleDownloadAll()}
          >
            {downloadingAll ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Preparing…
              </>
            ) : groups.length === 1 ? (
              "Download PNG"
            ) : (
              `Download ZIP (${groups.length})`
            )}
          </Button>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-900/80">
            Cutoff total
          </p>
          <p className="text-xl font-bold text-amber-950">{formatPhp(grandTotal)}</p>
          <p className="mt-1 text-sm text-amber-900/80">
            {rows.length} request{rows.length === 1 ? "" : "s"} · {groups.length} payee
            {groups.length === 1 ? "" : "s"} · {cutoffLabel}
          </p>
        </div>

        <div className="space-y-6">
          {groups.map((group, index) => (
            <div key={group.key} className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {index + 1}. {group.clientName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {group.requests.length} request
                    {group.requests.length === 1 ? "" : "s"} ·{" "}
                    {formatPhp(group.subtotalNet)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={dbHeaderButton}
                    disabled={busy}
                    onClick={() => void handleShareOrCopyPayee(index)}
                  >
                    {copyingIndex === index ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : prefersShare ? (
                      "Share"
                    ) : (
                      "Copy"
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={dbHeaderButton}
                    disabled={busy}
                    onClick={() => void handleDownloadPayee(index)}
                  >
                    {downloadingIndex === index ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Download"
                    )}
                  </Button>
                </div>
              </div>

              <div className="w-full min-w-0 overflow-hidden rounded-lg border bg-muted/20 p-2 sm:p-3">
                <FundRequestApprovedExportPayeeSheet
                  ref={(node) => {
                    captureRefs.current[index] = node;
                  }}
                  group={group}
                  groupIndex={index}
                  groupCount={groups.length}
                  cutoffLabel={cutoffLabel}
                  generatedAt={generatedAt}
                  grandTotal={grandTotal}
                  getRequesterName={getRequesterName}
                />
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className={dbHeaderButton}
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
