import type { SupabaseClient } from "@supabase/supabase-js";

type ResolvedEmployee = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
};

export async function resolveLinkedEmployee(
  supabase: SupabaseClient,
  options: {
    userId?: string | null;
    email?: string | null;
    fullName?: string | null;
  }
): Promise<ResolvedEmployee | null> {
  const trimmedEmail = options.email?.trim() || null;
  const trimmedFullName = options.fullName?.trim() || null;

  if (options.userId) {
    const { data } = await supabase
      .from("employees")
      .select("id, first_name, last_name, full_name")
      .eq("user_id", options.userId)
      .maybeSingle();

    if (data) return data as ResolvedEmployee;
  }

  if (trimmedEmail) {
    const { data } = await supabase
      .from("employees")
      .select("id, first_name, last_name, full_name")
      .eq("email", trimmedEmail)
      .maybeSingle();

    if (data) return data as ResolvedEmployee;
  }

  if (trimmedFullName) {
    const { data } = await supabase
      .from("employees")
      .select("id, first_name, last_name, full_name")
      .ilike("full_name", trimmedFullName)
      .maybeSingle();

    if (data) return data as ResolvedEmployee;
  }

  return null;
}
