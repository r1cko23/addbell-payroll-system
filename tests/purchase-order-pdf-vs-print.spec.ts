import { test, expect } from "@playwright/test";

test.describe("Purchase Order PDF vs Print", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");

    const adminEmail = process.env.TEST_ADMIN_EMAIL || "admin@addbell.com";
    const adminPassword = process.env.TEST_ADMIN_PASSWORD || "test123";

    await page.fill('input[type="email"]', adminEmail);
    await page.fill('input[type="password"]', adminPassword);
    await page.click('button:has-text("Sign In"), button:has-text("Login"), button[type="submit"]');

    // Wait for authenticated area
    await page.waitForURL(/\/dashboard|\/purchase-order/i, { timeout: 20000 });
  });

  async function goToCreatePO(page: any) {
    await page.goto("/purchase-order");
    await expect(page.getByRole("button", { name: /New PO/i })).toBeVisible();
    await page.getByRole("button", { name: /New PO/i }).click();
    // Generate a PO number so the template has a stable header number
    const generateBtn = page.getByRole("button", { name: /Generate/i });
    if (await generateBtn.count()) await generateBtn.click();
  }

  async function assertPrintTemplateCreated(page: any) {
    // The Print/PDF flows render into a temporary, zero-size iframe.
    // We assert that the iframe content includes key template strings.
    await page.waitForFunction(
      () => document.querySelectorAll("iframe").length > 0,
      { timeout: 5000 },
    );
    const frame = page.frameLocator("iframe").last();

    await expect(frame.getByText("Purchase Order")).toBeVisible({ timeout: 5000 });
    await expect(
      frame.getByText(/This document is not valid for claim of input tax/i)
    ).toBeVisible({ timeout: 5000 });
  }

  test("PDF uses the same template as Print", async ({ page }) => {
    await goToCreatePO(page);

    // Click Print first.
    await page.getByRole("button", { name: /^Print$/i }).click();
    await assertPrintTemplateCreated(page);
    await expect(page.getByRole("button", { name: /^Print$/i })).toBeEnabled({ timeout: 15000 });
    await expect(page.getByRole("button", { name: /^PDF$/i })).toBeEnabled({ timeout: 15000 });

    // Then click PDF (now reuses print template too).
    await page.getByRole("button", { name: /^PDF$/i }).click();
    await assertPrintTemplateCreated(page);
  });
});

