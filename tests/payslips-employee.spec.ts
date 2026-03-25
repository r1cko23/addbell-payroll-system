import { test, expect } from "@playwright/test";

test.describe("Payslips (Employee Portal)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login?mode=employee");
    await page.waitForSelector('button:has-text("Employee")', {
      timeout: 10000,
    });
    await page.click('button:has-text("Employee")');

    const empId = process.env.TEST_EMPLOYEE_ID || "2025001";
    const empPass = process.env.TEST_EMPLOYEE_PASSWORD || "2025001";

    await page.fill('input[placeholder="2025-001"]', empId);
    await page.fill('input[type="password"]', empPass);
    await page.click('button:has-text("Sign In")');
    await page.waitForURL(/\/employee-portal\//, { timeout: 15000 });
  });

  test("Payslips page loads without fetch error", async ({ page }) => {
    await page.goto("/employee-portal/payslips");
    await expect(page).toHaveURL(/\/employee-portal\/payslips/);
    await expect(page.locator("main")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Failed to load payslips")).toHaveCount(0);
  });
});

