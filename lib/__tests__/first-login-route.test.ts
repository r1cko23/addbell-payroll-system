import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createPortalSessionToken, PORTAL_SESSION_COOKIE } from "@/lib/portal-session";

const EMPLOYEE = "7d0f8f0e-1111-4c4c-9a9a-000000000001";
const OTHER = "7d0f8f0e-1111-4c4c-9a9a-000000000002";

let cookieValue: string | undefined;
vi.mock("next/headers", () => ({
  cookies: () => ({ get: (name: string) => (name === PORTAL_SESSION_COOKIE && cookieValue ? { value: cookieValue } : undefined) }),
}));

const rpc = vi.fn(async () => ({ data: [{ success: true, is_first_login: true, message: "ok" }], error: null }));
vi.mock("@/lib/fund-request-api", () => ({ getAdminClient: () => ({ rpc }) }));
// The route must not use the cookie (anon) client any more.
vi.mock("@supabase/auth-helpers-nextjs", () => ({
  createServerComponentClient: () => {
    throw new Error("first-login must use the service role, not the cookie client");
  },
}));

async function post(body: Record<string, unknown>) {
  const { POST } = await import("@/app/api/employee/first-login/route");
  return POST(new NextRequest("http://localhost/api/employee/first-login", { method: "POST", body: JSON.stringify(body) }));
}

describe("POST /api/employee/first-login", () => {
  beforeEach(() => {
    process.env.PORTAL_SESSION_SECRET = "test-secret";
    cookieValue = undefined;
    rpc.mockClear();
  });

  it("refuses a request with no portal session", async () => {
    const res = await post({ employee_id: EMPLOYEE });
    expect(res.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses recording a login for someone else", async () => {
    cookieValue = createPortalSessionToken(EMPLOYEE);
    const res = await post({ employee_id: OTHER });
    expect(res.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("records a first login made with the default password", async () => {
    cookieValue = createPortalSessionToken(EMPLOYEE, Date.now(), true);
    const res = await post({ employee_id: EMPLOYEE, browser_name: "Chrome" });
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith(
      "record_employee_first_login",
      expect.objectContaining({ p_employee_id: EMPLOYEE, p_browser_name: "Chrome" })
    );
    expect(await res.json()).toMatchObject({ success: true, is_first_login: true });
  });

  it("uses the session's employee when the body names none", async () => {
    cookieValue = createPortalSessionToken(EMPLOYEE);
    const res = await post({});
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("record_employee_first_login", expect.objectContaining({ p_employee_id: EMPLOYEE }));
  });
});
