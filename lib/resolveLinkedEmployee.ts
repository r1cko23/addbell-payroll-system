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
      .ilike("email", trimmedEmail)
      .maybeSingle();

    if (data) return data as ResolvedEmployee;
  }

  if (trimmedFullName) {
    const { data: exactNameMatch } = await supabase
      .from("employees")
      .select("id, first_name, last_name, full_name")
      .ilike("full_name", trimmedFullName)
      .maybeSingle();

    if (exactNameMatch) return exactNameMatch as ResolvedEmployee;

    // Dashboard display names (e.g. "Phen Conte") may differ from HR legal names
    // (e.g. "Josefina Echavia Conte"). Match one employee by email + last name.
    const nameParts = trimmedFullName.split(/\s+/).filter(Boolean);
    const lastName = nameParts[nameParts.length - 1];
    if (lastName && trimmedEmail) {
      const { data: emailMatches } = await supabase
        .from("employees")
        .select("id, first_name, last_name, full_name, email")
        .ilike("email", trimmedEmail);

      if (emailMatches?.length === 1) {
        const { email: _email, ...employee } = emailMatches[0];
        return employee as ResolvedEmployee;
      }

      if (emailMatches && emailMatches.length > 1) {
        const lastNameLower = lastName.toLowerCase();
        const narrowed = emailMatches.filter(
          (row) =>
            row.last_name?.toLowerCase().includes(lastNameLower) ||
            row.full_name?.toLowerCase().includes(lastNameLower)
        );
        if (narrowed.length === 1) {
          const { email: _email, ...employee } = narrowed[0];
          return employee as ResolvedEmployee;
        }
      }
    }
  }

  return null;
}
