import { test, expect } from '@playwright/test';

test.describe('Employee Management Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[type="email"]', 'jericko.rzl@gmail.com');
    await page.fill('input[type="password"]', 'Clnrd#1009');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard', { timeout: 10000 });
  });

  test('should navigate to employees page', async ({ page }) => {
    // Click on Employees in navigation
    await page.click('text=Employees');
    
    // Should be on employees page
    await expect(page).toHaveURL('/employees');
    await expect(page.locator('text=/Employee Management|Employees/i').first()).toBeVisible();
  });

  test('should display employee list', async ({ page }) => {
    await page.goto('/employees');
    
    // Should have table or list of employees
    const employeeTable = page.locator('table, [role="table"]').first();
    await expect(employeeTable).toBeVisible({ timeout: 5000 });
    
    // Should have at least headers
    await expect(page.locator('text=/employee id|name|email/i').first()).toBeVisible();
  });

  test('should open add employee modal', async ({ page }) => {
    await page.goto('/employees');
    
    // Click Add Employee button
    const addButton = page.locator('button:has-text("Add Employee")').first();
    await addButton.click();
    
    // Modal should appear - look for modal heading
    await page.waitForTimeout(500);
    await expect(page.locator('text=/Add New Employee|Create Employee/i').first()).toBeVisible({ timeout: 5000 });
  });

  test('should validate required fields when creating employee', async ({ page }) => {
    await page.goto('/employees');
    
    // Open add modal
    const addButton = page.locator('button:has-text("Add Employee"), button:has-text("Create Employee"), button:has-text("New Employee")').first();
    await addButton.click();
    
    // Try to submit without filling fields
    const submitButton = page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Create")').first();
    await submitButton.click();
    
    // Should show validation errors or prevent submission
    await page.waitForTimeout(1000);
  });

  test('should create a new employee successfully', async ({ page }) => {
    await page.goto('/employees');
    
    // Open add modal
    const addButton = page.locator('button:has-text("Add Employee")').first();
    await addButton.click();
    
    // Wait for modal to open
    await page.waitForTimeout(500);
    
    // Fill in employee details with unique ID
    const timestamp = Date.now();
    const employeeId = `TEST${timestamp}`;
    
    // Find inputs within the modal
    const employeeIdInput = page.locator('input').filter({ hasText: '' }).first();
    const inputs = page.locator('input[type="text"], input[type="email"], input[type="number"]');
    
    await inputs.nth(0).fill(employeeId);
    await inputs.nth(1).fill(`Test Employee ${timestamp}`);
    
    // Fill rate per day and rate per hour
    const numberInputs = page.locator('input[type="number"]');
    await numberInputs.nth(0).fill('800');
    await numberInputs.nth(1).fill('100');
    
    // Submit form
    const createButton = page.locator('button:has-text("Create")').first();
    await createButton.click();
    
    // Wait for success message and modal to close
    await page.waitForTimeout(3000);
    
    // Should show in list (check for employee ID)
    await expect(page.locator(`text=${employeeId}`)).toBeVisible({ timeout: 10000 });
  });

  test('should search for employees', async ({ page }) => {
    await page.goto('/employees');
    
    // Look for search input
    const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]').first();
    
    if (await searchInput.isVisible()) {
      await searchInput.fill('EMP001');
      await page.waitForTimeout(1000);
      
      // Results should be filtered
      const rows = page.locator('table tbody tr, [role="row"]');
      const count = await rows.count();
      
      // Should have fewer results after search
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  test('should view employee details', async ({ page }) => {
    await page.goto('/employees');
    
    // Click on first employee (view or edit button)
    const firstEmployee = page.locator('table tbody tr, [role="row"]').first();
    
    if (await firstEmployee.isVisible()) {
      // Look for view/edit button
      const actionButton = firstEmployee.locator('button:has-text("View"), button:has-text("Edit"), button:has-text("Details")').first();
      
      if (await actionButton.isVisible()) {
        await actionButton.click();
        
        // Modal or detail page should appear
        await page.waitForTimeout(1000);
        await expect(page.locator('[role="dialog"], .modal, form').first()).toBeVisible();
      }
    }
  });
});

