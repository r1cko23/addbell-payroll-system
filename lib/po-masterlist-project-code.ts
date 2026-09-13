/**
 * Catalog `projects.code` for a new masterlist job: the client P.O. number.
 * Never hashes title/location into an ML-* code.
 */
export function nextProjectCodeFromPoNumber(
  poNumber: string,
  usedCodes: Set<string>
): string {
  const base = poNumber.trim();
  if (!base) {
    throw new Error("P.O. number is required");
  }

  const usedUpper = new Set(
    [...usedCodes].map((code) => code.trim().toUpperCase()).filter(Boolean)
  );

  if (!usedUpper.has(base.toUpperCase())) {
    usedCodes.add(base);
    return base;
  }

  let suffix = 2;
  let candidate = `${base}-${suffix}`;
  while (usedUpper.has(candidate.toUpperCase())) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  usedCodes.add(candidate);
  return candidate;
}

/** Visible P.O. reference for a linked catalog project. Dedupes blanket-PO rows. */
export function projectDetailPoReference(
  jobs: { po_number?: string | null }[]
): string | null {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const job of jobs) {
    const po = job.po_number?.trim();
    if (!po) continue;
    const key = po.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(po);
  }
  if (unique.length === 0) return null;
  return unique.join(" · ");
}
