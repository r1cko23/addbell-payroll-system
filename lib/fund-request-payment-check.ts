import {
  MAX_REQUEST_DOCUMENT_SIZE,
  resolveRequestDocumentMimeType,
} from "@/lib/request-supporting-document";
import {
  compressImageForUpload,
  isCompressibleImageFile,
} from "@/lib/compress-image-for-upload";
import { uploadFundRequestDocumentFile } from "@/lib/fund-request-document-upload-client";
import type { FundRequestDocumentSummary, FundRequestRow } from "@/types/fund-request";
import { normalizeUserRole } from "@/lib/user-roles";

export const ALLOWED_PAYMENT_CHECK_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const ALLOWED_PAYMENT_CHECK_EXTENSIONS = [
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
] as const;

export function resolvePaymentCheckMimeType(file: File): string {
  if (file.type) return file.type;
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return resolveRequestDocumentMimeType(file);
}

export function isAllowedPaymentCheckFile(file: File): boolean {
  const mime = resolvePaymentCheckMimeType(file);
  const typeOk = (ALLOWED_PAYMENT_CHECK_MIME_TYPES as readonly string[]).includes(mime);
  const extOk = ALLOWED_PAYMENT_CHECK_EXTENSIONS.some((ext) =>
    file.name.toLowerCase().endsWith(ext)
  );
  return typeOk || extOk;
}

export function canUploadFundRequestPaymentCheck(
  role: string | null | undefined,
  status: FundRequestRow["status"] | null | undefined
): boolean {
  const normalizedRole = normalizeUserRole(role);
  if (normalizedRole !== "upper_management" && normalizedRole !== "admin") {
    return false;
  }
  return status === "purchasing_officer_approved" || status === "management_approved";
}

export function isFundRequestPaymentCheckDocument(
  document: Pick<FundRequestDocumentSummary, "document_type">
): boolean {
  return document.document_type === "payment_check";
}

export async function preparePaymentCheckFile(file: File): Promise<File> {
  if (!isAllowedPaymentCheckFile(file) || !isCompressibleImageFile(file)) {
    return file;
  }

  try {
    return await compressImageForUpload(file, {
      maxDimension: 1800,
      maxSizeKB: 400,
    });
  } catch {
    return file;
  }
}

export async function uploadFundRequestPaymentCheck(
  requestId: string,
  file: File
): Promise<{ document?: FundRequestDocumentSummary; error?: string }> {
  const preparedFile = await preparePaymentCheckFile(file);
  return uploadFundRequestDocumentFile(preparedFile, {
    requestId,
    documentType: "payment_check",
  });
}

export function validatePaymentCheckFile(file: File | null): string | null {
  if (!file) return null;
  if (!isAllowedPaymentCheckFile(file)) {
    return "Only PDF or image files (JPG, PNG, WEBP) are allowed for payment checks.";
  }
  if (file.size > MAX_REQUEST_DOCUMENT_SIZE) {
    return "File too large. Max size is 5MB.";
  }
  return null;
}
