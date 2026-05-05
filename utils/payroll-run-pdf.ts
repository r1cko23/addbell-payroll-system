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
  // Use A2 landscape so columns/rows aren't cramped.
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a2" });
  const M = 10;
  const PAGE_W = 594;
  const PAGE_H = 420;
  const CONTENT_W = PAGE_W - M * 2;
  const CONTENT_H = PAGE_H - M * 2;

  const totalWch = params.columns.reduce((s, c) => s + (c.wch || 8), 0) || 1;
  const colWidths = params.columns.map((c) => ((c.wch || 8) / totalWch) * CONTENT_W);

  const earningsSet = new Set(params.colorGroups.earningsCols);
  const deductionsSet = new Set(params.colorGroups.deductionCols);
  const netSet = new Set(params.colorGroups.netCols);

  let y = M;

  const drawTitle = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(params.title || "ADD-BELL TECHNICAL SERVICES INC.", PAGE_W / 2, y, { align: "center" });
    y += 7;
    doc.setFontSize(11);
    doc.text(params.subtitle || "", PAGE_W / 2, y, { align: "center" });
    y += 6;
  };

  const drawRow = (row: any[], fontSize: number, isHeader: boolean) => {
    doc.setFont("helvetica", isHeader ? "bold" : "normal");
    doc.setFontSize(fontSize);
    const rowH = isHeader ? 9 : 7;

    if (y + rowH > PAGE_H - M) {
      doc.addPage();
      y = M;
      drawTitle();
      // repeat the last two header rows for readability
      drawRow(params.headerRows[2] || [], 7, true);
      drawRow(params.headerRows[3] || [], 7, true);
    }

    let x = M;
    for (let c = 0; c < params.columns.length; c++) {
      const w = colWidths[c];
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

  drawTitle();
  // Use the same Excel header rows 3-4 (index 2-3)
  drawRow(params.headerRows[2] || [], 7, true);
  drawRow(params.headerRows[3] || [], 7, true);

  for (const r of params.dataRows) {
    drawRow(r, 7, false);
  }

  return doc;
}

