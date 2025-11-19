'use client';

import { format } from 'date-fns';
import { formatCurrency } from '@/utils/format';

interface PayslipPrintProps {
  employee: {
    employee_id: string;
    full_name: string;
    rate_per_day: number;
    rate_per_hour: number;
  };
  weekStart: Date;
  weekEnd: Date;
  attendance: any;
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
    uniformPPE: number;
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

export function PayslipPrint({
  employee,
  weekStart,
  weekEnd,
  attendance,
  earnings,
  deductions,
  adjustment,
  netPay,
  workingDays,
  absentDays,
  preparedBy
}: PayslipPrintProps) {
  return (
    <div className="payslip-container bg-white text-black" style={{ width: '210mm', minHeight: '297mm', padding: '10mm', margin: '0 auto' }}>
      <style jsx>{`
        @media print {
          .payslip-container {
            width: 100%;
            padding: 0;
            margin: 0;
            page-break-after: always;
          }
          @page {
            size: A4;
            margin: 10mm;
          }
        }
        
        .payslip-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 5px;
          font-size: 11pt;
        }
        
        .payslip-table td,
        .payslip-table th {
          border: 2px solid #000;
          padding: 6px 8px;
          text-align: left;
        }
        
        .payslip-table th {
          background-color: #e5e7eb;
          font-weight: bold;
        }
        
        .text-right {
          text-align: right;
        }
        
        .text-center {
          text-align: center;
        }
        
        .font-bold {
          font-weight: bold;
        }
        
        .section-header {
          background-color: #e5e7eb;
          font-weight: bold;
          font-size: 12pt;
        }
      `}</style>

      {/* Company Header */}
      <div style={{ textAlign: 'center', marginBottom: '15px', borderBottom: '2px solid #000', paddingBottom: '10px' }}>
        <img 
          src="/Official Logo Cropped.jpg" 
          alt="Addbell Technical Services" 
          style={{ height: '60px', marginBottom: '5px' }}
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
        <div style={{ fontSize: '9pt', marginTop: '5px' }}>
          Blk 6 Lot 26, London St., Villa Olympia Phase 1-A, Brgy. Maharlika, San Pedro, Laguna, Philippines
          <br />
          Tel No.: (+632) 7117 6128 | E-mail Address: admin@addbell.com
        </div>
      </div>

      <table className="payslip-table">
        {/* Payroll Period */}
        <tr>
          <td colSpan={4} className="section-header">
            PAYROLL PERIOD OF: {format(weekStart, 'MMM. d')}-{format(weekEnd, 'd, yyyy')}
          </td>
        </tr>

        {/* Employee Name */}
        <tr>
          <td colSpan={4} className="section-header">
            NAME: {employee.full_name.toUpperCase()}
          </td>
        </tr>

        {/* Basic Salary & Working Days */}
        <tr>
          <td className="font-bold">BASIC SALARY:</td>
          <td className="text-right">{formatCurrency(employee.rate_per_day)}</td>
          <td className="font-bold">RATE/HOUR:</td>
          <td className="text-right">{employee.rate_per_hour.toFixed(2)}</td>
        </tr>
        <tr>
          <td className="font-bold">WORKING DAYS:</td>
          <td className="text-right">{workingDays}</td>
          <td className="font-bold">ABSENT:</td>
          <td className="text-right">{absentDays}</td>
        </tr>

        {/* EARNINGS Section */}
        <tr>
          <td colSpan={4} className="section-header">EARNINGS:</td>
        </tr>

        <tr>
          <td className="font-bold">REGULAR PAY:</td>
          <td className="text-right">{formatCurrency(earnings.regularPay)}</td>
          <td></td>
          <td></td>
        </tr>

        <tr>
          <td className="font-bold">REGULAR O. T:</td>
          <td className="text-right">{formatCurrency(earnings.regularOT)}</td>
          <td className="text-right">{earnings.regularOTHours.toFixed(2)}</td>
          <td>HRS</td>
        </tr>

        <tr>
          <td className="font-bold">NIGHT DIFF.:</td>
          <td className="text-right">{formatCurrency(earnings.nightDiff)}</td>
          <td className="text-right">{earnings.nightDiffHours.toFixed(2)}</td>
          <td>HRS</td>
        </tr>

        <tr>
          <td className="font-bold">SUNDAY/ R.D OT:</td>
          <td className="text-right">{formatCurrency(earnings.sundayRestDay)}</td>
          <td className="text-right">{earnings.sundayRestDayHours.toFixed(2)}</td>
          <td>HRS</td>
        </tr>

        <tr>
          <td className="font-bold">SPECIAL HOLIDAY:</td>
          <td className="text-right">{formatCurrency(earnings.specialHoliday)}</td>
          <td className="text-right">{earnings.specialHolidayHours.toFixed(2)}</td>
          <td className="text-right">{0.toFixed(2)}</td>
        </tr>

        <tr>
          <td className="font-bold">REGULAR HOLIDAY:</td>
          <td className="text-right">{formatCurrency(earnings.regularHoliday)}</td>
          <td className="text-right">{earnings.regularHolidayHours.toFixed(2)}</td>
          <td className="text-right">{0.toFixed(2)}</td>
        </tr>

        <tr>
          <td className="font-bold section-header">GROSS INCOME:</td>
          <td className="text-right font-bold">{formatCurrency(earnings.grossIncome)}</td>
          <td colSpan={2}></td>
        </tr>

        {/* DEDUCTIONS Section */}
        <tr>
          <td colSpan={4} className="section-header">DEDUCTIONS:</td>
        </tr>

        {deductions.vale > 0 && (
          <tr>
            <td className="font-bold">vale</td>
            <td className="text-right">{formatCurrency(deductions.vale)}</td>
            <td colSpan={2}></td>
          </tr>
        )}

        {deductions.uniformPPE > 0 && (
          <tr>
            <td className="font-bold">UNIFORM/PPE</td>
            <td className="text-right">{formatCurrency(deductions.uniformPPE)}</td>
            <td colSpan={2}></td>
          </tr>
        )}

        {deductions.pagibigLoan > 0 && (
          <tr>
            <td className="font-bold">PAG-IBIG LOAN</td>
            <td className="text-right">{formatCurrency(deductions.pagibigLoan)}</td>
            <td colSpan={2}></td>
          </tr>
        )}

        {deductions.sssLoan > 0 && (
          <tr>
            <td className="font-bold">SSS LOAN</td>
            <td className="text-right">{formatCurrency(deductions.sssLoan)}</td>
            <td colSpan={2}></td>
          </tr>
        )}

        {deductions.sssCalamityLoan > 0 && (
          <tr>
            <td className="font-bold">SSS CALAMITY LOAN</td>
            <td className="text-right">{formatCurrency(deductions.sssCalamityLoan)}</td>
            <td colSpan={2}></td>
          </tr>
        )}

        {deductions.pagibigCalamityLoan > 0 && (
          <tr>
            <td className="font-bold">PAG-IBIG CALAMITY LOAN</td>
            <td className="text-right">{formatCurrency(deductions.pagibigCalamityLoan)}</td>
            <td colSpan={2}></td>
          </tr>
        )}

        <tr>
          <td className="font-bold">SSS CONTRI.</td>
          <td className="text-right">{formatCurrency(deductions.sssContribution)}</td>
          <td colSpan={2}></td>
        </tr>

        <tr>
          <td className="font-bold">PHILHEALTH contri</td>
          <td className="text-right">{formatCurrency(deductions.philhealthContribution)}</td>
          <td colSpan={2}></td>
        </tr>

        <tr>
          <td className="font-bold">PAG-IBIG contri</td>
          <td className="text-right">{formatCurrency(deductions.pagibigContribution)}</td>
          <td colSpan={2}></td>
        </tr>

        <tr>
          <td className="font-bold section-header">TOTAL DEDUCTION:</td>
          <td className="text-right font-bold">{formatCurrency(deductions.totalDeductions)}</td>
          <td colSpan={2}></td>
        </tr>

        {/* ADJUSTMENT Section */}
        <tr>
          <td className="font-bold">ADJUSTMENT:</td>
          <td className="text-right">{formatCurrency(Math.abs(adjustment))}</td>
          <td colSpan={2}></td>
        </tr>

        {/* NET PAY Section */}
        <tr>
          <td className="font-bold section-header" style={{ fontSize: '14pt' }}>NET PAY:</td>
          <td className="text-right font-bold" style={{ fontSize: '14pt' }} colSpan={3}>
            {formatCurrency(netPay)}
          </td>
        </tr>

        {/* Signature Section */}
        <tr>
          <td colSpan={2} className="font-bold">RECEIVED BY/DATE:</td>
          <td colSpan={2} style={{ height: '40px' }}></td>
        </tr>

        <tr>
          <td colSpan={2} className="font-bold">PREPARED BY:</td>
          <td colSpan={2} className="text-center">{preparedBy.toUpperCase()}</td>
        </tr>
      </table>
    </div>
  );
}

