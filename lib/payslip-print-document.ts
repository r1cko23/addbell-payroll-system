/** Shared print/PDF document shell for #payslip-print-content (matches browser Print). */

const PAYSLIP_TABLE_CELL_STYLES = `
  .payslip-earnings-deductions-row {
    display: flex;
    gap: 10px;
    margin-bottom: 15px;
    align-items: flex-start;
  }
  .payslip-section-label {
    font-weight: bold;
    font-size: 9pt;
    line-height: 1.2;
    margin: 0;
    padding: 0 0 12px 0;
    display: block;
  }
  .payslip-section-label-right {
    text-align: right;
  }
  .payslip-earnings-table,
  .payslip-deductions-table {
    margin-top: 0;
  }
  .payslip-earnings-table td,
  .payslip-earnings-table th,
  .payslip-deductions-table td,
  .payslip-deductions-table th,
  .payslip-summary-table td,
  .payslip-summary-table th {
    vertical-align: middle !important;
    padding: 5px !important;
    line-height: 1.3 !important;
    box-sizing: border-box;
    min-height: 22px;
  }
  .payslip-cell-inner {
    display: flex;
    align-items: center;
    min-height: 20px;
    width: 100%;
    box-sizing: border-box;
  }
  .payslip-cell-inner-right {
    justify-content: flex-end;
  }
  .payslip-cell-inner-center {
    justify-content: center;
  }
  .payslip-earnings-table td:nth-child(2),
  .payslip-earnings-table th:nth-child(2) {
    text-align: center !important;
  }
  .payslip-earnings-table td:nth-child(3),
  .payslip-earnings-table th:nth-child(3) {
    text-align: right !important;
  }
  .payslip-deductions-table td:last-child,
  .payslip-deductions-table th:last-child {
    text-align: right !important;
  }
`;

export const PAYSLIP_PRINT_PAGE_STYLES = `
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  html, body {
    width: 100%;
    margin: 0;
    padding: 0;
    background: white;
    color: black;
    font-family: Arial, sans-serif;
  }
  .payslip-container {
    width: 8.5in;
    padding: 0.5in;
    margin: 0 auto;
    background: white;
    color: black;
    box-sizing: border-box;
  }
  ${PAYSLIP_TABLE_CELL_STYLES}
  @media print {
    @page {
      size: letter portrait;
      margin: 0.5in;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: white;
    }
    .payslip-container {
      margin: 0 auto;
      page-break-inside: avoid;
    }
  }
`;

/** Inline styles embedded in PayslipPrint for preview + print + PDF capture. */
export const PAYSLIP_PRINT_INLINE_STYLES = PAYSLIP_TABLE_CELL_STYLES;

export function buildPayslipPrintDocumentHtml(
  payslipHtml: string,
  title = "Payslip"
): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>${PAYSLIP_PRINT_PAGE_STYLES}</style>
  </head>
  <body>
    ${payslipHtml}
  </body>
</html>`;
}
