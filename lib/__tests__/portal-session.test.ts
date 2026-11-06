import {
  createPortalSessionToken,
  isDefaultPortalPassword,
  verifyPortalSession,
  verifyPortalSessionToken,
} from "@/lib/portal-session";

const EMPLOYEE = "7d0f8f0e-1111-4c4c-9a9a-000000000001";

describe("portal session token", () => {
  beforeEach(() => {
    process.env.PORTAL_SESSION_SECRET = "test-secret";
  });

  test("a fresh token returns the employee it was issued for", () => {
    expect(verifyPortalSessionToken(createPortalSessionToken(EMPLOYEE))).toBe(EMPLOYEE);
  });

  test("a token with a swapped employee is rejected", () => {
    const [, sig] = createPortalSessionToken(EMPLOYEE).split(".");
    const forged = Buffer.from(JSON.stringify({ e: "someone-else", x: Date.now() + 60_000 })).toString("base64url");
    expect(verifyPortalSessionToken(`${forged}.${sig}`)).toBeNull();
  });

  test("an expired token is rejected", () => {
    const issued = Date.now() - 25 * 60 * 60 * 1000;
    expect(verifyPortalSessionToken(createPortalSessionToken(EMPLOYEE, issued))).toBeNull();
  });

  test("a token signed with another secret is rejected", () => {
    const token = createPortalSessionToken(EMPLOYEE);
    process.env.PORTAL_SESSION_SECRET = "other-secret";
    expect(verifyPortalSessionToken(token)).toBeNull();
  });

  test("missing or malformed tokens are rejected", () => {
    expect(verifyPortalSessionToken(undefined)).toBeNull();
    expect(verifyPortalSessionToken("")).toBeNull();
    expect(verifyPortalSessionToken("abc")).toBeNull();
    expect(verifyPortalSessionToken("abc.def")).toBeNull();
  });
});

describe("default-password sessions", () => {
  beforeEach(() => {
    process.env.PORTAL_SESSION_SECRET = "test-secret";
  });

  test("the must-change flag survives the signed token", () => {
    const token = createPortalSessionToken(EMPLOYEE, Date.now(), true);
    expect(verifyPortalSession(token)).toEqual({ employeeId: EMPLOYEE, mustChangePassword: true });
  });

  test("a normal session has no must-change flag", () => {
    expect(verifyPortalSession(createPortalSessionToken(EMPLOYEE))?.mustChangePassword).toBe(false);
  });

  test("the flag cannot be removed without breaking the signature", () => {
    const [, sig] = createPortalSessionToken(EMPLOYEE, Date.now(), true).split(".");
    const stripped = Buffer.from(JSON.stringify({ e: EMPLOYEE, x: Date.now() + 60_000 })).toString("base64url");
    expect(verifyPortalSession(`${stripped}.${sig}`)).toBeNull();
  });

  test("a password equal to one of the employee's IDs counts as default", () => {
    expect(isDefaultPortalPassword("AX-10001", [null, "AX-10001", "123"])).toBe(true);
    expect(isDefaultPortalPassword(" 123 ", ["2025001", null, "123"])).toBe(true);
  });

  test("any other password is not default", () => {
    expect(isDefaultPortalPassword("my-own-pass", ["2025001", "AX-10001", "123"])).toBe(false);
    expect(isDefaultPortalPassword("", ["", null])).toBe(false);
  });
});
