/**
 * Optimized hook to fetch current user data using /api/auth/me endpoint
 * This combines auth.getUser() and users table query into a single server-side call
 *
 * PERFORMANCE BENEFITS:
 * - Single API call instead of sequential client-side calls
 * - Server-side execution is faster
 * - Better caching with HTTP cache headers
 * - Reduces client-side rate limiting issues
 */

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import type { Database } from "@/types/database";

type UserRole = Database["public"]["Tables"]["users"]["Row"]["role"];

interface CurrentUser {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  profile_picture_url: string | null;
  can_access_salary: boolean;
}

interface UseCurrentUserData {
  user: CurrentUser | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// Module-level cache to share across components
let cachedUser: CurrentUser | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
let fetchPromise: Promise<CurrentUser | null> | null = null;

/**
 * Fetch user data from /api/auth/me endpoint
 */
async function fetchCurrentUser(force = false): Promise<CurrentUser | null> {
  const now = Date.now();

  // Check cache first
  if (!force && cachedUser && now - cacheTimestamp < CACHE_DURATION) {
    return cachedUser;
  }

  // If there's already a fetch in progress, return that promise
  if (fetchPromise) {
    return fetchPromise;
  }

  // Create new fetch promise
  fetchPromise = (async () => {
    try {
      const response = await fetch("/api/auth/me", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        // Use cache for non-forced requests
        cache: force ? "no-store" : "default",
      });

      if (!response.ok) {
        if (response.status === 401) {
          // User not authenticated
          cachedUser = null;
          cacheTimestamp = 0;
          return null;
        }
        throw new Error(`Failed to fetch user: ${response.statusText}`);
      }

      const data = await response.json();
      const user = data.user as CurrentUser;

      // Update cache
      cachedUser = user;
      cacheTimestamp = now;

      return user;
    } catch (error) {
      console.error("Error fetching current user:", error);
      // Return cached user on error if available
      return cachedUser;
    } finally {
      fetchPromise = null;
    }
  })();

  return fetchPromise;
}

/**
 * Hook to get current user data
 */
export function useCurrentUser(): UseCurrentUserData {
  const [user, setUser] = useState<CurrentUser | null>(cachedUser);
  const [loading, setLoading] = useState(!cachedUser);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const fetchUser = useCallback(async (force = false) => {
    // Prevent duplicate fetches
    if (fetchedRef.current && !force) return;
    fetchedRef.current = true;

    try {
      setLoading(true);
      setError(null);

      const userData = await fetchCurrentUser(force);
      setUser(userData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      console.error("Error in useCurrentUser:", err);
    } finally {
      setLoading(false);
      fetchedRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const refetch = useCallback(() => {
    fetchUser(true);
  }, [fetchUser]);

  return useMemo(
    () => ({
      user,
      loading,
      error,
      refetch,
    }),
    [user, loading, error, refetch]
  );
}

/**
 * Clear the cached user (call on logout)
 */
export function clearCurrentUserCache() {
  cachedUser = null;
  cacheTimestamp = 0;
  fetchPromise = null;
}