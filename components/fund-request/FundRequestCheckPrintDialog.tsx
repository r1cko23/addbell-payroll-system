"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { dbHeaderButton } from "@/lib/dashboard-ui";
import { printPhpCheckDocument } from "@/lib/php-check-print-document";
import { FundRequestCheckLayoutPreview } from "@/components/fund-request/FundRequestCheckLayoutPreview";
import {
  buildCheckPrintContent,
  CHECK_BANKS,
  CHECK_TEMPLATES,
  formatCheckDate,
  getDefaultCheckPrintOffset,
  loadCheckPrintOffsets,
  saveCheckPrintOffset,
  type CheckBank,
  type CheckPrintOffset,
} from "@/utils/php-check-print";
import { cn } from "@/lib/utils";

type FundRequestCheckPrintDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payeeName: string;
  amount: number;
};

function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateInputValue(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function FundRequestCheckPrintDialog({
  open,
  onOpenChange,
  payeeName,
  amount,
}: FundRequestCheckPrintDialogProps) {
  const [bank, setBank] = useState<CheckBank>("bdo");
  const [payee, setPayee] = useState(payeeName);
  const [amountText, setAmountText] = useState(
    Number.isFinite(amount) ? amount.toFixed(2) : ""
  );
  const [dateText, setDateText] = useState(toDateInputValue(new Date()));
  const [offset, setOffset] = useState<CheckPrintOffset>(
    getDefaultCheckPrintOffset()
  );
  const [showGuides, setShowGuides] = useState(false);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPayee(payeeName);
    setAmountText(Number.isFinite(amount) ? amount.toFixed(2) : "");
    setDateText(toDateInputValue(new Date()));
    setShowGuides(false);
    const stored = loadCheckPrintOffsets();
    setOffset(stored.bdo ?? getDefaultCheckPrintOffset());
    setBank("bdo");
  }, [open, payeeName, amount]);

  useEffect(() => {
    if (!open) return;
    const stored = loadCheckPrintOffsets();
    setOffset(stored[bank] ?? getDefaultCheckPrintOffset());
  }, [bank, open]);

  const parsedAmount = Number(amountText.replace(/,/g, ""));
  const parsedDate = parseDateInputValue(dateText);
  const template = CHECK_TEMPLATES[bank];

  const preview = useMemo(() => {
    if (!Number.isFinite(parsedAmount) || !parsedDate) return null;
    return buildCheckPrintContent({
      bank,
      payee,
      amount: parsedAmount,
      date: parsedDate,
    });
  }, [bank, payee, parsedAmount, parsedDate]);

  function nudge(axis: "x" | "y", delta: number) {
    setOffset((prev) => {
      const next =
        axis === "x"
          ? { ...prev, offsetXMm: Math.round((prev.offsetXMm + delta) * 10) / 10 }
          : { ...prev, offsetYMm: Math.round((prev.offsetYMm + delta) * 10) / 10 };
      saveCheckPrintOffset(bank, next);
      return next;
    });
  }

  function resetOffset() {
    const next = getDefaultCheckPrintOffset();
    setOffset(next);
    saveCheckPrintOffset(bank, next);
  }

  function handlePrint() {
    if (!payee.trim()) {
      toast.error("Enter the payee name");
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      toast.error("Enter a valid check amount");
      return;
    }
    if (!parsedDate) {
      toast.error("Enter a valid issue date");
      return;
    }

    setPrinting(true);
    const result = printPhpCheckDocument({
      fields: {
        bank,
        payee: payee.trim(),
        amount: parsedAmount,
        date: parsedDate,
      },
      offset,
      showGuides,
    });
    setPrinting(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      "Print opened. Paper 8.0 × 3.5 in · Margins None · Scale 100%. Push cheque into the rear clipper; leave the small gap on the right."
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Print check</DialogTitle>
          <DialogDescription>
            {template.label} format. In Chrome use paper{" "}
            <strong>8.0 × 3.5 in</strong> (203 × 90 mm) — not 3.5 × 5 photo.
            Margins None · Scale 100% (not Default). Push the cheque into the
            rear clipper, flush left; leave the small gap on the right — do
            not center it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="check-print-bank">Bank</Label>
            <Select
              value={bank}
              onValueChange={(value) => setBank(value as CheckBank)}
            >
              <SelectTrigger id="check-print-bank">
                <SelectValue placeholder="Select bank" />
              </SelectTrigger>
              <SelectContent>
                {CHECK_BANKS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <FundRequestCheckLayoutPreview
            bank={bank}
            offset={offset}
            content={preview}
          />

          <div className="space-y-2">
            <Label htmlFor="check-print-payee">Payee</Label>
            <Input
              id="check-print-payee"
              value={payee}
              onChange={(e) => setPayee(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="check-print-amount">Amount</Label>
              <Input
                id="check-print-amount"
                inputMode="decimal"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="check-print-date">Issue date</Label>
              <Input
                id="check-print-date"
                type="date"
                value={dateText}
                onChange={(e) => setDateText(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Prints as {parsedDate ? formatCheckDate(parsedDate) : "MM-DD-YYYY"}
              </p>
            </div>
          </div>

          <div className="space-y-2 rounded-md border border-dashed p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Alignment ({bank.toUpperCase()})
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={resetOffset}
              >
                Reset
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Offset X {offset.offsetXMm.toFixed(1)} mm · Y{" "}
              {offset.offsetYMm.toFixed(1)} mm (Addbell printer default X
              -1.5 · Y 8.0, saved on this browser)
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9 min-w-11"
                onClick={() => nudge("x", -0.5)}
              >
                ←
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9 min-w-11"
                onClick={() => nudge("x", 0.5)}
              >
                →
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9 min-w-11"
                onClick={() => nudge("y", -0.5)}
              >
                ↑
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9 min-w-11"
                onClick={() => nudge("y", 0.5)}
              >
                ↓
              </Button>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border"
                checked={showGuides}
                onChange={(e) => setShowGuides(e.target.checked)}
              />
              Print dashed field guides (plain paper calibration)
            </label>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className={cn(dbHeaderButton)}
            disabled={printing}
            onClick={handlePrint}
          >
            {printing ? "Opening…" : "Print"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
