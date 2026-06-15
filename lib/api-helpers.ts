/**
 * Shared API helper functions for common patterns
 * Reduces code duplication and improves consistency
 */

import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { NextResponse } from "next/server";
import { mergePermissions } from "@/lib/permissions";

// Note: Using profiles table instead of users table
type UserSelect = { role: string };

/**
 * Cache for user role lookups (in-memory, per-request)
 * Prevents duplicate queries within the same request
 */
const userRoleCache = new Map<string, { role: string; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute

/**
 * Get current user's role with caching
 * Returns null if user is not authenticated or not found
 */
export async function getCurrentUserRole(): Promise<string | null> {
  const supabase = createServerComponentClient<Database>({ cookies });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  // Check cache first
  const cached = userRoleCache.get(user.id);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.role;
  }

  // Fetch from database (profiles table)
  const { data: userData, error: userError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .eq("is_active", true)
    .single();

  if (userError || !userData) {
    return null;
  }

  // Update cache
  userRoleCache.set(user.id, {
    role: userData.role,
    timestamp: Date.now(),
  });

  return userData.role;
}

/**
 * Verify current user is admin
 * Returns user ID if admin, null otherwise
 */
export async function verifyAdminAccess(): Promise<{
  userId: string;
  role: string;
} | null> {
  const role = await getCurrentUserRole();
  if (!role || role !== "admin") {
    return null;
  }

  const supabase = createServerComponentClient<Database>({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return { userId: user.id, role };
}

const TIMESHEET_AND_PAYROLL_ROLES = new Set([
  "admin",
  "upper_management",
  "hr",
  "project_manager",
  "operations_manager",
]);

/**
 * Verify current user may run HR/payroll-style operations (timesheet generation, etc.).
 * Includes admin, upper_management, HR, and project/operations management roles.
 */
export async function verifyAdminOrHrAccess(): Promise<{
  userId: string;
  role: string;
} | null> {
  const role = await getCurrentUserRole();
  if (!role || !TIMESHEET_AND_PAYROLL_ROLES.has(role)) {
    return null;
  }

  const supabase = createServerComponentClient<Database>({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return { userId: user.id, role };
}

const EMPLOYEE_RECORD_EDIT_ROLES = new Set([
  "admin",
  "upper_management",
  "hr",
  "operations_manager",
]);

/**
 * Matches `canEdit` on the HR employee detail page (`app/employees/[id]/page.tsx`).
 */
export async function verifyEmployeeRecordEditAccess(): Promise<{
  userId: string;
  role: string;
} | null> {
  const role = await getCurrentUserRole();
  if (!role || !EMPLOYEE_RECORD_EDIT_ROLES.has(role)) {
    return null;
  }

  const supabase = createServerComponentClient<Database>({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return { userId: user.id, role };
}

const CLOCK_SITE_MANAGEMENT_ROLES = new Set(["admin", "upper_management"]);

export async function verifyProjectDeleteAccess(): Promise<{
  userId: string;
  role: string;
} | null> {
  const supabase = createServerComponentClient<Database>({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("role, permissions")
    .eq("id", user.id)
    .eq("is_active", true)
    .single();

  if (profileError || !profileData) {
    return null;
  }

  const permissions = mergePermissions(
    profileData.role,
    profileData.permissions as Parameters<typeof mergePermissions>[1]
  );

  if (!permissions.projects.delete) {
    return null;
  }

  return { userId: user.id, role: profileData.role };
}

/**
 * Admin/upper management always; HR and others need profiles.can_manage_clock_access.
 */
export async function verifyClockSiteManagementAccess(): Promise<{
  userId: string;
  role: string;
} | null> {
  const supabase = createServerComponentClient<Database>({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("role, can_manage_clock_access")
    .eq("id", user.id)
    .eq("is_active", true)
    .single();

  if (profileError || !profileData) {
    return null;
  }

  const role = profileData.role;
  if (CLOCK_SITE_MANAGEMENT_ROLES.has(role)) {
    return { userId: user.id, role };
  }

  if (profileData.can_manage_clock_access === true) {
    return { userId: user.id, role };
  }

  return null;
}

/**
 * Get authenticated user with role check
 */
export async function getAuthenticatedUser(): Promise<{
  userId: string;
  role: string;
} | null> {
  const role = await getCurrentUserRole();
  if (!role) {
    return null;
  }

  const supabase = createServerComponentClient<Database>({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return { userId: user.id, role };
}

/**
 * Clear user role cache (useful after user updates)
 */
export function clearUserRoleCache(userId?: string) {
  if (userId) {
    userRoleCache.delete(userId);
  } else {
    userRoleCache.clear();
  }
}

/**
 * Batch fetch user roles for multiple user IDs
 * More efficient than individual queries
 */
export async function batchGetUserRoles(
  userIds: string[]
): Promise<Map<string, string>> {
  if (userIds.length === 0) {
    return new Map();
  }

  const supabase = createServerComponentClient<Database>({ cookies });
  const { data: users, error } = await supabase
    .from("profiles")
    .select("id, role")
    .in("id", userIds)
    .eq("is_active", true);

  if (error || !users) {
    return new Map();
  }

  const roleMap = new Map<string, string>();
  users.forEach((user: any) => {
    roleMap.set(user.id, user.role);
    // Update cache
    userRoleCache.set(user.id, {
      role: user.role,
      timestamp: Date.now(),
    });
  });

  return roleMap;
}