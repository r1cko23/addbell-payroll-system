/**
 * Shared API helper functions for common patterns
 * Reduces code duplication and improves consistency
 */

import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { NextResponse } from "next/server";

type UserRow = Database["public"]["Tables"]["users"]["Row"];
type UserSelect = Pick<UserRow, "role">;

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

  // Fetch from database
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .eq("is_active", true)
    .single<UserSelect>();

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

/**
 * Verify current user is admin or HR
 * Returns user ID and role if authorized, null otherwise
 */
export async function verifyAdminOrHrAccess(): Promise<{
  userId: string;
  role: string;
} | null> {
  const role = await getCurrentUserRole();
  if (!role || (role !== "admin" && role !== "hr")) {
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
    .from("users")
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