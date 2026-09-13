export type PoMasterlistInvoiceLine = {
  raw: string;
  invoiceNumber: string | null;
  percent: number | null;
  status: string | null;
};

const INVOICE_LINE =
  /^(\S+?)(?:\s*\((\d+(?:\.\d+)?)%\))?(?:\s*[-–]\s*(.+))?$/;

function parseOneInvoiceLine(raw: string): PoMasterlistInvoiceLine {
  const trimmed = raw.trim();
  const match = INVOICE_LINE.exec(trimmed);
  if (!match) {
    return { raw: trimmed, invoiceNumber: null, percent: null, status: null };
  }

  const invoiceNumber = match[1]?.trim() || null;
  const percentRaw = match[2];
  const status = match[3]?.trim() || null;
  const percent =
    percentRaw != null && percentRaw !== "" ? Number(percentRaw) : null;

  if (!invoiceNumber || /^\(.*\)$/.test(invoiceNumber)) {
    return { raw: trimmed, invoiceNumber: null, percent: null, status: null };
  }

  return {
    raw: trimmed,
    invoiceNumber,
    percent: Number.isFinite(percent) ? percent : null,
    status,
  };
}

/** Split the sheet INVOICE NO. cell into progress-billing lines. */
export function parsePoMasterlistInvoiceNumbers(
  value: string | null | undefined
): PoMasterlistInvoiceLine[] {
  if (!value) return [];
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseOneInvoiceLine);
}

/** Reconstruct the sheet cell from parsed lines (lossless via `raw`). */
export function serializePoMasterlistInvoiceNumbers(
  lines: PoMasterlistInvoiceLine[]
): string {
  return lines.map((line) => line.raw).join("\n");
}

export function formatPoMasterlistInvoiceChip(
  line: PoMasterlistInvoiceLine
): string {
  if (!line.invoiceNumber) return line.raw;
  const parts = [`#${line.invoiceNumber}`];
  if (line.percent != null) parts.push(`${line.percent}%`);
  if (line.status) parts.push(line.status);
  return parts.join(" · ");
}

/** Compact cell label — status is shown by chip color, not extra text. */
export function formatPoMasterlistInvoiceGlance(
  line: PoMasterlistInvoiceLine
): string {
  if (!line.invoiceNumber) return line.raw;
  if (line.percent != null) return `#${line.invoiceNumber} · ${line.percent}%`;
  return `#${line.invoiceNumber}`;
}
