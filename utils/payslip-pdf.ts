import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency } from "@/utils/format";
import {
  getAttendanceDataFromEarningsBreakdown,
  type PayslipRowForDisplay,
  type EmployeeProfileForPayslip,
} from "@/lib/payslip-display";

export type PayslipPdfInput = {
  payslip: PayslipRowForDisplay & {
    payslip_number?: string;
    id?: string;
  };
  profile: EmployeeProfileForPayslip;
  companyName?: string;
};

function money(value: number): string {
  return formatCurrency(Number(value || 0));
}

export function generatePayslipPdfBytes(input: PayslipPdfInput): ArrayBuffer {
  const companyName = input.companyName || "Add-bell Technical Services, Inc.";
  const doc = new jsPDF("portrait", "mm", "letter");
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 16;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(companyName, pageWidth / 2, y, { align: "center" });
  y += 7;
  doc.setFontSize(12);
  doc.text("Payslip", pageWidth / 2, y, { align: "center" });
  y += 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Employee: ${input.profile.full_name}`, 14, y);
  y += 5;
  doc.text(`ID: ${input.profile.employee_id}`, 14, y);
  y += 5;
  if (input.profile.position) {
    doc.text(`Position: ${input.profile.position}`, 14, y);
    y += 5;
  }
  doc.text(
    `Period: ${input.payslip.period_start} – ${input.payslip.period_end}`,
    14,
    y
  );
  y += 5;
  const slipNo =
    input.payslip.payslip_number || input.payslip.id?.slice(0, 8) || "—";
  doc.text(`Payslip #: ${slipNo}`, 14, y);
  y += 8;

  const attendance = getAttendanceDataFromEarningsBreakdown(
    input.payslip.earnings_breakdown
  );

  if (attendance.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Date", "Day Type", "Regular Hrs", "OT Hrs", "ND Hrs"]],
      body: attendance.map((day: any) => [
        String(day.date || "—"),
        String(day.dayType || "regular"),
        String(Number(day.regularHours || 0).toFixed(2)),
        String(Number(day.overtimeHours || 0).toFixed(2)),
        String(Number(day.nightDiffHours || 0).toFixed(2)),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 64, 120] },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  const ded = input.payslip.deductions_breakdown || {};
  const deductionRows: [string, string][] = [
    ["SSS", money(Number(input.payslip.sss_amount || ded.sss || 0))],
    ["PhilHealth", money(Number(input.payslip.philhealth_amount || ded.philhealth || 0))],
    ["Pag-IBIG", money(Number(input.payslip.pagibig_amount || ded.pagibig || 0))],
    [
      "Withholding Tax",
      money(Number(input.payslip.withholding_tax || ded.withholding_tax || ded.tax || 0)),
    ],
  ];

  autoTable(doc, {
    startY: y,
    head: [["Summary", "Amount"]],
    body: [
      ["Gross Pay", money(input.payslip.gross_pay)],
      ...deductionRows,
      ["Total Deductions", money(input.payslip.total_deductions)],
      ["Net Pay", money(input.payslip.net_pay)],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 64, 120] },
    margin: { left: 14, right: 14 },
  });

  return doc.output("arraybuffer") as ArrayBuffer;
}
