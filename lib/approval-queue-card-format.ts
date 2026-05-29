import { format, parseISO } from "date-fns";
import { formatTime12h, formatTimeRange12h } from "@/utils/format";

export function truncateApprovalText(
  value: string | null | undefined,
  maxLength = 140
): string | null {
  const trimmed = (value || "").trim();
  if (!trimmed) return null;
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

function safeFormatDate(value: string | null | undefined, pattern: string): string {
  if (!value) return "—";
  try {
    const d = value.includes("T") ? parseISO(value) : parseISO(`${value}T12:00:00`);
    return format(d, pattern);
  } catch {
    return value;
  }
}

export function formatLeaveRequestDateLabel(
  startDate: string,
  endDate: string
): string {
  const start = safeFormatDate(startDate, "MMM d, yyyy");
  const end = safeFormatDate(endDate, "MMM d, yyyy");
  return start === end ? start : `${start} – ${end}`;
}

export function formatOtRequestDateLabel(
  otDate: string,
  startTime: string,
  endTime: string
): string {
  const date = safeFormatDate(otDate, "MMM d, yyyy");
  return `${date} · ${formatTimeRange12h(startTime, endTime)}`;
}

export function formatFtlRequestDateLabel(
  missedDate: string | null,
  entryType: string | null,
  actualClockIn?: string | null,
  actualClockOut?: string | null
): string {
  const date = safeFormatDate(missedDate, "MMM d, yyyy");
  const type = (entryType || "log").toUpperCase();
  const parts = [`Missed ${date}`, type];
  if (actualClockIn) {
    parts.push(`In ${formatTime12h(actualClockIn)}`);
  }
  if (actualClockOut) {
    parts.push(`Out ${formatTime12h(actualClockOut)}`);
  }
  return parts.join(" · ");
}

export function formatFiledAtLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return format(parseISO(iso), "MMM d, h:mm a");
  } catch {
    return null;
  }
}
