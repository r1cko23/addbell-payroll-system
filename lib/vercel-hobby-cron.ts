/**
 * Vercel Hobby cron jobs may run at most once per day.
 * Hourly (and more frequent) expressions fail the deployment:
 * "Hobby accounts are limited to daily cron jobs."
 * @see https://vercel.com/docs/cron-jobs/usage-and-pricing
 */

export type VercelCronEntry = {
  path: string;
  schedule: string;
};

const HOBBY_MORE_THAN_ONCE_PER_DAY =
  "Hobby accounts are limited to daily cron jobs. This cron expression would run more than once per day.";

function range(min: number, max: number, step = 1): number[] {
  const values: number[] = [];
  for (let i = min; i <= max; i += step) values.push(i);
  return values;
}

function expandCronField(field: string, min: number, max: number): number[] {
  const values = new Set<number>();
  for (const part of field.split(",")) {
    const [rangePart, stepRaw] = part.split("/");
    const step = stepRaw ? Number(stepRaw) : 1;
    if (!Number.isInteger(step) || step < 1) return [];

    let start: number;
    let end: number;
    if (rangePart === "*") {
      start = min;
      end = max;
    } else if (rangePart.includes("-")) {
      const [from, to] = rangePart.split("-").map(Number);
      start = from;
      end = to;
    } else {
      const exact = Number(rangePart);
      start = exact;
      end = stepRaw ? max : exact;
    }

    if (![start, end].every((n) => Number.isInteger(n))) return [];
    for (const value of range(start, end, step)) {
      if (value >= min && value <= max) values.add(value);
    }
  }
  return [...values].sort((a, b) => a - b);
}

/** Times the 5-field cron would fire on a day it is eligible to run. */
export function hobbyCronRunsPerDay(schedule: string): number {
  const fields = schedule.trim().split(/\s+/);
  if (fields.length !== 5) return Number.POSITIVE_INFINITY;
  const minutes = expandCronField(fields[0], 0, 59);
  const hours = expandCronField(fields[1], 0, 23);
  if (minutes.length === 0 || hours.length === 0) return Number.POSITIVE_INFINITY;
  return minutes.length * hours.length;
}

export function isVercelHobbyCronSchedule(schedule: string): boolean {
  return hobbyCronRunsPerDay(schedule) <= 1;
}

export function vercelHobbyCronRejection(schedule: string): string | null {
  return isVercelHobbyCronSchedule(schedule) ? null : HOBBY_MORE_THAN_ONCE_PER_DAY;
}

export function vercelHobbyIncompatibleCrons(
  crons: VercelCronEntry[]
): Array<VercelCronEntry & { reason: string }> {
  return crons.flatMap((cron) => {
    const reason = vercelHobbyCronRejection(cron.schedule);
    return reason ? [{ ...cron, reason }] : [];
  });
}
