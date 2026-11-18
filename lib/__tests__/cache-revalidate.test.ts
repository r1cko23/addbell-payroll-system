import { vi } from "vitest";

const store = new Map<string, unknown>();
let requestHeaders = new Headers();

vi.mock("@/lib/redis", () => ({
  getRedis: () => ({
    get: async (k: string) => store.get(k) ?? null,
    set: async (k: string, v: unknown) => {
      store.set(k, v);
      return "OK";
    },
  }),
}));
vi.mock("next/headers", () => ({ headers: () => requestHeaders }));

import { cachedJson } from "@/lib/cache";

describe("cachedJson after approve", () => {
  beforeEach(() => {
    store.clear();
    requestHeaders = new Headers();
  });

  test("normal read serves the cached list", async () => {
    await cachedJson(["ot"], async () => ({ status: "pending" }));
    const { data, cache } = await cachedJson(["ot"], async () => ({ status: "approved" }));
    expect(cache).toBe("HIT");
    expect(data.status).toBe("pending");
  });

  test("force refresh (x-cache-revalidate) loads fresh and replaces the cached list", async () => {
    await cachedJson(["ot"], async () => ({ status: "pending" }));
    requestHeaders = new Headers({ "x-cache-revalidate": "1" });
    const fresh = await cachedJson(["ot"], async () => ({ status: "approved" }));
    expect(fresh).toEqual({ data: { status: "approved" }, cache: "MISS" });

    // Other approvers now get the fresh list too.
    requestHeaders = new Headers();
    const next = await cachedJson(["ot"], async () => ({ status: "stale-loader-not-called" }));
    expect(next.data.status).toBe("approved");
  });
});
