"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  SESSION_STALE_MS,
  SESSION_TTL_MS,
  sessionCacheGet,
  sessionCacheSet,
} from "@/lib/session-cache";

type Options = {
  enabled?: boolean;
  staleTime?: number;
  ttl?: number;
};

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

  return { data, loading, validating, error, refresh, setData };
}
