import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_REQUEST_DOCUMENT_SIZE } from "@/lib/request-supporting-document";
import type { FundRequestDocumentType } from "@/types/fund-request";

export const FUND_REQUEST_DOCUMENTS_BUCKET = "fund-request-documents";
export const FUND_REQUEST_DOCUMENT_SIGNED_URL_TTL_SECONDS = 60 * 60;

export const FUND_REQUEST_DOCUMENT_SELECT =
  "id, fund_request_id, employee_id, file_name, file_type, file_size, created_at, document_type, uploaded_by, storage_path";

export type InsertFundRequestDocumentParams = {
  fundRequestId: string;
  employeeId: string;
  fileName: string;
  fileType: string;
  fileBase64: string;
  documentType?: FundRequestDocumentType;
  uploadedBy?: string | null;
};

export function sanitizeFundRequestDocumentFileName(fileName: string): string {
  const trimmed = fileName.trim();
  const sanitized = trimmed.replace(/[^a-zA-Z0-9._-]+/g, "_");
  return (sanitized || "document").slice(0, 180);
}

export function decodeDocumentBase64(base64: string): Buffer {
  const normalized = base64.includes(",") ? base64.split(",")[1]! : base64;
  return Buffer.from(normalized, "base64");
}

export function isFundRequestStorageUnavailableError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("bucket") ||
    lower.includes("storage") ||
    lower.includes("not found") ||
    lower.includes("storage_path")
  );
}

async function removeStoredFundRequestDocument(
  admin: SupabaseClient,
  storagePath: string
): Promise<void> {
  await admin.storage.from(FUND_REQUEST_DOCUMENTS_BUCKET).remove([storagePath]);
}

export async function insertFundRequestDocument(
  admin: SupabaseClient,
  params: InsertFundRequestDocumentParams
): Promise<
  | { document: Record<string, unknown> }
  | { error: string; status: number }
> {
  const fileBytes = decodeDocumentBase64(params.fileBase64);
  if (fileBytes.length > MAX_REQUEST_DOCUMENT_SIZE) {
    return { error: "File too large. Max size is 5MB.", status: 400 };
  }

  const documentId = randomUUID();
  const storagePath = `${params.fundRequestId}/${documentId}/${sanitizeFundRequestDocumentFileName(params.fileName)}`;

  const { error: storageError } = await admin.storage
    .from(FUND_REQUEST_DOCUMENTS_BUCKET)
    .upload(storagePath, fileBytes, {
      contentType: params.fileType,
      upsert: false,
    });

  if (!storageError) {
    const docInsert = await admin
      .from("fund_request_documents")
      .insert({
        id: documentId,
        fund_request_id: params.fundRequestId,
        employee_id: params.employeeId,
        file_name: params.fileName,
        file_type: params.fileType,
        file_size: fileBytes.length,
        storage_path: storagePath,
        file_base64: null,
        document_type: params.documentType ?? "supporting",
        uploaded_by: params.uploadedBy ?? null,
      })
      .select(FUND_REQUEST_DOCUMENT_SELECT)
      .single();

    if (!docInsert.error && docInsert.data) {
      return { document: docInsert.data as Record<string, unknown> };
    }

    await removeStoredFundRequestDocument(admin, storagePath);

    if (
      !docInsert.error ||
      !isFundRequestStorageUnavailableError(docInsert.error.message)
    ) {
      return {
        error: docInsert.error?.message ?? "Unable to save document",
        status: 500,
      };
    }
  }

  const legacyInsert = await admin
    .from("fund_request_documents")
    .insert({
      fund_request_id: params.fundRequestId,
      employee_id: params.employeeId,
      file_name: params.fileName,
      file_type: params.fileType,
      file_size: fileBytes.length,
      file_base64: params.fileBase64.includes(",")
        ? params.fileBase64.split(",")[1]!
        : params.fileBase64,
      document_type: params.documentType ?? "supporting",
      uploaded_by: params.uploadedBy ?? null,
    })
    .select(FUND_REQUEST_DOCUMENT_SELECT)
    .single();

  if (legacyInsert.error) {
    return { error: legacyInsert.error.message, status: 500 };
  }

  return { document: legacyInsert.data as Record<string, unknown> };
}

export async function createFundRequestDocumentSignedUrl(
  admin: SupabaseClient,
  storagePath: string
): Promise<string | null> {
  const { data, error } = await admin.storage
    .from(FUND_REQUEST_DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, FUND_REQUEST_DOCUMENT_SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

export async function deleteFundRequestDocumentFiles(
  admin: SupabaseClient,
  fundRequestIds: string[]
): Promise<void> {
  if (fundRequestIds.length === 0) return;

  const { data: documents, error } = await admin
    .from("fund_request_documents")
    .select("storage_path")
    .in("fund_request_id", fundRequestIds);

  if (error) throw error;

  const storagePaths = (documents ?? [])
    .map((row) => (row as { storage_path?: string | null }).storage_path)
    .filter((path): path is string => Boolean(path));

  if (storagePaths.length === 0) return;

  const { error: removeError } = await admin.storage
    .from(FUND_REQUEST_DOCUMENTS_BUCKET)
    .remove(storagePaths);

  if (removeError) throw removeError;
}
