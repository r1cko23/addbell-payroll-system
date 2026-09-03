/**
 * Normalize client / cost PO numbers for matching against po_masterlist_jobs.
 * Collapses spaces, strips PO/RSC-PO style prefixes, then non-alphanumerics,
 * then known letter wrappers (TCP) when followed by digits.
 */
export function normalizePoNumberKey(raw: string | null | undefined): string {
  let value = (raw || "").trim().toUpperCase();
  if (!value) return "";

  value = value.replace(/\s+/g, "");
  // RSC-PO… / PO#… / PO-…
  value = value.replace(/^(RSC-?)?PO[#\-]*/i, "");
  value = value.replace(/[^A-Z0-9]/g, "");
  // Known wrappers only (do not strip RE / PHL style client prefixes)
  value = value.replace(/^(TCP|RSC)(?=\d)/, "");
  return value;
}

/** Digits-only core with leading zeros removed — catches PO000010311 vs PO0000010311. */
export function poNumberDigitCore(raw: string | null | undefined): string {
  return normalizePoNumberKey(raw)
    .replace(/\D/g, "")
    .replace(/^0+/, "");
}

export type PurchaseOrderMasterlistLinkStatus = "linked" | "needs_review";

export function isStrongPoNumberKey(key: string): boolean {
  return key.length >= 5;
}

export function isStrongPoNumberDigitCore(core: string): boolean {
  return core.length >= 5;
}

export function masterlistLinkLabel(
  status: PurchaseOrderMasterlistLinkStatus | null | undefined
): string {
  if (status === "linked") return "Masterlist linked";
  if (status === "needs_review") return "Needs purchasing update";
  return "Unreviewed";
}
