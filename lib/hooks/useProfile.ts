/**
 * useProfile Hook
 * Wrapper around useCurrentUser that returns profile instead of user
 * for consistency with existing codebase patterns
 */

import { useCurrentUser } from "./useCurrentUser";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  profile_picture_url: string | null;
  can_access_salary: boolean;
}

interface UseProfileData {
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useProfile(): UseProfileData {
  const { user, loading, error, refetch } = useCurrentUser();

  return {
    profile: user
      ? {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          profile_picture_url: user.profile_picture_url,
          can_access_salary: user.can_access_salary,
        }
      : null,
    loading,
    error,
    refetch,
  };
}