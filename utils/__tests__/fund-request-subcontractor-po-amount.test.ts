import {
  shouldShowSubcontractorPoAmountOnReview,
  shouldShowSubcontractorPoAmountToPurchasingOfficer,
} from "@/lib/fund-request-subcontractor-po-amount";

describe("shouldShowSubcontractorPoAmountToPurchasingOfficer", () => {
  it("shows the PO amount field to purchasing at PO review", () => {
    expect(
      shouldShowSubcontractorPoAmountToPurchasingOfficer(
        "purchasing_officer",
        "subcontractor_payment",
        "project_manager_approved",
        null
      )
    ).toBe(true);
  });

  it("hides the PO amount field from upper management at PO review", () => {
    expect(
      shouldShowSubcontractorPoAmountToPurchasingOfficer(
        "upper_management",
        "subcontractor_payment",
        "project_manager_approved",
        1000
      )
    ).toBe(false);
  });
});

describe("shouldShowSubcontractorPoAmountOnReview", () => {
  it("shows the PO amount field to upper management at UM review", () => {
    expect(
      shouldShowSubcontractorPoAmountOnReview(
        "upper_management",
        "subcontractor_payment",
        "purchasing_officer_approved",
        25000
      )
    ).toBe(true);
  });

  it("shows the PO amount field to upper management even when amount is missing", () => {
    expect(
      shouldShowSubcontractorPoAmountOnReview(
        "upper_management",
        "subcontractor_payment",
        "purchasing_officer_approved",
        null
      )
    ).toBe(true);
  });

  it("shows the PO amount field to admin at UM review", () => {
    expect(
      shouldShowSubcontractorPoAmountOnReview(
        "admin",
        "subcontractor_payment",
        "purchasing_officer_approved",
        5000
      )
    ).toBe(true);
  });

  it("hides the PO amount field from upper management before UM review", () => {
    expect(
      shouldShowSubcontractorPoAmountOnReview(
        "upper_management",
        "subcontractor_payment",
        "project_manager_approved",
        5000
      )
    ).toBe(false);
  });

  it("keeps purchasing officer behavior unchanged", () => {
    expect(
      shouldShowSubcontractorPoAmountOnReview(
        "purchasing_officer",
        "subcontractor_payment",
        "project_manager_approved",
        null
      )
    ).toBe(true);
  });

  it("hides the PO amount field for non-subcontractor payment requests", () => {
    expect(
      shouldShowSubcontractorPoAmountOnReview(
        "upper_management",
        "supplier_payment",
        "purchasing_officer_approved",
        5000
      )
    ).toBe(false);
  });
});
