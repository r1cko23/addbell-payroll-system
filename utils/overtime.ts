export const OT_MIN_HOURS = 1;
export const OT_INCREMENT_HOURS = 0.5;
export const ND_MIN_HOURS = 0.5;
export const ND_INCREMENT_HOURS = 0.5;

/**
 * Convert raw OT duration (hours) to credited OT hours.
 *
 * Rules:
 * - Minimum OT credit is 1.0 hour
 * - After 1.0 hour, credits are in 0.5-hour increments
 * - Credit is floored (e.g., 1.49 -> 1.0, 1.50 -> 1.5)
 */
export function creditOvertimeHours(rawHours: number): number {
  const h = Number(rawHours) || 0;
  if (h < OT_MIN_HOURS) return 0;
  return Math.floor(h / OT_INCREMENT_HOURS) * OT_INCREMENT_HOURS;
}

/**
 * Convert raw night-differential duration (hours) to credited ND hours.
 *
 * Rules:
 * - Minimum ND credit is 0.5 hour
 * - Credits are in 0.5-hour increments
 * - Credit is floored (e.g., 0.99 -> 0.5, 0.49 -> 0)
 */
export function creditNightDiffHours(rawHours: number): number {
  const h = Number(rawHours) || 0;
  if (h < ND_MIN_HOURS) return 0;
  return Math.floor(h / ND_INCREMENT_HOURS) * ND_INCREMENT_HOURS;
}

/**
 * Convert raw worked hours (BH/regular hours display) into whole-hour steps (floored).
 * Example: 8.9 -> 8, 10.0 -> 10
 */
export function creditWorkHoursHalfHour(rawHours: number): number {
  const h = Number(rawHours) || 0;
  if (h < 1) return 0;
  return Math.floor(h);
}

