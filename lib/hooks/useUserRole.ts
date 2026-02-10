/**
 * Custom hook to get the current user's role
 * Used for role-based rendering and access control
 *
 * OPTIMIZATIONS:
 * - Uses /api/auth/me endpoint for faster server-side execution
 * - Session-level caching to prevent redundant API calls
 * - Memoized return values to prevent unnecessary re-renders
 * - Single API call instead of sequential client-side calls
 */

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import { useCurrentUser } from "./useCurrentUser";

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
  /** Only Admin or HR April Gammad can update (re-save) a saved payslip */
  canUpdatePayslip: boolean;
  refetch: () => void;
}

export function useUserRole(): UserRoleData {
  const { user, loading: userLoading, error: userError, refetch: refetchUser } = useCurrentUser();

  const refetch = useCallback(() => {
    refetchUser();
  }, [refetchUser]);

  // Memoize return value to prevent unnecessary re-renders
  return useMemo(() => {
    const isAprilGammad =
      user?.role === "hr" &&
      user?.full_name != null &&
      user.full_name.toLowerCase().includes("april") &&
      user.full_name.toLowerCase().includes("gammad");

    return {
      role: user?.role ?? null,
      email: user?.email ?? null,
      loading: userLoading,
      error: userError,
      isAdmin: user?.role === "admin",
      isHR: user?.role === "hr",
      isApprover: user?.role === "approver" || user?.role === "hr",
      isViewer: user?.role === "viewer",
      isRestrictedAccess: user?.role === "approver" || user?.role === "viewer",
      canAccessSalaryInfo: user?.role === "admin" || (user?.can_access_salary ?? false),
      canUpdatePayslip: user?.role === "admin" || isAprilGammad,
      refetch,
    };
  }, [user, userLoading, userError, refetch]);
}

/**
 * Clear the cached role (call on logout)
 */
export function clearUserRoleCache() {
  // Clear the current user cache as well
  const { clearCurrentUserCache } = require("./useCurrentUser");
  clearCurrentUserCache();
}