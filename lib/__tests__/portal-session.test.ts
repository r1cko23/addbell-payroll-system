import {
  createPortalSessionToken,
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
