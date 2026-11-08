import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-test");

vi.mock("next/headers", () => ({ cookies: () => ({ get: () => undefined }) }));
vi.mock("@/lib/api-helpers", () => ({
  verifyAdminAccess: async () => ({ userId: "admin-1", role: "admin" }),
  clearUserRoleCache: () => {},
}));

const createUser = vi.fn();
const deleteUser = vi.fn(async () => ({ error: null }));
const upserts: Record<string, unknown>[] = [];
let upsertError: { message: string } | null = null;
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { admin: { createUser, deleteUser } },
    from: (table: string) => ({
      upsert: (row: Record<string, unknown>) => {
        upserts.push({ table, ...row });
        return {
          select: () => ({
            single: async () =>
              upsertError ? { data: null, error: upsertError } : { data: row, error: null },
          }),
        };
      },
    }),
  }),
}));

async function create(body: Record<string, unknown>) {
  const { POST } = await import("@/app/api/users/create/route");
  return POST(new NextRequest("http://localhost/api/users/create", { method: "POST", body: JSON.stringify(body) }));
}

const base = { email: "New.Staff@Example.com", full_name: "New Staff", password: "test-pass-123" };

describe("POST /api/users/create", () => {
  beforeEach(() => {
    createUser.mockReset();
    createUser.mockResolvedValue({ data: { user: { id: "new-user" } }, error: null });
    deleteUser.mockClear();
    upserts.length = 0;
    upsertError = null;
  });

  it("creates the login and writes the role on the profile, not in metadata", async () => {
    const res = await create({ ...base, role: "admin_assistant" });
    expect(res.status).toBe(201);
    expect(createUser.mock.calls[0][0].user_metadata).toEqual({ full_name: "New Staff" });
    expect(upserts).toEqual([
      { table: "profiles", id: "new-user", email: "new.staff@example.com", full_name: "New Staff", role: "admin_assistant", is_active: true },
    ]);
  });

  it("refuses roles the profiles table does not allow", async () => {
    for (const role of ["approver", "viewer", "employee", "superuser"]) {
      const res = await create({ ...base, role });
      expect(res.status).toBe(400);
    }
    expect(createUser).not.toHaveBeenCalled();
  });

  it("removes the login again when the profile cannot be saved", async () => {
    upsertError = { message: "constraint" };
    const res = await create({ ...base, role: "hr" });
    expect(res.status).toBe(500);
    expect(deleteUser).toHaveBeenCalledWith("new-user");
  });
});
