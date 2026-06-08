import { computePayslipNetPay } from "@/lib/payslip-net";

describe("computePayslipNetPay", () => {
  test("gross + positive adjustment − deductions + allowance", () => {
    expect(
      computePayslipNetPay({
        grossPay: 10000,
        adjustmentAmount: 500,
        totalDeductions: 2000,
        allowanceAmount: 300,
      })
    ).toBe(8800);
  });

  test("negative adjustment reduces net", () => {
    expect(
      computePayslipNetPay({
        grossPay: 10000,
        adjustmentAmount: -500,
        totalDeductions: 1000,
        allowanceAmount: 0,
      })
    ).toBe(8500);
  });

  test("allowance is added after deductions", () => {
    expect(
      computePayslipNetPay({
        grossPay: 5000,
        adjustmentAmount: 0,
        totalDeductions: 500,
        allowanceAmount: 250,
      })
    ).toBe(4750);
  });
});
