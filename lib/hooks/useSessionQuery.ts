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
 * Hydration-safe: restore sessionStorage in useEffect (not useState init).
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

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!(enabled && key && url));
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const gen = useRef(0);

  useEffect(() => {
    if (!enabled || !key) {
      setReady(true);
      return;
    }
    const cached = sessionCacheGet<T>(key, ttl);
    if (cached) {
      setData(cached.data);
      setLoading(false);
    }
    setReady(true);
  }, [enabled, key, ttl]);

  const refresh = useCallback(
    async (opts?: { force?: boolean }) => {
      if (!enabled || !key || !url) return;
      const my = ++gen.current;
      const cached = sessionCacheGet<T>(key, ttl);
      const age = cached ? Date.now() - cached.at : Infinity;
      const needsNetwork = opts?.force || !cached || age > staleTime;

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
        const fresh = await sessionFetchJson<T>(key, url);
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
    },
    [enabled, key, url, ttl, staleTime]
  );

  useEffect(() => {
    if (!ready) return;
    void refresh();
  }, [ready, refresh]);

  return { data, loading, validating, error, refresh };
}
