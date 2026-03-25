import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || "jericko.rzl@gmail.com";
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || "test123";

test.describe("Upper Management Approval Access", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");

    const emailInput =
      (await page.locator('input[type="email"]').count()) > 0
        ? page.locator('input[type="email"]')
        : page.locator('input[placeholder*="email" i]').first();

    await emailInput.fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
    await page.click('button:has-text("Sign In"), button:has-text("Login")');
    await page.waitForURL(/\/dashboard|\/leave-approval|\/overtime-approval/, {
      timeout: 20000,
    });
  });

  test("can access Leave Approval page", async ({ page }) => {
    await page.goto("/leave-approval");
    await expect(page).toHaveURL(/\/leave-approval/);
    await expect(page.locator("main")).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByText(/Leave Approval|leave approvals/i).first()
    ).toBeVisible({ timeout: 15000 });
  });

  test("can access OT Approval page", async ({ page }) => {
    await page.goto("/overtime-approval");
    await expect(page).toHaveURL(/\/overtime-approval/);
    await expect(page.locator("main")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/OT Approvals|OT Approval/i).first()).toBeVisible({
      timeout: 15000,
    });
  });

  test("can access Failure-to-Log Approval page", async ({ page }) => {
    await page.goto("/failure-to-log-approval");
    await expect(page).toHaveURL(/\/failure-to-log-approval/);
    await expect(page.locator("text=Failure to Log Approval")).toBeVisible();
  });
});

