/**
 * Normalize text for Purchase Order print/PDF output:
 * - Capitalization (proper title case)
 * - Trim and collapse whitespace
 * - Common spelling corrections
 */

import type {
  PurchaseOrder,
  PurchaseOrderVendor,
  PurchaseOrderCompany,
  PurchaseOrderLineItem,
} from "@/types/purchase-order";

/** Words that stay all-caps in output (acronyms - e.g. TIN, PO) */
const PRESERVE_UPPER = new Set([
  "tin", "po", "php", "ph",
  "rm", "blk", "lot", "brgy", "st", "ave", "bldg",
]);

/** Common spelling corrections (lowercase key -> correct form) */
const SPELLING: Record<string, string> = {
  "reciept": "receipt",
  "accomodate": "accommodate",
  "recieve": "receive",
  "seperate": "separate",
  "occured": "occurred",
  "supllier": "supplier",
  "suplier": "supplier",
  "requisitioner": "requisitioner",
  "consumables": "consumables",
  "architechtural": "architectural",
  "architectual": "architectural",
};

function trimAndCollapse(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function fixSpelling(word: string): string {
  const lower = word.toLowerCase();
  return SPELLING[lower] || word;
}

/**
 * Convert to proper title case, preserving acronyms.
 * "JOHN DOE" -> "John Doe"
 * "ADD-BELL TECHNICAL SERVICES, INC." -> "Add-Bell Technical Services, Inc."
 */
export function toTitleCase(input: string): string {
  if (!input || typeof input !== "string") return input;
  const trimmed = trimAndCollapse(input);
  if (!trimmed) return input;

  return trimmed
    .split(/\s+/)
    .map((word) => {
      const clean = word.replace(/[.,;:!?()]/g, "");
      const lower = clean.toLowerCase();
      if (PRESERVE_UPPER.has(lower) || PRESERVE_UPPER.has(lower.replace(".", ""))) {
        return word; // Keep as-is (e.g. INC., TIN)
      }
      const corrected = fixSpelling(word);
      // Handle hyphenated: "ADD-BELL" -> "Add-Bell"
      if (corrected.includes("-")) {
        return corrected
          .split("-")
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
          .join("-");
      }
      const c = corrected.charAt(0).toUpperCase();
      const rest = corrected.slice(1).toLowerCase();
      return c + rest;
    })
    .join(" ");
}

/**
 * Normalize multi-line text (e.g. addresses, descriptions).
 * Each line gets title case; extra blank lines collapsed.
 */
export function normalizeMultiline(input: string): string {
  if (!input || typeof input !== "string") return input;
  return input
    .split(/\r?\n/)
    .map((line) => toTitleCase(line))
    .filter((line) => line.length > 0)
    .join("\n");
}

/**
 * Normalize a single line of text.
 */
export function normalizeText(input: string): string {
  if (!input || typeof input !== "string") return input;
  return toTitleCase(input);
}

function normalizeVendor(v: PurchaseOrderVendor): PurchaseOrderVendor {
  return {
    name: normalizeText(v.name),
    tin: trimAndCollapse(v.tin),
    address: normalizeMultiline(v.address),
    phone: trimAndCollapse(v.phone),
    email: trimAndCollapse(v.email),
  };
}

function normalizeCompany(c: PurchaseOrderCompany): PurchaseOrderCompany {
  return {
    name: normalizeText(c.name),
    tin: trimAndCollapse(c.tin),
    address: normalizeMultiline(c.address),
    phone: trimAndCollapse(c.phone),
    email: trimAndCollapse(c.email),
  };
}

function normalizeLineItem(item: PurchaseOrderLineItem): PurchaseOrderLineItem {
  return {
    ...item,
    description: normalizeMultiline(item.description),
    qty: trimAndCollapse(item.qty),
  };
}

/**
 * Returns a normalized copy of the PO data for print/PDF output.
 * Fixes capitalization, extra spaces, and common spelling.
 */
export function normalizePOData(data: PurchaseOrder): PurchaseOrder {
  return {
    ...data,
    poNumber: trimAndCollapse(data.poNumber),
    date: trimAndCollapse(data.date),
    vendor: normalizeVendor(data.vendor),
    requisitioner: normalizeText(data.requisitioner),
    company: normalizeCompany(data.company),
    projectTitle: normalizeText(data.projectTitle),
    deliverTo: normalizeText(data.deliverTo),
    items: data.items.map(normalizeLineItem),
    paymentTerms: data.paymentTerms.map((t) => toTitleCase(trimAndCollapse(t))),
    requestedBy: normalizeText(data.requestedBy || data.requisitioner),
    preparedBy: normalizeText(data.preparedBy),
    reviewedBy: normalizeText(data.reviewedBy || ""),
    approvedBy: normalizeText(data.approvedBy),
    approvedByTitle: normalizeText(data.approvedByTitle),
  };
}
