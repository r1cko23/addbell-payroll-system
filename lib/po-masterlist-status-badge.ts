export type PoMasterlistStatusTone =
  | "success"
  | "progress"
  | "pending"
  | "cancelled"
  | "neutral";

const TONE_CLASS: Record<PoMasterlistStatusTone, string> = {
  success: "!border-emerald-200 !bg-emerald-100 !text-emerald-800",
  progress: "!border-orange-200 !bg-orange-100 !text-orange-800",
  pending: "!border-yellow-200 !bg-yellow-100 !text-yellow-800",
  cancelled: "!border-red-200 !bg-red-100 !text-red-700",
  neutral: "!border-border !bg-muted/40 !text-muted-foreground",
};

function normalizePoMasterlistStatus(status: string | null | undefined): string {
  return (status ?? "")
    .trim()
    .toUpperCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

export function poMasterlistStatusTone(
  status: string | null | undefined
): PoMasterlistStatusTone {
  const normalized = normalizePoMasterlistStatus(status);
  if (!normalized || normalized === "N/A" || normalized === "—") {
    return "neutral";
  }
  if (normalized === "COMPLETED" || normalized === "COMPLETE" || normalized === "PAID") {
    return "success";
  }
  if (
    normalized === "ON GOING" ||
    normalized === "ONGOING" ||
    normalized === "FOR INVOICE"
  ) {
    return "progress";
  }
  if (normalized === "PENDING") return "pending";
  if (normalized === "CANCELLED" || normalized === "CANCELED") {
    return "cancelled";
  }
  return "neutral";
}

export function poMasterlistStatusBadgeClass(
  status: string | null | undefined
): string {
  return TONE_CLASS[poMasterlistStatusTone(status)];
}
