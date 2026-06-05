/**
 * Days Work rollup — shared by Time Attendance and Payslip (Frappe HR one engine).
 */

import { creditWorkHoursHalfHour } from "@/utils/overtime";
import { computeDaysWork } from "./attendance-cutoff";
import type { DaysWorkResult } from "./types";

export type DaysWorkRollupDay = {
  date: string;
  dayType?: string;
  status?: string;
  bh?: number;
  regularHours?: number;
  isHalfDayLeave?: boolean;
};

export type DaysWorkEmployeeContext = {
  employeeType?: "office-based" | "client-based" | null;
  position?: string | null;
  jobLevel?: string | null;
};

const SUPERVISORY_POSITIONS = [
  "PAYROLL SUPERVISOR",
  "ACCOUNT RECEIVABLE SUPERVISOR",
  "HR OPERATIONS SUPERVISOR",
  "HR SUPERVISOR - LABOR RELATIONS/EMPLOYEE ENGAGEMENT",
  "HR SUPERVISOR - LABOR RELATIONS",
  "HR SUPERVISOR-LABOR RELATIONS",
  "HR SUPERVISOR - EMPLOYEE ENGAGEMENT",
  "HR SUPERVISOR-EMPLOYEE ENGAGEMENT",
];

function dayBh(day: DaysWorkRollupDay): number {
  const raw = Number(day.bh ?? day.regularHours ?? 0);
  return creditWorkHoursHalfHour(Math.round(raw * 100) / 100);
}

function isFutureDay(dateStr: string, asOf: Date): boolean {
  const dayDate = new Date(dateStr);
  dayDate.setHours(0, 0, 0, 0);
  return dayDate > asOf;
}

function shouldSkipForRollup(day: DaysWorkRollupDay): boolean {
  if (day.status === "CTO" || day.status === "OB") return true;
  if (day.status === "LWOP" && !day.isHalfDayLeave) return true;
  return false;
}

function isHolidayDay(day: DaysWorkRollupDay): boolean {
  if (day.status === "RH" || day.status === "SH") return true;
  const dayType = day.dayType || "";
  return (
    dayType === "regular-holiday" ||
    dayType === "non-working-holiday" ||
    dayType === "sunday-regular-holiday" ||
    dayType === "sunday-special-holiday" ||
    dayType.includes("holiday")
  );
}

function isRestDay(
  day: DaysWorkRollupDay,
  restDays?: Map<string, boolean>
): boolean {
  if (day.status === "RD") return true;
  if (day.dayType === "sunday") return true;
  return restDays?.get(day.date) === true;
}

function isSpecialDay(
  day: DaysWorkRollupDay,
  restDays?: Map<string, boolean>
): boolean {
  return isHolidayDay(day) || isRestDay(day, restDays);
}

export function isEligibleForAllowancesEmployee(
  ctx: DaysWorkEmployeeContext
): boolean {
  const isOfficeBased = ctx.employeeType !== "client-based";
  const isAccountSupervisor =
    (ctx.position || "").toUpperCase().includes("ACCOUNT SUPERVISOR");
  const isManagerial =
    isOfficeBased && (ctx.jobLevel || "").toUpperCase() === "MANAGERIAL";
  const isSupervisoryByJobLevel =
    isOfficeBased && (ctx.jobLevel || "").toUpperCase() === "SUPERVISORY";
  const isSupervisory =
    isOfficeBased &&
    SUPERVISORY_POSITIONS.some((pos) =>
      (ctx.position || "").toUpperCase().includes(pos.toUpperCase())
    );
  return (
    isAccountSupervisor ||
    isSupervisory ||
    isSupervisoryByJobLevel ||
    isManagerial
  );
}

export function excludeWorkedSpecialDayFromDaysWork(
  ctx: DaysWorkEmployeeContext
): boolean {
  if (ctx.employeeType === "client-based") return true;
  return isEligibleForAllowancesEmployee(ctx);
}

/** Sum BH credited toward Days Work (holidays, RD worked, regular days with BH). */
export function rollupActualBHForDaysWork(
  days: DaysWorkRollupDay[],
  options?: { asOf?: Date; restDays?: Map<string, boolean> }
): number {
  const asOf = options?.asOf ? new Date(options.asOf) : new Date();
  asOf.setHours(0, 0, 0, 0);
  const restDays = options?.restDays;

  return days.reduce((sum, day) => {
    if (isFutureDay(day.date, asOf) || shouldSkipForRollup(day)) return sum;

    const bh = dayBh(day);
    if (bh <= 0) return sum;

    if (isRestDay(day, restDays)) return sum + bh;
    if (isHolidayDay(day)) return sum + bh;
    if ((day.dayType || "regular") === "regular" || day.status === "LOG") {
      return sum + bh;
    }
    if (day.bh != null && day.bh > 0) return sum + bh;
    if (day.regularHours != null && day.regularHours > 0) return sum + bh;

    return sum;
  }, 0);
}

/** BH on holidays / rest days (subtracted from base for allowance-tier employees). */
export function rollupRenderedSpecialBH(
  days: DaysWorkRollupDay[],
  options?: { asOf?: Date; restDays?: Map<string, boolean> }
): number {
  const asOf = options?.asOf ? new Date(options.asOf) : new Date();
  asOf.setHours(0, 0, 0, 0);
  const restDays = options?.restDays;

  return days.reduce((sum, day) => {
    if (isFutureDay(day.date, asOf) || !isSpecialDay(day, restDays)) {
      return sum;
    }
    const bh = dayBh(day);
    return bh > 0 ? sum + bh : sum;
  }, 0);
}

export type ResolvedDaysWork = DaysWorkResult & {
  actualTotalBH: number;
  renderedSpecialBH: number;
};

export function resolveDaysWorkTotals(input: {
  days: DaysWorkRollupDay[];
  basePayHours: number;
  employee: DaysWorkEmployeeContext;
  asOf?: Date;
  restDays?: Map<string, boolean>;
}): ResolvedDaysWork {
  const actualTotalBH = rollupActualBHForDaysWork(input.days, {
    asOf: input.asOf,
    restDays: input.restDays,
  });
  const renderedSpecialBH = rollupRenderedSpecialBH(input.days, {
    asOf: input.asOf,
    restDays: input.restDays,
  });
  const exclude = excludeWorkedSpecialDayFromDaysWork(input.employee);
  const result = computeDaysWork({
    basePayHours: input.basePayHours,
    actualTotalBH,
    renderedSpecialBH,
    excludeWorkedSpecialDayFromDaysWork: exclude,
  });
  return { ...result, actualTotalBH, renderedSpecialBH };
}
