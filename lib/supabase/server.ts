import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';

/**
 * Server-side Supabase client for use in Server Components and Server Actions
 */
export const createClient = () => 
  createServerComponentClient<Database>({ cookies });

