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

export type PortalSession = {
  employeeId: string;
  /** Signed in with a default password (one of the employee's own IDs). */
  mustChangePassword: boolean;
};

export function createPortalSessionToken(
  employeeId: string,
  now = Date.now(),
  mustChangePassword = false
): string {
  const payload = Buffer.from(
    JSON.stringify({
      e: employeeId,
      x: now + MAX_AGE_SECONDS * 1000,
      ...(mustChangePassword ? { c: 1 } : {}),
    })
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyPortalSession(
  token: string | null | undefined,
  now = Date.now()
): PortalSession | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const { e, x, c } = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      e?: unknown;
      x?: unknown;
      c?: unknown;
    };
    if (typeof e !== "string" || !e || typeof x !== "number" || x < now) return null;
    return { employeeId: e, mustChangePassword: c === 1 };
  } catch {
    return null;
  }
}

export function verifyPortalSessionToken(
  token: string | null | undefined,
  now = Date.now()
): string | null {
  return verifyPortalSession(token, now)?.employeeId ?? null;
}

/** True when the password is one of the employee's own IDs (the HR default). */
export function isDefaultPortalPassword(
  password: string,
  ids: Array<string | null | undefined>
): boolean {
  const value = password.trim();
  return !!value && ids.some((id) => !!id && id.trim() === value);
}

export function setPortalSessionCookie(
  res: NextResponse,
  employeeId: string,
  options?: { mustChangePassword?: boolean }
) {
  res.cookies.set(
    PORTAL_SESSION_COOKIE,
    createPortalSessionToken(employeeId, Date.now(), options?.mustChangePassword ?? false),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: MAX_AGE_SECONDS,
    }
  );
}

export function clearPortalSessionCookie(res: NextResponse) {
  res.cookies.set(PORTAL_SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

/** The portal session on this request, or null. */
export function getPortalSession(): PortalSession | null {
  return verifyPortalSession(cookies().get(PORTAL_SESSION_COOKIE)?.value);
}

/** The employee (employees.id) signed into the portal on this request, or null. */
export function getPortalEmployeeId(): string | null {
  return getPortalSession()?.employeeId ?? null;
}

/**
 * Guard for portal routes. Returns the signed-in employee id, or a 401/403 response.
 * When the request also names an employee (query or body), it must be the same person.
 * A session signed in with a default password is refused until the password changes,
 * except where allowPendingPasswordChange is set (the change-password route).
 */
export function requirePortalEmployee(
  claimedEmployeeId?: string | null,
  options?: { allowPendingPasswordChange?: boolean }
): { employeeId: string } | NextResponse {
  const session = getPortalSession();
  const employeeId = session?.employeeId ?? null;
  if (session?.mustChangePassword && !options?.allowPendingPasswordChange) {
    return NextResponse.json(
      { error: "Change your password to continue.", code: "password_change_required" },
      { status: 403 }
    );
  }
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
