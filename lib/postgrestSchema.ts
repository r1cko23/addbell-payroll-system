/**
 * PostgREST errors when a table or relationship is not in the schema cache.
 * Callers should treat these as "feature absent" and continue without logging noise.
 */
export function isSchemaMissingTableOrRelationError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string };
  if (e.code === "PGRST205" || e.code === "PGRST200") return true;
  const msg = (e.message || "").toLowerCase();
  return (
    msg.includes("could not find the table") ||
    msg.includes("could not find a relationship") ||
    msg.includes("schema cache")
  );
}
