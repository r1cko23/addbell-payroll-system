import type { PoMasterlistEditableColumn } from "@/lib/po-masterlist-column-acl";

export type PoMasterlistCellPatch = {
  field: PoMasterlistEditableColumn;
  value: unknown;
};

function parseAmount(text: string): number | null {
  const cleaned = text.replace(/[₱,]/g, "").trim();
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function normalizeText(text: string): string | null {
  const next = text.replace(/^\s+|\s+$/g, "");
  return next === "" ? null : next;
}

function currentAsText(current: unknown): string {
  return current == null ? "" : String(current);
}

/** Build a PATCH body for one in-cell save, or null when nothing changed. */
export function buildPoMasterlistCellPatch(
  field: PoMasterlistEditableColumn,
  nextText: string,
  current: unknown
): PoMasterlistCellPatch | null {
  if (field === "po_amount") {
    const trimmed = nextText.trim();
    const currentValue =
      current == null || current === ""
        ? null
        : typeof current === "number"
          ? current
          : parseAmount(String(current));
    if (trimmed === "") {
      if (currentValue == null) return null;
      return { field, value: null };
    }
    const nextValue = parseAmount(nextText);
    if (nextValue == null) return null;
    if (nextValue === currentValue) return null;
    return { field, value: nextValue };
  }

  const nextValue = normalizeText(nextText);
  const currentValue = normalizeText(currentAsText(current));
  if (nextValue === currentValue) return null;
  return { field, value: nextValue };
}

/** Value shown in the in-cell editor (ISO dates, plain amount, raw text). */
export function editorSeedValue(
  field: PoMasterlistEditableColumn,
  current: unknown
): string {
  if (current == null || current === "") return "";
  if (field === "po_amount" && typeof current === "number") return String(current);
  return String(current);
}
