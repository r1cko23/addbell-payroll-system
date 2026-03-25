import { test, expect } from "@playwright/test";

const PM_EMAIL =
  process.env.TEST_PM_EMAIL || "carizza.leonardo@addbell.com";
const PM_PASSWORD = process.env.TEST_PM_PASSWORD || "test123";

test.describe("Project Manager Approval Access", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', PM_EMAIL);
    await page.fill('input[type="password"]', PM_PASSWORD);
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
    await expect(page.locator("main")).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByText(/Failure to Log Approval/i).first()
    ).toBeVisible({ timeout: 15000 });
  });
});

