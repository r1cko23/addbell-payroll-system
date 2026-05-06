import jsPDF from "jspdf";

function safeNumber(n: unknown) {
  const x = Number(n ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function fmtCell(v: unknown) {
  if (v == null) return "";
  if (typeof v === "number") {
    // treat as money if it looks like a currency cell (2dp) else plain
    return v.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return String(v);
}

export function generatePayrollRunTemplatePDF(params: {
  title: string;
  subtitle: string;
  columns: Array<{ wch: number }>;
  headerRows: any[][];
  dataRows: any[][];
  colorGroups: {
    earningsCols: number[];
    deductionCols: number[];
    netCols: number[];
  };
}) {
  // Use A3 landscape and split wide tables across pages for readability.
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
  const M = 8;
  const PAGE_W = doc.internal.pageSize.getWidth();
  const PAGE_H = doc.internal.pageSize.getHeight();
  const CONTENT_W = PAGE_W - M * 2;

  const earningsSet = new Set(params.colorGroups.earningsCols);
  const deductionsSet = new Set(params.colorGroups.deductionCols);
  const netSet = new Set(params.colorGroups.netCols);

  let y = M;

  const drawTitle = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(params.title || "ADD-BELL TECHNICAL SERVICES INC.", PAGE_W / 2, y, { align: "center" });
    y += 7;
    doc.setFontSize(10);
    doc.text(params.subtitle || "", PAGE_W / 2, y, { align: "center" });
    y += 6;
  };

  const buildColWidths = (colIdxs: number[]) => {
    const totalWch =
      colIdxs.reduce((s, idx) => s + (params.columns[idx]?.wch || 8), 0) || 1;
    return colIdxs.map((idx) => ((params.columns[idx]?.wch || 8) / totalWch) * CONTENT_W);
  };

  const drawRow = (
    row: any[],
    fontSize: number,
    isHeader: boolean,
    colIdxs: number[],
    colWidths: number[]
  ) => {
    doc.setFont("helvetica", isHeader ? "bold" : "normal");
    doc.setFontSize(fontSize);
    const rowH = isHeader ? 9 : 7;

    if (y + rowH > PAGE_H - M) {
      doc.addPage();
      y = M;
      drawTitle();
      // repeat the last two header rows for readability
      drawRow(params.headerRows[2] || [], 7, true, colIdxs, colWidths);
      drawRow(params.headerRows[3] || [], 7, true, colIdxs, colWidths);
    }

    let x = M;
    for (let i = 0; i < colIdxs.length; i++) {
      const c = colIdxs[i];
      const w = colWidths[i];
      if (isHeader) {
        if (earningsSet.has(c)) doc.setFillColor(234, 246, 234);
        else if (deductionsSet.has(c)) doc.setFillColor(255, 234, 234);
        else if (netSet.has(c)) doc.setFillColor(234, 241, 255);
        else doc.setFillColor(245, 245, 245);
        doc.rect(x, y, w, rowH, "F");
      }
      doc.setDrawColor(210, 210, 210);
      doc.rect(x, y, w, rowH, "S");

      const text = fmtCell(row?.[c]);
      if (text) {
        const pad = 1.2;
        const alignRight = typeof row?.[c] === "number";
        doc.text(
          text.length > 60 && isHeader ? text.slice(0, 60) : text,
          alignRight ? x + w - pad : x + pad,
          y + rowH - 2,
          { align: alignRight ? "right" : "left", maxWidth: w - pad * 2 }
        );
      }

      x += w;
    }

    y += rowH;
  };

  // Split into two pages:
  // 1) left + earnings/OT/ND columns
  // 2) identification + gross/deductions/net columns
  const allIdxs = params.columns.map((_, i) => i);
  const leftToNdIdxs = allIdxs.filter((i) => i <= 18);
  const idAndMoneyIdxs = [0, 1, 2, 3, ...allIdxs.filter((i) => i >= 20)];

  const chunks = [
    { colIdxs: leftToNdIdxs, font: 8 },
    { colIdxs: idAndMoneyIdxs, font: 8 },
  ];

  chunks.forEach((chunk, chunkIdx) => {
    if (chunkIdx > 0) doc.addPage();
    y = M;
    const colWidths = buildColWidths(chunk.colIdxs);
    drawTitle();
    drawRow(params.headerRows[2] || [], 7, true, chunk.colIdxs, colWidths);
    drawRow(params.headerRows[3] || [], 7, true, chunk.colIdxs, colWidths);
    for (const r of params.dataRows) {
      drawRow(r, chunk.font, false, chunk.colIdxs, colWidths);
    }
  });

  return doc;
}

