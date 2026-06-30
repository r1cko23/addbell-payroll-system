import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import {
  isGoogleSheetsBillingConfigured,
  lookupBillingInvoiceStatus,
} from "@/lib/google-sheets-billing-invoice";
import { recordBillingLookupRequest } from "@/lib/platform-runtime-metrics";
import type { Database } from "@/types/database";

export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as { po_number?: string };
    const poNumber = body.po_number?.trim();

    if (!poNumber) {
      return NextResponse.json(
        { error: "po_number is required" },
        { status: 400 }
      );
    }

    if (!isGoogleSheetsBillingConfigured()) {
      return NextResponse.json(
        {
          error: "not_configured",
          message:
            "Google Sheets billing lookup is not configured on the server yet.",
        },
        { status: 503 }
      );
    }

    const result = await lookupBillingInvoiceStatus(poNumber);
    recordBillingLookupRequest();
    return NextResponse.json(result, {
      headers: result.cached
        ? { "X-Cache": "HIT" }
        : { "X-Cache": "MISS" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Lookup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
