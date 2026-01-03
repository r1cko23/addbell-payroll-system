"use client";

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/types/database";

/**
 * Singleton Supabase client for Client Components
 * Prevents creating multiple client instances which improves performance
 * and reduces memory usage.
 */
let supabaseClient: ReturnType<
  typeof createClientComponentClient<Database>
> | null = null;

export const createClient = () => {
  if (!supabaseClient) {
    supabaseClient = createClientComponentClient<Database>();
  }
  return supabaseClient;
};

/**
 * Reset the client (useful for testing or logout)
 */
export const resetClient = () => {
  supabaseClient = null;
};
