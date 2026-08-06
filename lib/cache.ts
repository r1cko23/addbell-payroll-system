import { getRedis } from "@/lib/redis";

const EPOCH_KEY = "addbell:cache:epoch";
const DEFAULT_TTL_SECONDS = 120;

let epochMemo: { value: number; at: number } | null = null;
const EPOCH_MEMO_MS = 10_000;

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

export async function cacheKey(parts: Array<string | number>): Promise<string> {
  const epoch = await currentEpoch();
  return ["addbell", `e${epoch}`, ...parts.map(String)].join(":");
}

export async function cachedJson<T>(
  keyParts: Array<string | number>,
  loader: () => Promise<T>,
  ttlSeconds = DEFAULT_TTL_SECONDS
): Promise<{ data: T; cache: "HIT" | "MISS" | "BYPASS" }> {
  const redis = getRedis();
  if (!redis) {
    return { data: await loader(), cache: "BYPASS" };
  }
  const key = await cacheKey(keyParts);
  const hit = await redis.get<T>(key);
  if (hit !== null && hit !== undefined) {
    return { data: hit, cache: "HIT" };
  }
  const data = await loader();
  await redis.set(key, data, { ex: ttlSeconds });
  return { data, cache: "MISS" };
}

export async function invalidateAppCache(): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  const next = await redis.incr(EPOCH_KEY);
  epochMemo = { value: next, at: Date.now() };
  return true;
}
