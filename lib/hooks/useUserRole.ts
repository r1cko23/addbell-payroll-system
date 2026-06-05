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
import { isOperationsManagerRole, normalizeUserRole } from "@/lib/user-roles";

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
  /** Literal `admin` role only (system owner — user mgmt, manual punch, CRUD matrix). */
  isAdmin: boolean;
  /** `upper_management` — broad operational access, not system admin. */
  isUpperManagement: boolean;
  /** Admin or upper management (legacy combined “management” access). */
  isManagement: boolean;
  isHR: boolean;
  isApprover: boolean;
  isViewer: boolean;
  isRestrictedAccess: boolean; // approver or viewer
  isOperationsManager: boolean;
  canAccessSalaryInfo: boolean;
  /** Admin/upper management, or HR with explicit profile flag */
  canManageClockAccess: boolean;
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
      typeof user?.role === "string" ? normalizeUserRole(user.role) : null;

    const isAprilGammad =
      normalizedRole === "hr" &&
      user?.full_name != null &&
      user.full_name.toLowerCase().includes("april") &&
      user.full_name.toLowerCase().includes("gammad");

    // Cast role to the expected type since profiles table may have different role values
    const role = normalizedRole as UserRoleData["role"] | null;

    const isAdmin = normalizedRole === "admin";
    const isUpperManagement = normalizedRole === "upper_management";
    const isManagement = isAdmin || isUpperManagement;

    return {
      role,
      email: user?.email ?? null,
      loading: userLoading,
      error: userError,
      isAdmin,
      isUpperManagement,
      isManagement,
      isHR: normalizedRole === "hr",
      isApprover: normalizedRole === "approver" || normalizedRole === "hr",
      isViewer: normalizedRole === "viewer",
      isRestrictedAccess: normalizedRole === "approver" || normalizedRole === "viewer",
      isOperationsManager: isOperationsManagerRole(normalizedRole),
      canAccessSalaryInfo:
        isManagement || (user?.can_access_salary ?? false),
      canManageClockAccess:
        isManagement || (user?.can_manage_clock_access ?? false),
      canUpdatePayslip: isManagement || isAprilGammad,
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