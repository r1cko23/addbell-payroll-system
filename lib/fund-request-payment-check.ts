import {
  fileToBase64,
  MAX_REQUEST_DOCUMENT_SIZE,
  resolveRequestDocumentMimeType,
} from "@/lib/request-supporting-document";
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

export async function uploadFundRequestPaymentCheck(
  requestId: string,
  file: File
): Promise<{ document?: FundRequestDocumentSummary; error?: string }> {
  const response = await fetch("/api/fund-requests/payment-checks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      request_id: requestId,
      document: {
        file_name: file.name,
        file_type: resolvePaymentCheckMimeType(file),
        file_size: file.size,
        file_base64: await fileToBase64(file),
      },
    }),
  });

  const result = (await response.json()) as {
    error?: string;
    document?: FundRequestDocumentSummary;
  };

  if (!response.ok) {
    return { error: result.error ?? "Unable to upload payment check" };
  }
  if (!result.document) {
    return { error: "Unable to upload payment check" };
  }

  return { document: result.document };
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
