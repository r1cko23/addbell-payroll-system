/** Default Save as PDF name: PO number and vendor. */

const UNSAFE_FILE_CHARS = /[/\\:*?"<>|\r\n\t]+/g;

function sanitizeFileNamePart(value: string): string {
  return value
    .replace(UNSAFE_FILE_CHARS, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
}

export function purchaseOrderPrintFileName(input: {
  poNumber: string;
  vendorName: string;
}): string {
  const poNumber = sanitizeFileNamePart(input.poNumber) || "DRAFT";
  const vendorName = sanitizeFileNamePart(input.vendorName);
  return vendorName ? `${poNumber} - ${vendorName}` : poNumber;
}

export function purchaseOrderPrintHtmlTitle(input: {
  poNumber: string;
  vendorName: string;
}): string {
  return purchaseOrderPrintFileName(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
