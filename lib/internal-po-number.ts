/** Internal Addbell PO numbers: ADDPO-YYMM-{clientPoCode}{monthlySequence}. */

export type NextInternalPoNumberInput = {
  issuedAt: Date;
  clientPoCode: string;
  existingPoNumbers: string[];
};

export function formatPoYearMonth(issuedAt: Date): string {
  const year = issuedAt.getFullYear();
  const month = issuedAt.getMonth() + 1;
  return `${String(year).slice(-2)}${String(month).padStart(2, "0")}`;
}

export function formatMonthlyPoSequence(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error("PO sequence must be a positive integer");
  }
  return sequence < 100 ? String(sequence).padStart(2, "0") : String(sequence);
}

export function formatInternalPoNumber(input: {
  yearMonth: string;
  clientPoCode: string;
  sequence: number;
}): string {
  const clientPoCode = input.clientPoCode.trim();
  if (!clientPoCode) {
    throw new Error("Client PO code is required");
  }
  return `ADDPO-${input.yearMonth}-${clientPoCode}${formatMonthlyPoSequence(input.sequence)}`;
}

function monthlySequenceFromSuffix(suffix: string): number | null {
  if (suffix.length < 3) return null;
  const last2 = suffix.slice(-2);
  if (!/^\d{2}$/.test(last2)) return null;
  if (suffix.length >= 5) {
    const last3 = suffix.slice(-3);
    if (/^\d{3}$/.test(last3)) {
      const three = Number(last3);
      if (three >= 100) return three;
    }
  }
  return Number(last2);
}

export function nextMonthlyInternalPoSequence(
  existingPoNumbers: string[],
  yearMonth: string
): number {
  const prefix = `ADDPO-${yearMonth}-`.toUpperCase();
  let max = 0;
  for (const raw of existingPoNumbers) {
    const po = raw.trim().toUpperCase();
    if (!po.startsWith(prefix)) continue;
    const seq = monthlySequenceFromSuffix(po.slice(prefix.length));
    if (seq != null && seq > max) max = seq;
  }
  return max + 1;
}

export function nextInternalPoNumber(input: NextInternalPoNumberInput): string {
  const clientPoCode = input.clientPoCode.trim();
  if (!clientPoCode) {
    throw new Error("Client PO code is required");
  }
  const yearMonth = formatPoYearMonth(input.issuedAt);
  const sequence = nextMonthlyInternalPoSequence(
    input.existingPoNumbers,
    yearMonth
  );
  return formatInternalPoNumber({ yearMonth, clientPoCode, sequence });
}
