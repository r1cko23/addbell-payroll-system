"use client";

/**
 * Client hook for checking user permissions (ACL/RBAC).
 * Types, defaults, and merge helpers live in @/lib/permissions (server-safe).
 */

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import {
  mergePermissions,
  DEFAULT_PERMISSIONS,
  EMPTY_PERMISSIONS,
  type ModuleName,
  type ActionName,
  type UserPermissions,
} from "@/lib/permissions";

export * from "@/lib/permissions";

interface UsePermissionsReturn {
  permissions: UserPermissions | null;
  loading: boolean;
  error: string | null;
  hasPermission: (module: ModuleName, action: ActionName) => boolean;
  canCreate: (module: ModuleName) => boolean;
  canRead: (module: ModuleName) => boolean;
  canUpdate: (module: ModuleName) => boolean;
  canDelete: (module: ModuleName) => boolean;
  refetch: () => void;
}

let permissionsCache: {
  userId: string;
  permissions: UserPermissions;
  timestamp: number;
} | null = null;
const CACHE_TTL = 5 * 60 * 1000;

export function usePermissions(): UsePermissionsReturn {
  const { user, loading: userLoading, refetch: refetchUser } = useCurrentUser();
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPermissions = useCallback(async () => {
    if (!user) {
      setPermissions(null);
      setLoading(false);
      return;
    }

    if (
      permissionsCache &&
      permissionsCache.userId === user.id &&
      Date.now() - permissionsCache.timestamp < CACHE_TTL
    ) {
      setPermissions(permissionsCache.permissions);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("role, permissions")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      const resolvedRole =
        (profileData?.role as string | undefined) || user.role || "viewer";
      const normalizedRole = resolvedRole.trim().toLowerCase().replace(/\s+/g, "_");
      const mergedPermissions = mergePermissions(
        normalizedRole,
        (profileData?.permissions as Partial<UserPermissions> | null | undefined) ?? null
      );

      setPermissions(mergedPermissions);
      setError(null);
      permissionsCache = {
        userId: user.id,
        permissions: mergedPermissions,
        timestamp: Date.now(),
      };
    } catch (err: unknown) {
      console.error("Error fetching permissions:", err);
      const normalizedRole = (user.role || "viewer").trim().toLowerCase().replace(/\s+/g, "_");
      const defaultPerms = DEFAULT_PERMISSIONS[normalizedRole] || EMPTY_PERMISSIONS;
      setPermissions(defaultPerms);
      setError(err instanceof Error ? err.message : "Failed to load permissions");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!userLoading) {
      fetchPermissions();
    }
  }, [userLoading, fetchPermissions]);

  const refetch = useCallback(() => {
    permissionsCache = null;
    refetchUser();
    fetchPermissions();
  }, [refetchUser, fetchPermissions]);

  const hasPermission = useCallback(
    (module: ModuleName, action: ActionName): boolean => {
      if (!permissions) return false;
      const modulePerms = permissions[module];
      if (!modulePerms) return false;
      return modulePerms[action] ?? false;
    },
    [permissions]
  );

  const canCreate = useCallback(
    (module: ModuleName): boolean => hasPermission(module, "create"),
    [hasPermission]
  );

  const canRead = useCallback(
    (module: ModuleName): boolean => hasPermission(module, "read"),
    [hasPermission]
  );

  const canUpdate = useCallback(
    (module: ModuleName): boolean => hasPermission(module, "update"),
    [hasPermission]
  );

  const canDelete = useCallback(
    (module: ModuleName): boolean => hasPermission(module, "delete"),
    [hasPermission]
  );

  return useMemo(
    () => ({
      permissions,
      loading: loading || userLoading,
      error,
      hasPermission,
      canCreate,
      canRead,
      canUpdate,
      canDelete,
      refetch,
    }),
    [
      permissions,
      loading,
      userLoading,
      error,
      hasPermission,
      canCreate,
      canRead,
      canUpdate,
      canDelete,
      refetch,
    ]
  );
}

export function clearPermissionsCache() {
  permissionsCache = null;
}
