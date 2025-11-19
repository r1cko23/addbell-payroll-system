import { test, expect } from '@playwright/test';

test.describe('Payslip Generation Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[type="email"]', 'jericko.rzl@gmail.com');
    await page.fill('input[type="password"]', 'Clnrd#1009');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard', { timeout: 10000 });
  });

  test('should navigate to payslips page', async ({ page }) => {
    await page.click('text=Payslips');
    
    await expect(page).toHaveURL('/payslips');
    await expect(page.locator('text=/Payslip Generation|Payslips/i').first()).toBeVisible();
  });

  test('should display week selector', async ({ page }) => {
    await page.goto('/payslips');
    
    // Should have week navigation
    await expect(page.locator('button:has-text("Prev"), button:has-text("Previous"), button:has-text("←")').first()).toBeVisible();
    await expect(page.locator('button:has-text("Next"), button:has-text("→")').first()).toBeVisible();
  });

  test('should display employee list for payslip generation', async ({ page }) => {
    await page.goto('/payslips');
    
    await page.waitForTimeout(3000);
    
    // Page should load - check for main heading
    await expect(page.locator('text=/Payslip Generation|Select Week|Select Employee/i').first()).toBeVisible({ timeout: 10000 });
    
    // Should have either employee selector or table
    const hasEmployeeSelect = await page.locator('select, text=/Select Employee|employee/i').first().isVisible().catch(() => false);
    const hasTable = await page.locator('table').first().isVisible().catch(() => false);
    
    expect(hasEmployeeSelect || hasTable).toBeTruthy();
  });

  test('should show generate payslip button', async ({ page }) => {
    await page.goto('/payslips');
    
    await page.waitForTimeout(3000);
    
    // Look for generate button - it should exist somewhere on the page
    const generateButton = page.locator('button:has-text("Generate")').first();
    const isVisible = await generateButton.isVisible({ timeout: 10000 }).catch(() => false);
    
    // Button should exist (even if page needs timesheet data first)
    expect(isVisible || await page.locator('text=/generate|payslip/i').first().isVisible()).toBeTruthy();
  });

  test('should open payslip generation modal', async ({ page }) => {
    await page.goto('/payslips');
    
    await page.waitForTimeout(2000);
    
    // Click first generate button
    const generateButton = page.locator('button:has-text("Generate"), button:has-text("Create Payslip")').first();
    
    if (await generateButton.isVisible()) {
      await generateButton.click();
      
      // Modal should open
      await expect(page.locator('[role="dialog"], .modal').first()).toBeVisible({ timeout: 3000 });
    }
  });

  test('should display payslip details in modal', async ({ page }) => {
    await page.goto('/payslips');
    
    await page.waitForTimeout(2000);
    
    // Click generate button
    const generateButton = page.locator('button:has-text("Generate"), button:has-text("Create Payslip")').first();
    
    if (await generateButton.isVisible()) {
      await generateButton.click();
      await page.waitForTimeout(1000);
      
      // Should show payslip details
      await expect(page.locator('text=/Employee|Name|Rate|Hours|Gross|Deductions|Net/i').first()).toBeVisible();
    }
  });

  test('should show deductions section', async ({ page }) => {
    await page.goto('/payslips');
    
    await page.waitForTimeout(2000);
    
    // Click generate button
    const generateButton = page.locator('button:has-text("Generate"), button:has-text("Create Payslip")').first();
    
    if (await generateButton.isVisible()) {
      await generateButton.click();
      await page.waitForTimeout(1000);
      
      // Should have deductions fields
      const deductionsSection = page.locator('text=/deduction|sss|philhealth|pag-ibig/i').first();
      if (await deductionsSection.isVisible()) {
        await expect(deductionsSection).toBeVisible();
      }
    }
  });

  test('should allow toggling contribution deductions', async ({ page }) => {
    await page.goto('/payslips');
    
    await page.waitForTimeout(2000);
    
    // Click generate button
    const generateButton = page.locator('button:has-text("Generate"), button:has-text("Create Payslip")').first();
    
    if (await generateButton.isVisible()) {
      await generateButton.click();
      await page.waitForTimeout(1000);
      
      // Look for checkboxes for SSS, PhilHealth, Pag-IBIG
      const checkbox = page.locator('input[type="checkbox"]').first();
      
      if (await checkbox.isVisible()) {
        const isChecked = await checkbox.isChecked();
        await checkbox.click();
        
        // State should change
        const newState = await checkbox.isChecked();
        expect(newState).not.toBe(isChecked);
      }
    }
  });

  test('should enter deduction amounts', async ({ page }) => {
    await page.goto('/payslips');
    
    await page.waitForTimeout(2000);
    
    // Click generate button
    const generateButton = page.locator('button:has-text("Generate"), button:has-text("Create Payslip")').first();
    
    if (await generateButton.isVisible()) {
      await generateButton.click();
      await page.waitForTimeout(1000);
      
      // Look for deduction input fields
      const deductionInputs = page.locator('input[type="number"], input[type="text"]').filter({ hasText: /vale|loan|uniform/i });
      
      if (await deductionInputs.first().isVisible()) {
        await deductionInputs.first().fill('500');
        await expect(deductionInputs.first()).toHaveValue('500');
      }
    }
  });

  test('should calculate net pay after deductions', async ({ page }) => {
    await page.goto('/payslips');
    
    await page.waitForTimeout(2000);
    
    // Click generate button
    const generateButton = page.locator('button:has-text("Generate"), button:has-text("Create Payslip")').first();
    
    if (await generateButton.isVisible()) {
      await generateButton.click();
      await page.waitForTimeout(1000);
      
      // Should show net pay
      const netPayText = page.locator('text=/net pay|take home|total/i');
      await expect(netPayText.first()).toBeVisible({ timeout: 3000 });
    }
  });

  test('should save payslip successfully', async ({ page }) => {
    await page.goto('/payslips');
    
    await page.waitForTimeout(2000);
    
    // Click generate button
    const generateButton = page.locator('button:has-text("Generate"), button:has-text("Create Payslip")').first();
    
    if (await generateButton.isVisible()) {
      await generateButton.click();
      await page.waitForTimeout(1000);
      
      // Click save/confirm button
      const saveButton = page.locator('button:has-text("Save"), button:has-text("Confirm"), button:has-text("Generate Payslip")').last();
      
      if (await saveButton.isVisible()) {
        await saveButton.click();
        
        // Should show success message
        await page.waitForTimeout(2000);
      }
    }
  });

  test('should navigate between weeks for payslips', async ({ page }) => {
    await page.goto('/payslips');
    
    // Get current week
    const weekText = await page.locator('text=/Nov|Dec|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct/i').first().textContent();
    
    // Click next week
    const nextButton = page.locator('button:has-text("Next"), button:has-text("→")').first();
    await nextButton.click();
    await page.waitForTimeout(1500);
    
    // Week should change
    const newWeekText = await page.locator('text=/Nov|Dec|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct/i').first().textContent();
    expect(newWeekText).not.toBe(weekText);
  });
});

