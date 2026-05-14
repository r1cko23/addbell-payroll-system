export const OT_MIN_HOURS = 1;
export const OT_INCREMENT_HOURS = 0.5;
export const ND_MIN_HOURS = 1;
export const ND_INCREMENT_HOURS = 0.5;

/**
 * Credited **overtime** hours from a raw duration (e.g. approved OT `total_hours` or computed span).
 *
 * Policy (OT and ND use the same staircase):
 * - Below **1 full hour** raw → **0** credited (nothing payable).
 * - From **1.0 hour** upward, credit is floored to **0.5 h steps**: 1, 1.5, 2, 2.5, 3, …
 * - Examples: 0.99 → 0 · 1.0 → 1 · 1.49 → 1 · 1.5 → 1.5 · 2.25 → 2 · 2.5 → 2.5
 */
export function creditOvertimeHours(rawHours: number): number {
  const h = Number(rawHours) || 0;
  if (h < OT_MIN_HOURS) return 0;
  return Math.floor(h / OT_INCREMENT_HOURS) * OT_INCREMENT_HOURS;
}

/**
 * Credited **night differential** hours from raw night-window overlap (sum for the day before crediting).
 *
 * Same staircase as {@link creditOvertimeHours}:
 * - Below **1 full hour** raw → **0** credited.
 * - From **1.0 hour** upward: **0.5 h steps** (1, 1.5, 2, 2.5, …), floored.
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

