import {
  MAX_REQUEST_DOCUMENT_SIZE,
  resolveRequestDocumentMimeType,
} from "@/lib/request-supporting-document";
import {
  compressImageForUpload,
  isCompressibleImageFile,
} from "@/lib/compress-image-for-upload";
import { getFundRequestCutoffStartYmd } from "@/lib/fund-request-cutoff";
import { getFundRequestPayeeAccountName } from "@/lib/fund-request-inbox-grouping";
import { uploadFundRequestDocumentFile } from "@/lib/fund-request-document-upload-client";
import type { FundRequestDocumentSummary, FundRequestRow } from "@/types/fund-request";
import { normalizeUserRole } from "@/lib/user-roles";

export const FUND_REQUEST_PAYMENT_CHECK_PEER_STATUSES = [
  "purchasing_officer_approved",
  "management_approved",
] as const;

export type FundRequestPaymentCheckPeerRow = Pick<
  FundRequestRow,
  "id" | "supplier_bank_details" | "status" | "created_at" | "request_date"
>;

export function isFundRequestPaymentCheckPeerStatus(
  status: string | null | undefined
): boolean {
  return (FUND_REQUEST_PAYMENT_CHECK_PEER_STATUSES as readonly string[]).includes(
    status ?? ""
  );
}

export function hasSameFundRequestPayeeAccountName(
  a: FundRequestPaymentCheckPeerRow,
  b: FundRequestPaymentCheckPeerRow
): boolean {
  const accountNameA = getFundRequestPayeeAccountName(a);
  const accountNameB = getFundRequestPayeeAccountName(b);
  if (!accountNameA || !accountNameB) return false;
  return (
    accountNameA.localeCompare(accountNameB, undefined, { sensitivity: "base" }) === 0
  );
}

export function hasSameFundRequestCutoff(
  a: FundRequestPaymentCheckPeerRow,
  b: FundRequestPaymentCheckPeerRow
): boolean {
  const cutoffA = getFundRequestCutoffStartYmd(a as FundRequestRow);
  const cutoffB = getFundRequestCutoffStartYmd(b as FundRequestRow);
  if (!cutoffA || !cutoffB) return false;
  return cutoffA === cutoffB;
}

/** Same payee and cutoff; eligible for sharing one payment check. */
export function isFundRequestPaymentCheckPeer(
  source: FundRequestPaymentCheckPeerRow,
  candidate: FundRequestPaymentCheckPeerRow
): boolean {
  if (source.id === candidate.id) return true;
  if (!isFundRequestPaymentCheckPeerStatus(candidate.status)) return false;
  if (!hasSameFundRequestPayeeAccountName(source, candidate)) return false;
  return hasSameFundRequestCutoff(source, candidate);
}

export function getFundRequestPaymentCheckPeerIds(
  source: FundRequestPaymentCheckPeerRow,
  candidates: FundRequestPaymentCheckPeerRow[]
): string[] {
  const payeeAccountName = getFundRequestPayeeAccountName(source);
  if (!payeeAccountName || !isFundRequestPaymentCheckPeerStatus(source.status)) {
    return [source.id];
  }
  if (!getFundRequestCutoffStartYmd(source as FundRequestRow)) {
    return [source.id];
  }

  const peerIds = candidates
    .filter((candidate) => isFundRequestPaymentCheckPeer(source, candidate))
    .map((candidate) => candidate.id);

  return peerIds.length > 0 ? peerIds : [source.id];
}

export type FundRequestPaymentCheckUploadResult = {
  documents: FundRequestDocumentSummary[];
  error?: string;
};

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

export function dedupeFundRequestPaymentCheckDocuments(
  documents: FundRequestDocumentSummary[]
): FundRequestDocumentSummary[] {
  const seen = new Set<string>();
  const deduped: FundRequestDocumentSummary[] = [];

  for (const document of documents.filter(isFundRequestPaymentCheckDocument)) {
    const key =
      document.storage_path?.trim() ||
      `${document.file_name ?? ""}:${document.created_at ?? ""}:${document.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(document);
  }

  return deduped;
}

export async function deleteFundRequestPaymentCheck(
  documentId: string
): Promise<{ error?: string }> {
  const response = await fetch(`/api/fund-requests/documents/${documentId}`, {
    method: "DELETE",
  });
  const payload = (await response.json()) as { error?: string };
  if (!response.ok) {
    return { error: payload.error ?? "Unable to delete payment check" };
  }
  return {};
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
  file: File,
  options?: { linkedRequestIds?: string[] }
): Promise<FundRequestPaymentCheckUploadResult> {
  const preparedFile = await preparePaymentCheckFile(file);
  const linkedRequestIds = (options?.linkedRequestIds ?? []).filter(
    (id) => id && id !== requestId
  );
  const result = await uploadFundRequestDocumentFile(preparedFile, {
    requestId,
    documentType: "payment_check",
    linkedRequestIds: linkedRequestIds.length > 0 ? linkedRequestIds : undefined,
  });

  if (result.error || !result.document) {
    return { documents: [], error: result.error ?? "Unable to upload payment check" };
  }

  return {
    documents: [result.document, ...(result.linkedDocuments ?? [])],
  };
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
