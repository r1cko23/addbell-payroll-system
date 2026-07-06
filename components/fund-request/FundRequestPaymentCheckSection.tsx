"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { epFileInput } from "@/lib/employee-portal-ui";
import { dbHeaderButton } from "@/lib/dashboard-ui";
import {
  dedupeFundRequestPaymentCheckDocuments,
  deleteFundRequestPaymentCheck,
  isFundRequestPaymentCheckDocument,
  preparePaymentCheckFile,
  uploadFundRequestPaymentCheck,
  validatePaymentCheckFile,
} from "@/lib/fund-request-payment-check";
import { FundRequestSupportingDocuments } from "@/components/fund-request/FundRequestSupportingDocuments";
import type { FundRequestDocumentSummary } from "@/types/fund-request";
import { cn } from "@/lib/utils";

type FundRequestPaymentCheckSectionProps = {
  requestId: string;
  documents: FundRequestDocumentSummary[];
  canUpload: boolean;
  canDelete?: boolean;
  linkedRequestIds?: string[];
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

  const paymentChecks = useMemo(
    () => dedupeFundRequestPaymentCheckDocuments(documents),
    [documents]
  );
  const appliesToMultiple = linkedRequestIds.length > 1;

  function resetInput() {
    setSelectedFile(null);
    setFileError(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
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
        {appliesToMultiple ? (
          <p className="mt-1 text-xs text-muted-foreground">
            One check covers all {linkedRequestIds.length} requests for this payee.
          </p>
        ) : null}
      </div>

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

export function splitFundRequestDocuments(documents: FundRequestDocumentSummary[]) {
  return {
    supportingDocuments: documents.filter((doc) => !isFundRequestPaymentCheckDocument(doc)),
    paymentCheckDocuments: documents.filter(isFundRequestPaymentCheckDocument),
  };
}
