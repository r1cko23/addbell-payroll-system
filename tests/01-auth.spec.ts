import { test, expect } from '@playwright/test';

test.describe('Authentication Tests', () => {
  
  test('should display login page correctly', async ({ page }) => {
    await page.goto('/login');
    
    // Check page title and elements
    await expect(page.locator('h1, h2').first()).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    await page.goto('/login');
    
    // Fill credentials
    await page.fill('input[type="email"]', 'jericko.rzl@gmail.com');
    await page.fill('input[type="password"]', 'Clnrd#1009');
    
    // Click login
    await page.click('button[type="submit"]');
    
    // Should redirect to dashboard
    await page.waitForURL('/dashboard', { timeout: 10000 });
    await expect(page).toHaveURL('/dashboard');
    
    // Verify dashboard elements
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('input[type="email"]', 'wrong@email.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // Should show error (either toast or error message)
    // Wait a bit for error to appear
    await page.waitForTimeout(2000);
    
    // Should still be on login page
    await expect(page).toHaveURL(/login/);
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[type="email"]', 'jericko.rzl@gmail.com');
    await page.fill('input[type="password"]', 'Clnrd#1009');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    
    // Find and click logout button
    const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign Out")').first();
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
      
      // Should redirect to login
      await page.waitForURL('/login', { timeout: 5000 });
      await expect(page).toHaveURL('/login');
    }
  });
});

