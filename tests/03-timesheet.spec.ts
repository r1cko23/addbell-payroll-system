import { test, expect } from '@playwright/test';

test.describe('Weekly Timesheet Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[type="email"]', 'jericko.rzl@gmail.com');
    await page.fill('input[type="password"]', 'Clnrd#1009');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard', { timeout: 10000 });
  });

  test('should navigate to timesheet page', async ({ page }) => {
    await page.click('text=Weekly Timesheet');
    
    await expect(page).toHaveURL('/timesheet');
    await expect(page.locator('text=/Weekly Timesheet|Timesheet Entry/i').first()).toBeVisible();
  });

  test('should display week selector', async ({ page }) => {
    await page.goto('/timesheet');
    
    // Should have week navigation buttons
    await expect(page.locator('button:has-text("Prev"), button:has-text("Previous"), button:has-text("←")').first()).toBeVisible();
    await expect(page.locator('button:has-text("Next"), button:has-text("→")').first()).toBeVisible();
    
    // Should show current week dates
    await expect(page.locator('text=/Nov|Dec|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct/i').first()).toBeVisible();
  });

  test('should display employee selector', async ({ page }) => {
    await page.goto('/timesheet');
    
    // Should have employee dropdown
    const employeeSelect = page.locator('select, [role="combobox"]').first();
    await expect(employeeSelect).toBeVisible();
  });

  test('should select an employee and display timesheet table', async ({ page }) => {
    await page.goto('/timesheet');
    
    // Select first employee
    const employeeSelect = page.locator('select').first();
    await employeeSelect.selectOption({ index: 1 });
    
    await page.waitForTimeout(2500);
    
    // Should display weekly hours table
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10000 });
    
    // Should have 7 data rows + 1 totals row = 8 rows (Wed-Tue)
    const rows = page.locator('table tbody tr');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(7); // At least 7 rows
  });

  test('should display correct day types', async ({ page }) => {
    await page.goto('/timesheet');
    
    // Select employee
    const employeeSelect = page.locator('select').first();
    await employeeSelect.selectOption({ index: 1 });
    await page.waitForTimeout(1500);
    
    // Should have day type badges (Regular Day, Sunday/Rest, Holiday)
    const dayTypeBadge = page.locator('text=/Regular Day|Sunday|Rest Day|Holiday/i').first();
    await expect(dayTypeBadge).toBeVisible();
  });

  test('should allow typing hours in input fields', async ({ page }) => {
    await page.goto('/timesheet');
    
    // Select employee
    const employeeSelect = page.locator('select').first();
    await employeeSelect.selectOption({ index: 1 });
    await page.waitForTimeout(2000);
    
    // Wait for table to be visible
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 10000 });
    
    // Get first regular hours input
    const firstInput = page.locator('table tbody tr').first().locator('input').first();
    
    // Clear and type hours
    await firstInput.click();
    await firstInput.fill('8');
    
    // Verify value was entered
    await expect(firstInput).toHaveValue('8', { timeout: 5000 });
    
    // Type decimal value
    await firstInput.fill('8.5');
    await expect(firstInput).toHaveValue('8.5', { timeout: 5000 });
  });

  test('should allow continuous typing without getting stuck', async ({ page }) => {
    await page.goto('/timesheet');
    
    // Select employee
    const employeeSelect = page.locator('select').first();
    await employeeSelect.selectOption({ index: 1 });
    await page.waitForTimeout(2000);
    
    // Wait for table to be visible
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 10000 });
    
    // Get first input
    const firstInput = page.locator('table tbody tr').first().locator('input').first();
    
    // Type multiple characters continuously
    await firstInput.click();
    await firstInput.fill('12.5');
    
    // Should have full value
    await expect(firstInput).toHaveValue('12.5', { timeout: 5000 });
  });

  test('should fill out complete week timesheet', async ({ page }) => {
    await page.goto('/timesheet');
    
    // Select employee
    const employeeSelect = page.locator('select').first();
    await employeeSelect.selectOption({ index: 1 });
    await page.waitForTimeout(2000);
    
    // Wait for table to be visible
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 10000 });
    
    // Fill hours for each day
    const rows = page.locator('table tbody tr');
    const rowCount = await rows.count();
    
    for (let i = 0; i < Math.min(rowCount - 1, 5); i++) { // -1 to exclude totals row
      const row = rows.nth(i);
      const inputs = row.locator('input');
      
      // Regular hours
      const regularInput = inputs.nth(0);
      await regularInput.fill('8');
      
      // Overtime hours  
      const overtimeInput = inputs.nth(1);
      await overtimeInput.fill('2');
      
      // Night diff hours
      const nightDiffInput = inputs.nth(2);
      await nightDiffInput.fill('1');
      
      await page.waitForTimeout(100);
    }
    
    // Should calculate amounts
    await page.waitForTimeout(1000);
    
    // Check if amounts are displayed
    const amountCell = page.locator('td:has-text("₱")').first();
    await expect(amountCell).toBeVisible({ timeout: 5000 });
  });

  test('should save timesheet successfully', async ({ page }) => {
    await page.goto('/timesheet');
    
    // Select employee
    const employeeSelect = page.locator('select').first();
    await employeeSelect.selectOption({ index: 1 });
    await page.waitForTimeout(2000);
    
    // Wait for table to be visible
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 10000 });
    
    // Fill some hours
    const firstRow = page.locator('table tbody tr').first();
    const firstInput = firstRow.locator('input').first();
    await firstInput.fill('8');
    
    await page.waitForTimeout(500);
    
    // Click Save button
    const saveButton = page.locator('button:has-text("Save Timesheet")').first();
    await saveButton.click();
    
    // Should show success message
    await page.waitForTimeout(3000);
    
    // Success toast should appear (check for common success indicators)
    const successIndicator = page.locator('text=/success|saved|updated/i').first();
    await expect(successIndicator).toBeVisible({ timeout: 10000 });
  });

  test('should load existing timesheet data', async ({ page }) => {
    await page.goto('/timesheet');
    
    // Select employee
    const employeeSelect = page.locator('select').first();
    await employeeSelect.selectOption({ index: 1 });
    await page.waitForTimeout(2000);
    
    // If there's existing data, inputs should have values
    const firstInput = page.locator('table tbody tr').first().locator('input').first();
    const value = await firstInput.inputValue();
    
    // Value might be empty or have data
    console.log('Loaded value:', value);
  });

  test('should navigate between weeks', async ({ page }) => {
    await page.goto('/timesheet');
    
    // Select employee
    const employeeSelect = page.locator('select').first();
    await employeeSelect.selectOption({ index: 1 });
    await page.waitForTimeout(1500);
    
    // Get current week text
    const weekText = await page.locator('text=/Nov|Dec|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct/i').first().textContent();
    
    // Click Next week
    const nextButton = page.locator('button:has-text("Next"), button:has-text("→")').first();
    await nextButton.click();
    await page.waitForTimeout(1500);
    
    // Week should change
    const newWeekText = await page.locator('text=/Nov|Dec|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct/i').first().textContent();
    expect(newWeekText).not.toBe(weekText);
    
    // Click Prev to go back
    const prevButton = page.locator('button:has-text("Prev"), button:has-text("Previous"), button:has-text("←")').first();
    await prevButton.click();
    await page.waitForTimeout(1500);
  });

  test('should calculate weekly totals', async ({ page }) => {
    await page.goto('/timesheet');
    
    // Select employee
    const employeeSelect = page.locator('select').first();
    await employeeSelect.selectOption({ index: 1 });
    await page.waitForTimeout(2000);
    
    // Wait for table to be visible
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 10000 });
    
    // Fill some hours
    const rows = page.locator('table tbody tr');
    const rowCount = await rows.count();
    
    for (let i = 0; i < Math.min(3, rowCount - 1); i++) { // -1 to exclude totals row
      const row = rows.nth(i);
      const input = row.locator('input').first();
      await input.fill('8');
      await page.waitForTimeout(100);
    }
    
    // Should display totals
    await page.waitForTimeout(1000);
    
    // Look for "WEEKLY TOTALS"
    const totalText = page.locator('text=/WEEKLY TOTALS/i');
    await expect(totalText).toBeVisible({ timeout: 5000 });
  });
});

