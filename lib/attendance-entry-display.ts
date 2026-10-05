/** Labels for the attendance Entries column (same shape as GP-HRIS). */

export function attendanceEntryStatusLabel(punch: {
  status: string;
  clockOutTime: string | null;
}): string {
  if (!punch.clockOutTime || punch.status === "clocked_in") return "Incomplete";
  switch (punch.status) {
    case "rejected":
      return "Rejected";
    case "pending":
      return "Pending";
    case "approved":
      return "Approved";
    default:
      return "Auto approved";
  }
}

/** Elapsed punch span. Falls back to credited regular hours when total is missing. */
export function attendanceEntryHoursLabel(punch: {
  totalHours: number | null;
  regularHours: number | null;
}): string | null {
  const elapsed = Number(punch.totalHours ?? 0);
  const regular = Number(punch.regularHours ?? 0);
  const hours = elapsed > 0 ? elapsed : regular > 0 ? regular : null;
  if (hours == null) return null;
  return `${Number(hours.toFixed(2))}h`;
}

export function attendanceEntrySourceLabel(input: {
  source?: string | null;
  device?: string | null;
}): "Biometric" | "Bundy" | null {
  const source = String(input.source || "").toLowerCase();
  const device = String(input.device || "").toLowerCase();
  if (source === "admin_correction" || device.startsWith("admin:manual")) return null;
  if (
    source === "biometric" ||
    device.includes("biometric") ||
    device.includes("zkteco")
  ) {
    return "Biometric";
  }
  return "Bundy";
}

export function attendanceEntryStatusTone(statusLabel: string): string {
  switch (statusLabel) {
    case "Incomplete":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "Rejected":
      return "bg-red-100 text-red-800 border-red-200";
    case "Approved":
    case "Auto approved":
      return "bg-green-100 text-green-800 border-green-200";
    default:
      return "bg-muted text-foreground border-border";
  }
}
