/**
 * Overtime group IDs where the current user is approver or viewer on `overtime_groups`.
 * Used to scope OT / leave / failure-to-log / time entries for non–HR admins.
 * Admin, upper_management, and HR get an empty list (pages treat that as “no group filter” when combined with sees-all flags).
 */

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface AssignedGroupsData {
  groupIds: string[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const BROAD_ACCESS_ROLES = new Set([
  "admin",
  "upper_management",
  "hr",
]);

export function useAssignedGroups(): AssignedGroupsData {
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssignedGroups = useCallback(async () => {
    const supabase = createClient();
    try {
      setLoading(true);
      setError(null);

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      if (!user) {
        setGroupIds([]);
        setLoading(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      const role = (profile?.role as string | undefined)?.trim().toLowerCase();
      if (role && BROAD_ACCESS_ROLES.has(role)) {
        setGroupIds([]);
        setLoading(false);
        return;
      }

      const { data: groups, error: groupsError } = await supabase
        .from("overtime_groups")
        .select("id")
        .eq("is_active", true)
        .or(`approver_id.eq.${user.id},viewer_id.eq.${user.id}`);

      if (groupsError) {
        throw groupsError;
      }

      setGroupIds((groups || []).map((g) => g.id).filter(Boolean));
    } catch (err) {
      console.error("Error fetching assigned overtime groups:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setGroupIds([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssignedGroups();
  }, [fetchAssignedGroups]);

  return {
    groupIds,
    loading,
    error,
    refetch: fetchAssignedGroups,
  };
}
