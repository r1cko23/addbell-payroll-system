'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/database';

/**
 * Client-side Supabase client for use in Client Components
 */
export const createClient = () => createClientComponentClient<Database>();

