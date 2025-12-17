/**
 * Custom hook to get the current user's role
 * Used for role-based rendering and access control
 */

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type UserRole =
  | Database["public"]["Tables"]["users"]["Row"]["role"]
  | "account_manager";

interface UserRoleData {
  role: UserRole | null;
  loading: boolean;
  error: string | null;
  isAdmin: boolean;
  isHR: boolean;
}

export function useUserRole(): UserRoleData {
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function fetchUserRole() {
      try {
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

        // Get user role from users table
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("role")
          .eq("id", user.id)
          .single();

        if (userError) {
          throw userError;
        }

        setRole(userData.role);
      } catch (err) {
        console.error("Error fetching user role:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    fetchUserRole();
  }, [supabase]);

  return {
    role,
    loading,
    error,
    isAdmin: role === "admin",
    isHR: role === "hr",
  };
}
