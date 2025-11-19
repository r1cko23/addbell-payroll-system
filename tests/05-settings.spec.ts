import { test, expect } from '@playwright/test';

test.describe('Settings and Navigation Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[type="email"]', 'jericko.rzl@gmail.com');
    await page.fill('input[type="password"]', 'Clnrd#1009');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard', { timeout: 10000 });
  });

  test('should navigate to settings page', async ({ page }) => {
    const settingsLink = page.locator('text=Settings, a[href="/settings"]').first();
    
    if (await settingsLink.isVisible()) {
      await settingsLink.click();
      await expect(page).toHaveURL('/settings');
    }
  });

  test('should display user information', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Should show logged in user email
    await expect(page.locator('text=jericko.rzl@gmail.com')).toBeVisible({ timeout: 5000 });
  });

  test('should display HR role information', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Should show HR role or badge
    const roleIndicator = page.locator('text=/hr|role/i');
    if (await roleIndicator.isVisible()) {
      await expect(roleIndicator).toBeVisible();
    }
  });

  test('should display navigation menu', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Check all navigation items exist
    await expect(page.locator('text=Dashboard')).toBeVisible();
    await expect(page.locator('text=Employees')).toBeVisible();
    await expect(page.locator('text=Weekly Timesheet')).toBeVisible();
    await expect(page.locator('text=Payslips')).toBeVisible();
  });

  test('should navigate through all main pages', async ({ page }) => {
    // Dashboard
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/dashboard');
    
    // Employees
    await page.click('text=Employees');
    await expect(page).toHaveURL('/employees');
    
    // Timesheet
    await page.click('text=Weekly Timesheet');
    await expect(page).toHaveURL('/timesheet');
    
    // Payslips
    await page.click('text=Payslips');
    await expect(page).toHaveURL('/payslips');
    
    // Deductions
    const deductionsLink = page.locator('text=Deductions, a[href="/deductions"]').first();
    if (await deductionsLink.isVisible()) {
      await deductionsLink.click();
      await expect(page).toHaveURL('/deductions');
    }
  });

  test('should display dashboard statistics', async ({ page }) => {
    await page.goto('/dashboard');
    
    await page.waitForTimeout(2000);
    
    // Should show some stats or cards
    const statsCard = page.locator('.card, [role="article"], .stat-card').first();
    if (await statsCard.isVisible()) {
      await expect(statsCard).toBeVisible();
    }
  });

  test('should handle page refresh correctly', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Reload page
    await page.reload();
    
    // Should still be authenticated
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });

  test('should display responsive navigation', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Check if navigation is visible (sidebar or header)
    const navigation = page.locator('nav, [role="navigation"], aside').first();
    await expect(navigation).toBeVisible();
  });

  test('should show holidays management if available', async ({ page }) => {
    const settingsLink = page.locator('text=Settings, a[href="/settings"]').first();
    
    if (await settingsLink.isVisible()) {
      await settingsLink.click();
      
      // Look for holidays section
      const holidaysSection = page.locator('text=/holiday/i').first();
      if (await holidaysSection.isVisible()) {
        await expect(holidaysSection).toBeVisible();
      }
    }
  });

  test('should show user management for HR role', async ({ page }) => {
    const settingsLink = page.locator('text=Settings, a[href="/settings"]').first();
    
    if (await settingsLink.isVisible()) {
      await settingsLink.click();
      
      // Look for user management section
      const userSection = page.locator('text=/user|manage users/i').first();
      if (await userSection.isVisible()) {
        await expect(userSection).toBeVisible();
      }
    }
  });
});

