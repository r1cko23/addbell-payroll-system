"use client";

import React from "react";
import { format } from "date-fns";
import { formatCurrency } from "@/utils/format";

interface PayslipData {
  employee: {
    employee_id: string;
    full_name: string;
  };
  weekStart: Date;
  weekEnd: Date;
  earnings: {
    regularPay: number;
    regularOT: number;
    regularOTHours: number;
    nightDiff: number;
    nightDiffHours: number;
    sundayRestDay: number;
    sundayRestDayHours: number;
    specialHoliday: number;
    specialHolidayHours: number;
    regularHoliday: number;
    regularHolidayHours: number;
    grossIncome: number;
  };
  deductions: {
    vale: number;
    sssLoan: number;
    sssCalamityLoan: number;
    pagibigLoan: number;
    pagibigCalamityLoan: number;
    sssContribution: number;
    philhealthContribution: number;
    pagibigContribution: number;
    totalDeductions: number;
  };
  adjustment: number;
  netPay: number;
  workingDays: number;
  absentDays: number;
  preparedBy: string;
}

interface PayslipMultiPrintProps {
  payslips: PayslipData[];
}

export function PayslipMultiPrint({
  payslips,
}: PayslipMultiPrintProps): JSX.Element {
  // Styles for compact payslip (fits 4 on legal paper)
  const compactTableStyle = {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: "4.5pt",
    color: "#000",
  };

  const compactCellStyle = {
    border: "1px solid #000",
    padding: "1px 2px",
    textAlign: "left" as const,
  };

  const compactHeaderStyle = {
    ...compactCellStyle,
    backgroundColor: "#e5e7eb",
    fontWeight: "bold" as const,
    fontSize: "5pt",
  };

  const renderCompactPayslip = (data: PayslipData, index: number) => (
    <div
      key={index}
      className="compact-payslip"
      style={{
        width: "100%",
        height: "100%",
        padding: "0.1in",
        boxSizing: "border-box",
        pageBreakInside: "avoid",
        overflow: "hidden",
      }}
    >
      {/* Company Header - Compact */}
      <div
        style={{
          textAlign: "center",
          marginBottom: "3px",
          borderBottom: "1px solid #000",
          paddingBottom: "2px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <img
          src="/gp-logo.webp"
          alt="Green Pasture People Management Inc."
          style={{
            height: "36px",
            width: "auto",
            display: "block",
            margin: "0 auto",
            objectFit: "contain",
          }}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      </div>

      <table style={compactTableStyle}>
        <tbody>
          {/* Period & Employee */}
          <tr>
            <td colSpan={4} style={compactHeaderStyle}>
              PAYROLL: {format(data.weekStart, "MMM. d")}-
              {format(data.weekEnd, "d, yyyy")}
            </td>
          </tr>
          <tr>
            <td colSpan={4} style={compactHeaderStyle}>
              {data.employee.full_name.toUpperCase()}
            </td>
          </tr>

          {/* Basic Info - Rates Removed */}
          <tr>
            <td
              style={{
                ...compactCellStyle,
                fontWeight: "bold",
                fontSize: "6pt",
              }}
            >
              DAYS:
            </td>
            <td
              style={{
                ...compactCellStyle,
                textAlign: "right",
                fontSize: "6pt",
              }}
            >
              {data.workingDays}
            </td>
            <td
              style={{
                ...compactCellStyle,
                fontWeight: "bold",
                fontSize: "6pt",
              }}
            >
              ABSENT:
            </td>
            <td
              style={{
                ...compactCellStyle,
                textAlign: "right",
                fontSize: "6pt",
              }}
            >
              {data.absentDays}
            </td>
          </tr>

          {/* Earnings */}
          <tr>
            <td colSpan={4} style={compactHeaderStyle}>
              EARNINGS:
            </td>
          </tr>
          <tr>
            <td
              style={{
                ...compactCellStyle,
                fontWeight: "bold",
                fontSize: "6pt",
              }}
            >
              REG PAY:
            </td>
            <td
              style={{
                ...compactCellStyle,
                textAlign: "right",
                fontSize: "6pt",
              }}
            >
              {formatCurrency(data.earnings.regularPay)}
            </td>
            <td colSpan={2} style={compactCellStyle}></td>
          </tr>
          <tr>
            <td
              style={{
                ...compactCellStyle,
                fontWeight: "bold",
                fontSize: "6pt",
              }}
            >
              REG OT:
            </td>
            <td
              style={{
                ...compactCellStyle,
                textAlign: "right",
                fontSize: "6pt",
              }}
            >
              {formatCurrency(data.earnings.regularOT)}
            </td>
            <td
              style={{
                ...compactCellStyle,
                textAlign: "right",
                fontSize: "6pt",
              }}
            >
              {data.earnings.regularOTHours.toFixed(1)}
            </td>
            <td style={{ ...compactCellStyle, fontSize: "6pt" }}>HRS</td>
          </tr>
          <tr>
            <td
              style={{
                ...compactCellStyle,
                fontWeight: "bold",
                fontSize: "6pt",
              }}
            >
              NIGHT DIFF:
            </td>
            <td
              style={{
                ...compactCellStyle,
                textAlign: "right",
                fontSize: "6pt",
              }}
            >
              {formatCurrency(data.earnings.nightDiff)}
            </td>
            <td
              style={{
                ...compactCellStyle,
                textAlign: "right",
                fontSize: "6pt",
              }}
            >
              {data.earnings.nightDiffHours.toFixed(1)}
            </td>
            <td style={{ ...compactCellStyle, fontSize: "6pt" }}>HRS</td>
          </tr>
          <tr>
            <td
              style={{
                ...compactCellStyle,
                fontWeight: "bold",
                fontSize: "6pt",
              }}
            >
              SUN/RD OT:
            </td>
            <td
              style={{
                ...compactCellStyle,
                textAlign: "right",
                fontSize: "6pt",
              }}
            >
              {formatCurrency(data.earnings.sundayRestDay)}
            </td>
            <td
              style={{
                ...compactCellStyle,
                textAlign: "right",
                fontSize: "6pt",
              }}
            >
              {data.earnings.sundayRestDayHours.toFixed(1)}
            </td>
            <td style={{ ...compactCellStyle, fontSize: "6pt" }}>HRS</td>
          </tr>
          {data.earnings.specialHoliday > 0 && (
            <tr>
              <td
                style={{
                  ...compactCellStyle,
                  fontWeight: "bold",
                  fontSize: "6pt",
                }}
              >
                SP HOL:
              </td>
              <td
                style={{
                  ...compactCellStyle,
                  textAlign: "right",
                  fontSize: "6pt",
                }}
              >
                {formatCurrency(data.earnings.specialHoliday)}
              </td>
              <td
                style={{
                  ...compactCellStyle,
                  textAlign: "right",
                  fontSize: "6pt",
                }}
              >
                {data.earnings.specialHolidayHours.toFixed(1)}
              </td>
              <td style={{ ...compactCellStyle, fontSize: "6pt" }}>HRS</td>
            </tr>
          )}
          {data.earnings.regularHoliday > 0 && (
            <tr>
              <td
                style={{
                  ...compactCellStyle,
                  fontWeight: "bold",
                  fontSize: "6pt",
                }}
              >
                REG HOL:
              </td>
              <td
                style={{
                  ...compactCellStyle,
                  textAlign: "right",
                  fontSize: "6pt",
                }}
              >
                {formatCurrency(data.earnings.regularHoliday)}
              </td>
              <td
                style={{
                  ...compactCellStyle,
                  textAlign: "right",
                  fontSize: "6pt",
                }}
              >
                {data.earnings.regularHolidayHours.toFixed(1)}
              </td>
              <td style={{ ...compactCellStyle, fontSize: "6pt" }}>HRS</td>
            </tr>
          )}
          <tr>
            <td style={compactHeaderStyle}>GROSS:</td>
            <td style={{ ...compactHeaderStyle, textAlign: "right" }}>
              {formatCurrency(data.earnings.grossIncome)}
            </td>
            <td colSpan={2} style={compactCellStyle}></td>
          </tr>

          {/* Deductions */}
          <tr>
            <td colSpan={4} style={compactHeaderStyle}>
              DEDUCTIONS: ({format(data.weekStart, "MMM d")}-
              {format(data.weekEnd, "d")})
            </td>
          </tr>
          {data.deductions.vale > 0 && (
            <tr>
              <td
                style={{
                  ...compactCellStyle,
                  fontWeight: "bold",
                  fontSize: "6pt",
                }}
              >
                Vale:
              </td>
              <td
                style={{
                  ...compactCellStyle,
                  textAlign: "right",
                  fontSize: "6pt",
                }}
              >
                {formatCurrency(data.deductions.vale)}
              </td>
              <td colSpan={2} style={compactCellStyle}></td>
            </tr>
          )}
          {data.deductions.pagibigLoan > 0 && (
            <tr>
              <td
                style={{
                  ...compactCellStyle,
                  fontWeight: "bold",
                  fontSize: "6pt",
                }}
              >
                PAG-IBIG:
              </td>
              <td
                style={{
                  ...compactCellStyle,
                  textAlign: "right",
                  fontSize: "6pt",
                }}
              >
                {formatCurrency(data.deductions.pagibigLoan)}
              </td>
              <td colSpan={2} style={compactCellStyle}></td>
            </tr>
          )}
          {data.deductions.sssLoan > 0 && (
            <tr>
              <td
                style={{
                  ...compactCellStyle,
                  fontWeight: "bold",
                  fontSize: "6pt",
                }}
              >
                SSS Loan:
              </td>
              <td
                style={{
                  ...compactCellStyle,
                  textAlign: "right",
                  fontSize: "6pt",
                }}
              >
                {formatCurrency(data.deductions.sssLoan)}
              </td>
              <td colSpan={2} style={compactCellStyle}></td>
            </tr>
          )}
          <tr>
            <td
              style={{
                ...compactCellStyle,
                fontWeight: "bold",
                fontSize: "6pt",
              }}
            >
              SSS:
            </td>
            <td
              style={{
                ...compactCellStyle,
                textAlign: "right",
                fontSize: "6pt",
              }}
            >
              {formatCurrency(data.deductions.sssContribution)}
            </td>
            <td colSpan={2} style={compactCellStyle}></td>
          </tr>
          <tr>
            <td
              style={{
                ...compactCellStyle,
                fontWeight: "bold",
                fontSize: "6pt",
              }}
            >
              PhilHealth:
            </td>
            <td
              style={{
                ...compactCellStyle,
                textAlign: "right",
                fontSize: "6pt",
              }}
            >
              {formatCurrency(data.deductions.philhealthContribution)}
            </td>
            <td colSpan={2} style={compactCellStyle}></td>
          </tr>
          <tr>
            <td
              style={{
                ...compactCellStyle,
                fontWeight: "bold",
                fontSize: "6pt",
              }}
            >
              Pag-IBIG:
            </td>
            <td
              style={{
                ...compactCellStyle,
                textAlign: "right",
                fontSize: "6pt",
              }}
            >
              {formatCurrency(data.deductions.pagibigContribution)}
            </td>
            <td colSpan={2} style={compactCellStyle}></td>
          </tr>
          <tr>
            <td style={compactHeaderStyle}>TOTAL DED:</td>
            <td style={{ ...compactHeaderStyle, textAlign: "right" }}>
              {formatCurrency(data.deductions.totalDeductions)}
            </td>
            <td colSpan={2} style={compactCellStyle}></td>
          </tr>

          {/* Net Pay */}
          <tr>
            <td style={{ ...compactHeaderStyle, fontSize: "8pt" }}>NET PAY:</td>
            <td
              style={{
                ...compactHeaderStyle,
                textAlign: "right",
                fontSize: "8pt",
              }}
              colSpan={3}
            >
              {formatCurrency(data.netPay)}
            </td>
          </tr>

          {/* Signature */}
          <tr>
            <td
              colSpan={2}
              style={{
                ...compactCellStyle,
                fontWeight: "bold",
                fontSize: "5pt",
              }}
            >
              RECEIVED BY/DATE:
            </td>
            <td
              colSpan={2}
              style={{ ...compactCellStyle, height: "15px", fontSize: "5pt" }}
            ></td>
          </tr>
          <tr>
            <td
              colSpan={2}
              style={{
                ...compactCellStyle,
                fontWeight: "bold",
                fontSize: "5pt",
              }}
            >
              CREATED BY:
            </td>
            <td
              colSpan={2}
              style={{
                ...compactCellStyle,
                textAlign: "center",
                fontSize: "5pt",
              }}
            >
              {data.preparedBy.toUpperCase()}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  // Group payslips into pages of 4
  const pages = [];
  for (let i = 0; i < payslips.length; i += 4) {
    pages.push(payslips.slice(i, i + 4));
  }

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: legal;
            margin: 0.2in;
          }
          body {
            margin: 0;
            padding: 0;
          }
          .legal-page {
            margin: 0 !important;
            padding: 0.2in !important;
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            grid-template-rows: repeat(2, 1fr) !important;
            gap: 0.15in !important;
            width: 8.5in !important;
            height: 14in !important;
          }
          .compact-payslip {
            width: 100% !important;
            height: 100% !important;
            box-sizing: border-box !important;
          }
        }
      `}</style>
      <div className="multi-payslip-print">
        {pages.map((pagePayslips, pageIndex) => (
          <div
            key={pageIndex}
            className="legal-page"
            style={{
              width: "8.5in",
              height: "14in",
              margin: "0 auto",
              padding: "0.2in",
              backgroundColor: "#fff",
              position: "relative",
              pageBreakAfter: pageIndex < pages.length - 1 ? "always" : "auto",
              boxSizing: "border-box",
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gridTemplateRows: "repeat(2, 1fr)",
              gap: "0.15in",
            }}
          >
            {pagePayslips.map((payslip, index) =>
              renderCompactPayslip(payslip, index)
            )}
          </div>
        ))}
      </div>
    </>
  );
}