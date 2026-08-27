const PO_HEADER_CANDIDATES = [
  "P.O. NO.",
  "P.O. NO",
  "PO Number",
  "P.O. Number",
  "PO No",
  "PO#",
  "Client PO",
];

const CLIENT_HEADER_CANDIDATES = [
  "CLIENT",
  "CLIENT NAME",
  "Customer",
  "Customer Name",
];

const REJECTED_CLIENT_NAMES = new Set([
  "",
  "client",
  "client name",
  "yes",
  "no",
  "y",
  "n",
  "remarks",
  "skipped invoice",
  "n/a",
  "na",
  "-",
  "—",
]);

const CODE_STOP_WORDS = new Set([
  "INC",
  "LLC",
  "CORP",
  "CORPORATION",
  "CO",
  "COMPANY",
  "THE",
  "AND",
  "OF",
  "PHILIPPINES",
  "PHIL",
]);

export type BillingSheetClientPoRow = {
  poNumber: string;
  clientName: string;
};

export function normalizeBillingHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeBillingPoNumber(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, " ");
}

export function normalizeClientNameKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Stronger identity for deduping near-matches (punctuation/spacing differences). */
export function normalizeClientIdentityKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function findHeaderIndex(headers: string[], candidates: string[]): number {
  const normalized = headers.map(normalizeBillingHeader);
  for (const candidate of candidates) {
    const index = normalized.indexOf(normalizeBillingHeader(candidate));
    if (index >= 0) return index;
  }
  return -1;
}

export function findBillingClientPoHeader(
  rows: string[][],
  maxScan = 12
): { headerRowIndex: number; poIndex: number; clientIndex: number } | null {
  const limit = Math.min(rows.length, maxScan);
  for (let rowIndex = 0; rowIndex < limit; rowIndex += 1) {
    const headers = (rows[rowIndex] ?? []).map((cell) => String(cell ?? ""));
    const poIndex = findHeaderIndex(headers, PO_HEADER_CANDIDATES);
    const clientIndex = findHeaderIndex(headers, CLIENT_HEADER_CANDIDATES);
    if (poIndex >= 0 && clientIndex >= 0 && poIndex !== clientIndex) {
      return { headerRowIndex: rowIndex, poIndex, clientIndex };
    }
  }
  return null;
}

export function isRejectedBillingClientName(value: string): boolean {
  const key = normalizeClientNameKey(value);
  if (REJECTED_CLIENT_NAMES.has(key)) return true;
  if (key.length < 3) return true;
  return false;
}

export function displayClientName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function splitClientBusinessUnit(name: string): {
  name: string;
  businessUnit: string | null;
} {
  const trimmed = displayClientName(name);
  const parts = trimmed.split(/\s*\/\s*/).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return { name: trimmed, businessUnit: null };
  return {
    name: trimmed,
    businessUnit: parts.slice(1).join(" / "),
  };
}

export function deriveClientCode(name: string, used: Set<string>): string {
  const words = name
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word && !CODE_STOP_WORDS.has(word.toUpperCase()));
  let base =
    words.length === 0
      ? "CL"
      : words.length === 1
        ? words[0].slice(0, 6).toUpperCase()
        : words
            .map((word) => word[0])
            .join("")
            .slice(0, 8)
            .toUpperCase();
  if (!base) base = "CL";
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let suffix = 2;
  while (used.has(`${base}${suffix}`)) suffix += 1;
  const code = `${base}${suffix}`;
  used.add(code);
  return code;
}

export function parseBillingSheetClientRows(rows: string[][]): BillingSheetClientPoRow[] {
  const header = findBillingClientPoHeader(rows);
  if (!header) return [];

  const parsed: BillingSheetClientPoRow[] = [];
  for (let rowIndex = header.headerRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const clientName = displayClientName(String(row[header.clientIndex] ?? ""));
    const poNumber = normalizeBillingPoNumber(String(row[header.poIndex] ?? ""));
    if (!poNumber || poNumber === "N/A") continue;
    if (isRejectedBillingClientName(clientName)) continue;
    parsed.push({ poNumber, clientName });
  }
  return parsed;
}

export function preferredClientNameByPo(
  rows: BillingSheetClientPoRow[]
): Map<string, string> {
  const counts = new Map<string, Map<string, { count: number; display: string }>>();
  for (const row of rows) {
    const po = row.poNumber;
    const key = normalizeClientNameKey(row.clientName);
    const byClient = counts.get(po) ?? new Map();
    const current = byClient.get(key) ?? { count: 0, display: row.clientName };
    current.count += 1;
    byClient.set(key, current);
    counts.set(po, byClient);
  }

  const preferred = new Map<string, string>();
  for (const [po, byClient] of counts) {
    let best: { count: number; display: string; key: string } | null = null;
    for (const [key, value] of byClient) {
      if (
        !best ||
        value.count > best.count ||
        (value.count === best.count && key.localeCompare(best.key) < 0)
      ) {
        best = { count: value.count, display: value.display, key };
      }
    }
    if (best) preferred.set(po, best.display);
  }
  return preferred;
}

export function uniqueClientNames(rows: BillingSheetClientPoRow[]): string[] {
  const byKey = new Map<string, string>();
  for (const row of rows) {
    const key = normalizeClientNameKey(row.clientName);
    if (!byKey.has(key)) byKey.set(key, displayClientName(row.clientName));
  }
  return [...byKey.values()].sort((left, right) => left.localeCompare(right));
}
