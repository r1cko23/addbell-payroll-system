import { format, isValid, parse } from "date-fns";

export const PO_DATE_TEXT_FORMAT = "MMM. d, yyyy";

const PARSE_FORMATS = [
  "yyyy-MM-dd",
  PO_DATE_TEXT_FORMAT,
  "MMM d, yyyy",
  "MMMM d, yyyy",
] as const;

export function formatPoDateText(date: Date): string {
  return format(date, PO_DATE_TEXT_FORMAT);
}

export function parsePoDateText(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  for (const fmt of PARSE_FORMATS) {
    const parsed = parse(trimmed, fmt, new Date());
    if (isValid(parsed)) return parsed;
  }
  return null;
}

export function poDateTextToYmd(value: string): string {
  const parsed = parsePoDateText(value);
  return parsed ? format(parsed, "yyyy-MM-dd") : "";
}

export function ymdToPoDateText(ymd: string): string {
  const parsed = parsePoDateText(ymd);
  return parsed ? formatPoDateText(parsed) : "";
}

export function issuedAtFromPoDateText(dateText: string): Date {
  return parsePoDateText(dateText) ?? new Date();
}
