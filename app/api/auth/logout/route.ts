import { NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

export async function POST() {
  const supabase = createServerComponentClient<Database>({ cookies });

  await supabase.auth.signOut();
  return NextResponse.json({ success: true });
}
