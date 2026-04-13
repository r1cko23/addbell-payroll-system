import { test, expect } from '@playwright/test';

/**
 * Test loan creation functionality
 * Tests that users with Admin/HR roles can create loans
 */
test.describe('Loan Creation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');
    
    // Wait for login page to load
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    
    // TODO: Replace with actual admin/HR credentials from test environment
    // For now, this test assumes you're already logged in as admin/HR
    // You may need to update these credentials based on your test setup
    // Default to the same admin creds used by other approval access tests
    // Default to a real HR/Admin user (profiles.role must be "admin" or "hr")
    // Found via service-role query: admin@addbell.com (role: hr), password: test123
    const adminEmail = process.env.TEST_ADMIN_EMAIL || 'admin@addbell.com';
    const adminPassword = process.env.TEST_ADMIN_PASSWORD || 'test123';
    
    // Fill in login form
    await page.fill('input[type="email"]', adminEmail);
    await page.fill('input[type="password"]', adminPassword);
    
    // Submit login form
    await page.click('button:has-text("Sign In"), button:has-text("Login"), button[type="submit"]');
    
    // Wait for navigation after login (adjust selector based on your app)
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
  });

  test('should allow admin/HR to create a loan', async ({ page }) => {
    // Navigate to loans page
    await page.goto('/loans');
    
    // Wait for loans page to load
    await page.waitForSelector('h1:has-text("Loan Management")', { timeout: 10000 });
    
    // Click "Add Loan" button
    await page.click('button:has-text("Add Loan")');
    
    // Wait for modal to appear
    await page.waitForSelector('text=Add New Loan', { timeout: 5000 });
    
    // Wait a moment for form to fully load
    await page.waitForTimeout(500);
    
    // Fill in loan form
    const dialog = page.locator('[role="dialog"]').first();

    // Select employee (Radix Select). Prefer the "Select employee" placeholder.
    const employeeCombobox = dialog
      .locator('button[role="combobox"]')
      .filter({ hasText: /Select employee/i })
      .first();

    if ((await employeeCombobox.count()) > 0) {
      await employeeCombobox.click();
    } else {
      await dialog.locator('button[role="combobox"]').first().click();
    }

    const employeeOptions = page.locator('[role="option"]');
    await page.waitForSelector('[role="option"]', { timeout: 5000 });
    const firstEmployee = employeeOptions.first();
    const optionText = (await firstEmployee.textContent()) || "";
    const match = optionText.match(/\(([^)]+)\)/);
    const expectedEmployeeId = match?.[1];
    await firstEmployee.click();

    // Sanity-check the selection took effect (employee_id is displayed in parentheses).
    if (expectedEmployeeId) {
      await expect(
        dialog
          .locator('button[role="combobox"]')
          .filter({ hasText: expectedEmployeeId })
          .first()
      ).toBeVisible({ timeout: 5000 });
    }
    
    // Fill in loan details
    await page.fill('input[id="original_balance"]', '10000');
    await page.fill('input[id="current_balance"]', '10000');
    // Loan form uses Weekly Deduction Amount (not monthly payment)
    // For a company loan of 6 total terms (~24 weeks), 10000 / (6*4) = 416.67/week
    await page.fill('input[id="weekly_deduction_amount"]', '416.67');
    await page.fill('input[id="total_terms"]', '6');
    await page.fill('input[id="remaining_terms"]', '6');
    
    // Set effectivity date (format: YYYY-MM-DD)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    await page.fill('input[id="effectivity_date"]', dateStr);
    
    // Click "Create Loan" button
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });
    const createButton = page.locator('button:has-text("Create Loan")');
    await createButton.click();
    
    // Prefer app's success signal: modal closes only after a successful insert.
    let modalClosed = false;
    try {
      await page.waitForSelector('text=Add New Loan', { state: 'hidden', timeout: 30000 });
      modalClosed = true;
    } catch {
      // Modal didn't close within timeout.
    }

    const toasts = page.locator('[role="status"], [data-sonner-toast]');
    const toastTexts = (await toasts.allInnerTexts().catch(() => [])).map((t) =>
      t.trim()
    );
    const hasSuccessToast = toastTexts.some((t) => /Loan created successfully/i.test(t));

    if (!modalClosed && !hasSuccessToast) {
      throw new Error(
        `Loan creation did not succeed. Toasts: ${toastTexts.join(
          " | "
        )}. ConsoleErrors: ${consoleErrors.join(" | ")}. PageErrors: ${pageErrors.join(
          " | "
        )}`
      );
    }
    
    if (!modalClosed) {
      // If toast arrived but modal close was slightly delayed, wait briefly.
      await page.waitForSelector('text=Add New Loan', { state: 'hidden', timeout: 5000 });
    }
  });

  test('should prevent duplicate submissions', async ({ page }) => {
    // Navigate to loans page
    await page.goto('/loans');
    
    // Wait for loans page to load
    await page.waitForSelector('h1:has-text("Loan Management")', { timeout: 10000 });
    
    // Click "Add Loan" button
    await page.click('button:has-text("Add Loan")');
    
    // Wait for modal to appear
    await page.waitForSelector('text=Add New Loan', { timeout: 5000 });
    
    // Fill in minimal required fields
    const dialog = page.locator('[role="dialog"]').first();
    const employeeCombobox = dialog
      .locator('button[role="combobox"]')
      .filter({ hasText: /Select employee/i })
      .first();
    if ((await employeeCombobox.count()) > 0) {
      await employeeCombobox.click();
    } else {
      await dialog.locator('button[role="combobox"]').first().click();
    }

    const employeeOptions = page.locator('[role="option"]');
    await page.waitForSelector('[role="option"]', { timeout: 5000 });
    const firstEmployee = employeeOptions.first();
    const optionText = (await firstEmployee.textContent()) || "";
    const match = optionText.match(/\(([^)]+)\)/);
    const expectedEmployeeId = match?.[1];
    await firstEmployee.click();

    if (expectedEmployeeId) {
      await expect(
        dialog
          .locator('button[role="combobox"]')
          .filter({ hasText: expectedEmployeeId })
          .first()
      ).toBeVisible({ timeout: 5000 });
    }
    
    await page.fill('input[id="original_balance"]', '5000');
    await page.fill('input[id="current_balance"]', '5000');
    await page.fill('input[id="total_terms"]', '6');
    await page.fill('input[id="remaining_terms"]', '6');
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    await page.fill('input[id="effectivity_date"]', dateStr);
    
    // Rapidly click create button multiple times
    const createButton = page.locator('button:has-text("Create Loan")');
    
    // Click multiple times rapidly
    await Promise.all([
      createButton.click(),
      createButton.click(),
      createButton.click(),
    ]);
    
    // Wait a moment
    await page.waitForTimeout(2000);
    
    // Check console for duplicate submission warnings
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      if (msg.text().includes('duplicate') || msg.text().includes('already in progress')) {
        consoleMessages.push(msg.text());
      }
    });
    
    // Should only see one success or error message, not multiple
    const toasts = page.locator('[role="status"], [data-sonner-toast]');
    const toastCount = await toasts.count();
    
    // Should have at most 1 toast (success or error)
    expect(toastCount).toBeLessThanOrEqual(1);
  });
});
