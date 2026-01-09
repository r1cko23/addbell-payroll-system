/**
 * Custom hook to get the current user's role
 * Used for role-based rendering and access control
 *
 * OPTIMIZATIONS:
 * - Session-level caching to prevent redundant API calls
 * - Memoized return values to prevent unnecessary re-renders
 * - Singleton Supabase client usage
 */

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type UserRole =
  | Database["public"]["Tables"]["users"]["Row"]["role"];

interface UserRoleData {
  role: UserRole | null;
  email: string | null;
  loading: boolean;
  error: string | null;
  isAdmin: boolean;
  isHR: boolean;
  isApprover: boolean;
  isViewer: boolean;
  isRestrictedAccess: boolean; // approver or viewer
  canAccessSalaryInfo: boolean; // Admin or April Nina Gammad
  refetch: () => void;
}

// Session-level cache for user role data
let cachedRole: UserRole | null = null;
let cachedEmail: string | null = null;
let cachedCanAccessSalary: boolean | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useUserRole(): UserRoleData {
  const [role, setRole] = useState<UserRole | null>(cachedRole);
  const [email, setEmail] = useState<string | null>(cachedEmail);
  const [canAccessSalary, setCanAccessSalary] = useState<boolean>(cachedCanAccessSalary ?? false);
  const [loading, setLoading] = useState(!cachedRole);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);
  const supabase = createClient();

  const fetchUserRole = useCallback(
    async (force = false) => {
      // Check cache validity
      const now = Date.now();
      if (!force && cachedRole && cachedEmail !== null && cachedCanAccessSalary !== null && now - cacheTimestamp < CACHE_DURATION) {
        setRole(cachedRole);
        setEmail(cachedEmail);
        setCanAccessSalary(cachedCanAccessSalary);
        setLoading(false);
        fetchedRef.current = false; // Reset ref after using cache
        return;
      }

      // Prevent duplicate fetches
      if (fetchedRef.current && !force) return;
      fetchedRef.current = true;

      try {
        setLoading(true);

        // Get current authenticated user using safe utility
        const { getUserSafe } = await import("@/lib/session-utils");
        const user = await getUserSafe();

        if (!user) {
          // Handle rate limit or auth errors gracefully
          if (cachedRole) {
            // Use cached data if available
            setRole(cachedRole);
            setEmail(cachedEmail);
            setCanAccessSalary(cachedCanAccessSalary ?? false);
            setLoading(false);
            fetchedRef.current = false;
            return;
          }
          setError("No authenticated user");
          setLoading(false);
          return;
        }

        if (!user) {
          setError("No authenticated user");
          setLoading(false);
          return;
        }

        // Get user role, email, and salary access permission from users table
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("role, email, can_access_salary")
          .eq("id", user.id)
          .single();

        if (userError) {
          throw userError;
        }

        const userRecord = userData as { role: UserRole; email: string; can_access_salary: boolean | null };

        // Update cache
        cachedRole = userRecord.role;
        cachedEmail = userRecord.email;
        cachedCanAccessSalary = userRecord.can_access_salary ?? false;
        cacheTimestamp = Date.now();

        setRole(userRecord.role);
        setEmail(userRecord.email);
        setCanAccessSalary(cachedCanAccessSalary);
      } catch (err) {
        console.error("Error fetching user role:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
        fetchedRef.current = false; // Reset ref after fetch completes
      }
    },
    [] // Remove supabase dependency - it's a singleton and stable
  );

  useEffect(() => {
    fetchUserRole();
  }, [fetchUserRole]);

  // Memoize refetch function separately to prevent recreating it
  const refetch = useCallback(() => {
    fetchUserRole(true);
  }, [fetchUserRole]);

  // Memoize return value to prevent unnecessary re-renders
  return useMemo(
    () => ({
      role,
      email,
      loading,
      error,
      isAdmin: role === "admin",
      isHR: role === "hr",
      isApprover: role === "approver" || role === "hr",
      isViewer: role === "viewer",
      isRestrictedAccess: role === "approver" || role === "viewer",
      canAccessSalaryInfo: role === "admin" || canAccessSalary === true,
      refetch,
    }),
    [role, email, canAccessSalary, loading, error, refetch]
  );
}

/**
 * Clear the cached role (call on logout)
 */
export function clearUserRoleCache() {
  cachedRole = null;
  cachedEmail = null;
  cachedCanAccessSalary = null;
  cacheTimestamp = 0;
}