"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  isAllowedRequestDocument,
  MAX_REQUEST_DOCUMENT_SIZE,
} from "@/lib/request-supporting-document";
import { uploadFundRequestDocumentFile } from "@/lib/fund-request-document-upload-client";
import {
  requestFormCopy,
  requestSupportingDocLabel,
} from "@/lib/employee-portal-request-copy";
import { epFileInput, epSubmitRequestButton } from "@/lib/employee-portal-ui";
import { cn } from "@/lib/utils";
import type { FundRequestDocumentSummary } from "@/types/fund-request";

type FundRequestAddDocumentProps = {
  requestId: string;
  requestedBy: string;
  onUploaded: (document: FundRequestDocumentSummary) => void;
};

export function FundRequestAddDocument({
  requestId,
  requestedBy,
  onUploaded,
}: FundRequestAddDocumentProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  function resetInput() {
    setSelectedFile(null);
    setDocError(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  async function handleUpload() {
    if (!selectedFile) return;

    setUploading(true);
    try {
      const result = await uploadFundRequestDocumentFile(selectedFile, {
        requestId,
        requestedBy,
        documentType: "supporting",
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (!result.document) {
        toast.error("Unable to upload document");
        return;
      }

      onUploaded(result.document);
      toast.success("Document added");
      resetInput();
    } catch {
      toast.error("Unable to upload document");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-lg border border-dashed border-border/80 p-4">
      <Label htmlFor="fund-request-add-doc">{requestSupportingDocLabel}</Label>
      <input
        ref={inputRef}
        id="fund-request-add-doc"
        type="file"
        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        disabled={uploading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) {
            setSelectedFile(null);
            setDocError(null);
            return;
          }
          if (!isAllowedRequestDocument(file)) {
            setDocError("Only PDF, DOC, or DOCX files are allowed.");
            setSelectedFile(null);
            return;
          }
          if (file.size > MAX_REQUEST_DOCUMENT_SIZE) {
            setDocError("File too large. Max size is 5MB.");
            setSelectedFile(null);
            return;
          }
          setDocError(null);
          setSelectedFile(file);
        }}
        className={epFileInput}
      />
      <p className="mt-1 text-xs text-muted-foreground">
        {requestFormCopy.fundRequest.supportingDocHint} Files upload directly to
        storage (up to 5MB).
      </p>
      {selectedFile && !docError ? (
        <p className="mt-2 text-sm text-emerald-700">
          Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
        </p>
      ) : null}
      {docError ? (
        <p className="mt-1 text-sm font-medium text-destructive">{docError}</p>
      ) : null}
      <Button
        type="button"
        size="sm"
        className={cn("mt-3", epSubmitRequestButton, "sm:mt-3 sm:w-auto")}
        disabled={!selectedFile || uploading}
        onClick={handleUpload}
      >
        {uploading ? "Uploading..." : "Add document"}
      </Button>
    </div>
  );
}
