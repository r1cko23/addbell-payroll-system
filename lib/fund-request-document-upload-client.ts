import { createClient } from "@/lib/supabase/client";
import {
  FUND_REQUEST_DOCUMENTS_BUCKET,
} from "@/lib/fund-request-document-storage";
import { MAX_REQUEST_DOCUMENT_SIZE } from "@/lib/request-supporting-document";
import type {
  FundRequestDocumentSummary,
  FundRequestDocumentType,
} from "@/types/fund-request";

type UploadFundRequestDocumentOptions = {
  requestId: string;
  requestedBy?: string;
  documentType?: FundRequestDocumentType;
};

type UploadUrlResponse = {
  documentId: string;
  storagePath: string;
  token: string;
  error?: string;
};

export async function uploadFundRequestDocumentFile(
  file: File,
  options: UploadFundRequestDocumentOptions
): Promise<{ document?: FundRequestDocumentSummary; error?: string }> {
  if (file.size > MAX_REQUEST_DOCUMENT_SIZE) {
    return { error: "File too large. Max size is 5MB." };
  }

  const uploadUrlResponse = await fetch("/api/fund-requests/documents/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      request_id: options.requestId,
      requested_by: options.requestedBy,
      document_type: options.documentType ?? "supporting",
      file_name: file.name,
      file_size: file.size,
    }),
  });

  const uploadUrlPayload = (await uploadUrlResponse.json()) as UploadUrlResponse;
  if (!uploadUrlResponse.ok) {
    return { error: uploadUrlPayload.error ?? "Unable to prepare upload" };
  }

  const supabase = createClient();
  const { error: storageError } = await supabase.storage
    .from(FUND_REQUEST_DOCUMENTS_BUCKET)
    .uploadToSignedUrl(
      uploadUrlPayload.storagePath,
      uploadUrlPayload.token,
      file,
      { contentType: file.type || "application/octet-stream" }
    );

  if (storageError) {
    return { error: storageError.message || "Unable to upload file" };
  }

  const confirmResponse = await fetch("/api/fund-requests/documents/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      request_id: options.requestId,
      requested_by: options.requestedBy,
      document_type: options.documentType ?? "supporting",
      document_id: uploadUrlPayload.documentId,
      storage_path: uploadUrlPayload.storagePath,
      file_name: file.name,
      file_type: file.type || "application/octet-stream",
      file_size: file.size,
    }),
  });

  const confirmPayload = (await confirmResponse.json()) as {
    error?: string;
    document?: FundRequestDocumentSummary;
  };

  if (!confirmResponse.ok) {
    return { error: confirmPayload.error ?? "Unable to save document" };
  }
  if (!confirmPayload.document) {
    return { error: "Unable to save document" };
  }

  return { document: confirmPayload.document };
}
