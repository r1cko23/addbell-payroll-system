export type PhilippinePhoneKind = "mobile" | "landline";

export function normalizePhilippinePhone(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("63") && digits.length > 10) {
    digits = `0${digits.slice(2)}`;
  }
  return digits;
}

/** @deprecated Use normalizePhilippinePhone */
export const normalizePhilippineMobilePhone = normalizePhilippinePhone;

export function canonicalizePhilippinePhoneDigits(value: string): string {
  const { main } = parsePhoneWithExtension(value);
  let digits = normalizePhilippinePhone(main);
  if (/^9\d{9}$/.test(digits)) {
    digits = `0${digits}`;
  }
  if (/^\d{7,8}$/.test(digits)) {
    digits = `02${digits.padStart(8, "0")}`;
  }
  return digits;
}

function parsePhoneWithExtension(value: string): { main: string; suffix?: string } {
  const match = value.match(/^(.+?)\s+TO\s+(.+)$/i);
  if (!match) return { main: value.trim() };
  return { main: match[1].trim(), suffix: match[2].trim() };
}

function formatMobileDisplay(digits: string): string {
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
}

function formatLandlineDisplay(digits: string): string {
  if (digits.startsWith("02") && digits.length === 10) {
    return `(02) ${digits.slice(2, 6)} ${digits.slice(6)}`;
  }
  if (digits.length === 10 && /^0[3-8]/.test(digits)) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  if (digits.length === 11 && /^0[3-8]/.test(digits)) {
    return `(${digits.slice(0, 4)}) ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  return digits;
}

function formatForeignPhoneDisplay(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function classifyPhilippinePhone(
  value: string
): PhilippinePhoneKind | null {
  const { main } = parsePhoneWithExtension(value);
  const digits = canonicalizePhilippinePhoneDigits(main);
  if (/^09\d{9}$/.test(digits)) return "mobile";
  if (/^02\d{8}$/.test(digits)) return "landline";
  if (/^0[3-8]\d{7,9}$/.test(digits) && digits.length >= 9 && digits.length <= 11) {
    return "landline";
  }
  return null;
}

export function isValidPhilippinePhone(value: string): boolean {
  return classifyPhilippinePhone(value) !== null;
}

export function isAcceptableVendorPhoneEntry(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (isValidPhilippinePhone(trimmed)) return true;
  if (trimmed.startsWith("+")) {
    return normalizePhilippinePhone(trimmed).length >= 8;
  }
  return false;
}

/** @deprecated Use isValidPhilippinePhone */
export function isValidPhilippineMobilePhone(value: string): boolean {
  return classifyPhilippinePhone(value) === "mobile";
}

export function getPhilippinePhoneLabel(value: string): string {
  const kind = classifyPhilippinePhone(value);
  if (kind === "mobile") return "Mobile";
  if (kind === "landline") return "Tel";
  if (value.trim().startsWith("+") || normalizePhilippinePhone(value).length > 11) {
    return "Intl";
  }
  return "Phone";
}

export function formatPhilippinePhoneDisplay(
  value: string | null | undefined
): string {
  if (!value?.trim()) return "—";

  const { main, suffix } = parsePhoneWithExtension(value);
  const digits = canonicalizePhilippinePhoneDigits(main);
  const kind = classifyPhilippinePhone(main);

  let formatted: string;
  if (kind === "mobile") {
    formatted = formatMobileDisplay(digits);
  } else if (kind === "landline") {
    formatted = formatLandlineDisplay(digits);
  } else if (main.trim().startsWith("+") || /^\+?\d{2,}/.test(main.trim())) {
    formatted = formatForeignPhoneDisplay(main);
  } else {
    formatted = main.trim().replace(/-/g, " ").replace(/\s+/g, " ");
  }

  if (suffix) {
    formatted += ` loc. ${suffix}`;
  }

  return formatted;
}

/** @deprecated Use formatPhilippinePhoneDisplay */
export const formatPhilippineMobilePhoneDisplay = formatPhilippinePhoneDisplay;

const PHONE_CHUNK_PATTERN =
  /\+?\d[\d\s().-]{5,}\d(?:\s+TO\s+\d+)?/gi;

export function expandPhilippinePhoneEntries(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];

  const separatorParts = trimmed
    .split(/\s*(?:;|,|\/|\||\n|\band\b)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);

  if (separatorParts.length > 1) {
    return separatorParts.flatMap((part) => expandPhilippinePhoneEntries(part));
  }

  const matches = trimmed.match(PHONE_CHUNK_PATTERN);
  if (matches && matches.length > 1) {
    return matches.map((part) => part.trim());
  }

  return [trimmed];
}

export function dedupePhoneEntries(entries: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const entry of entries) {
    const key = canonicalizePhilippinePhoneDigits(entry) || entry.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(entry.trim());
  }

  return result;
}

export function normalizePhoneEntryForStorage(value: string): string {
  const { main, suffix } = parsePhoneWithExtension(value);
  const digits = canonicalizePhilippinePhoneDigits(main);
  if (classifyPhilippinePhone(main)) {
    return suffix ? `${digits} TO ${suffix}` : digits;
  }
  return value.trim().replace(/\s+/g, " ");
}

export function primaryStoredPhone(value: string): string {
  const { main } = parsePhoneWithExtension(value);
  const digits = canonicalizePhilippinePhoneDigits(main);
  if (classifyPhilippinePhone(main)) return digits;
  return main.trim();
}
