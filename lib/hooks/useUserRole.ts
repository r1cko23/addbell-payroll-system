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

    // Cast role to the expected type since profiles table may have different role values
    const role = user?.role as UserRoleData["role"] | null;

    // upper_management = admin per Addbell roles
    const isAdmin = user?.role === "admin" || user?.role === "upper_management";

    return {
      role,
      email: user?.email ?? null,
      loading: userLoading,
      error: userError,
      isAdmin,
      isHR: user?.role === "hr",
      isApprover: user?.role === "approver" || user?.role === "hr",
      isViewer: user?.role === "viewer",
      isRestrictedAccess: user?.role === "approver" || user?.role === "viewer",
      canAccessSalaryInfo: isAdmin || (user?.can_access_salary ?? false),
      canUpdatePayslip: isAdmin || isAprilGammad,
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