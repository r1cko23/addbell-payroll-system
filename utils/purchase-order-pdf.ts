/**
 * Generate Purchase Order as PDF - Addbell branded format
 */

import jsPDF from "jspdf";
import { formatCurrency } from "./format";
import type { PurchaseOrder } from "@/types/purchase-order";

const MARGIN = 15;
const PAGE_WIDTH = 210;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

/** Addbell brand colors (RGB for jsPDF) */
const COLORS = {
  blue: [30, 64, 175] as [number, number, number],
  blueLight: [59, 130, 246] as [number, number, number],
  sepia: [139, 99, 84] as [number, number, number],
  dark: [30, 41, 59] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
};

export async function generatePurchaseOrderPDF(
  data: PurchaseOrder
): Promise<jsPDF> {
  const doc = new jsPDF("p", "mm", "a4");
  let yPos = MARGIN;

  const addSpace = (mm: number) => {
    yPos += mm;
  };

  const checkPageBreak = (needed: number) => {
    if (yPos + needed > 277) {
      doc.addPage();
      yPos = MARGIN;
    }
  };

  // Header: Logo left, blue accent line
  try {
    const logoResponse = await fetch("/addbell-po-logo.png");
    if (logoResponse.ok) {
      const logoBlob = await logoResponse.blob();
      const logoDataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(logoBlob);
      });
      doc.addImage(logoDataUrl, "PNG", MARGIN, yPos, 80, 16);
    }
  } catch {
    // Continue without logo
  }

  doc.setDrawColor(...COLORS.blue);
  doc.setLineWidth(1.5);
  doc.line(MARGIN, yPos + 20, PAGE_WIDTH - MARGIN, yPos + 20);
  addSpace(6);

  // Title right - blue
  doc.setTextColor(...COLORS.blue);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("PURCHASE ORDER", PAGE_WIDTH - MARGIN, yPos + 8, { align: "right" });
  doc.setTextColor(...COLORS.muted);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(
    "Please provide this PO number on all invoices and delivery receipts.",
    PAGE_WIDTH - MARGIN,
    yPos + 14,
    { align: "right" }
  );

  yPos += 26;

  // PO Number & Date - accent bar (light blue fill)
  doc.setFillColor(219, 234, 254); // blueMuted
  doc.rect(MARGIN, yPos, CONTENT_WIDTH, 14, "F");
  doc.setDrawColor(...COLORS.blue);
  doc.setLineWidth(0.8);
  doc.line(MARGIN, yPos, MARGIN, yPos + 14);
  doc.setTextColor(...COLORS.blue);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("PO No.", MARGIN + 3, yPos + 6);
  doc.text("Date", MARGIN + 55, yPos + 6);
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(data.poNumber, MARGIN + 3, yPos + 12);
  doc.text(data.date, MARGIN + 55, yPos + 12);
  yPos += 18;

  // Vendor | Buyer boxes - wrap long addresses to stay inside box
  const colWidth = (CONTENT_WIDTH - 10) / 2;
  const addrMaxWidth = colWidth - 8;
  const lineH = 4;
  const wrapAddr = (s: string) => doc.splitTextToSize(s || "", addrMaxWidth);

  const vendorAddrLines = wrapAddr(data.vendor.address);
  const companyAddrLines = wrapAddr(data.company.address);
  const maxAddrLines = Math.max(vendorAddrLines.length, companyAddrLines.length, 1);
  const boxHeight = Math.max(48, 20 + maxAddrLines * lineH);

  doc.setDrawColor(...COLORS.sepia);
  doc.setLineWidth(0.3);
  doc.setFillColor(245, 240, 237);
  doc.roundedRect(MARGIN, yPos, colWidth, boxHeight, 2, 2, "FD");

  doc.setDrawColor(...COLORS.blue);
  doc.setFillColor(219, 234, 254);
  doc.roundedRect(MARGIN + colWidth + 10, yPos, colWidth, boxHeight, 2, 2, "FD");

  doc.setTextColor(...COLORS.sepia);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("VENDOR / SUPPLIER", MARGIN + 4, yPos + 7);
  doc.setTextColor(...COLORS.blue);
  doc.text("BUYER / COMPANY", MARGIN + colWidth + 14, yPos + 7);

  let vy = yPos + 13;
  doc.setTextColor(...COLORS.dark);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(data.vendor.name, MARGIN + 4, vy);
  vy += 5;
  doc.setFontSize(8);
  doc.text(`TIN: ${data.vendor.tin}`, MARGIN + 4, vy);
  vy += lineH;
  vendorAddrLines.forEach((line: string) => {
    doc.text(line, MARGIN + 4, vy);
    vy += lineH;
  });
  doc.text(`Tel: ${data.vendor.phone}`, MARGIN + 4, vy);
  vy += lineH;
  doc.text(`Email: ${data.vendor.email}`, MARGIN + 4, vy);
  vy += lineH;
  doc.text(`Requisitioner: ${data.requisitioner}`, MARGIN + 4, vy);

  vy = yPos + 13;
  doc.setFontSize(10);
  doc.text(data.company.name, MARGIN + colWidth + 14, vy);
  vy += 5;
  doc.setFontSize(8);
  doc.text(`TIN: ${data.company.tin}`, MARGIN + colWidth + 14, vy);
  vy += lineH;
  companyAddrLines.forEach((line: string) => {
    doc.text(line, MARGIN + colWidth + 14, vy);
    vy += lineH;
  });
  doc.text(`Tel: ${data.company.phone}`, MARGIN + colWidth + 14, vy);
  vy += lineH;
  doc.text(`Email: ${data.company.email}`, MARGIN + colWidth + 14, vy);

  yPos += boxHeight + 12;

  // Project & Deliver To
  doc.setTextColor(...COLORS.blue);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("PROJECT TITLE", MARGIN, yPos);
  doc.text("SHIP / DELIVER TO", MARGIN + colWidth + 10, yPos);
  doc.setTextColor(...COLORS.dark);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(data.projectTitle, MARGIN, yPos + 7);
  doc.text(data.deliverTo, MARGIN + colWidth + 10, yPos + 7);
  addSpace(14);

  // Line items table - blue header
  const col1 = 10;
  const col2 = 95;
  const col3 = 22;
  const col4 = 28;
  const col5 = 25;

  doc.setFillColor(...COLORS.blue);
  doc.rect(MARGIN, yPos, CONTENT_WIDTH, 9, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("#", MARGIN + col1 / 2, yPos + 6, { align: "center" });
  doc.text("Description", MARGIN + col1 + col2 / 2, yPos + 6, { align: "center" });
  doc.text("Qty", MARGIN + col1 + col2 + col3 / 2, yPos + 6, { align: "center" });
  doc.text("Unit Price", MARGIN + col1 + col2 + col3 + col4 / 2, yPos + 6, {
    align: "center",
  });
  doc.text("Total Amount", MARGIN + col1 + col2 + col3 + col4 + col5 / 2, yPos + 6, {
    align: "center",
  });
  doc.setTextColor(...COLORS.dark);
  yPos += 9;

  doc.setFont("helvetica", "normal");
  data.items.forEach((item, idx) => {
    checkPageBreak(12);
    if (idx % 2 === 1) doc.setFillColor(248, 250, 252);
    else doc.setFillColor(255, 255, 255);
    doc.rect(MARGIN, yPos, CONTENT_WIDTH, 10, "F");
    doc.setDrawColor(226, 232, 240);
    doc.rect(MARGIN, yPos, CONTENT_WIDTH, 10, "S");
    doc.text(String(item.itemNo), MARGIN + col1 / 2, yPos + 7, { align: "center" });
    doc.text(item.description, MARGIN + col1 + 2, yPos + 7, { maxWidth: col2 - 4 });
    doc.text(item.qty, MARGIN + col1 + col2 + col3 / 2, yPos + 7, {
      align: "center",
    });
    doc.text(
      formatCurrency(item.unitPrice),
      MARGIN + col1 + col2 + col3 + col4 - 2,
      yPos + 7,
      { align: "right" }
    );
    doc.setFont("helvetica", "bold");
    doc.text(
      formatCurrency(item.totalAmount),
      MARGIN + CONTENT_WIDTH - 2,
      yPos + 7,
      { align: "right" }
    );
    doc.setFont("helvetica", "normal");
    yPos += 10;
  });

  addSpace(10);

  const grandTotal = data.items.reduce((s, i) => s + i.totalAmount, 0);

  // Conforme & Total box
  checkPageBreak(35);
  doc.setTextColor(...COLORS.sepia);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("CONFORME (VENDOR ACCEPTANCE)", MARGIN, yPos);
  doc.setDrawColor(...COLORS.dark);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, yPos + 9, MARGIN + 55, yPos + 9);
  doc.setTextColor(...COLORS.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Signature over Printed Name", MARGIN, yPos + 15);

  doc.setFillColor(219, 234, 254);
  doc.setDrawColor(...COLORS.blue);
  doc.roundedRect(PAGE_WIDTH - MARGIN - 65, yPos - 2, 65, 22, 2, 2, "FD");
  doc.setTextColor(...COLORS.blue);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("APPROXIMATE TOTAL", PAGE_WIDTH - MARGIN - 32, yPos + 5, {
    align: "center",
  });
  doc.setFontSize(14);
  doc.text(formatCurrency(grandTotal), PAGE_WIDTH - MARGIN - 32, yPos + 14, {
    align: "center",
  });
  addSpace(22);

  // Payment Terms - sepia box (dynamic height)
  const paymentTermsHeight = 12 + data.paymentTerms.length * 5;
  checkPageBreak(paymentTermsHeight + 4);
  doc.setFillColor(245, 240, 237);
  doc.setDrawColor(...COLORS.sepia);
  doc.roundedRect(MARGIN, yPos, CONTENT_WIDTH, paymentTermsHeight, 2, 2, "FD");
  doc.setTextColor(...COLORS.sepia);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("PAYMENT TERMS", MARGIN + 4, yPos + 6);
  doc.setTextColor(...COLORS.dark);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  data.paymentTerms.forEach((term, i) => {
    doc.text(`• ${term}`, MARGIN + 6, yPos + 12 + i * 5);
  });
  yPos += paymentTermsHeight + 6;

  // Signatures - blue top border
  checkPageBreak(25);
  doc.setDrawColor(...COLORS.blue);
  doc.setLineWidth(0.8);
  doc.line(MARGIN, yPos, PAGE_WIDTH - MARGIN, yPos);
  addSpace(10);
  doc.setTextColor(...COLORS.blue);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("PREPARED BY", MARGIN, yPos);
  doc.text("APPROVED BY", PAGE_WIDTH - MARGIN - 55, yPos);
  doc.setTextColor(...COLORS.dark);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(data.preparedBy, MARGIN, yPos + 7);
  doc.setTextColor(...COLORS.muted);
  doc.setFontSize(8);
  doc.text("Purchasing", MARGIN, yPos + 11);
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(11);
  doc.text(data.approvedBy, PAGE_WIDTH - MARGIN - 55, yPos + 7);
  doc.setTextColor(...COLORS.muted);
  doc.setFontSize(8);
  doc.text(data.approvedByTitle, PAGE_WIDTH - MARGIN - 55, yPos + 11);

  return doc;
}
