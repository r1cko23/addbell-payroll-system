import { describe, expect, it } from "vitest";
import {
  buildMasterlistPoKeySet,
  buildUniqueMasterlistTitleKeySet,
  evaluateFundRequestClientPoMasterlist,
  isClientPoPlaceholder,
  normalizeProjectTitleKey,
} from "@/lib/fund-request-client-po-masterlist";

describe("isClientPoPlaceholder", () => {
  it("treats blank and NTP-style values as placeholders", () => {
    expect(isClientPoPlaceholder("")).toBe(true);
    expect(isClientPoPlaceholder("NTP")).toBe(true);
    expect(isClientPoPlaceholder("With NTP only")).toBe(true);
    expect(isClientPoPlaceholder("PO to follow")).toBe(true);
    expect(isClientPoPlaceholder("No PO, with NTP")).toBe(true);
  });

  it("does not treat real client PO numbers as placeholders", () => {
    expect(isClientPoPlaceholder("PO-RE1350007312")).toBe(false);
    expect(isClientPoPlaceholder("TCP30012515-1")).toBe(false);
  });
});

describe("evaluateFundRequestClientPoMasterlist", () => {
  const masterlistKeys = buildMasterlistPoKeySet([
    "PO-RE1350007312",
    "TCP30012515-1",
  ]);
  const uniqueTitles = buildUniqueMasterlistTitleKeySet([
    "DROP CEILING AT PRODUCE SECTION",
    "Other unique job title here",
  ]);

  it("flags NTP even after approval, and marks ready when title matches masterlist", () => {
    const result = evaluateFundRequestClientPoMasterlist(
      {
        po_number: "With NTP only",
        project_details: {
          v: 1,
          projects: [
            {
              po_number: "With NTP only",
              title: "DROP CEILING AT PRODUCE SECTION",
              location: "Site",
              po_amount: null,
              completion_percentage: null,
            },
          ],
        },
        status: "management_approved",
        rejected_at: null,
        reference_mode: "client_linked",
      },
      masterlistKeys,
      uniqueTitles
    );
    expect(result.needsUpdate).toBe(true);
    expect(result.readyOnMasterlist).toBe(true);
    expect(result.reason).toBe("placeholder");
  });

  it("clears needsUpdate when PO is on masterlist", () => {
    const result = evaluateFundRequestClientPoMasterlist(
      {
        po_number: "PO-RE1350007312",
        project_details: null,
        project_title: "Some project",
        status: "management_approved",
        rejected_at: null,
        reference_mode: "client_linked",
      },
      masterlistKeys,
      uniqueTitles
    );
    expect(result.needsUpdate).toBe(false);
    expect(result.reason).toBe("ok");
  });

  it("flags unmatched strong PO numbers", () => {
    const result = evaluateFundRequestClientPoMasterlist(
      {
        po_number: "PO-RE9999999999",
        project_details: null,
        status: "pending",
        rejected_at: null,
        reference_mode: "client_linked",
      },
      masterlistKeys
    );
    expect(result.needsUpdate).toBe(true);
    expect(result.reason).toBe("unmatched");
  });

  it("does not false-flag strong POs while masterlist is still loading", () => {
    const result = evaluateFundRequestClientPoMasterlist(
      {
        po_number: "PO-RE1350007690",
        project_details: null,
        status: "management_approved",
        rejected_at: null,
        reference_mode: "client_linked",
      },
      new Set(),
      undefined,
      { masterlistLoaded: false }
    );
    expect(result.needsUpdate).toBe(false);
    expect(result.reason).toBe("ok");
  });

  it("ignores office-related requests (no Projects masterlist P.O.)", () => {
    const result = evaluateFundRequestClientPoMasterlist(
      {
        po_number: null,
        project_details: null,
        status: "management_approved",
        rejected_at: null,
        reference_mode: "internal_stock",
      },
      masterlistKeys
    );
    expect(result.needsUpdate).toBe(false);
    expect(result.reason).toBe("office_related");
  });

  it("ignores rejected requests", () => {
    const result = evaluateFundRequestClientPoMasterlist(
      {
        po_number: "NTP",
        project_details: null,
        status: "rejected",
        rejected_at: "2026-08-01T00:00:00Z",
        reference_mode: "client_linked",
      },
      masterlistKeys
    );
    expect(result.needsUpdate).toBe(false);
    expect(result.reason).toBe("rejected");
  });
});

describe("normalizeProjectTitleKey", () => {
  it("collapses punctuation and case", () => {
    expect(normalizeProjectTitleKey("Drop Ceiling — At Produce Section")).toBe(
      "DROPCEILINGATPRODUCESECTION"
    );
  });
});
