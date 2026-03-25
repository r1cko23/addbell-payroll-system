import { test, expect } from "@playwright/test";

test.describe("Overtime Request (Employee Portal)", () => {
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

    await page.goto("/employee-portal/overtime");
  });

  test("Can submit and cancel OT request", async ({ page }) => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const todayStr = `${yyyy}-${mm}-${dd}`;

    await page.fill('input[id="ot-date"]', todayStr);
    await page.fill('input[id="start-time"]', "17:00");
    await page.fill('input[id="end-time"]', "18:00");
    await page.fill(
      'textarea[placeholder="Provide reason for overtime request..."]',
      `Playwright OT test ${Date.now()}`
    );

    await page.click('button:has-text("Submit OT Request")');
    await expect(
      page.locator("text=Overtime request submitted successfully")
    ).toBeVisible({ timeout: 10000 });

    const cancelBtn = page.locator('button:has-text("Cancel")').first();
    if ((await cancelBtn.count()) > 0) {
      await cancelBtn.click();
      await expect(page.locator("text=OT request cancelled")).toBeVisible({
        timeout: 10000,
      });
    }
  });
});

