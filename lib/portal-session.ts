import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Employee portal session. Portal users have no Supabase auth, so the portal
 * login sets this signed, httpOnly cookie and every portal API derives the
 * employee from it instead of trusting an `employee_id` sent by the browser.
 */
export const PORTAL_SESSION_COOKIE = "ep_session";
const MAX_AGE_SECONDS = 24 * 60 * 60;

function secret(): string {
  // Falls back to the service-role key (server-only) so a deploy without the new env var still works.
  const s = process.env.PORTAL_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("Missing PORTAL_SESSION_SECRET");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createPortalSessionToken(employeeId: string, now = Date.now()): string {
  const payload = Buffer.from(
    JSON.stringify({ e: employeeId, x: now + MAX_AGE_SECONDS * 1000 })
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyPortalSessionToken(
  token: string | null | undefined,
  now = Date.now()
): string | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const { e, x } = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      e?: unknown;
      x?: unknown;
    };
    if (typeof e !== "string" || !e || typeof x !== "number" || x < now) return null;
    return e;
  } catch {
    return null;
  }
}

export function setPortalSessionCookie(res: NextResponse, employeeId: string) {
  res.cookies.set(PORTAL_SESSION_COOKIE, createPortalSessionToken(employeeId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export function clearPortalSessionCookie(res: NextResponse) {
  res.cookies.set(PORTAL_SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

/** The employee (employees.id) signed into the portal on this request, or null. */
export function getPortalEmployeeId(): string | null {
  return verifyPortalSessionToken(cookies().get(PORTAL_SESSION_COOKIE)?.value);
}

/**
 * Guard for portal routes. Returns the signed-in employee id, or a 401/403 response.
 * When the request also names an employee (query or body), it must be the same person.
 */
export function requirePortalEmployee(
  claimedEmployeeId?: string | null
): { employeeId: string } | NextResponse {
  const employeeId = getPortalEmployeeId();
  if (!employeeId) {
    return NextResponse.json(
      { error: "Your portal session has ended. Sign in again." },
      { status: 401 }
    );
  }
  const claimed = claimedEmployeeId?.trim();
  if (claimed && claimed !== employeeId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return { employeeId };
}
