import { describe, expect, it } from "vitest";
import {
  decidePoMasterlistPullAction,
  isPoMasterlistHeaderLikeRow,
} from "@/lib/po-masterlist-sheet-pull";
import { shouldAutoPullPoMasterlistSheet } from "@/lib/hooks/usePoMasterlistJobs";

describe("P.O. masterlist sheet pull merge", () => {
  it("skips header-looking rows", () => {
    expect(
      isPoMasterlistHeaderLikeRow({
        poNumber: "P.O. NUMBER",
        projectTitle: "PROJECT TITLE",
        projectStatus: "PROJECT STATUS",
        paymentStatus: "PAYMENT STATUS",
      })
    ).toBe(true);
    expect(
      decidePoMasterlistPullAction({
        existing: null,
        isHeaderRow: true,
      })
    ).toBe("skip_header");
  });

  it("inserts a sheet row that is not yet in the app", () => {
    expect(
      decidePoMasterlistPullAction({
        existing: null,
        isHeaderRow: false,
      })
    ).toBe("insert");
  });

  it("updates when the app has not been edited since the last sheet sync", () => {
    expect(
      decidePoMasterlistPullAction({
        existing: {
          updated_at: "2026-08-26T13:51:24.468Z",
          sheet_synced_at: "2026-08-26T13:51:24.468Z",
        },
        isHeaderRow: false,
      })
    ).toBe("update");
  });

  it("pushes an app-only edit to the sheet when the Google Sheet is unchanged", () => {
    expect(
      decidePoMasterlistPullAction({
        existing: {
          updated_at: "2026-09-13T08:00:00.000Z",
          sheet_synced_at: "2026-08-26T13:51:24.468Z",
        },
        isHeaderRow: false,
        sheetMatchesApp: false,
        sheetMatchesLastSync: true,
        appMatchesLastSync: false,
      })
    ).toBe("skip_app_newer");
  });

  it("does not clobber an app-created job that has never synced", () => {
    expect(
      decidePoMasterlistPullAction({
        existing: {
          updated_at: "2026-09-13T08:00:00.000Z",
          sheet_synced_at: null,
        },
        isHeaderRow: false,
        sheetMatchesApp: false,
      })
    ).toBe("skip_app_newer");
  });

  it("pulls a sheet edit into the app when the app has not changed since last sync", () => {
    expect(
      decidePoMasterlistPullAction({
        existing: {
          updated_at: "2026-08-26T13:51:24.468Z",
          sheet_synced_at: "2026-08-26T13:51:24.468Z",
        },
        isHeaderRow: false,
        sheetMatchesApp: false,
      })
    ).toBe("update");
  });

  it("does not write either way when the sheet row already matches the app", () => {
    expect(
      decidePoMasterlistPullAction({
        existing: {
          updated_at: "2026-09-13T08:00:00.000Z",
          sheet_synced_at: "2026-08-26T13:51:24.468Z",
        },
        isHeaderRow: false,
        sheetMatchesApp: true,
      })
    ).toBe("skip_in_sync");
  });

  it("keeps a Google Sheets edit instead of pushing the stale app row back over it", () => {
    expect(
      decidePoMasterlistPullAction({
        existing: {
          updated_at: "2026-09-13T13:00:00.000Z",
          sheet_synced_at: "2026-08-26T13:51:24.468Z",
        },
        isHeaderRow: false,
        sheetMatchesApp: false,
        sheetMatchesLastSync: false,
        appMatchesLastSync: true,
      })
    ).toBe("update");
  });

  it("keeps the Google Sheets edit when both sides changed since last sync", () => {
    expect(
      decidePoMasterlistPullAction({
        existing: {
          updated_at: "2026-09-13T13:00:00.000Z",
          sheet_synced_at: "2026-08-26T13:51:24.468Z",
        },
        isHeaderRow: false,
        sheetMatchesApp: false,
        sheetMatchesLastSync: false,
        appMatchesLastSync: false,
      })
    ).toBe("update");
  });

  it("copies the Google Sheet into the app when it is unknown whether the sheet changed", () => {
    expect(
      decidePoMasterlistPullAction({
        existing: {
          updated_at: "2026-09-13T13:00:00.000Z",
          sheet_synced_at: "2026-08-26T13:51:24.468Z",
        },
        isHeaderRow: false,
        sheetMatchesApp: false,
      })
    ).toBe("update");
  });
});

describe("P.O. masterlist auto pull throttle", () => {
  it("pulls when the user can sync and has never pulled this session", () => {
    expect(
      shouldAutoPullPoMasterlistSheet({
        canSyncSheet: true,
        lastPullAtMs: null,
        nowMs: 1_000,
      })
    ).toBe(true);
  });

  it("does not pull for roles that cannot sync the sheet", () => {
    expect(
      shouldAutoPullPoMasterlistSheet({
        canSyncSheet: false,
        lastPullAtMs: null,
        nowMs: 1_000,
      })
    ).toBe(false);
  });

  it("waits a minute between automatic pulls", () => {
    expect(
      shouldAutoPullPoMasterlistSheet({
        canSyncSheet: true,
        lastPullAtMs: 0,
        nowMs: 59_000,
      })
    ).toBe(false);
    expect(
      shouldAutoPullPoMasterlistSheet({
        canSyncSheet: true,
        lastPullAtMs: 0,
        nowMs: 60_000,
      })
    ).toBe(true);
  });
});
