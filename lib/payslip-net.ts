function safeNumber(n: unknown): number {
  const x = Number(n ?? 0);
  return Number.isFinite(x) ? x : 0;
}

/**
 * Net payroll = gross + adjustment − deductions + allowance.
 * Adjustment is a single signed amount (positive or negative).
 */
export function computePayslipNetPay(params: {
  grossPay: unknown;
  adjustmentAmount?: unknown;
  totalDeductions?: unknown;
  allowanceAmount?: unknown;
}): number {
  const gross = safeNumber(params.grossPay);
  const adjustment = safeNumber(params.adjustmentAmount);
  const deductions = safeNumber(params.totalDeductions);
  const allowance = safeNumber(params.allowanceAmount);
  return Math.round((gross + adjustment - deductions + allowance) * 100) / 100;
}
