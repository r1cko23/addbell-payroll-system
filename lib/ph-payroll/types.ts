/**
 * Philippine payroll types (Frappe HR Salary Structure pattern).
 * Single source of truth for cutoff attendance shapes.
 */

export type TaxFrequency = "daily" | "weekly" | "semi-monthly" | "monthly";

export interface DaysWorkInput {
  basePayHours: number;
  actualTotalBH: number;
  renderedSpecialBH: number;
  /** Supervisory/managerial/client-based: exclude rendered special-day hours from regular Days Work. */
  excludeWorkedSpecialDayFromDaysWork: boolean;
}

export interface DaysWorkResult {
  totalBHForDaysWork: number;
  daysWorked: number;
}

/** Max credited hours in one weekly Wed–Tue cutoff (6 × 10h + buffer). */
export const WEEKLY_MAX_CUTOFF_HOURS = 70;

export type HolidayForCutoff = {
  holiday_date: string;
  holiday_type: string;
};
