"use client";

import { invalidateSessionCache } from "@/lib/session-cache";

const EPOCH_STORAGE_KEY = "addbell:sc:__epoch";
const BUS_CHANNEL = "addbell:cache-bus";

/**
 * Free-tier budget (approx, mid-session freshness only):
 *
 * Upstash Redis free: 500K cmds/mo
 * Vercel Hobby:       1M function invocations/mo
 * Supabase free:      unlimited API reqs; watch 5GB egress / 500MB DB
 *
 * Safe defaults for ~20–50 concurrent office users:
 * - Session cache absorbs nav (0 Redis / 0 Vercel for warm pages).
 * - Focus → epoch probe at most every CLIENT_EPOCH_MIN_INTERVAL_MS (not full list refetch).
 * - Background poll only on hot queues, ≥ FREE_TIER_POLL_EPOCH_MS, visible tab only.
 * - No poll when Redis is disabled (epoch stays 0).
 *
 * Example worst case (10 tabs polling @ 3min, 8h × 22d):
 *   10 × 20 × 8 × 22 ≈ 35K Vercel invokes + ~35K Redis GETs — well under free caps.
 */
export const FREE_TIER_POLL_EPOCH_MS = 180_000;
export const CLIENT_EPOCH_MIN_INTERVAL_MS = 30_000;
export const FREE_TIER_FOCUS_THROTTLE_MS = 30_000;

type EpochListener = () => void;

type Subscriber = {
  listener: EpochListener;
  pollMs: number;
};

const subscribers = new Set<Subscriber>();
let knownEpoch: number | null = null;
let redisEnabled: boolean | null = null;
let syncInFlight: Promise<"unchanged" | "changed" | "unknown"> | null = null;
let lastSyncAt = 0;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let activePollMs = 0;
let bus: BroadcastChannel | null = null;
let busBound = false;

function readStoredEpoch(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const n = Number(sessionStorage.getItem(EPOCH_STORAGE_KEY));
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeStoredEpoch(epoch: number): void {
  knownEpoch = epoch;
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(EPOCH_STORAGE_KEY, String(epoch));
  } catch {
    /* private mode */
  }
}

function ensureKnownEpoch(): number | null {
  if (knownEpoch !== null) return knownEpoch;
  knownEpoch = readStoredEpoch();
  return knownEpoch;
}

function notifyListeners(): void {
  for (const sub of subscribers) {
    try {
      sub.listener();
    } catch {
      /* ignore subscriber errors */
    }
  }
}

function getBus(): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  if (typeof BroadcastChannel === "undefined") return null;
  if (!bus) bus = new BroadcastChannel(BUS_CHANNEL);
  return bus;
}

function bindBus(): void {
  if (busBound) return;
  const channel = getBus();
  if (!channel) return;
  busBound = true;
  channel.onmessage = (event: MessageEvent<{ type?: string; epoch?: number }>) => {
    const type = event.data?.type;
    if (type === "bust") {
      invalidateSessionCache();
      if (typeof event.data?.epoch === "number") {
        writeStoredEpoch(event.data.epoch);
      }
      notifyListeners();
      return;
    }
    if (type === "epoch" && typeof event.data?.epoch === "number") {
      const prev = ensureKnownEpoch();
      writeStoredEpoch(event.data.epoch);
      if (prev !== null && prev !== event.data.epoch) {
        invalidateSessionCache();
        notifyListeners();
      }
    }
  };
}

function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  activePollMs = 0;
}

function tickPoll(): void {
  if (typeof document !== "undefined" && document.visibilityState !== "visible") {
    return;
  }
  // No Redis → polling cannot observe cross-user invalidation; skip network.
  if (redisEnabled === false) return;
  void syncCacheEpoch();
}

function desiredPollMs(): number {
  if (redisEnabled === false) return 0;
  let min = 0;
  for (const sub of subscribers) {
    if (sub.pollMs <= 0) continue;
    if (min === 0 || sub.pollMs < min) min = sub.pollMs;
  }
  return min;
}

function reconcilePolling(): void {
  const ms = desiredPollMs();
  if (ms <= 0) {
    stopPolling();
    return;
  }
  if (pollTimer && activePollMs === ms) return;
  stopPolling();
  activePollMs = ms;
  pollTimer = setInterval(tickPoll, ms);
}

/**
 * Fetch shared Redis epoch. If it advanced since last check, clear session
 * cache and notify subscribers so open queries force-refetch.
 *
 * Coalesces in-flight requests and skips the network if we synced recently
 * (spam focus/alt-tab safe for Upstash + Vercel free tiers).
 */
export async function syncCacheEpoch(opts?: {
  force?: boolean;
}): Promise<"unchanged" | "changed" | "unknown"> {
  if (typeof window === "undefined") return "unknown";
  if (syncInFlight) return syncInFlight;

  // Known no-Redis deploy: never keep hitting Vercel for a constant 0 epoch.
  if (redisEnabled === false && !opts?.force) {
    return "unchanged";
  }

  const now = Date.now();
  if (
    !opts?.force &&
    ensureKnownEpoch() !== null &&
    now - lastSyncAt < CLIENT_EPOCH_MIN_INTERVAL_MS
  ) {
    return "unchanged";
  }

  syncInFlight = (async () => {
    try {
      const res = await fetch("/api/cache/epoch", { method: "GET" });
      if (!res.ok) return "unknown";
      const json = (await res.json()) as { epoch?: number; redis?: boolean };
      if (typeof json.epoch !== "number" || !Number.isFinite(json.epoch)) {
        return "unknown";
      }

      lastSyncAt = Date.now();
      redisEnabled = json.redis !== false;
      if (!redisEnabled) {
        writeStoredEpoch(json.epoch);
        reconcilePolling(); // stop any active pollers
        return "unchanged";
      }

      const prev = ensureKnownEpoch();
      writeStoredEpoch(json.epoch);
      getBus()?.postMessage({ type: "epoch", epoch: json.epoch });

      if (prev === null || prev === json.epoch) return "unchanged";

      invalidateSessionCache();
      notifyListeners();
      return "changed";
    } catch {
      return "unknown";
    } finally {
      syncInFlight = null;
    }
  })();

  return syncInFlight;
}

/** Call after local bustCache so other tabs drop session data immediately. */
export function broadcastCacheBust(): void {
  bindBus();
  getBus()?.postMessage({ type: "bust" });
}

/**
 * Subscribe to cross-user / cross-tab cache invalidation.
 * When pollMs > 0, runs a single shared interval (visible tabs only).
 * Interval reconciles to the most aggressive active subscriber.
 */
export function subscribeCacheInvalidation(
  listener: EpochListener,
  pollMs: number | false = false
): () => void {
  bindBus();
  const requested =
    typeof pollMs === "number" && pollMs > 0 ? pollMs : 0;
  // Never poll faster than the free-tier floor, even if a caller passes 60s.
  const safePoll =
    requested > 0 ? Math.max(requested, FREE_TIER_POLL_EPOCH_MS) : 0;

  const sub: Subscriber = {
    listener,
    pollMs: safePoll,
  };
  subscribers.add(sub);
  reconcilePolling();

  return () => {
    subscribers.delete(sub);
    reconcilePolling();
  };
}
