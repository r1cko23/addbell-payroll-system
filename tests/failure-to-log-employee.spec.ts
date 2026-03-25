import { test, expect } from "@playwright/test";

test.describe("Failure to Log (Employee Portal)", () => {
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
    await page.goto("/employee-portal/failure-to-log");
    await expect(page.locator("h1")).toContainText(/Failure to Log/i, {
      timeout: 20000,
    });
  });

  test("Failure to Log page loads with form and list sections", async ({
    page,
  }) => {
    await expect(page.getByText(/File Failure to Log Request/i)).toBeVisible();
    await expect(page.getByText(/My Failure to Log Requests/i)).toBeVisible();
    await expect(page.locator("#reason")).toBeVisible();
  });
});
