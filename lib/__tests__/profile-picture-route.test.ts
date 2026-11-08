import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createPortalSessionToken, PORTAL_SESSION_COOKIE } from "@/lib/portal-session";

const EMPLOYEE = "7d0f8f0e-1111-4c4c-9a9a-000000000001";
const STAFF = "3e731aed-0000-4000-8000-000000000001";

let cookieValue: string | undefined;
vi.mock("next/headers", () => ({
  cookies: () => ({ get: (name: string) => (name === PORTAL_SESSION_COOKIE && cookieValue ? { value: cookieValue } : undefined) }),
}));

let staffUser: { id: string } | null = null;
vi.mock("@supabase/auth-helpers-nextjs", () => ({
  createServerComponentClient: () => ({ auth: { getUser: async () => ({ data: { user: staffUser } }) } }),
}));

const updates: { table: string; values: Record<string, unknown>; id: string }[] = [];
const upload = vi.fn(async () => ({ error: null }));
const remove = vi.fn(async () => ({ error: null }));
let listed: { name: string }[] = [];
vi.mock("@/lib/fund-request-api", () => ({
  getAdminClient: () => ({
    from: (table: string) => ({
      update: (values: Record<string, unknown>) => ({
        eq: async (_c: string, id: string) => {
          updates.push({ table, values, id });
          return { error: null };
        },
      }),
    }),
    storage: {
      from: () => ({
        upload,
        remove,
        list: async () => ({ data: listed }),
        getPublicUrl: (p: string) => ({ data: { publicUrl: `https://cdn.test/profile-pictures/${p}` } }),
      }),
    },
  }),
}));

async function post(as: string, file: Blob) {
  const { POST } = await import("@/app/api/profile-picture/route");
  const form = new FormData();
  form.append("as", as);
  form.append("file", file);
  return POST(new NextRequest("http://localhost/api/profile-picture", { method: "POST", body: form }));
}

const jpeg = (bytes = 1000) => new Blob([new Uint8Array(bytes)], { type: "image/jpeg" });

describe("/api/profile-picture", () => {
  beforeEach(() => {
    process.env.PORTAL_SESSION_SECRET = "test-secret";
    cookieValue = undefined;
    staffUser = null;
    updates.length = 0;
    listed = [];
    upload.mockClear();
    remove.mockClear();
  });

  it("refuses an employee upload with no portal session", async () => {
    const res = await post("employee", jpeg());
    expect(res.status).toBe(401);
    expect(upload).not.toHaveBeenCalled();
  });

  it("refuses a portal session still on the default password", async () => {
    cookieValue = createPortalSessionToken(EMPLOYEE, Date.now(), true);
    const res = await post("employee", jpeg());
    expect(res.status).toBe(403);
    expect(upload).not.toHaveBeenCalled();
  });

  it("refuses a staff upload with no login", async () => {
    const res = await post("user", jpeg());
    expect(res.status).toBe(401);
  });

  it("saves the employee's picture and removes their old one", async () => {
    cookieValue = createPortalSessionToken(EMPLOYEE);
    listed = [{ name: "old.jpeg" }];
    const res = await post("employee", jpeg());
    expect(res.status).toBe(200);
    const { url } = await res.json();
    expect(url).toMatch(new RegExp(`/profile-pictures/employees/${EMPLOYEE}/[0-9a-f-]+\\.jpeg$`));
    expect(updates).toEqual([{ table: "employees", values: { profile_picture_url: url }, id: EMPLOYEE }]);
    expect(remove).toHaveBeenCalledWith([`employees/${EMPLOYEE}/old.jpeg`]);
  });

  it("saves a staff picture on the signed-in profile", async () => {
    staffUser = { id: STAFF };
    const res = await post("user", jpeg());
    expect(res.status).toBe(200);
    expect(updates[0]).toMatchObject({ table: "profiles", id: STAFF });
    expect(updates[0].values.avatar_url).toContain(`/users/${STAFF}/`);
  });

  it("rejects non-images and oversized images", async () => {
    cookieValue = createPortalSessionToken(EMPLOYEE);
    expect((await post("employee", new Blob(["x"], { type: "text/html" }))).status).toBe(400);
    expect((await post("employee", jpeg(201 * 1024))).status).toBe(400);
    expect(upload).not.toHaveBeenCalled();
  });

  it("removes the picture", async () => {
    cookieValue = createPortalSessionToken(EMPLOYEE);
    listed = [{ name: "a.jpeg" }];
    const { DELETE } = await import("@/app/api/profile-picture/route");
    const res = await DELETE(new NextRequest("http://localhost/api/profile-picture?as=employee", { method: "DELETE" }));
    expect(res.status).toBe(200);
    expect(updates).toEqual([{ table: "employees", values: { profile_picture_url: null }, id: EMPLOYEE }]);
    expect(remove).toHaveBeenCalledWith([`employees/${EMPLOYEE}/a.jpeg`]);
  });
});
