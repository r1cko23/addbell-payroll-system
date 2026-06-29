"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { epFileInput } from "@/lib/employee-portal-ui";
import { dbHeaderButton } from "@/lib/dashboard-ui";
import {
  isFundRequestPaymentCheckDocument,
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
  onDocumentsChange: (documents: FundRequestDocumentSummary[]) => void;
  selectedFile: File | null;
  onSelectedFileChange: (file: File | null) => void;
  className?: string;
};

export function FundRequestPaymentCheckSection({
  requestId,
  documents,
  canUpload,
  onDocumentsChange,
  selectedFile,
  onSelectedFileChange,
  className,
}: FundRequestPaymentCheckSectionProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const paymentChecks = documents.filter(isFundRequestPaymentCheckDocument);

  function resetInput() {
    onSelectedFileChange(null);
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

    setUploading(true);
    const result = await uploadFundRequestPaymentCheck(requestId, selectedFile);
    setUploading(false);

    if (result.error || !result.document) {
      toast.error(result.error ?? "Unable to upload payment check");
      return;
    }

    onDocumentsChange([...documents, result.document]);
    toast.success("Payment check uploaded");
    resetInput();
  }

  if (!canUpload && paymentChecks.length === 0) {
    return null;
  }

  return (
    <div className={cn("rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-4", className)}>
      <div>
        <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Payment check (audit)
        </h4>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a scan or photo of the issued check for this request before or after final
          approval.
        </p>
      </div>

      <FundRequestSupportingDocuments
        documents={paymentChecks}
        title="Uploaded payment check"
        emptyLabel="No payment check uploaded yet."
      />

      {canUpload ? (
        <div className="space-y-2 border-t border-primary/10 pt-4">
          <Label htmlFor="fund-request-payment-check">Upload payment check</Label>
          <input
            ref={inputRef}
            id="fund-request-payment-check"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) {
                onSelectedFileChange(null);
                setFileError(null);
                return;
              }
              const validationError = validatePaymentCheckFile(file);
              if (validationError) {
                setFileError(validationError);
                onSelectedFileChange(null);
                return;
              }
              setFileError(null);
              onSelectedFileChange(file);
            }}
            className={epFileInput}
          />
          <p className="text-xs text-muted-foreground">
            PDF or image (JPG, PNG, WEBP). Max 5MB.
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
            disabled={!selectedFile || uploading}
            onClick={() => void handleUpload()}
          >
            {uploading ? "Uploading..." : "Upload check"}
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
