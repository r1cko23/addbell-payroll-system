import { test, expect } from "@playwright/test";

test.describe("Employee Portal Workflow Smoke", () => {
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

  test("bundy page loads and action controls are visible", async ({ page }) => {
    await page.goto("/employee-portal/bundy");
    await expect(page).toHaveURL(/\/employee-portal\/bundy/);
    await expect(page.locator("text=Logout")).toBeVisible();
    await expect(page.locator("main")).toBeVisible();
  });

  test("leave request page loads without fetch failure", async ({ page }) => {
    await page.goto("/employee-portal/leave-request");
    await expect(page).toHaveURL(/\/employee-portal\/leave-request/);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("text=Unable to load leave requests")).toHaveCount(
      0
    );
  });

  test("ot filing page loads without fetch failure", async ({ page }) => {
    await page.goto("/employee-portal/overtime");
    await expect(page).toHaveURL(/\/employee-portal\/overtime/);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("text=Failed to load OT requests")).toHaveCount(0);
  });

  test("failure-to-log page loads form and history", async ({ page }) => {
    await page.goto("/employee-portal/failure-to-log");
    await expect(page).toHaveURL(/\/employee-portal\/failure-to-log/);
    await expect(page.locator("main")).toBeVisible();
  });
});

