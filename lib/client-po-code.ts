/** Sequential purchasing codes for clients, starting at 01. */

export function formatClientPoCode(n: number): string {
  if (!Number.isInteger(n) || n < 1) {
    throw new Error("Client PO code must be a positive integer");
  }
  return n < 100 ? String(n).padStart(2, "0") : String(n);
}

export function parseClientPoCode(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d{1,}$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

function takenNumericCodes(used: Set<string>): Set<number> {
  const taken = new Set<number>();
  for (const raw of used) {
    const n = parseClientPoCode(raw);
    if (n != null) taken.add(n);
  }
  return taken;
}

export function nextClientPoCode(used: Set<string>): string {
  const taken = takenNumericCodes(used);
  let n = 1;
  while (taken.has(n)) n += 1;
  const code = formatClientPoCode(n);
  used.add(code);
  return code;
}

export function assignSequentialClientPoCodes(
  clients: { id: string; name: string }[]
): { id: string; clientPoCode: string }[] {
  const sorted = [...clients].sort((left, right) => {
    const byName = left.name.trim().toLowerCase().localeCompare(
      right.name.trim().toLowerCase()
    );
    if (byName !== 0) return byName;
    return left.id.localeCompare(right.id);
  });
  return sorted.map((client, index) => ({
    id: client.id,
    clientPoCode: formatClientPoCode(index + 1),
  }));
}
