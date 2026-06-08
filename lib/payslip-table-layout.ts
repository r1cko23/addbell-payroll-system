/** Shared table layout fixes for payslip preview, print, and PDF capture. */

const PAYSLIP_TABLE_CELL_SELECTOR =
  ".payslip-earnings-table td, .payslip-earnings-table th, .payslip-deductions-table td, .payslip-deductions-table th";

function getCellFlexAlign(cell: HTMLTableCellElement): string {
  const inlineAlign = cell.style.textAlign;
  if (inlineAlign === "right" || inlineAlign === "center") {
    return inlineAlign;
  }
  if (cell.tagName === "TH") return "center";
  const colIndex = cell.cellIndex;
  const row = cell.parentElement as HTMLTableRowElement | null;
  const colCount = row?.cells.length ?? 1;
  if (colIndex === colCount - 1 && colCount > 1) return "right";
  return "left";
}

/** Centers cell content; html2canvas ignores table vertical-align without flex wrappers. */
export function applyPayslipTableLayoutFixes(root: ParentNode) {
  root.querySelectorAll(PAYSLIP_TABLE_CELL_SELECTOR).forEach((el) => {
    const cell = el as HTMLTableCellElement;
    cell.style.verticalAlign = "middle";
    cell.style.padding = "0";
    cell.style.lineHeight = "1.3";
    cell.style.boxSizing = "border-box";
    cell.style.minHeight = "22px";

    if (cell.querySelector(":scope > .payslip-cell-inner")) return;

    const inner = cell.ownerDocument.createElement("div");
    inner.className = "payslip-cell-inner";
    inner.style.display = "flex";
    inner.style.alignItems = "center";
    inner.style.minHeight = "22px";
    inner.style.width = "100%";
    inner.style.padding = "5px";
    inner.style.boxSizing = "border-box";

    const align = getCellFlexAlign(cell);
    if (align === "right") {
      inner.style.justifyContent = "flex-end";
    } else if (align === "center") {
      inner.style.justifyContent = "center";
    }

    while (cell.firstChild) {
      inner.appendChild(cell.firstChild);
    }
    cell.appendChild(inner);
  });

  root.querySelectorAll(".payslip-section-label").forEach((el) => {
    const label = el as HTMLElement;
    label.style.display = "block";
    label.style.margin = "0";
    label.style.padding = "0 0 12px 0";
    label.style.lineHeight = "1.2";
  });
}
