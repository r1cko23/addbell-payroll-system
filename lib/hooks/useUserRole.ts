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

type DbUserRole = Database["public"]["Tables"]["users"]["Row"]["role"];

/** Profiles include roles beyond the legacy `users` table enum in generated types */
export type UserRole =
  | DbUserRole
  | "upper_management"
  | "project_manager"
  | "operations_manager";

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
    const normalizedRole =
      typeof user?.role === "string"
        ? user.role.trim().toLowerCase().replace(/\s+/g, "_")
        : null;

    const isAprilGammad =
      normalizedRole === "hr" &&
      user?.full_name != null &&
      user.full_name.toLowerCase().includes("april") &&
      user.full_name.toLowerCase().includes("gammad");

    // Cast role to the expected type since profiles table may have different role values
    const role = normalizedRole as UserRoleData["role"] | null;

    // upper_management = admin per Addbell roles
    const isAdmin = normalizedRole === "admin" || normalizedRole === "upper_management";

    return {
      role,
      email: user?.email ?? null,
      loading: userLoading,
      error: userError,
      isAdmin,
      isHR: normalizedRole === "hr",
      isApprover: normalizedRole === "approver" || normalizedRole === "hr",
      isViewer: normalizedRole === "viewer",
      isRestrictedAccess: normalizedRole === "approver" || normalizedRole === "viewer",
      canAccessSalaryInfo:
        isAdmin ||
        normalizedRole === "hr" ||
        (user?.can_access_salary ?? false),
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