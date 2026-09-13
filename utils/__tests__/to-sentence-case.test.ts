import { describe, expect, it } from "vitest";
import { toSentenceCase } from "@/lib/to-sentence-case";

describe("toSentenceCase", () => {
  it("returns empty and single-word copy unchanged in shape", () => {
    expect(toSentenceCase("")).toBe("");
    expect(toSentenceCase("Email")).toBe("Email");
    expect(toSentenceCase("Projects")).toBe("Projects");
  });

  it("turns page headers into sentence case", () => {
    expect(toSentenceCase("Fund Requests")).toBe("Fund requests");
    expect(toSentenceCase("Purchase orders")).toBe("Purchase orders");
    expect(toSentenceCase("Project Details")).toBe("Project details");
    expect(toSentenceCase("OT Filing")).toBe("OT filing");
    expect(toSentenceCase("BIR reports")).toBe("BIR reports");
    expect(toSentenceCase("My Information")).toBe("My information");
    expect(toSentenceCase("Failure To Log")).toBe("Failure to log");
    expect(toSentenceCase("Storage Monitor")).toBe("Storage monitor");
  });

  it("turns form labels into sentence case and keeps acronyms", () => {
    expect(toSentenceCase("First Name")).toBe("First name");
    expect(toSentenceCase("Leave Type")).toBe("Leave type");
    expect(toSentenceCase("Date of Birth")).toBe("Date of birth");
    expect(toSentenceCase("Notes (Optional)")).toBe("Notes (optional)");
    expect(toSentenceCase("PO Code")).toBe("PO code");
    expect(toSentenceCase("Company ID no.")).toBe("Company ID no.");
    expect(toSentenceCase("Government IDs")).toBe("Government IDs");
    expect(toSentenceCase("PhilHealth #")).toBe("PhilHealth #");
    expect(toSentenceCase("Pag-IBIG #")).toBe("Pag-IBIG #");
    expect(toSentenceCase("SSS Salary Loan")).toBe("SSS salary loan");
    expect(toSentenceCase("NBI Clearance (expiration date)")).toBe(
      "NBI clearance (expiration date)"
    );
    expect(toSentenceCase("SUBCONTRACTOR DETAILS")).toBe(
      "Subcontractor details"
    );
    expect(toSentenceCase("Business Unit / Sub Company")).toBe(
      "Business unit / sub company"
    );
    expect(toSentenceCase("P.O. Number")).toBe("P.O. number");
    expect(toSentenceCase("Client-Linked Requests")).toBe(
      "Client-linked requests"
    );
  });

  it("does not retitle many-word copy that is already sentence case", () => {
    expect(toSentenceCase("Track employee registrations and the latest time in/out activity.")).toBe(
      "Track employee registrations and the latest time in/out activity."
    );
  });
});
