import { describe, expect, it } from "vitest";
import {
  calculateFundRequestDetailAmount,
  canPurchasingOfficerEditDetails,
  canPurchasingOfficerSetVatEwtOnRequesterForm,
  cleanFundRequestDetails,
  createEmptyFundRequestDetail,
} from "@/lib/fund-request-details";

describe("canPurchasingOfficerEditDetails", () => {
  it("allows PO only at project_manager_approved (approval queue)", () => {
    expect(
      canPurchasingOfficerEditDetails("purchasing_officer", "project_manager_approved")
    ).toBe(true);
    expect(
      canPurchasingOfficerEditDetails("purchasing_officer", "purchasing_officer_approved")
    ).toBe(false);
    expect(
      canPurchasingOfficerEditDetails("upper_management", "project_manager_approved")
    ).toBe(false);
  });
});

describe("canPurchasingOfficerSetVatEwtOnRequesterForm", () => {
  it("allows PO self-submit create", () => {
    expect(
      canPurchasingOfficerSetVatEwtOnRequesterForm({
        role: "purchasing_officer",
        isSelfSubmitPath: true,
        isEditMode: false,
        editStatus: null,
      })
    ).toBe(true);
  });

  it("blocks create when not on self-submit path", () => {
    expect(
      canPurchasingOfficerSetVatEwtOnRequesterForm({
        role: "purchasing_officer",
        isSelfSubmitPath: false,
        isEditMode: false,
        editStatus: null,
      })
    ).toBe(false);
  });

  it("allows PO edit while awaiting upper management", () => {
    expect(
      canPurchasingOfficerSetVatEwtOnRequesterForm({
        role: "purchasing_officer",
        isSelfSubmitPath: true,
        isEditMode: true,
        editStatus: "purchasing_officer_approved",
      })
    ).toBe(true);
  });

  it("blocks edit at other statuses", () => {
    expect(
      canPurchasingOfficerSetVatEwtOnRequesterForm({
        role: "purchasing_officer",
        isSelfSubmitPath: true,
        isEditMode: true,
        editStatus: "pending",
      })
    ).toBe(false);
    expect(
      canPurchasingOfficerSetVatEwtOnRequesterForm({
        role: "purchasing_officer",
        isSelfSubmitPath: true,
        isEditMode: true,
        editStatus: "management_approved",
      })
    ).toBe(false);
  });

  it("blocks non-PO roles", () => {
    expect(
      canPurchasingOfficerSetVatEwtOnRequesterForm({
        role: "operations_manager",
        isSelfSubmitPath: true,
        isEditMode: false,
        editStatus: null,
      })
    ).toBe(false);
  });
});

describe("cleanFundRequestDetails VAT/EWT persistence", () => {
  it("stores vat_mode, ewt_rate, base_amount and adjusted amount", () => {
    const base = createEmptyFundRequestDetail();
    const row = {
      ...base,
      description: "Materials",
      baseAmount: "11200",
      vatMode: "inclusive" as const,
      ewtRate: 1 as const,
    };
    const expectedAmount = calculateFundRequestDetailAmount(11200, "inclusive", 1);
    const cleaned = cleanFundRequestDetails([row], []);

    expect(cleaned).not.toBeNull();
    expect(cleaned!.details).toHaveLength(1);
    expect(cleaned!.details[0]).toMatchObject({
      kind: "item",
      description: "Materials",
      base_amount: 11200,
      vat_mode: "inclusive",
      ewt_rate: 1,
      amount: expectedAmount,
    });
    expect(cleaned!.total).toBe(expectedAmount);
  });

  it("applies deductions after VAT/EWT-adjusted line items", () => {
    const row = {
      ...createEmptyFundRequestDetail(),
      description: "Billing",
      baseAmount: "10000",
      vatMode: "exclusive" as const,
      ewtRate: 2 as const,
    };
    const lineAmount = calculateFundRequestDetailAmount(10000, "exclusive", 2);
    const cleaned = cleanFundRequestDetails(
      [row],
      [{ description: "Retention", amount: "500" }]
    );

    expect(cleaned).not.toBeNull();
    expect(cleaned!.details).toHaveLength(2);
    expect(cleaned!.details[1]).toMatchObject({
      kind: "deduction",
      description: "Retention",
      amount: 500,
    });
    expect(cleaned!.total).toBe(Math.round((lineAmount - 500) * 100) / 100);
  });

  it("returns null when deductions exceed item total", () => {
    const row = {
      ...createEmptyFundRequestDetail(),
      description: "Item",
      baseAmount: "100",
      vatMode: null,
      ewtRate: null,
    };
    expect(
      cleanFundRequestDetails([row], [{ description: "Too much", amount: "200" }])
    ).toBeNull();
  });
});
