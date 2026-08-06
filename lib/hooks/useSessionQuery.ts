"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  SESSION_STALE_MS,
  SESSION_TTL_MS,
  prefetchSessionJson,
  sessionCacheGet,
  sessionFetchJson,
} from "@/lib/session-cache";

type PrefetchTarget = { key: string; url: string };

type Options = {
  enabled?: boolean;
  staleTime?: number;
  ttl?: number;
  prefetch?: PrefetchTarget[];
};

/**
 * Hydration-safe session cache hook.
 * Never starts in a loading state when cached data exists — avoids full-page
 * spinners when a tab remounts after cross-tab auth sync or back/forward nav.
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
      const fresh = await sessionFetchJson<T>(k, u);
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

  return { data, loading, validating, error, refresh };
}
