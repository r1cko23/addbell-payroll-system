/**
 * Maps earnings into PayslipPrint's earnings table
 * (employee portal + HR print preview).
 */

import {
  buildStoredEarningsBreakdown,
  normalizeEarningsBreakdownForExport,
  regularHoursBasicGross,
} from "@/lib/payroll-earnings-breakdown";
import type { DayType } from "@/utils/payroll-calculator";
import {
  overtimeAndNightDiffPay,
  calculateNonWorkingHoliday,
  calculateRegularHoliday,
  calculateRegularOT,
  calculateSundayRestDay,
} from "@/utils/payroll-calculator";
import { creditNightDiffHours, creditWorkHoursHalfHour } from "@/utils/overtime";
import {
  unworkedHolidayCreditHours,
  isEligibleForHolidayPayRule,
} from "@/utils/holidays";

export type PayslipPrintEarningsTable = {
  basic: { days: number; hours: number; amount: number };
  sil: { hours: number; amount: number };
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

export type AttendanceDayForPrintSync = {
  date: string;
  dayType: string;
  regularHours: number;
  overtimeHours: number;
  nightDiffHours: number;
  clockInTime?: string;
  clockOutTime?: string;
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

function hoursToDays(hours: number) {
  return hours > 0 ? hours / 8 : 0;
}

/**
 * Moves paid leave (SIL) hours out of the Basic row into their own SIL row.
 * Basic + SIL equals the old Basic, so gross pay does not change.
 */
export function moveSilOutOfBasic(
  table: Pick<PayslipPrintEarningsTable, "basic" | "sil">,
  attendanceDays: unknown,
  ratePerHour: number,
  sundayIsWorkday: boolean
): void {
  if (!Array.isArray(attendanceDays)) return;
  let hours = 0;
  for (const day of attendanceDays as Array<{
    date?: string;
    dayType?: string;
    regularHours?: number;
    leaveHours?: number;
  }>) {
    if ((day.dayType || "regular") !== "regular") continue;
    if (new Date(day.date ?? "").getDay() === 0 && !sundayIsWorkday) continue;
    const regular = creditWorkHoursHalfHour(
      Math.round((Number(day.regularHours) || 0) * 100) / 100
    );
    hours += Math.min(Number(day.leaveHours) || 0, regular);
  }
  hours = Math.min(hours, table.basic.hours);
  if (hours <= 0) return;
  const amount = Math.min(
    Math.round(hours * ratePerHour * 100) / 100,
    table.basic.amount
  );
  table.sil = { hours, amount };
  table.basic.hours -= hours;
  table.basic.days = hoursToDays(table.basic.hours);
  table.basic.amount = Math.round((table.basic.amount - amount) * 100) / 100;
}

export function buildPayslipPrintSyncFromDetailedBreakdown(
  data: DetailedBreakdownSnapshot
): PayslipPrintEarningsSync {
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
      sil: { hours: 0, amount: 0 },
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

/** Build print rows from saved payslip attendance (employee portal; no hidden breakdown). */
export function buildPayslipPrintSyncFromStoredPayslip(
  attendanceData: AttendanceDayForPrintSync[],
  ratePerHour: number,
  savedGrossPay: number,
  options?: {
    useFixedAllowances?: boolean;
    isClientBased?: boolean;
    isAccountSupervisor?: boolean;
  }
): PayslipPrintEarningsSync | null {
  if (ratePerHour <= 0 || attendanceData.length === 0) return null;

  const isClientBased = options?.isClientBased ?? false;
  const isAccountSupervisor = options?.isAccountSupervisor ?? false;

  const breakdown = {
    nightDifferential: { hours: 0, amount: 0 },
    legalHoliday: { hours: 0, amount: 0 },
    specialHoliday: { hours: 0, amount: 0 },
    restDay: { hours: 0, amount: 0 },
    restDayNightDiff: { hours: 0, amount: 0 },
  };

  const earningsOT = {
    regularOvertime: { hours: 0, amount: 0 },
    legalHolidayOT: { hours: 0, amount: 0 },
    legalHolidayND: { hours: 0, amount: 0 },
    shOT: { hours: 0, amount: 0 },
    shNightDiff: { hours: 0, amount: 0 },
    shOnRDOT: { hours: 0, amount: 0 },
    lhOnRDOT: { hours: 0, amount: 0 },
    restDayOT: { hours: 0, amount: 0 },
  };

  let hoursWorked = 0;

  attendanceData.forEach((day) => {
    const dayType = (day.dayType || "regular") as DayType;
    const regularHours = creditWorkHoursHalfHour(
      Math.round((Number(day.regularHours) || 0) * 100) / 100
    );
    const overtimeHours = Number(day.overtimeHours) || 0;
    const nightDiffHours = creditNightDiffHours(
      Math.round((Number(day.nightDiffHours) || 0) * 100) / 100
    );
    const dateObj = new Date(day.date);
    const dayOfWeek = Number.isNaN(dateObj.getTime()) ? -1 : dateObj.getDay();
    const isSundayRegularWorkday =
      dayOfWeek === 0 && (isClientBased || isAccountSupervisor);

    if (dayType === "regular") {
      if ((dayOfWeek !== 0 || isSundayRegularWorkday) && regularHours > 0) {
        hoursWorked += regularHours;
      }
      if (overtimeHours > 0) {
        earningsOT.regularOvertime.hours += overtimeHours;
        earningsOT.regularOvertime.amount += calculateRegularOT(
          overtimeHours,
          ratePerHour
        );
      }
      if (nightDiffHours > 0) {
        breakdown.nightDifferential.hours += nightDiffHours;
        breakdown.nightDifferential.amount += overtimeAndNightDiffPay(
          dayType,
          regularHours,
          overtimeHours,
          nightDiffHours,
          ratePerHour
        ).nightDiffPay;
      }
    }

    if (dayType === "regular-holiday") {
      const eligible = isEligibleForHolidayPayRule(
        day.date,
        regularHours,
        attendanceData
      );
      if (eligible) {
        const hasCompleteLog = Boolean(day.clockInTime && day.clockOutTime);
        const paidH = hasCompleteLog
          ? regularHours
          : unworkedHolidayCreditHours(dayType);
        if (paidH > 0) {
          breakdown.legalHoliday.hours += paidH;
          breakdown.legalHoliday.amount += calculateRegularHoliday(
            paidH,
            ratePerHour
          );
        }
      }
    }

    if (dayType === "non-working-holiday") {
      const eligible = isEligibleForHolidayPayRule(
        day.date,
        regularHours,
        attendanceData
      );
      if (eligible) {
        const hasCompleteLog = Boolean(day.clockInTime && day.clockOutTime);
        const paidH = hasCompleteLog
          ? regularHours
          : unworkedHolidayCreditHours(dayType);
        if (paidH > 0) {
          breakdown.specialHoliday.hours += paidH;
          breakdown.specialHoliday.amount += calculateNonWorkingHoliday(
            paidH,
            ratePerHour
          );
        }
      }
    }

    if (
      dayType === "sunday" ||
      dayType === "sunday-special-holiday" ||
      dayType === "sunday-regular-holiday"
    ) {
      if (regularHours > 0) {
        breakdown.restDay.hours += regularHours;
        breakdown.restDay.amount += calculateSundayRestDay(
          regularHours,
          ratePerHour
        );
      }
    }
  });

  const basicSalary = regularHoursBasicGross(attendanceData, ratePerHour);
  const payroll = buildStoredEarningsBreakdown(attendanceData, ratePerHour)
    .payroll_result;
  const computedGross = payroll?.grossPay ?? 0;
  const totalGrossPay =
    savedGrossPay > 0
      ? savedGrossPay
      : computedGross > 0
        ? computedGross
        : basicSalary +
          earningsOT.regularOvertime.amount +
          breakdown.nightDifferential.amount +
          breakdown.legalHoliday.amount +
          breakdown.specialHoliday.amount +
          breakdown.restDay.amount;

  if (!Number.isFinite(totalGrossPay) || totalGrossPay < 0) return null;

  return buildPayslipPrintSyncFromDetailedBreakdown({
    hoursWorked,
    basicSalary,
    totalGrossPay: Math.round(totalGrossPay * 100) / 100,
    breakdown,
    earningsOT,
    otherPay: {
      legalHolidayAllowance: { amount: 0 },
      specialHolidayAllowance: { amount: 0 },
      restDayAllowance: { amount: 0 },
      specialHolidayOnRestDayAllowance: { amount: 0 },
      legalHolidayOnRestDayAllowance: { amount: 0 },
    },
    useFixedAllowances: options?.useFixedAllowances ?? false,
  });
}

/** Resolve sync from payslip row + mapped attendance days. */
export function buildPayslipPrintSyncFromPayslipRow(
  payslip: { gross_pay: number; earnings_breakdown?: unknown },
  attendanceDays: AttendanceDayForPrintSync[],
  ratePerHour: number,
  profile?: {
    employment_type?: string | null;
    position?: string | null;
    job_level?: string | null;
  }
): PayslipPrintEarningsSync | null {
  const normalized = normalizeEarningsBreakdownForExport(
    payslip.earnings_breakdown
  );
  const days =
    attendanceDays.length > 0
      ? attendanceDays
      : (normalized?.attendance_data ?? []).map((day: any) => ({
          date: day.date || "",
          dayType: day.dayType || "regular",
          regularHours: Number(day.regularHours ?? 0),
          overtimeHours: Number(day.overtimeHours ?? 0),
          nightDiffHours: Number(day.nightDiffHours ?? 0),
          clockInTime: day.clockInTime ?? day.clock_in_time,
          clockOutTime: day.clockOutTime ?? day.clock_out_time,
        }));

  const isClientBased = profile?.employment_type === "client-based";
  const isAccountSupervisor =
    profile?.position?.toUpperCase().includes("ACCOUNT SUPERVISOR") ?? false;
  const isEligibleForAllowances =
    isClientBased ||
    (profile?.employment_type === "office-based" &&
      (profile?.job_level?.toUpperCase() === "SUPERVISORY" ||
        profile?.job_level?.toUpperCase() === "MANAGERIAL"));

  return buildPayslipPrintSyncFromStoredPayslip(
    days,
    ratePerHour,
    Number(payslip.gross_pay ?? 0),
    {
      useFixedAllowances: isEligibleForAllowances,
      isClientBased,
      isAccountSupervisor,
    }
  );
}
