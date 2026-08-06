import { invalidateSessionCache } from "@/lib/session-cache";

export async function bustCache(): Promise<void> {
  invalidateSessionCache();
  try {
    await fetch("/api/cache/invalidate", { method: "POST" });
  } catch {
    /* best-effort */
  }
}
