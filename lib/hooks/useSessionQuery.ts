"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  SESSION_STALE_MS,
  SESSION_TTL_MS,
  prefetchSessionJson,
  sessionCacheGet,
  sessionFetchJson,
} from "@/lib/session-cache";
import {
  FREE_TIER_FOCUS_THROTTLE_MS,
  subscribeCacheInvalidation,
  syncCacheEpoch,
} from "@/lib/cache-epoch-client";

type PrefetchTarget = { key: string; url: string };

type Options = {
  enabled?: boolean;
  staleTime?: number;
  ttl?: number;
  prefetch?: PrefetchTarget[];
  /** Refetch when tab becomes visible / window focused. Default true. */
  refetchOnWindowFocus?: boolean;
  /** Min ms between focus-triggered epoch checks. Default 15s. */
  focusThrottleMs?: number;
  /** Refetch when browser comes online. Default true. */
  refetchOnReconnect?: boolean;
  /**
   * Poll shared cache epoch while this query is enabled.
   * When epoch advances (another user mutated), session cache clears and this
   * query force-refetches. Default false — enable on hot approval/inbox pages.
   */
  pollEpochMs?: number | false;
};

const DEFAULT_FOCUS_THROTTLE_MS = FREE_TIER_FOCUS_THROTTLE_MS;

/**
 * Hydration-safe session cache hook.
 * Never starts in a loading state when cached data exists — avoids full-page
 * spinners when a tab remounts after cross-tab auth sync or back/forward nav.
 *
 * Mid-session freshness:
 * - refetchOnWindowFocus → cheap epoch check; force only if epoch advanced
 * - pollEpochMs → detect other users' bustCache / Redis epoch bumps
 * - BroadcastChannel (via bustCache) → other local tabs refresh immediately
 */
export function useSessionQuery<T>(
  key: string | null,
  url: string | null,
  options: Options = {}
) {
  const {
    enabled = true,
    staleTime = SESSION_STALE_MS,
    ttl = SESSION_TTL_MS,
    prefetch = [],
    refetchOnWindowFocus = true,
    focusThrottleMs = DEFAULT_FOCUS_THROTTLE_MS,
    refetchOnReconnect = true,
    pollEpochMs = false,
  } = options;

  const prefetchRef = useRef(prefetch);
  prefetchRef.current = prefetch;

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const keyRef = useRef(key);
  keyRef.current = key;
  const urlRef = useRef(url);
  urlRef.current = url;
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
    const u = urlRef.current;
    if (!enabledRef.current || !k || !u) return;

    const my = ++gen.current;
    const cached = sessionCacheGet<T>(k, ttlRef.current);
    const age = cached ? Date.now() - cached.at : Infinity;
    const needsNetwork = opts?.force || !cached || age > staleTimeRef.current;

    if (cached) {
      setData(cached.data);
      setLoading(false);
    }
    if (!needsNetwork) {
      for (const p of prefetchRef.current) prefetchSessionJson(p.key, p.url);
      return;
    }

    if (!cached) setLoading(true);
    else setValidating(true);
    setError(null);

    try {
      const fresh = await sessionFetchJson<T>(
        k,
        u,
        opts?.force ? { bypassCache: true } : undefined
      );
      if (gen.current !== my) return;
      setData(fresh);
      for (const p of prefetchRef.current) prefetchSessionJson(p.key, p.url);
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
    if (!enabled || !key || !url) {
      return;
    }

    const cached = sessionCacheGet<T>(key, ttl);
    if (cached) {
      setData(cached.data);
      setLoading(false);
    } else {
      setLoading(true);
    }

    void refresh();
  }, [enabled, key, url, ttl, refresh]);

  // Mid-session: focus / reconnect / epoch / cross-tab bust
  useEffect(() => {
    if (!enabled || !key || !url) return;

    const forceRefresh = () => {
      void refresh({ force: true });
    };

    const onExternalInvalidation = () => {
      forceRefresh();
    };

    const unsub = subscribeCacheInvalidation(
      onExternalInvalidation,
      pollEpochMs
    );

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
        // Epoch bump already cleared session + force-refetched via subscribers.
        if (result === "changed") return;
        // Soft only: uses session cache; networks only if past staleTime.
        // Spam alt-tab within 10m stale window → no list API / Redis reads.
        await refresh();
      })();
    };

    const onOnline = () => {
      if (!refetchOnReconnect) return;
      // Soft refetch after reconnect — force only if data is already stale.
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
    url,
    refresh,
    refetchOnWindowFocus,
    focusThrottleMs,
    refetchOnReconnect,
    pollEpochMs,
  ]);

  return { data, loading, validating, error, refresh };
}
