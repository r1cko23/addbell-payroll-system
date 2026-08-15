const STORAGE_PREFIX = "addbell:sc:";
const VERSION_KEY = "addbell:sc:__v";
const DEFAULT_TTL_MS = 30 * 60 * 1000;

type RecordShape = { v: number; at: number; data: unknown };

const memory = new Map<string, RecordShape>();

function readVersion(): number {
  if (typeof window === "undefined") return 0;
  try {
    const n = Number(sessionStorage.getItem(VERSION_KEY) ?? 0);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function writeVersion(v: number): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(VERSION_KEY, String(v));
  } catch {
    /* private mode */
  }
}

function isFresh(rec: RecordShape, ttlMs: number): boolean {
  if (rec.v !== readVersion()) return false;
  return Date.now() - rec.at <= ttlMs;
}

export function sessionCacheGet<T>(
  key: string,
  ttlMs = DEFAULT_TTL_MS
): { data: T; at: number } | null {
  if (typeof window === "undefined") return null;
  const mem = memory.get(key);
  if (mem && isFresh(mem, ttlMs)) {
    return { data: mem.data as T, at: mem.at };
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RecordShape;
    if (!isFresh(parsed, ttlMs)) {
      sessionStorage.removeItem(STORAGE_PREFIX + key);
      memory.delete(key);
      return null;
    }
    memory.set(key, parsed);
    return { data: parsed.data as T, at: parsed.at };
  } catch {
    return null;
  }
}

export function sessionCacheSet(key: string, data: unknown): void {
  if (typeof window === "undefined") return;
  const rec: RecordShape = { v: readVersion(), at: Date.now(), data };
  memory.set(key, rec);
  try {
    sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(rec));
  } catch {
    /* memory still works */
  }
}

export function invalidateSessionCache(): void {
  memory.clear();
  if (typeof window === "undefined") return;
  try {
    writeVersion(readVersion() + 1);
    const toRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const k = sessionStorage.key(i);
      if (k?.startsWith(STORAGE_PREFIX) && k !== VERSION_KEY) toRemove.push(k);
    }
    for (const k of toRemove) sessionStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}

export async function sessionFetchJson<T>(
  key: string,
  url: string,
  init?: RequestInit & { bypassCache?: boolean }
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.bypassCache) {
    headers.set("x-cache-revalidate", "1");
  }
  const res = await fetch(url, {
    method: init?.method,
    body: init?.body,
    credentials: init?.credentials,
    headers,
    cache: "no-store",
  });
  const json = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(json.error || `Request failed (${res.status})`);
  }
  sessionCacheSet(key, json);
  return json;
}

export function prefetchSessionJson(key: string, url: string): void {
  if (typeof window === "undefined") return;
  if (sessionCacheGet(key)) return;
  void sessionFetchJson(key, url).catch(() => undefined);
}

export const SESSION_STALE_MS = 10 * 60 * 1000;
export const SESSION_TTL_MS = DEFAULT_TTL_MS;
