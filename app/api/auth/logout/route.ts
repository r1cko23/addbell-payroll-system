import { NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

export async function POST() {
  const supabase = createServerComponentClient<Database>({ cookies });

  await supabase.auth.signOut();
  
  // Clear session cache on server side
  // Note: Client-side cache will be cleared by the client component
  
  return NextResponse.json({ success: true });
}