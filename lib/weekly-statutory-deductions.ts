import { endOfMonth } from "date-fns";

/**
 * Wed–Tue weekly pay: attribute each pay to the calendar month of **period end** (Tuesday).
 * SSS / PhilHealth / Pag-IBIG: full month (prorated) on the **4th** Tuesday (or last if fewer than four).
 * BIR withholding: **semi-monthly** — last Tuesday with day 1–15 (1st half), then last Tuesday
 * of the month for the 2nd half (days 16–end), using monthly table on 2× semi-monthly taxable ÷ 2.
 */

function assertTuesday(periodEnd: Date) {
  if (periodEnd.getDay() !== 2) {
    // Still compute; Wed-start weeks should end Tuesday (day 2)
    console.warn(
      "[weekly-statutory] periodEnd is not a Tuesday:",
      periodEnd.toISOString()
    );
  }
}

/** Count Tuesdays in the same calendar month as `periodEnd` (= number of weekly pays in that month). */
export function countWeeklyPayPeriodsInMonth(periodEnd: Date): number {
  assertTuesday(periodEnd);
  const y = periodEnd.getFullYear();
  const m = periodEnd.getMonth();
  const last = endOfMonth(periodEnd);
  let n = 0;
  for (let d = new Date(y, m, 1); d <= last; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 2) n++;
  }
  return Math.max(1, n);
}

/**
 * 0-based index of this period's Tuesday among all Tuesdays in that month
 * (first Tuesday of month = 0).
 */
export function tuesdayPayIndexInMonth(periodEnd: Date): number {
  assertTuesday(periodEnd);
  const y = periodEnd.getFullYear();
  const m = periodEnd.getMonth();
  const target = periodEnd.getDate();
  let idx = 0;
  for (let d = new Date(y, m, 1); d.getMonth() === m; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 2) {
      if (d.getDate() === target) return idx;
      idx++;
    }
  }
  return 0;
}

/** True if this pay is the last Tuesday (last weekly pay) of the calendar month. */
export function isLastWeeklyPayOfMonth(periodEnd: Date): boolean {
  const n = countWeeklyPayPeriodsInMonth(periodEnd);
  const i = tuesdayPayIndexInMonth(periodEnd);
  return i === n - 1;
}

/** 0-based index of the 4th Tuesday in the month (= “4th weekly pay” for Wed–Tue cycles). */
const FOURTH_TUESDAY_INDEX = 3;

/**
 * SSS / PhilHealth / Pag-IBIG are taken on the **4th** weekly pay (4th Tuesday)
 * in the calendar month of period end. If the month has fewer than four Tuesdays, use the
 * **last** Tuesday so short months still get one deduction run.
 */
export function isFourthStatutoryWeeklyPay(periodEnd: Date): boolean {
  assertTuesday(periodEnd);
  const n = countWeeklyPayPeriodsInMonth(periodEnd);
  const idx = tuesdayPayIndexInMonth(periodEnd);
  if (n >= 4) return idx === FOURTH_TUESDAY_INDEX;
  return idx === n - 1;
}

/**
 * Split a monthly peso amount across N weekly pays in the month (cent-safe; remainder on earliest pays).
 */
export function shareMonthlyAmountAcrossWeeklyPays(
  monthlyAmount: number,
  periodEnd: Date
): number {
  const n = countWeeklyPayPeriodsInMonth(periodEnd);
  const cents = Math.round(monthlyAmount * 100);
  const base = Math.floor(cents / n);
  const rem = cents - base * n;
  const idx = tuesdayPayIndexInMonth(periodEnd);
  const outCents = base + (idx < rem ? 1 : 0);
  return outCents / 100;
}

/** 1 = calendar days 1–15, 2 = 16–end (month of `periodEnd`). */
export function semiMonthlyPeriodIndex(periodEnd: Date): 1 | 2 {
  return periodEnd.getDate() <= 15 ? 1 : 2;
}

/** Tuesdays in the same calendar month and same semi-month as `periodEnd`. */
export function tuesdaysInSameSemiMonth(periodEnd: Date): Date[] {
  const y = periodEnd.getFullYear();
  const m = periodEnd.getMonth();
  const half = semiMonthlyPeriodIndex(periodEnd);
  const last = endOfMonth(periodEnd);
  const out: Date[] = [];
  for (let d = new Date(y, m, 1); d <= last; d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== 2) continue;
    const dom = d.getDate();
    if (half === 1 && dom <= 15) out.push(new Date(d.getTime()));
    if (half === 2 && dom >= 16) out.push(new Date(d.getTime()));
  }
  return out;
}

export function countWeeklyPaysInSemiMonth(periodEnd: Date): number {
  const n = tuesdaysInSameSemiMonth(periodEnd).length;
  return Math.max(1, n);
}

/**
 * True when this pay is the **withholding settlement** for its semi-month:
 * — 1st half: last Tuesday falling on day ≤ 15;
 * — 2nd half: last Tuesday of the calendar month (always in 16–end if any Tue exists there).
 */
export function isLastWeeklyPayOfSemiMonth(periodEnd: Date): boolean {
  assertTuesday(periodEnd);
  const y = periodEnd.getFullYear();
  const m = periodEnd.getMonth();
  const day = periodEnd.getDate();

  if (day <= 15) {
    let lastTueDay = 0;
    for (let dom = 1; dom <= 15; dom++) {
      const dt = new Date(y, m, dom);
      if (dt.getDay() === 2) lastTueDay = dom;
    }
    return lastTueDay > 0 && day === lastTueDay;
  }
  return isLastWeeklyPayOfMonth(periodEnd);
}

/**
 * Withholding tax for this pay:
 * - Non-final pays: equal split of monthly tax due (same cent logic as contributions).
 * - Last pay of month: remainder so month total matches `monthlyTaxDue` minus amounts already saved for earlier pays.
 *
 * @deprecated Payslips use {@link isLastWeeklyPayOfSemiMonth} + semi-monthly BIR table (×2 / ÷2) instead.
 */
export function weeklyWithholdingTaxForPeriod(
  monthlyTaxDue: number,
  periodEnd: Date,
  taxWithheldPriorSameMonth: number
): number {
  const due = Math.round(monthlyTaxDue * 100) / 100;
  const prior = Math.round(taxWithheldPriorSameMonth * 100) / 100;
  if (isLastWeeklyPayOfMonth(periodEnd)) {
    return Math.max(0, Math.round((due - prior) * 100) / 100);
  }
  return shareMonthlyAmountAcrossWeeklyPays(due, periodEnd);
}
