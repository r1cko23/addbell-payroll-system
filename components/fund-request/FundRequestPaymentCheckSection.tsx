"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { epFileInput } from "@/lib/employee-portal-ui";
import { dbHeaderButton } from "@/lib/dashboard-ui";
import {
  dedupeFundRequestPaymentCheckDocuments,
  deleteFundRequestPaymentCheck,
  formatFundRequestChequePhp,
  getFundRequestSeparateChequePrompt,
  isFundRequestPaymentCheckDocument,
  preparePaymentCheckFile,
  uploadFundRequestPaymentCheck,
  validatePaymentCheckFile,
} from "@/lib/fund-request-payment-check";
import { FundRequestCheckPrintDialog } from "@/components/fund-request/FundRequestCheckPrintDialog";
import { FundRequestSupportingDocuments } from "@/components/fund-request/FundRequestSupportingDocuments";
import type { FundRequestDocumentSummary } from "@/types/fund-request";
import { cn } from "@/lib/utils";

type FundRequestPaymentCheckSectionProps = {
  requestId: string;
  documents: FundRequestDocumentSummary[];
  canUpload: boolean;
  canDelete?: boolean;
  linkedRequestIds?: string[];
  /** Amount printed on the cheque (this request, or remaining combined). */
  checkAmount?: number;
  /** Payee / account name printed on the check. */
  checkPayeeName?: string;
  /** Full payee subtotal shown in the inbox header (unchanged when a request is split). */
  payeeTotal?: number;
  /** Combined cheque amount after this request is excluded. */
  combinedChequeAfter?: number;
  printMode?: "combined" | "separate";
  isSeparateCheque?: boolean;
  separateChequeCount?: number;
  onMarkSeparateCheque?: () => Promise<boolean>;
  onClearSeparateCheque?: () => Promise<boolean>;
  onDocumentsChange: (documents: FundRequestDocumentSummary[]) => void;
  className?: string;
  compact?: boolean;
};

export function FundRequestPaymentCheckSection({
  requestId,
  documents,
  canUpload,
  canDelete = false,
  linkedRequestIds = [],
  checkAmount,
  checkPayeeName = "",
  payeeTotal,
  combinedChequeAfter,
  printMode = "combined",
  isSeparateCheque = false,
  separateChequeCount = 0,
  onMarkSeparateCheque,
  onClearSeparateCheque,
  onDocumentsChange,
  className,
  compact = false,
}: FundRequestPaymentCheckSectionProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [confirmSeparateOpen, setConfirmSeparateOpen] = useState(false);
  const [markingSeparate, setMarkingSeparate] = useState(false);

  const paymentChecks = useMemo(
    () => dedupeFundRequestPaymentCheckDocuments(documents),
    [documents]
  );
  const appliesToMultiple = linkedRequestIds.length > 1;
  const canPrintCheck =
    typeof checkAmount === "number" &&
    Number.isFinite(checkAmount) &&
    checkAmount >= 0;
  const isSeparatePrint = printMode === "separate";
  const remainingCombined = typeof checkAmount === "number" ? checkAmount : 0;
  const remainingRequestCount = Math.max(
    0,
    linkedRequestIds.length - separateChequeCount
  );
  const prompt = getFundRequestSeparateChequePrompt({
    requestAmount: typeof checkAmount === "number" ? checkAmount : 0,
    payeeName: checkPayeeName,
    groupTotal: typeof payeeTotal === "number" ? payeeTotal : 0,
    combinedAfter:
      typeof combinedChequeAfter === "number"
        ? combinedChequeAfter
        : roundPromptAmount(
            (typeof payeeTotal === "number" ? payeeTotal : 0) -
              (typeof checkAmount === "number" ? checkAmount : 0)
          ),
  });

  function resetInput() {
    setSelectedFile(null);
    setFileError(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function handlePrintClick() {
    if (!canPrintCheck) return;
    if (isSeparatePrint && !isSeparateCheque) {
      setConfirmSeparateOpen(true);
      return;
    }
    if (!isSeparatePrint && remainingCombined <= 0) {
      toast.error("All requests for this payee already have separate cheques.");
      return;
    }
    setPrintOpen(true);
  }

  async function confirmSeparateCheque() {
    setMarkingSeparate(true);
    const marked = onMarkSeparateCheque ? await onMarkSeparateCheque() : true;
    setMarkingSeparate(false);
    if (!marked) return;
    setConfirmSeparateOpen(false);
    setPrintOpen(true);
  }

  async function handleClearSeparateCheque() {
    if (!onClearSeparateCheque) return;
    const cleared = await onClearSeparateCheque();
    if (!cleared) return;
    toast.success("This request is included in the combined cheque again.");
  }

  async function handleUpload() {
    if (!selectedFile) return;

    const validationError = validatePaymentCheckFile(selectedFile);
    if (validationError) {
      setFileError(validationError);
      return;
    }

    setCompressing(true);
    let fileToUpload = selectedFile;
    try {
      fileToUpload = await preparePaymentCheckFile(selectedFile);
    } finally {
      setCompressing(false);
    }

    setUploading(true);
    const result = await uploadFundRequestPaymentCheck(requestId, fileToUpload, {
      linkedRequestIds,
    });
    setUploading(false);

    if (result.error || result.documents.length === 0) {
      toast.error(result.error ?? "Unable to upload payment check");
      return;
    }

    onDocumentsChange([...documents, ...result.documents]);
    toast.success(
      appliesToMultiple
        ? `Payment check uploaded for ${linkedRequestIds.length} requests`
        : "Payment check uploaded"
    );
    resetInput();
  }

  async function handleDelete(documentId: string) {
    setDeletingDocId(documentId);
    const result = await deleteFundRequestPaymentCheck(documentId);
    setDeletingDocId(null);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    const deletedDoc = documents.find((doc) => doc.id === documentId);
    const storagePath = deletedDoc?.storage_path?.trim();
    const nextDocuments = documents.filter((doc) => {
      if (doc.id === documentId) return false;
      if (
        storagePath &&
        doc.document_type === "payment_check" &&
        doc.storage_path?.trim() === storagePath
      ) {
        return false;
      }
      return true;
    });
    onDocumentsChange(nextDocuments);
    toast.success(
      appliesToMultiple
        ? "Payment check removed from all requests for this payee"
        : "Payment check deleted"
    );
  }

  if (!canUpload && paymentChecks.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-primary/20 bg-primary/5 space-y-4",
        compact ? "p-3" : "p-4",
        className
      )}
    >
      <div>
        <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Payment check (optional audit)
        </h4>
        {isSeparatePrint ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {isSeparateCheque
              ? "This request prints on its own cheque and is excluded from the combined payee cheque."
              : appliesToMultiple
                ? `Print this request on its own cheque. It will be excluded from the combined cheque for all ${linkedRequestIds.length} requests.`
                : "Print this request on its own cheque."}
          </p>
        ) : appliesToMultiple ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {separateChequeCount > 0
              ? `One check covers the remaining ${remainingRequestCount} request${
                  remainingRequestCount === 1 ? "" : "s"
                } for this payee.`
              : `One check covers all ${linkedRequestIds.length} requests for this payee.`}
          </p>
        ) : null}
        {canPrintCheck ? (
          <div className="mt-2 flex flex-col items-start gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={cn(dbHeaderButton)}
              onClick={handlePrintClick}
            >
              {isSeparatePrint ? "Print Separate cheque" : "Print check (BDO / BPI)"}
            </Button>
            {!isSeparatePrint &&
            separateChequeCount > 0 &&
            typeof payeeTotal === "number" ? (
              <p className="text-xs text-sky-800">
                Cheque prints {formatFundRequestChequePhp(remainingCombined)}{" "}
                (excludes {separateChequeCount} separate cheque
                {separateChequeCount === 1 ? "" : "s"}). Payee total stays{" "}
                {formatFundRequestChequePhp(payeeTotal)}.
              </p>
            ) : null}
            {isSeparatePrint && isSeparateCheque && onClearSeparateCheque ? (
              <button
                type="button"
                className="text-xs font-medium text-sky-800 underline-offset-2 hover:underline"
                onClick={() => void handleClearSeparateCheque()}
              >
                Include in combined cheque
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <FundRequestCheckPrintDialog
        open={printOpen}
        onOpenChange={setPrintOpen}
        payeeName={checkPayeeName}
        amount={typeof checkAmount === "number" ? checkAmount : 0}
      />

      <AlertDialog open={confirmSeparateOpen} onOpenChange={setConfirmSeparateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{prompt.title}</AlertDialogTitle>
            <AlertDialogDescription>{prompt.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={markingSeparate}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={markingSeparate}
              onClick={(event) => {
                event.preventDefault();
                void confirmSeparateCheque();
              }}
            >
              {markingSeparate ? "Saving…" : "Print separate cheque"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <FundRequestSupportingDocuments
        documents={paymentChecks}
        title="Uploaded payment check"
        emptyLabel="No payment check uploaded."
        canDelete={canDelete}
        deletingDocId={deletingDocId}
        onDelete={(docId) => void handleDelete(docId)}
      />

      {canUpload ? (
        <div className="space-y-2 border-t border-primary/10 pt-4">
          <Label htmlFor={`fund-request-payment-check-${requestId}`}>
            Upload Payment Check (Optional)
          </Label>
          <input
            ref={inputRef}
            id={`fund-request-payment-check-${requestId}`}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) {
                setSelectedFile(null);
                setFileError(null);
                return;
              }
              const validationError = validatePaymentCheckFile(file);
              if (validationError) {
                setFileError(validationError);
                setSelectedFile(null);
                return;
              }
              setFileError(null);
              setSelectedFile(file);
            }}
            className={epFileInput}
          />
          <p className="text-xs text-muted-foreground">
            PDF or image (JPG, PNG, WEBP). Images are resized to about 400 KB. Max 5MB.
          </p>
          {selectedFile && !fileError ? (
            <p className="text-sm text-emerald-700">
              Selected: {selectedFile.name} (
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          ) : null}
          {fileError ? (
            <p className="text-sm font-medium text-destructive">{fileError}</p>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={dbHeaderButton}
            disabled={!selectedFile || uploading || compressing}
            onClick={() => void handleUpload()}
          >
            {compressing ? "Compressing..." : uploading ? "Uploading..." : "Upload check"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function roundPromptAmount(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function splitFundRequestDocuments(documents: FundRequestDocumentSummary[]) {
  return {
    supportingDocuments: documents.filter((doc) => !isFundRequestPaymentCheckDocument(doc)),
    paymentCheckDocuments: documents.filter(isFundRequestPaymentCheckDocument),
  };
}

export function FundRequestSeparateChequeBadge({
  className,
}: {
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-sky-300 bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800",
        className
      )}
    >
      Separate cheque
    </span>
  );
}
