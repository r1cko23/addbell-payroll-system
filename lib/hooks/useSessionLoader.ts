"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  SESSION_STALE_MS,
  SESSION_TTL_MS,
  sessionCacheGet,
  sessionCacheSet,
} from "@/lib/session-cache";
import {
  FREE_TIER_FOCUS_THROTTLE_MS,
  subscribeCacheInvalidation,
  syncCacheEpoch,
} from "@/lib/cache-epoch-client";

type Options = {
  enabled?: boolean;
  staleTime?: number;
  ttl?: number;
  /** Refetch when tab becomes visible / window focused. Default true. */
  refetchOnWindowFocus?: boolean;
  /** Min ms between focus-triggered epoch checks. Default 15s. */
  focusThrottleMs?: number;
  /** Refetch when browser comes online. Default true. */
  refetchOnReconnect?: boolean;
  /** Poll shared cache epoch while enabled. Default false. */
  pollEpochMs?: number | false;
};

const DEFAULT_FOCUS_THROTTLE_MS = FREE_TIER_FOCUS_THROTTLE_MS;

/**
 * Hydration-safe session cache for client-side loaders (Supabase, etc.).
 * Same stale/TTL behavior as useSessionQuery, without requiring an API URL.
 */
export function useSessionLoader<T>(
  key: string | null,
  loader: () => Promise<T>,
  options: Options = {}
) {
  const {
    enabled = true,
    staleTime = SESSION_STALE_MS,
    ttl = SESSION_TTL_MS,
    refetchOnWindowFocus = true,
    focusThrottleMs = DEFAULT_FOCUS_THROTTLE_MS,
    refetchOnReconnect = true,
    pollEpochMs = false,
  } = options;

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const keyRef = useRef(key);
  keyRef.current = key;
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const ttlRef = useRef(ttl);
  ttlRef.current = ttl;
  const staleTimeRef = useRef(staleTime);
  staleTimeRef.current = staleTime;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gen = useRef(0);
  const lastFocusForceAt = useRef(0);

  const refresh = useCallback(async (opts?: { force?: boolean }) => {
    const k = keyRef.current;
    if (!enabledRef.current || !k) return;

    const my = ++gen.current;
    const cached = sessionCacheGet<T>(k, ttlRef.current);
    const age = cached ? Date.now() - cached.at : Infinity;
    const needsNetwork = opts?.force || !cached || age > staleTimeRef.current;

    if (cached) {
      setData(cached.data);
      setLoading(false);
    }
    if (!needsNetwork) return;

    if (!cached) setLoading(true);
    else setValidating(true);
    setError(null);

    try {
      const fresh = await loaderRef.current();
      if (gen.current !== my) return;
      sessionCacheSet(k, fresh);
      setData(fresh);
    } catch (err) {
      if (gen.current !== my) return;
      if (!cached) {
        setError(err instanceof Error ? err.message : "Failed to load");
      }
    } finally {
      if (gen.current === my) {
        setLoading(false);
        setValidating(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled || !key) return;

    const cached = sessionCacheGet<T>(key, ttl);
    if (cached) {
      setData(cached.data);
      setLoading(false);
    } else {
      setLoading(true);
    }

    void refresh();
  }, [enabled, key, ttl, refresh]);

  useEffect(() => {
    if (!enabled || !key) return;

    const unsub = subscribeCacheInvalidation(() => {
      void refresh({ force: true });
    }, pollEpochMs);

    const onFocusOrVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      if (!refetchOnWindowFocus) return;

      const now = Date.now();
      if (now - lastFocusForceAt.current < focusThrottleMs) return;
      lastFocusForceAt.current = now;

      void (async () => {
        const result = await syncCacheEpoch();
        if (result === "changed") return;
        // Soft only — respects staleTime; no Upstash spam on alt-tab.
        await refresh();
      })();
    };

    const onOnline = () => {
      if (!refetchOnReconnect) return;
      void refresh();
    };

    document.addEventListener("visibilitychange", onFocusOrVisible);
    window.addEventListener("focus", onFocusOrVisible);
    window.addEventListener("online", onOnline);

    return () => {
      unsub();
      document.removeEventListener("visibilitychange", onFocusOrVisible);
      window.removeEventListener("focus", onFocusOrVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [
    enabled,
    key,
    refresh,
    refetchOnWindowFocus,
    focusThrottleMs,
    refetchOnReconnect,
    pollEpochMs,
  ]);

  return { data, loading, validating, error, refresh, setData };
}
