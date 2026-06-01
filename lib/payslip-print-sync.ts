/**
 * Maps PayslipDetailedBreakdown totals into PayslipPrint's earnings table
 * so employee/admin print matches the on-screen breakdown.
 */

export type PayslipPrintEarningsTable = {
  basic: { days: number; hours: number; amount: number };
  overtime: { hours: number; amount: number };
  nightDiff: { hours: number; amount: number };
  legalHoliday: { days: number; amount: number };
  legalHDOT: { hours: number; amount: number };
  legalHDND: { hours: number; amount: number };
  spHoliday: { days: number; amount: number };
  SHOT: { hours: number; amount: number };
  SHND: { hours: number; amount: number };
  SHonRDOT: { hours: number; amount: number };
  LHonRDOT: { hours: number; amount: number };
  restDay: { days: number; amount: number };
  restDayOT: { hours: number; amount: number };
  restDayND: { hours: number; amount: number };
  workingDayoff: { days: number; amount: number };
  otherPay: { amount: number };
};

export type PayslipPrintFixedAllowances = {
  legalHolidayAllowance: { amount: number };
  specialHolidayAllowance: { amount: number };
  restDayAllowance: { amount: number };
  specialHolidayOnRestDayAllowance: { amount: number };
  legalHolidayOnRestDayAllowance: { amount: number };
};

export type PayslipPrintEarningsSync = {
  earningsBreakdown: PayslipPrintEarningsTable;
  totalGrossPay: number;
  useFixedAllowances: boolean;
  fixedAllowances: PayslipPrintFixedAllowances;
};

type DetailedBreakdownSnapshot = {
  hoursWorked: number;
  basicSalary: number;
  totalGrossPay: number;
  breakdown: {
    nightDifferential: { hours: number; amount: number };
    legalHoliday: { hours: number; amount: number };
    specialHoliday: { hours: number; amount: number };
    restDay: { hours: number; amount: number };
    restDayNightDiff: { hours: number; amount: number };
  };
  earningsOT: {
    regularOvertime: { hours: number; amount: number };
    legalHolidayOT: { hours: number; amount: number };
    legalHolidayND: { hours: number; amount: number };
    shOT: { hours: number; amount: number };
    shNightDiff: { hours: number; amount: number };
    shOnRDOT: { hours: number; amount: number };
    lhOnRDOT: { hours: number; amount: number };
    restDayOT: { hours: number; amount: number };
  };
  otherPay: {
    legalHolidayAllowance: { amount: number };
    specialHolidayAllowance: { amount: number };
    restDayAllowance: { amount: number };
    specialHolidayOnRestDayAllowance: { amount: number };
    legalHolidayOnRestDayAllowance: { amount: number };
  };
  useFixedAllowances: boolean;
};

export function buildPayslipPrintSyncFromDetailedBreakdown(
  data: DetailedBreakdownSnapshot
): PayslipPrintEarningsSync {
  const hoursToDays = (hours: number) => (hours > 0 ? hours / 8 : 0);

  const fixedAllowances: PayslipPrintFixedAllowances = {
    legalHolidayAllowance: {
      amount: data.otherPay.legalHolidayAllowance.amount,
    },
    specialHolidayAllowance: {
      amount: data.otherPay.specialHolidayAllowance.amount,
    },
    restDayAllowance: { amount: data.otherPay.restDayAllowance.amount },
    specialHolidayOnRestDayAllowance: {
      amount: data.otherPay.specialHolidayOnRestDayAllowance.amount,
    },
    legalHolidayOnRestDayAllowance: {
      amount: data.otherPay.legalHolidayOnRestDayAllowance.amount,
    },
  };

  const allowanceTotal =
    fixedAllowances.legalHolidayAllowance.amount +
    fixedAllowances.specialHolidayAllowance.amount +
    fixedAllowances.restDayAllowance.amount +
    fixedAllowances.specialHolidayOnRestDayAllowance.amount +
    fixedAllowances.legalHolidayOnRestDayAllowance.amount;

  return {
    totalGrossPay: data.totalGrossPay,
    useFixedAllowances: data.useFixedAllowances,
    fixedAllowances,
    earningsBreakdown: {
      basic: {
        hours: data.hoursWorked,
        days: hoursToDays(data.hoursWorked),
        amount: data.basicSalary,
      },
      overtime: {
        hours: data.earningsOT.regularOvertime.hours,
        amount: data.earningsOT.regularOvertime.amount,
      },
      nightDiff: {
        hours: data.breakdown.nightDifferential.hours,
        amount: data.breakdown.nightDifferential.amount,
      },
      legalHoliday: {
        days: hoursToDays(data.breakdown.legalHoliday.hours),
        amount: data.breakdown.legalHoliday.amount,
      },
      legalHDOT: {
        hours: data.earningsOT.legalHolidayOT.hours,
        amount: data.earningsOT.legalHolidayOT.amount,
      },
      legalHDND: {
        hours: data.earningsOT.legalHolidayND.hours,
        amount: data.earningsOT.legalHolidayND.amount,
      },
      spHoliday: {
        days: hoursToDays(data.breakdown.specialHoliday.hours),
        amount: data.breakdown.specialHoliday.amount,
      },
      SHOT: {
        hours: data.earningsOT.shOT.hours,
        amount: data.earningsOT.shOT.amount,
      },
      SHND: {
        hours: data.earningsOT.shNightDiff.hours,
        amount: data.earningsOT.shNightDiff.amount,
      },
      SHonRDOT: {
        hours: data.earningsOT.shOnRDOT.hours,
        amount: data.earningsOT.shOnRDOT.amount,
      },
      LHonRDOT: {
        hours: data.earningsOT.lhOnRDOT.hours,
        amount: data.earningsOT.lhOnRDOT.amount,
      },
      restDay: {
        days: hoursToDays(data.breakdown.restDay.hours),
        amount: data.breakdown.restDay.amount,
      },
      restDayOT: {
        hours: data.earningsOT.restDayOT.hours,
        amount: data.earningsOT.restDayOT.amount,
      },
      restDayND: {
        hours: data.breakdown.restDayNightDiff.hours,
        amount: data.breakdown.restDayNightDiff.amount,
      },
      workingDayoff: { days: 0, amount: 0 },
      otherPay: { amount: allowanceTotal },
    },
  };
}
