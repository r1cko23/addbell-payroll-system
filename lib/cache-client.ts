import { invalidateSessionCache } from "@/lib/session-cache";
import { broadcastCacheBust } from "@/lib/cache-epoch-client";

let invalidateInFlight: Promise<void> | null = null;
let lastInvalidateStartedAt = 0;
const CLIENT_INVALIDATE_COALESCE_MS = 3_000;

/**
 * Clear browser session cache and bump Upstash epoch (best-effort).
 * Coalesces rapid POST /api/cache/invalidate calls (approve bursts, multi-refresh).
 * Also notifies other open tabs via BroadcastChannel.
 */
export async function bustCache(): Promise<void> {
  invalidateSessionCache();
  broadcastCacheBust();

  const now = Date.now();
  if (
    invalidateInFlight &&
    now - lastInvalidateStartedAt < CLIENT_INVALIDATE_COALESCE_MS
  ) {
    return invalidateInFlight;
  }

  lastInvalidateStartedAt = now;
  invalidateInFlight = (async () => {
    try {
      await fetch("/api/cache/invalidate", { method: "POST" });
    } catch {
      /* best-effort */
    }
  })();

  try {
    await invalidateInFlight;
  } finally {
    // Keep coalesce window even after settle so parallel callers share one POST.
    setTimeout(() => {
      if (Date.now() - lastInvalidateStartedAt >= CLIENT_INVALIDATE_COALESCE_MS) {
        invalidateInFlight = null;
      }
    }, CLIENT_INVALIDATE_COALESCE_MS);
  }
}
