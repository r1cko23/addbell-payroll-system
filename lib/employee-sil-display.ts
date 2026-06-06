/** Statutory annual SIL entitlement (5 days/year). Shown as "allotted" in the portal. */
export const SIL_ANNUAL_ALLOTMENT = 5;

/** Format available balance from employees.sil_credits (Bundy, Leave Request, etc.). */
export function formatSilCreditsAvailable(credits: number | null): string {
  if (credits === null) return "—";
  return credits.toFixed(2);
}
