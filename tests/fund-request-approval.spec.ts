import { test, expect } from "@playwright/test";

test.describe("Fund Request Approval Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Login (use defaults from other approval access specs)
    await page.goto("/login");

    const adminEmail = process.env.TEST_ADMIN_EMAIL || "jericko.rzl@gmail.com";
    const adminPassword = process.env.TEST_ADMIN_PASSWORD || "test123";

    const emailInput =
      (await page.locator('input[type="email"]').count()) > 0
        ? page.locator('input[type="email"]')
        : page.locator('input[placeholder*="email" i]').first();

    await emailInput.fill(adminEmail);
    await page.locator('input[type="password"]').fill(adminPassword);
    await page.click('button:has-text("Sign In"), button:has-text("Login")');

    await page.waitForURL(
      /\/dashboard|\/leave-approval|\/overtime-approval|\/loans|\/employees|\/payslips|\/fund-request/i,
      { timeout: 20000 },
    );
  });

  test("does not double-render dashboard layout (list + detail)", async ({ page }) => {
    await page.goto("/fund-request?tab=inbox");
    await expect(page).toHaveURL(/\/fund-request\/?\?tab=inbox/);

    const listHeading = page.locator('h1:has-text("Fund Requests")');
    await expect(listHeading).toHaveCount(1);

    // Open the user dropdown and ensure logout only exists once.
    // (If the page was wrapped twice, the header would also be duplicated.)
    const logoutTrigger = page.locator('header [aria-haspopup="menu"]').first();
    await logoutTrigger.click();
    const logoutItem = page.locator('text=Logout').first();
    await expect(logoutItem).toBeVisible();
    await expect(page.locator('text=Logout')).toHaveCount(1);

    // Navigate to the first fund request detail page (if available).
    const openFullPageLinks = page.getByRole("link", { name: /View details/i });
    if ((await openFullPageLinks.count()) > 0) {
      await openFullPageLinks.first().click();
      await expect(page.locator("text=Fund request")).toHaveCount(1);

      await page.getByRole("link", { name: /Back to For Approval/i }).click();
      await expect(page).toHaveURL(/\/fund-request\/?\?tab=inbox/);
      await expect(listHeading).toHaveCount(1);
    } else {
      // Still validate that layout didn't double-render even when there are no rows.
      await expect(listHeading).toHaveCount(1);
    }
  });
});

