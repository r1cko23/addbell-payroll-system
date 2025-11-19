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
  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: '5px',
    fontSize: '11pt',
    color: '#000',
  };

  const cellStyle: React.CSSProperties = {
    border: '2px solid #000',
    padding: '6px 8px',
    textAlign: 'left',
  };

  const sectionHeaderStyle: React.CSSProperties = {
    ...cellStyle,
    backgroundColor: '#e5e7eb',
    fontWeight: 'bold',
    fontSize: '12pt',
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          .payslip-container {
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            page-break-after: always;
          }
          @page {
            size: A4;
            margin: 10mm;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}} />
      <div className="payslip-container bg-white text-black" style={{ width: '210mm', minHeight: '297mm', padding: '10mm', margin: '0 auto', color: '#000' }}>

      {/* Company Header */}
      <div style={{ textAlign: 'center', marginBottom: '15px', borderBottom: '2px solid #000', paddingBottom: '10px' }}>
        <img 
          src="/Payslip_logo.png" 
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

      <table style={tableStyle}>
        <tbody>
        {/* Payroll Period */}
        <tr>
          <td colSpan={4} style={sectionHeaderStyle}>
            PAYROLL PERIOD OF: {format(weekStart, 'MMM. d')}-{format(weekEnd, 'd, yyyy')}
          </td>
        </tr>

        {/* Employee Name */}
        <tr>
          <td colSpan={4} style={sectionHeaderStyle}>
            NAME: {employee.full_name.toUpperCase()}
          </td>
        </tr>

        {/* Basic Salary & Working Days */}
        <tr>
          <td style={{...cellStyle, fontWeight: 'bold'}}>BASIC SALARY:</td>
          <td style={{...cellStyle, textAlign: 'right'}}>{formatCurrency(employee.rate_per_day)}</td>
          <td style={{...cellStyle, fontWeight: 'bold'}}>RATE/HOUR:</td>
          <td style={{...cellStyle, textAlign: 'right'}}>{employee.rate_per_hour.toFixed(2)}</td>
        </tr>
        <tr>
          <td style={{...cellStyle, fontWeight: 'bold'}}>WORKING DAYS:</td>
          <td style={{...cellStyle, textAlign: 'right'}}>{workingDays}</td>
          <td style={{...cellStyle, fontWeight: 'bold'}}>ABSENT:</td>
          <td style={{...cellStyle, textAlign: 'right'}}>{absentDays}</td>
        </tr>

        {/* EARNINGS Section */}
        <tr>
          <td colSpan={4} style={sectionHeaderStyle}>EARNINGS:</td>
        </tr>

        <tr>
          <td style={{...cellStyle, fontWeight: 'bold'}}>REGULAR PAY:</td>
          <td style={{...cellStyle, textAlign: 'right'}}>{formatCurrency(earnings.regularPay)}</td>
          <td style={cellStyle}></td>
          <td style={cellStyle}></td>
        </tr>

        <tr>
          <td style={{...cellStyle, fontWeight: 'bold'}}>REGULAR O. T:</td>
          <td style={{...cellStyle, textAlign: 'right'}}>{formatCurrency(earnings.regularOT)}</td>
          <td style={{...cellStyle, textAlign: 'right'}}>{earnings.regularOTHours.toFixed(2)}</td>
          <td style={cellStyle}>HRS</td>
        </tr>

        <tr>
          <td style={{...cellStyle, fontWeight: 'bold'}}>NIGHT DIFF.:</td>
          <td style={{...cellStyle, textAlign: 'right'}}>{formatCurrency(earnings.nightDiff)}</td>
          <td style={{...cellStyle, textAlign: 'right'}}>{earnings.nightDiffHours.toFixed(2)}</td>
          <td style={cellStyle}>HRS</td>
        </tr>

        <tr>
          <td style={{...cellStyle, fontWeight: 'bold'}}>SUNDAY/ R.D OT:</td>
          <td style={{...cellStyle, textAlign: 'right'}}>{formatCurrency(earnings.sundayRestDay)}</td>
          <td style={{...cellStyle, textAlign: 'right'}}>{earnings.sundayRestDayHours.toFixed(2)}</td>
          <td style={cellStyle}>HRS</td>
        </tr>

        <tr>
          <td style={{...cellStyle, fontWeight: 'bold'}}>SPECIAL HOLIDAY:</td>
          <td style={{...cellStyle, textAlign: 'right'}}>{formatCurrency(earnings.specialHoliday)}</td>
          <td style={{...cellStyle, textAlign: 'right'}}>{earnings.specialHolidayHours.toFixed(2)}</td>
          <td style={{...cellStyle, textAlign: 'right'}}>{0.toFixed(2)}</td>
        </tr>

        <tr>
          <td style={{...cellStyle, fontWeight: 'bold'}}>REGULAR HOLIDAY:</td>
          <td style={{...cellStyle, textAlign: 'right'}}>{formatCurrency(earnings.regularHoliday)}</td>
          <td style={{...cellStyle, textAlign: 'right'}}>{earnings.regularHolidayHours.toFixed(2)}</td>
          <td style={{...cellStyle, textAlign: 'right'}}>{0.toFixed(2)}</td>
        </tr>

        <tr>
          <td style={sectionHeaderStyle}>GROSS INCOME:</td>
          <td style={{...sectionHeaderStyle, textAlign: 'right'}}>{formatCurrency(earnings.grossIncome)}</td>
          <td colSpan={2} style={cellStyle}></td>
        </tr>

        {/* DEDUCTIONS Section */}
        <tr>
          <td colSpan={4} style={sectionHeaderStyle}>DEDUCTIONS:</td>
        </tr>

        {deductions.vale > 0 && (
          <tr>
            <td style={{...cellStyle, fontWeight: 'bold'}}>vale</td>
            <td style={{...cellStyle, textAlign: 'right'}}>{formatCurrency(deductions.vale)}</td>
            <td colSpan={2} style={cellStyle}></td>
          </tr>
        )}

        {deductions.uniformPPE > 0 && (
          <tr>
            <td style={{...cellStyle, fontWeight: 'bold'}}>UNIFORM/PPE</td>
            <td style={{...cellStyle, textAlign: 'right'}}>{formatCurrency(deductions.uniformPPE)}</td>
            <td colSpan={2} style={cellStyle}></td>
          </tr>
        )}

        {deductions.pagibigLoan > 0 && (
          <tr>
            <td style={{...cellStyle, fontWeight: 'bold'}}>PAG-IBIG LOAN</td>
            <td style={{...cellStyle, textAlign: 'right'}}>{formatCurrency(deductions.pagibigLoan)}</td>
            <td colSpan={2} style={cellStyle}></td>
          </tr>
        )}

        {deductions.sssLoan > 0 && (
          <tr>
            <td style={{...cellStyle, fontWeight: 'bold'}}>SSS LOAN</td>
            <td style={{...cellStyle, textAlign: 'right'}}>{formatCurrency(deductions.sssLoan)}</td>
            <td colSpan={2} style={cellStyle}></td>
          </tr>
        )}

        {deductions.sssCalamityLoan > 0 && (
          <tr>
            <td style={{...cellStyle, fontWeight: 'bold'}}>SSS CALAMITY LOAN</td>
            <td style={{...cellStyle, textAlign: 'right'}}>{formatCurrency(deductions.sssCalamityLoan)}</td>
            <td colSpan={2} style={cellStyle}></td>
          </tr>
        )}

        {deductions.pagibigCalamityLoan > 0 && (
          <tr>
            <td style={{...cellStyle, fontWeight: 'bold'}}>PAG-IBIG CALAMITY LOAN</td>
            <td style={{...cellStyle, textAlign: 'right'}}>{formatCurrency(deductions.pagibigCalamityLoan)}</td>
            <td colSpan={2} style={cellStyle}></td>
          </tr>
        )}

        <tr>
          <td style={{...cellStyle, fontWeight: 'bold'}}>SSS CONTRI.</td>
          <td style={{...cellStyle, textAlign: 'right'}}>{formatCurrency(deductions.sssContribution)}</td>
          <td colSpan={2} style={cellStyle}></td>
        </tr>

        <tr>
          <td style={{...cellStyle, fontWeight: 'bold'}}>PHILHEALTH contri</td>
          <td style={{...cellStyle, textAlign: 'right'}}>{formatCurrency(deductions.philhealthContribution)}</td>
          <td colSpan={2} style={cellStyle}></td>
        </tr>

        <tr>
          <td style={{...cellStyle, fontWeight: 'bold'}}>PAG-IBIG contri</td>
          <td style={{...cellStyle, textAlign: 'right'}}>{formatCurrency(deductions.pagibigContribution)}</td>
          <td colSpan={2} style={cellStyle}></td>
        </tr>

        <tr>
          <td style={sectionHeaderStyle}>TOTAL DEDUCTION:</td>
          <td style={{...sectionHeaderStyle, textAlign: 'right'}}>{formatCurrency(deductions.totalDeductions)}</td>
          <td colSpan={2} style={cellStyle}></td>
        </tr>

        {/* ADJUSTMENT Section */}
        <tr>
          <td style={{...cellStyle, fontWeight: 'bold'}}>ADJUSTMENT:</td>
          <td style={{...cellStyle, textAlign: 'right'}}>{formatCurrency(Math.abs(adjustment))}</td>
          <td colSpan={2} style={cellStyle}></td>
        </tr>

        {/* NET PAY Section */}
        <tr>
          <td style={{...sectionHeaderStyle, fontSize: '14pt'}}>NET PAY:</td>
          <td style={{...sectionHeaderStyle, textAlign: 'right', fontSize: '14pt'}} colSpan={3}>
            {formatCurrency(netPay)}
          </td>
        </tr>

        {/* Signature Section */}
        <tr>
          <td colSpan={2} style={{...cellStyle, fontWeight: 'bold'}}>RECEIVED BY/DATE:</td>
          <td colSpan={2} style={{...cellStyle, height: '40px'}}></td>
        </tr>

        <tr>
          <td colSpan={2} style={{...cellStyle, fontWeight: 'bold'}}>PREPARED BY:</td>
          <td colSpan={2} style={{...cellStyle, textAlign: 'center'}}>{preparedBy.toUpperCase()}</td>
        </tr>
        </tbody>
      </table>
    </div>
    </>
  );
}

