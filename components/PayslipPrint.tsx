'use client';

import { format } from 'date-fns';
import { formatCurrency } from '@/utils/format';

interface PayslipPrintProps {
  employee: {
    employee_id: string;
    full_name: string;
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

export function PayslipPrint(props: PayslipPrintProps) {
  const { employee, weekStart, weekEnd, earnings, deductions, netPay, workingDays, preparedBy } = props;
  
  return (
    <div className="payslip-container" style={{ 
      width: '3.6in',
      height: '6.3in',
      padding: '0.08in', 
      margin: '0.05in', 
      backgroundColor: '#fff', 
      color: '#000',
      boxSizing: 'border-box',
      pageBreakInside: 'avoid'
    }}>
      {/* Company Header */}
      <div style={{ textAlign: 'center', marginBottom: '2px', borderBottom: '1px solid #000', paddingBottom: '1px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <img 
          src="/gp-logo.webp" 
          alt="Green Pasture People Management Inc." 
          style={{ height: '22px', display: 'block', margin: '0 auto' }}
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      </div>

      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        marginTop: '1px',
        fontSize: '4.8pt',
        color: '#000',
      }}>
        <tbody>
        {/* Payroll Period */}
        <tr>
          <td colSpan={4} style={{
            border: '1px solid #000',
            padding: '1px 2px',
            backgroundColor: '#e5e7eb',
            fontWeight: 'bold',
            fontSize: '5pt',
          }}>
            PAYROLL PERIOD OF: {format(weekStart, 'MMM. d')}-{format(weekEnd, 'd, yyyy')}
          </td>
        </tr>

        {/* Employee Name */}
        <tr>
          <td colSpan={4} style={{
            border: '1px solid #000',
            padding: '1px 2px',
            backgroundColor: '#e5e7eb',
            fontWeight: 'bold',
            fontSize: '5pt',
          }}>
            NAME: {employee.full_name.toUpperCase()}
          </td>
        </tr>

        {/* Basic Salary & Working Days - Removed Rates */}
        <tr>
          <td style={{border: '2px solid #000', padding: '6px 8px', fontWeight: 'bold'}}>WORKING DAYS:</td>
          <td style={{border: '2px solid #000', padding: '6px 8px', textAlign: 'right'}}>{workingDays}</td>
          <td style={{border: '2px solid #000', padding: '6px 8px', fontWeight: 'bold'}}>ABSENT:</td>
          <td style={{border: '2px solid #000', padding: '6px 8px', textAlign: 'right'}}>0</td>
        </tr>

        {/* EARNINGS Section */}
        <tr>
          <td colSpan={4} style={{
            border: '1px solid #000',
            padding: '1px 2px',
            backgroundColor: '#e5e7eb',
            fontWeight: 'bold',
            fontSize: '5pt',
          }}>EARNINGS:</td>
        </tr>

        <tr>
          <td style={{border: '2px solid #000', padding: '6px 8px', fontWeight: 'bold'}}>REGULAR PAY:</td>
          <td style={{border: '2px solid #000', padding: '6px 8px', textAlign: 'right'}}>{formatCurrency(earnings.regularPay)}</td>
          <td style={{border: '2px solid #000', padding: '6px 8px'}}></td>
          <td style={{border: '2px solid #000', padding: '6px 8px'}}></td>
        </tr>

        <tr>
          <td style={{border: '2px solid #000', padding: '6px 8px', fontWeight: 'bold'}}>REGULAR O. T:</td>
          <td style={{border: '2px solid #000', padding: '6px 8px', textAlign: 'right'}}>{formatCurrency(earnings.regularOT)}</td>
          <td style={{border: '2px solid #000', padding: '6px 8px', textAlign: 'right'}}>{earnings.regularOTHours.toFixed(2)}</td>
          <td style={{border: '2px solid #000', padding: '6px 8px'}}>HRS</td>
        </tr>

        <tr>
          <td style={{border: '2px solid #000', padding: '6px 8px', fontWeight: 'bold'}}>NIGHT DIFF.:</td>
          <td style={{border: '2px solid #000', padding: '6px 8px', textAlign: 'right'}}>{formatCurrency(earnings.nightDiff)}</td>
          <td style={{border: '2px solid #000', padding: '6px 8px', textAlign: 'right'}}>{earnings.nightDiffHours.toFixed(2)}</td>
          <td style={{border: '2px solid #000', padding: '6px 8px'}}>HRS</td>
        </tr>

        <tr>
          <td style={{border: '2px solid #000', padding: '6px 8px', fontWeight: 'bold'}}>SUNDAY/ R.D OT:</td>
          <td style={{border: '2px solid #000', padding: '6px 8px', textAlign: 'right'}}>{formatCurrency(earnings.sundayRestDay)}</td>
          <td style={{border: '2px solid #000', padding: '6px 8px', textAlign: 'right'}}>{earnings.sundayRestDayHours.toFixed(2)}</td>
          <td style={{border: '2px solid #000', padding: '6px 8px'}}>HRS</td>
        </tr>

        <tr>
          <td style={{border: '2px solid #000', padding: '6px 8px', fontWeight: 'bold'}}>SPECIAL HOLIDAY:</td>
          <td style={{border: '2px solid #000', padding: '6px 8px', textAlign: 'right'}}>{formatCurrency(earnings.specialHoliday)}</td>
          <td style={{border: '2px solid #000', padding: '6px 8px', textAlign: 'right'}}>{earnings.specialHolidayHours.toFixed(2)}</td>
          <td style={{border: '2px solid #000', padding: '6px 8px', textAlign: 'right'}}>{(0).toFixed(2)}</td>
        </tr>

        <tr>
          <td style={{border: '2px solid #000', padding: '6px 8px', fontWeight: 'bold'}}>REGULAR HOLIDAY:</td>
          <td style={{border: '2px solid #000', padding: '6px 8px', textAlign: 'right'}}>{formatCurrency(earnings.regularHoliday)}</td>
          <td style={{border: '2px solid #000', padding: '6px 8px', textAlign: 'right'}}>{earnings.regularHolidayHours.toFixed(2)}</td>
          <td style={{border: '2px solid #000', padding: '6px 8px', textAlign: 'right'}}>{(0).toFixed(2)}</td>
        </tr>

        <tr>
          <td style={{
            border: '1px solid #000',
            padding: '1px 2px',
            backgroundColor: '#e5e7eb',
            fontWeight: 'bold',
            fontSize: '5pt',
          }}>GROSS INCOME:</td>
          <td style={{
            border: '1px solid #000',
            padding: '1px 2px',
            backgroundColor: '#e5e7eb',
            fontWeight: 'bold',
            fontSize: '5pt',
            textAlign: 'right'
          }}>{formatCurrency(earnings.grossIncome)}</td>
          <td colSpan={2} style={{border: '2px solid #000', padding: '6px 8px'}}></td>
        </tr>

        {/* DEDUCTIONS Section */}
        <tr>
          <td colSpan={4} style={{
            border: '1px solid #000',
            padding: '1px 2px',
            backgroundColor: '#e5e7eb',
            fontWeight: 'bold',
            fontSize: '5pt',
          }}>DEDUCTIONS: (Week of {format(weekStart, 'MMM. d')} - {format(weekEnd, 'MMM. d, yyyy')})</td>
        </tr>

        {deductions.vale > 0 && (
          <tr>
            <td style={{border: '2px solid #000', padding: '6px 8px', fontWeight: 'bold'}}>vale</td>
            <td style={{border: '2px solid #000', padding: '6px 8px', textAlign: 'right'}}>{formatCurrency(deductions.vale)}</td>
            <td colSpan={2} style={{border: '2px solid #000', padding: '6px 8px'}}></td>
          </tr>
        )}

        {deductions.uniformPPE > 0 && (
          <tr>
            <td style={{border: '2px solid #000', padding: '6px 8px', fontWeight: 'bold'}}>UNIFORM/PPE</td>
            <td style={{border: '2px solid #000', padding: '6px 8px', textAlign: 'right'}}>{formatCurrency(deductions.uniformPPE)}</td>
            <td colSpan={2} style={{border: '2px solid #000', padding: '6px 8px'}}></td>
          </tr>
        )}

        {deductions.pagibigLoan > 0 && (
          <tr>
            <td style={{border: '2px solid #000', padding: '6px 8px', fontWeight: 'bold'}}>PAG-IBIG LOAN</td>
            <td style={{border: '2px solid #000', padding: '6px 8px', textAlign: 'right'}}>{formatCurrency(deductions.pagibigLoan)}</td>
            <td colSpan={2} style={{border: '2px solid #000', padding: '6px 8px'}}></td>
          </tr>
        )}

        {deductions.sssLoan > 0 && (
          <tr>
            <td style={{border: '2px solid #000', padding: '6px 8px', fontWeight: 'bold'}}>SSS LOAN</td>
            <td style={{border: '2px solid #000', padding: '6px 8px', textAlign: 'right'}}>{formatCurrency(deductions.sssLoan)}</td>
            <td colSpan={2} style={{border: '2px solid #000', padding: '6px 8px'}}></td>
          </tr>
        )}

        {deductions.sssCalamityLoan > 0 && (
          <tr>
            <td style={{border: '2px solid #000', padding: '6px 8px', fontWeight: 'bold'}}>SSS CALAMITY LOAN</td>
            <td style={{border: '2px solid #000', padding: '6px 8px', textAlign: 'right'}}>{formatCurrency(deductions.sssCalamityLoan)}</td>
            <td colSpan={2} style={{border: '2px solid #000', padding: '6px 8px'}}></td>
          </tr>
        )}

        {deductions.pagibigCalamityLoan > 0 && (
          <tr>
            <td style={{border: '2px solid #000', padding: '6px 8px', fontWeight: 'bold'}}>PAG-IBIG CALAMITY LOAN</td>
            <td style={{border: '2px solid #000', padding: '6px 8px', textAlign: 'right'}}>{formatCurrency(deductions.pagibigCalamityLoan)}</td>
            <td colSpan={2} style={{border: '2px solid #000', padding: '6px 8px'}}></td>
          </tr>
        )}

        <tr>
          <td style={{border: '2px solid #000', padding: '6px 8px', fontWeight: 'bold'}}>SSS CONTRI.</td>
          <td style={{border: '2px solid #000', padding: '6px 8px', textAlign: 'right'}}>{formatCurrency(deductions.sssContribution)}</td>
          <td colSpan={2} style={{border: '2px solid #000', padding: '6px 8px'}}></td>
        </tr>

        <tr>
          <td style={{border: '2px solid #000', padding: '6px 8px', fontWeight: 'bold'}}>PHILHEALTH contri</td>
          <td style={{border: '2px solid #000', padding: '6px 8px', textAlign: 'right'}}>{formatCurrency(deductions.philhealthContribution)}</td>
          <td colSpan={2} style={{border: '2px solid #000', padding: '6px 8px'}}></td>
        </tr>

        <tr>
          <td style={{border: '2px solid #000', padding: '6px 8px', fontWeight: 'bold'}}>PAG-IBIG contri</td>
          <td style={{border: '2px solid #000', padding: '6px 8px', textAlign: 'right'}}>{formatCurrency(deductions.pagibigContribution)}</td>
          <td colSpan={2} style={{border: '2px solid #000', padding: '6px 8px'}}></td>
        </tr>

        <tr>
          <td style={{
            border: '1px solid #000',
            padding: '1px 2px',
            backgroundColor: '#e5e7eb',
            fontWeight: 'bold',
            fontSize: '5pt',
          }}>TOTAL DEDUCTION:</td>
          <td style={{
            border: '1px solid #000',
            padding: '1px 2px',
            backgroundColor: '#e5e7eb',
            fontWeight: 'bold',
            fontSize: '5pt',
            textAlign: 'right'
          }}>{formatCurrency(deductions.totalDeductions)}</td>
          <td colSpan={2} style={{border: '2px solid #000', padding: '6px 8px'}}></td>
        </tr>

        {/* ADJUSTMENT Section */}
        <tr>
          <td style={{border: '2px solid #000', padding: '6px 8px', fontWeight: 'bold'}}>ADJUSTMENT:</td>
          <td style={{border: '2px solid #000', padding: '6px 8px', textAlign: 'right'}}>{formatCurrency(Math.abs(props.adjustment))}</td>
          <td colSpan={2} style={{border: '2px solid #000', padding: '6px 8px'}}></td>
        </tr>

        {/* NET PAY Section */}
        <tr>
          <td style={{
            border: '1px solid #000',
            padding: '1px 2px',
            backgroundColor: '#e5e7eb',
            fontWeight: 'bold',
            fontSize: '6pt',
          }}>NET PAY:</td>
          <td style={{
            border: '1px solid #000',
            padding: '1px 2px',
            backgroundColor: '#e5e7eb',
            fontWeight: 'bold',
            fontSize: '6pt',
            textAlign: 'right'
          }} colSpan={3}>
            {formatCurrency(netPay)}
          </td>
        </tr>

        {/* Signature Section */}
        <tr>
          <td colSpan={2} style={{border: '2px solid #000', padding: '6px 8px', fontWeight: 'bold'}}>RECEIVED BY/DATE:</td>
          <td colSpan={2} style={{border: '2px solid #000', padding: '6px 8px', height: '40px'}}></td>
        </tr>

        <tr>
          <td colSpan={2} style={{border: '2px solid #000', padding: '6px 8px', fontWeight: 'bold'}}>CREATED BY:</td>
          <td colSpan={2} style={{border: '2px solid #000', padding: '6px 8px', textAlign: 'center'}}>{preparedBy.toUpperCase()}</td>
        </tr>
        </tbody>
      </table>
    </div>
  );
}
