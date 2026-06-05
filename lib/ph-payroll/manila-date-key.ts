/** Manila calendar date (yyyy-MM-dd) from an ISO timestamp. */
export function manilaDateKeyFromIso(iso: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date(iso));
  return `${parts.find((p) => p.type === "year")?.value}-${
    parts.find((p) => p.type === "month")?.value
  }-${parts.find((p) => p.type === "day")?.value}`;
}
