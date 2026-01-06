import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

function getClientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  // @ts-ignore
  return (req as any).ip || null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      employee_id,
      user_agent,
      device_info,
      browser_name,
      browser_version,
      os_name,
      os_version,
      device_type,
      mac_address,
    } = body;

    if (!employee_id) {
      return NextResponse.json(
        { success: false, error: "Employee ID is required" },
        { status: 400 }
      );
    }

    const supabase = createServerComponentClient({ cookies });
    const ipAddress = getClientIp(request);

    // Call the database function to record first login
    const { data, error } = await supabase.rpc("record_employee_first_login", {
      p_employee_id: employee_id,
      p_ip_address: ipAddress,
      p_user_agent: user_agent || null,
      p_device_info: device_info || null,
      p_browser_name: browser_name || null,
      p_browser_version: browser_version || null,
      p_os_name: os_name || null,
      p_os_version: os_version || null,
      p_device_type: device_type || null,
      p_mac_address: mac_address || null,
    });

    if (error) {
      console.error("Error recording first login:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const result = data?.[0];
    return NextResponse.json({
      success: result?.success || false,
      is_first_login: result?.is_first_login || false,
      message: result?.message || "Login recorded",
    });
  } catch (error: any) {
    console.error("Error in first-login API:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

