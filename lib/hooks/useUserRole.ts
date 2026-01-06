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
  | Database["public"]["Tables"]["users"]["Row"]["role"]
  | "account_manager";

interface UserRoleData {
  role: UserRole | null;
  email: string | null;
  loading: boolean;
  error: string | null;
  isAdmin: boolean;
  isHR: boolean;
  isAccountManager: boolean;
  isOTApprover: boolean;
  isOTViewer: boolean;
  isRestrictedAccess: boolean; // ot_approver or ot_viewer
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
        return;
      }

      // Prevent duplicate fetches
      if (fetchedRef.current && !force) return;
      fetchedRef.current = true;

      try {
        setLoading(true);

        // Get current authenticated user
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) {
          throw authError;
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
      }
    },
    [supabase]
  );

  useEffect(() => {
    fetchUserRole();
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
      isAccountManager: role === "account_manager",
      isOTApprover: role === "ot_approver",
      isOTViewer: role === "ot_viewer",
      isRestrictedAccess: role === "ot_approver" || role === "ot_viewer",
      canAccessSalaryInfo: role === "admin" || canAccessSalary === true,
      refetch: () => fetchUserRole(true),
    }),
    [role, email, canAccessSalary, loading, error, fetchUserRole]
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
