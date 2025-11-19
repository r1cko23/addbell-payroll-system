import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

/**
 * Authentication setup - runs once before all tests
 * Logs in with HR credentials and saves auth state
 */
setup('authenticate', async ({ page }) => {
  // Navigate to login page
  await page.goto('/login');
  
  // Fill in login credentials
  await page.fill('input[type="email"]', 'jericko.rzl@gmail.com');
  await page.fill('input[type="password"]', 'Clnrd#1009');
  
  // Click login button
  await page.click('button[type="submit"]');
  
  // Wait for successful redirect to dashboard
  await page.waitForURL('/dashboard', { timeout: 10000 });
  
  // Verify we're logged in
  await expect(page.locator('text=Dashboard')).toBeVisible();
  
  // Save authentication state
  await page.context().storageState({ path: authFile });
});

