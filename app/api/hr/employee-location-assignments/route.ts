import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyClockSiteManagementAccess } from "@/lib/api-helpers";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase service-role configuration");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * HR: list all active bundy clock sites and, when `employee_id` is set, that employee's allowed IDs.
 * Omit `employee_id` to load sites only (e.g. Add Employee modal).
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyClockSiteManagementAccess();
    if (!auth) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const employeeId = req.nextUrl.searchParams.get("employee_id")?.trim() || null;

    const admin = adminClient();

    const { data: offices, error: officesError } = await admin
      .from("office_locations")
      .select("id, name, address, latitude, longitude, radius_meters")
      .eq("is_active", true)
      .order("name");

    if (officesError) {
      console.error(officesError);
      return NextResponse.json(
        { error: "Failed to load office locations" },
        { status: 500 }
      );
    }

    const allowedIds = new Set(
      (offices ?? []).map((o: { id: string }) => o.id)
    );

    if (!employeeId) {
      return NextResponse.json({
        office_locations: offices ?? [],
        assigned_location_ids: [],
        allow_clock_anywhere: false,
      });
    }

    const { data: assigned, error: assignedError } = await admin
      .from("employee_location_assignments")
      .select("location_id")
      .eq("employee_id", employeeId);

    if (assignedError) {
      console.error(assignedError);
      return NextResponse.json(
        { error: "Failed to load assignments" },
        { status: 500 }
      );
    }

    const assignedIds = (assigned ?? [])
      .map((r: { location_id: string }) => r.location_id)
      .filter((id: string) => allowedIds.has(id));

    const { data: anywhereRow, error: anywhereError } = await admin
      .from("employee_clock_anywhere_overrides")
      .select("employee_id")
      .eq("employee_id", employeeId)
      .maybeSingle();

    if (anywhereError) {
      console.error(anywhereError);
      return NextResponse.json(
        { error: "Failed to load clock-anywhere setting" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      office_locations: offices ?? [],
      assigned_location_ids: assignedIds,
      allow_clock_anywhere: !!anywhereRow,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Server error loading clock sites" },
      { status: 500 }
    );
  }
}

/**
 * HR: replace this employee's assignments among all active clock sites.
 * Empty location_ids removes all such rows → employee may clock at any active office (legacy behavior).
 */
export async function PUT(req: NextRequest) {
  try {
    const auth = await verifyClockSiteManagementAccess();
    if (!auth) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as {
      employee_id?: string;
      location_ids?: string[];
      allow_clock_anywhere?: boolean;
    };

    const employeeId = body.employee_id?.trim();
    const locationIds = Array.isArray(body.location_ids)
      ? body.location_ids
      : null;
    const allowClockAnywhere =
      typeof body.allow_clock_anywhere === "boolean"
        ? body.allow_clock_anywhere
        : false;

    if (!employeeId || locationIds === null) {
      return NextResponse.json(
        { error: "Missing employee_id or location_ids array" },
        { status: 400 }
      );
    }

    const admin = adminClient();

    const { data: offices, error: officesError } = await admin
      .from("office_locations")
      .select("id")
      .eq("is_active", true);

    if (officesError || !offices?.length) {
      console.error(officesError);
      return NextResponse.json(
        { error: "Clock sites are not configured in office_locations" },
        { status: 500 }
      );
    }

    const validIds = new Set(offices.map((o: { id: string }) => o.id));
    const uniqueIncoming = [...new Set(locationIds.map((id) => id.trim()))];
    for (const id of uniqueIncoming) {
      if (!validIds.has(id)) {
        return NextResponse.json(
          { error: `Invalid location_id: ${id}` },
          { status: 400 }
        );
      }
    }

    const { error: delError } = await admin
      .from("employee_location_assignments")
      .delete()
      .eq("employee_id", employeeId)
      .in("location_id", [...validIds]);

    if (delError) {
      console.error(delError);
      return NextResponse.json(
        { error: "Failed to update assignments" },
        { status: 500 }
      );
    }

    if (allowClockAnywhere) {
      const { error: anywhereInsertError } = await admin
        .from("employee_clock_anywhere_overrides")
        .upsert(
          [
            {
              employee_id: employeeId,
              reason: "HR enabled from employee profile",
            },
          ],
          { onConflict: "employee_id" }
        );

      if (anywhereInsertError) {
        console.error(anywhereInsertError);
        return NextResponse.json(
          { error: "Failed to save clock-anywhere setting" },
          { status: 500 }
        );
      }
    } else {
      const { error: anywhereDeleteError } = await admin
        .from("employee_clock_anywhere_overrides")
        .delete()
        .eq("employee_id", employeeId);

      if (anywhereDeleteError) {
        console.error(anywhereDeleteError);
        return NextResponse.json(
          { error: "Failed to save clock-anywhere setting" },
          { status: 500 }
        );
      }
    }

    if (uniqueIncoming.length > 0) {
      const rows = uniqueIncoming.map((location_id) => ({
        employee_id: employeeId,
        location_id,
      }));
      const { error: insError } = await admin
        .from("employee_location_assignments")
        .insert(rows);

      if (insError) {
        console.error(insError);
        return NextResponse.json(
          { error: "Failed to save assignments" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      assigned_location_ids: uniqueIncoming,
      allow_clock_anywhere: allowClockAnywhere,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Server error saving clock sites" },
      { status: 500 }
    );
  }
}
