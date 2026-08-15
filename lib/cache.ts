import { getRedis } from "@/lib/redis";

/**
 * Upstash free tier (as of 2025+): 500K commands / month, 256 MB, 10 GB bandwidth.
 * Vercel Hobby: 1M function invocations / month.
 * Supabase free: unlimited API requests; watch 5 GB egress + 500 MB DB.
 *
 * Budget for ~50–100 users (session-cache-first):
 * - Browser sessionStorage absorbs most back/forth (0 Redis / 0 Vercel).
 * - Redis is a short shared CDN for cold/stale API hits only.
 * - Shared keys (no per-userId) for admin list payloads that are identical after auth.
 * - Coalesced epoch bumps so bursts of approve/reject don't multiply INCR traffic.
 * - Mid-session epoch probes are throttled client-side (≥30s) and polls ≥3 min
 *   on hot queues only (see lib/cache-epoch-client.ts).
 *
 * Rough ceiling if every active user hits 30 cold API reads/day × ~2 cmds:
 * 100 users × 22 workdays × 30 × 2 ≈ 132K cmds/month — well under 500K.
 * Plus ~35K epoch polls (10 open queues × 3min × 8h × 22d) still ≪ 500K / 1M.
 */
const EPOCH_KEY = "addbell:cache:epoch";
const INVALIDATE_LOCK_KEY = "addbell:cache:invalidate-lock";

/** Match session stale window so warm Redis usually serves revalidation. */
const DEFAULT_TTL_SECONDS = 600;

/** Short memo only coalesces parallel reads on one warm instance.
 * A 60s memo served pre-approve Redis keys after another instance bumped epoch. */
const EPOCH_MEMO_MS = 2_000;

/** At most one global epoch bump per this window (commands + correctness tradeoff). */
const INVALIDATE_COALESCE_MS = 10_000;

let epochMemo: { value: number; at: number } | null = null;
let lastInvalidateAt = 0;

function configuredTtl(fallback: number): number {
  const raw = process.env.UPSTASH_CACHE_TTL_SECONDS;
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 30 ? Math.floor(n) : fallback;
}

async function currentEpoch(): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;
  if (epochMemo && Date.now() - epochMemo.at < EPOCH_MEMO_MS) {
    return epochMemo.value;
  }
  const value = await redis.get<number | string>(EPOCH_KEY);
  const n = typeof value === "number" ? value : Number(value ?? 0);
  const epoch = Number.isFinite(n) ? n : 0;
  epochMemo = { value: epoch, at: Date.now() };
  return epoch;
}

/** Public read of the shared cache epoch (for client freshness checks). */
export async function getCacheEpoch(): Promise<number> {
  return currentEpoch();
}

export async function cacheKey(parts: Array<string | number>): Promise<string> {
  const epoch = await currentEpoch();
  return ["addbell", `e${epoch}`, ...parts.map(String)].join(":");
}

export type CachedJsonOptions = {
  /** When false, run loader only (session cache still applies client-side). Default true. */
  useRedis?: boolean;
  /** Skip Redis GET, load fresh, then write. Used after mutations. */
  revalidate?: boolean;
};

export async function cachedJson<T>(
  keyParts: Array<string | number>,
  loader: () => Promise<T>,
  ttlSeconds = DEFAULT_TTL_SECONDS,
  options: CachedJsonOptions = {}
): Promise<{ data: T; cache: "HIT" | "MISS" | "BYPASS" }> {
  const useRedis = options.useRedis !== false;
  const revalidate = options.revalidate === true;
  const redis = useRedis ? getRedis() : null;
  if (!redis) {
    return { data: await loader(), cache: "BYPASS" };
  }

  const ttl = configuredTtl(ttlSeconds);
  const key = await cacheKey(keyParts);
  try {
    if (!revalidate) {
      const hit = await redis.get<T>(key);
      if (hit !== null && hit !== undefined) {
        return { data: hit, cache: "HIT" };
      }
    }
    const data = await loader();
    await redis.set(key, data, { ex: ttl });
    return { data, cache: "MISS" };
  } catch (err) {
    // Free-tier throttling / transient errors must not break pages.
    console.error("cachedJson redis error — falling back to loader:", err);
    return { data: await loader(), cache: "BYPASS" };
  }
}

/**
 * Bump global cache epoch. Coalesced so approve/reject bursts cost ~1 INCR / 10s.
 */
export async function invalidateAppCache(): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;

  const now = Date.now();
  if (now - lastInvalidateAt < INVALIDATE_COALESCE_MS && epochMemo) {
    return true;
  }

  try {
    // Cross-instance coalesce: only one INCR wins the lock window.
    const locked = await redis.set(INVALIDATE_LOCK_KEY, "1", {
      ex: Math.ceil(INVALIDATE_COALESCE_MS / 1000),
      nx: true,
    });
    if (locked === null) {
      lastInvalidateAt = now;
      // Refresh local epoch memo from Redis without INCR.
      epochMemo = null;
      await currentEpoch();
      return true;
    }

    const next = await redis.incr(EPOCH_KEY);
    epochMemo = { value: next, at: Date.now() };
    lastInvalidateAt = now;
    return true;
  } catch (err) {
    console.error("invalidateAppCache redis error:", err);
    return false;
  }
}

export const CACHE_TTL = {
  /** Shared admin/HR list payloads (OT / leave / FTL / employees / FR). */
  list: DEFAULT_TTL_SECONDS,
  /** Dashboards — shared per role where possible. */
  dashboard: DEFAULT_TTL_SECONDS,
  /** Employee-portal reads (per employee). */
  employeePortal: 300,
  /** High-churn punches — prefer session; keep Redis short if used. */
  timeEntries: 180,
} as const;
