/** Allowance line types — aligned with cutoff_allowances columns and payroll Excel export. */

export const ALLOWANCE_TYPES = [
  "Transpo",
  "Load",
  "Allowance",
  "Refund",
] as const;

export type AllowanceType = (typeof ALLOWANCE_TYPES)[number];

export type AllowanceLine = {
  type: AllowanceType;
  amount: number;
};

export type CutoffAllowanceRow = {
  transpo_allowance?: number | null;
  load_allowance?: number | null;
  allowance?: number | null;
  refund?: number | null;
};

function safeNumber(n: unknown): number {
  const x = Number(n ?? 0);
  return Number.isFinite(x) ? x : 0;
}

export function sumAllowanceLines(lines: unknown): number {
  if (!Array.isArray(lines)) return 0;
  return lines.reduce((sum, line) => {
    const row = line as { amount?: unknown };
    return sum + safeNumber(row?.amount);
  }, 0);
}

export function sumCutoffAllowanceRow(row?: CutoffAllowanceRow | null): number {
  if (!row) return 0;
  return (
    safeNumber(row.transpo_allowance) +
    safeNumber(row.load_allowance) +
    safeNumber(row.allowance) +
    safeNumber(row.refund)
  );
}

/** Payroll Excel + payslip: prefer stored payslip allowance, then cutoff_allowances. */
export function resolvePayslipAllowanceAmount(
  payslip: {
    allowance_amount?: number | null;
    deductions_breakdown?: Record<string, unknown> | null;
  },
  cutoffRow?: CutoffAllowanceRow | null
): number {
  const ded = payslip.deductions_breakdown || {};
  const fromColumn = safeNumber(payslip.allowance_amount);
  if (fromColumn > 0) return fromColumn;
  const fromBreakdown = safeNumber(ded.allowance_amount);
  if (fromBreakdown > 0) return fromBreakdown;
  const fromLines = sumAllowanceLines(ded.allowance_lines);
  if (fromLines > 0) return fromLines;
  return sumCutoffAllowanceRow(cutoffRow);
}

export function allowanceLinesFromCutoffRow(
  row?: CutoffAllowanceRow | null
): AllowanceLine[] {
  if (!row) return [];
  return [
    { type: "Transpo", amount: safeNumber(row.transpo_allowance) },
    { type: "Load", amount: safeNumber(row.load_allowance) },
    { type: "Allowance", amount: safeNumber(row.allowance) },
    { type: "Refund", amount: safeNumber(row.refund) },
  ];
}

export function allowanceLinesFromBreakdown(
  deductionsBreakdown?: Record<string, unknown> | null
): AllowanceLine[] | null {
  const lines = deductionsBreakdown?.allowance_lines;
  if (!Array.isArray(lines) || lines.length === 0) return null;
  const amounts = new Map<AllowanceType, number>();
  for (const t of ALLOWANCE_TYPES) amounts.set(t, 0);
  for (const line of lines) {
    const L = line as { type?: string; amount?: unknown };
    const typ = String(L?.type ?? "").trim() as AllowanceType;
    if ((ALLOWANCE_TYPES as readonly string[]).includes(typ)) {
      amounts.set(typ, safeNumber(L?.amount));
    }
  }
  return ALLOWANCE_TYPES.map((type) => ({
    type,
    amount: amounts.get(type) ?? 0,
  }));
}

/** Single allowance field for payslip UI — saved lines and cutoff rows sum to one amount. */
export function resolveAllowanceInputAmount(
  deductionsBreakdown?: Record<string, unknown> | null,
  cutoffRow?: CutoffAllowanceRow | null,
  allowanceAmount?: number | null
): string {
  const fromColumn = safeNumber(allowanceAmount);
  if (fromColumn > 0) return String(fromColumn);

  const fromBreakdown = safeNumber(deductionsBreakdown?.allowance_amount);
  if (fromBreakdown > 0) return String(fromBreakdown);

  const fromLines = sumAllowanceLines(deductionsBreakdown?.allowance_lines);
  if (fromLines > 0) return String(fromLines);

  const fromCutoff = sumCutoffAllowanceRow(cutoffRow);
  if (fromCutoff > 0) return String(fromCutoff);

  return "0";
}
