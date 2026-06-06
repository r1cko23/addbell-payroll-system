/** Shared print/PDF document shell for #payslip-print-content (matches browser Print). */

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
  .payslip-earnings-table td,
  .payslip-earnings-table th,
  .payslip-deductions-table td,
  .payslip-deductions-table th,
  .payslip-summary-table td,
  .payslip-summary-table th {
    vertical-align: middle !important;
    line-height: 1.35;
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
export const PAYSLIP_PRINT_INLINE_STYLES = `
  .payslip-earnings-table td,
  .payslip-earnings-table th,
  .payslip-deductions-table td,
  .payslip-deductions-table th,
  .payslip-summary-table td,
  .payslip-summary-table th {
    vertical-align: middle !important;
    line-height: 1.35;
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
