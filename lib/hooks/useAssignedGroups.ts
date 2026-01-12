/**
 * Custom hook to get the current user's assigned overtime groups
 * Returns group IDs where the user is assigned as approver or viewer
 */

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface AssignedGroupsData {
  groupIds: string[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useAssignedGroups(): AssignedGroupsData {
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const fetchAssignedGroups = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current authenticated user
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

      // Get user role to check if they're admin or HR (both see all)
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();

      if (userError) {
        throw userError;
      }

      // Admins see all groups (return empty array means no filtering)
      // HR users need to have group assignments returned to check if they're group approvers
      // (HR users bypass group filtering for viewing, but need group approver status for approval)
      if (userData?.role === "admin") {
        setGroupIds([]);
        setLoading(false);
        return;
      }

      // Find groups where this user is approver or viewer
      // This applies to both HR and approver/viewer roles
      const { data: approverGroups, error: approverError } = await supabase
        .from("overtime_groups")
        .select("id")
        .eq("approver_id", user.id);

      if (approverError) {
        throw approverError;
      }

      const { data: viewerGroups, error: viewerError } = await supabase
        .from("overtime_groups")
        .select("id")
        .eq("viewer_id", user.id);

      if (viewerError) {
        throw viewerError;
      }

      // Combine unique group IDs
      const allGroupIds = [
        ...(approverGroups || []).map((g) => g.id),
        ...(viewerGroups || []).map((g) => g.id),
      ];
      const uniqueGroupIds = Array.from(new Set(allGroupIds));

      setGroupIds(uniqueGroupIds);
    } catch (err) {
      console.error("Error fetching assigned groups:", err);
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