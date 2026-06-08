/** Shared print/PDF document shell for #payslip-print-content (matches browser Print). */

const PAYSLIP_TABLE_CELL_STYLES = `
  .payslip-earnings-deductions-row {
    display: flex;
    gap: 10px;
    margin-bottom: 8px;
    align-items: flex-start;
  }
  .payslip-section-label {
    font-weight: bold;
    font-size: 9pt;
    line-height: 1.2;
    margin: 0;
    padding: 0 0 10px 0;
    display: block;
  }
  .payslip-other-pay-section {
    margin-top: 4px;
  }
  .payslip-section-label-right {
    text-align: right;
  }
  .payslip-earnings-table,
  .payslip-deductions-table,
  .payslip-other-pay-table {
    margin-top: 0;
  }
  .payslip-earnings-table td,
  .payslip-earnings-table th,
  .payslip-other-pay-table td,
  .payslip-other-pay-table th,
  .payslip-deductions-table td,
  .payslip-deductions-table th,
  .payslip-summary-table td,
  .payslip-summary-table th {
    vertical-align: middle !important;
    padding: 3px 4px !important;
    line-height: 1.2 !important;
    box-sizing: border-box;
    min-height: 18px;
  }
  .payslip-cell-inner {
    display: flex;
    align-items: center;
    min-height: 18px;
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
  .payslip-earnings-table th:nth-child(2),
  .payslip-other-pay-table td:nth-child(2),
  .payslip-other-pay-table th:nth-child(2) {
    text-align: center !important;
  }
  .payslip-earnings-table td:nth-child(3),
  .payslip-earnings-table th:nth-child(3),
  .payslip-other-pay-table td:nth-child(3),
  .payslip-other-pay-table th:nth-child(3) {
    text-align: right !important;
  }
  .payslip-deductions-table td:last-child,
  .payslip-deductions-table th:last-child {
    text-align: right !important;
  }
  .payslip-summary-label {
    font-weight: bold;
    margin: 0 0 4px 0;
    line-height: 1.35;
  }
  .payslip-summary-label-spaced {
    margin-top: 6px;
    padding-top: 2px;
  }
  .payslip-summary-amount {
    text-align: right;
    margin: 0 0 6px 0;
    padding: 2px 0 6px 0;
    border-bottom: 1px solid #000;
    line-height: 1.4;
  }
  .payslip-summary-deduction-total {
    text-align: right;
    margin: 0 0 6px 0;
    padding: 4px 0 6px 0;
    font-weight: bold;
    border-top: 1px solid #000;
    border-bottom: 1px solid #000;
    line-height: 1.4;
  }
  .payslip-summary-adjustment {
    text-align: right;
    margin: 0 0 8px 0;
    padding: 2px 0 4px 0;
    font-weight: bold;
    line-height: 1.4;
  }
  .payslip-summary-adjustment-note {
    font-weight: normal;
    font-size: 8pt;
    color: #374151;
    margin-top: 4px;
    line-height: 1.35;
  }
  .payslip-summary-total-amount {
    text-align: right;
    margin: 0 0 4px 0;
    padding: 5px 0 7px 0;
    font-weight: bold;
    border-top: 2px solid #000;
    border-bottom: 2px solid #000;
    line-height: 1.4;
  }
  .payslip-summary-net-amount {
    font-size: 10pt;
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
