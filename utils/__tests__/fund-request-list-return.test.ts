import { describe, expect, it } from "vitest";
import {
  buildFundRequestDetailHref,
  buildFundRequestListHref,
  parseFundRequestListReturnState,
} from "@/lib/fund-request-list-return";

describe("fund request list return urls", () => {
  it("preserves tab, search, status, cutoff, and clientPo on detail and back hrefs", () => {
    const state = parseFundRequestListReturnState(
      new URLSearchParams(
        "tab=my-requests&q=xyz&status=pending&cutoff=2026-08-15&clientPo=needs_update"
      )
    );
    expect(
      buildFundRequestDetailHref("/fund-request", "req-1", state, {
        defaultStatus: "pending",
      })
    ).toBe(
      "/fund-request/req-1?tab=my-requests&cutoff=2026-08-15&q=xyz&clientPo=needs_update"
    );
    expect(
      buildFundRequestListHref("/fund-request", state, {
        defaultStatus: "pending",
      })
    ).toBe(
      "/fund-request?tab=my-requests&cutoff=2026-08-15&q=xyz&clientPo=needs_update"
    );
    expect(
      buildFundRequestDetailHref(
        "/fund-request",
        "req-1",
        { tab: "inbox", status: "approved", cutoff: "2026-08-15" },
        { defaultStatus: "pending" }
      )
    ).toBe(
      "/fund-request/req-1?tab=inbox&cutoff=2026-08-15&status=approved"
    );
  });
});
