import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { creditOvertimeHours } from "@/utils/overtime";
export { dynamic } from "@/lib/api-route-segment";


function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase service-role configuration");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

type PunchType = "in" | "out";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      employee_id?: string;
      ot_request_id?: string | null;
      punch_type?: PunchType;
      reason?: string | null;
      lat?: number;
      lng?: number;
      device_info?: string | null;
    };

    if (
      !body?.employee_id ||
      !body?.punch_type ||
      (body.punch_type !== "in" && body.punch_type !== "out")
    ) {
      return NextResponse.json(
        {
          error: "employee_id and punch_type (in/out) are required",
        },
        { status: 400 }
      );
    }

    if (typeof body.lat !== "number" || typeof body.lng !== "number") {
      return NextResponse.json(
        { error: "lat and lng are required for OT punch location tracking" },
        { status: 400 }
      );
    }

    const admin = getAdminClient();

    const { data: employee, error: employeeError } = await admin
      .from("employees")
      .select("id, requires_ot_punch")
      .eq("id", body.employee_id)
      .maybeSingle();

    if (employeeError || !employee) {
      return NextResponse.json(
        { error: employeeError?.message || "Employee not found" },
        { status: 404 }
      );
    }

    if (!employee.requires_ot_punch) {
      return NextResponse.json(
        { error: "Employee is not enabled for OT punch workflow" },
        { status: 403 }
      );
    }

    const getManilaParts = (isoString: string) => {
      const date = new Date(isoString);
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).formatToParts(date);

      const get = (type: string) => parts.find((p) => p.type === type)?.value;
      const year = get("year");
      const month = get("month");
      const day = get("day");
      const hour = get("hour");
      const minute = get("minute");

      const otDate = year && month && day ? `${year}-${month}-${day}` : null;
      const time = hour && minute ? `${hour}:${minute}` : null;

      return { otDate, time };
    };

    const timeToMinutes = (time?: string | null): number | null => {
      if (!time || typeof time !== "string") return null;
      const [hRaw, mRaw] = time.split(":");
      const h = Number(hRaw);
      const m = Number(mRaw);
      if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
      return h * 60 + m;
    };

    const computeTotalHours = (params: {
      startDate: string;
      endDate: string;
      startTime: string;
      endTime: string;
    }): number => {
      const startMin = timeToMinutes(params.startTime);
      const endMin = timeToMinutes(params.endTime);
      if (startMin == null || endMin == null) return 0;

      // If OT spans midnight, treat end as next day.
      const diffMinutes =
        params.endDate === params.startDate
          ? endMin - startMin
          : (24 * 60 - startMin) + endMin;

      const safeMinutes = diffMinutes > 0 ? diffMinutes : 0;
      const hours = safeMinutes / 60;
      const rawHours = Math.round(hours * 100) / 100;
      return creditOvertimeHours(rawHours);
    };

    const otRequestIdFromBody = body.ot_request_id || null;
    let effectiveOtRequestId: string | null = otRequestIdFromBody;

    const { data: latestPunchRows, error: latestPunchError } = effectiveOtRequestId
      ? await admin
          .from("ot_time_entries")
          .select("id, punch_type, punched_at")
          .eq("employee_id", body.employee_id)
          .eq("ot_request_id", effectiveOtRequestId)
          .order("punched_at", { ascending: false })
          .limit(1)
      : { data: [], error: null };

    if (latestPunchError) {
      return NextResponse.json(
        { error: latestPunchError.message },
        { status: 500 }
      );
    }

    const latestPunch = latestPunchRows?.[0] as
      | { id: string; punch_type: PunchType; punched_at: string }
      | undefined;

    if (body.punch_type === "in" && latestPunch?.punch_type === "in") {
      return NextResponse.json(
        { error: "Existing OT time-in is still open. Please OT time-out first." },
        { status: 400 }
      );
    }
    if (body.punch_type === "out" && latestPunch?.punch_type !== "in") {
      return NextResponse.json(
        { error: "No open OT time-in found for this request." },
        { status: 400 }
      );
    }

    const { data: locationCheck, error: locationCheckError } = await admin.rpc(
      "is_employee_location_allowed",
      {
        p_employee_uuid: body.employee_id,
        p_latitude: body.lat,
        p_longitude: body.lng,
      } as any
    );

    if (locationCheckError) {
      return NextResponse.json(
        { error: "Failed to validate punch location" },
        { status: 500 }
      );
    }
    const allowedResult = (locationCheck as Array<{ is_allowed: boolean }>)[0];
    if (!allowedResult?.is_allowed) {
      return NextResponse.json(
        { error: "Location is not allowed for OT punch." },
        { status: 403 }
      );
    }

    const { data: serverTimeData, error: timeError } = await admin.rpc(
      "get_server_time"
    );
    if (timeError || serverTimeData == null) {
      return NextResponse.json(
        { error: timeError?.message || "Could not get server time" },
        { status: 500 }
      );
    }
    const punchedAt = new Date(serverTimeData as string).toISOString();

    // Create/update overtime_requests automatically if ot_request_id is not provided.
    if (!effectiveOtRequestId) {
      const { otDate, time } = getManilaParts(punchedAt);
      if (!otDate || !time) {
        return NextResponse.json(
          { error: "Unable to compute OT date/time from server time" },
          { status: 500 }
        );
      }

      if (body.punch_type === "in") {
        const { data: created, error: createError } = await admin
          .from("overtime_requests")
          .insert({
            employee_id: body.employee_id,
            ot_date: otDate,
            end_date: null,
            start_time: time,
            end_time: time, // will be updated on OT time-out
            total_hours: 0,
            reason:
              typeof body.reason === "string" && body.reason.trim().length > 0
                ? body.reason.trim()
                : null,
            status: "pending",
            account_manager_id: null,
            project_manager_id: null,
          })
          .select("id")
          .single();

        if (createError || !created) {
          return NextResponse.json(
            { error: createError?.message || "Failed to create OT request" },
            { status: 500 }
          );
        }

        effectiveOtRequestId = created.id;
      } else {
        // OT Time Out without a provided request id:
        // try to update the most recent pending OT request for this employee
        // (the one created by OT Time In).
        const { data: candidateRows, error: candidateError } = await admin
          .from("overtime_requests")
          .select("id, ot_date, start_time, end_date, end_time, created_at")
          .eq("employee_id", body.employee_id)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(1);

        if (candidateError || !candidateRows?.length) {
          return NextResponse.json(
            { error: candidateError?.message || "No pending OT request to complete" },
            { status: 404 }
          );
        }

        effectiveOtRequestId = candidateRows[0].id;

        // Update end_time + total_hours based on start_time + punchedAt (Manila)
        const { otDate: endOtDate, time: endTime } = getManilaParts(punchedAt);

        const totalHours =
          candidateRows[0].ot_date && endOtDate && candidateRows[0].start_time && endTime
            ? computeTotalHours({
                startDate: candidateRows[0].ot_date,
                endDate: endOtDate,
                startTime: candidateRows[0].start_time,
                endTime: endTime,
              })
            : 0;

        const { error: updateError } = await admin
          .from("overtime_requests")
          .update({
            end_time: endTime,
            end_date:
              endOtDate !== candidateRows[0].ot_date ? endOtDate : null,
            total_hours: totalHours,
            updated_at: new Date().toISOString(),
          })
          .eq("id", effectiveOtRequestId);

        if (updateError) {
          return NextResponse.json(
            { error: updateError.message || "Failed to update OT request" },
            { status: 500 }
          );
        }
      }
    } else {
      // If an ot_request_id is provided, enforce it is pending.
      const { data: requestRow, error: requestError } = await admin
        .from("overtime_requests")
        .select("id, employee_id, status")
        .eq("id", effectiveOtRequestId)
        .eq("employee_id", body.employee_id)
        .maybeSingle();

      if (requestError || !requestRow) {
        return NextResponse.json(
          { error: requestError?.message || "OT request not found" },
          { status: 404 }
        );
      }

      if (requestRow.status !== "pending") {
        return NextResponse.json(
          { error: "OT punches are only allowed while request is pending" },
          { status: 400 }
        );
      }

      // Update end_time/total_hours when punching out for an existing request.
      if (body.punch_type === "out") {
        const { data: reqRow, error: reqError } = await admin
          .from("overtime_requests")
          .select("ot_date, start_time")
          .eq("id", effectiveOtRequestId)
          .maybeSingle();

        if (reqError) {
          return NextResponse.json(
            { error: reqError.message || "Failed to load OT request for update" },
            { status: 500 }
          );
        }

        const { otDate: endOtDate, time: endTime } = getManilaParts(punchedAt);

        const totalHours =
          reqRow?.ot_date && endOtDate && reqRow?.start_time && endTime
            ? computeTotalHours({
                startDate: reqRow.ot_date,
                endDate: endOtDate,
                startTime: reqRow.start_time,
                endTime: endTime,
              })
            : 0;

        if (reqRow?.ot_date && reqRow?.start_time && endOtDate && endTime) {
          const { error: updateError } = await admin
            .from("overtime_requests")
            .update({
              end_time: endTime,
              end_date: endOtDate !== reqRow.ot_date ? endOtDate : null,
              total_hours: totalHours,
              updated_at: new Date().toISOString(),
            })
            .eq("id", effectiveOtRequestId);

          if (updateError) {
            return NextResponse.json(
              { error: updateError.message || "Failed to update OT request" },
              { status: 500 }
            );
          }
        }
      }
    }

    const { data: insertData, error: insertError } = await admin
      .from("ot_time_entries")
      .insert({
        employee_id: body.employee_id,
        ot_request_id: effectiveOtRequestId,
        punch_type: body.punch_type,
        punched_at: punchedAt,
        lat: body.lat,
        lng: body.lng,
        source: "web",
        device_info: body.device_info ?? null,
      })
      .select("id, punched_at")
      .single();

    if (insertError || !insertData) {
      return NextResponse.json(
        { error: insertError?.message || "Failed to save OT punch" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: insertData.id,
      punched_at: insertData.punched_at,
      ot_request_id: effectiveOtRequestId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
