/**
 * Data Rendering Check Script
 *
 * This script helps verify that data is rendering properly on the new pages.
 * Run this with: node scripts/check-data-rendering.js
 *
 * Make sure your dev server is running on http://localhost:3000
 */

const { chromium } = require("playwright");

const PAGES_TO_CHECK = [
  {
    name: "Failure to Log Approval",
    url: "/failure-to-log-approval",
    requiresAuth: true,
    expectedElements: [
      'h1:has-text("Failure to Log Approval")',
      "text=/Total Requests|Pending|Approved|Rejected/i",
      "select", // Filter dropdown
    ],
  },
  {
    name: "Leave Approval",
    url: "/leave-approval",
    requiresAuth: true,
    expectedElements: [
      'h1:has-text("Leave Approval")',
      "text=/Total Requests|Pending|Approved|Rejected/i",
      "select", // Filter dropdown
    ],
  },
  {
    name: "Employee Portal - Failure to Log",
    url: "/employee-portal/failure-to-log",
    requiresAuth: false, // Uses employee session
    expectedElements: [
      "text=/Failure to Log|File Failure to Log/i",
      "text=/Pending|Approved|Total Requests/i",
    ],
  },
  {
    name: "Employee Portal - Leave Request",
    url: "/employee-portal/leave-request",
    requiresAuth: false, // Uses employee session
    expectedElements: [
      "text=/Leave Request|File Leave Request/i",
      "text=/SIL|LWOP/i",
      "text=/SIL Credits/i",
    ],
  },
];

async function checkPage(browser, pageConfig, credentials) {
  const page = await browser.newPage();
  const results = {
    name: pageConfig.name,
    url: pageConfig.url,
    passed: false,
    errors: [],
    warnings: [],
    dataFound: false,
  };

  try {
    console.log(`\n🔍 Checking: ${pageConfig.name}`);
    console.log(`   URL: ${pageConfig.url}`);

    // Login if required
    if (pageConfig.requiresAuth && credentials) {
      await page.goto("http://localhost:3000/login");
      await page.waitForTimeout(1000);

      await page.fill('input[type="email"]', credentials.email);
      await page.fill('input[type="password"]', credentials.password);
      await page.click('button[type="submit"]');
      await page.waitForURL("**/dashboard", { timeout: 10000 });
      console.log("   ✓ Logged in successfully");
    }

    // Navigate to page
    await page.goto(`http://localhost:3000${pageConfig.url}`);
    await page.waitForTimeout(2000);

    // Check for expected elements
    for (const selector of pageConfig.expectedElements) {
      try {
        const element = page.locator(selector).first();
        const isVisible = await element.isVisible({ timeout: 3000 });

        if (isVisible) {
          console.log(`   ✓ Found: ${selector}`);
        } else {
          results.warnings.push(`Element not visible: ${selector}`);
          console.log(`   ⚠️  Not found: ${selector}`);
        }
      } catch (error) {
        results.warnings.push(`Error checking ${selector}: ${error.message}`);
        console.log(`   ⚠️  Error checking: ${selector}`);
      }
    }

    // Check for data rendering
    const dataIndicators = [
      "text=/Employee|Name|ID/i",
      "text=/\\d+/", // Numbers (stats, counts)
      '[class*="Card"]',
      'table, [role="table"]',
    ];

    let dataFound = false;
    for (const indicator of dataIndicators) {
      try {
        const count = await page.locator(indicator).count();
        if (count > 0) {
          dataFound = true;
          console.log(
            `   ✓ Data indicator found: ${indicator} (${count} items)`
          );
          break;
        }
      } catch (error) {
        // Continue checking other indicators
      }
    }

    if (!dataFound) {
      // Check for empty state
      const emptyState = await page
        .locator("text=/No requests|No data|No records/i")
        .isVisible()
        .catch(() => false);
      if (emptyState) {
        console.log("   ℹ️  Empty state displayed (no data yet)");
        results.dataFound = true; // Empty state is valid
      } else {
        results.errors.push("No data indicators found and no empty state");
        console.log("   ❌ No data indicators found");
      }
    } else {
      results.dataFound = true;
    }

    // Check for console errors
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    // Take screenshot for visual inspection
    const screenshotPath = `screenshots/${pageConfig.name
      .replace(/\s+/g, "-")
      .toLowerCase()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`   📸 Screenshot saved: ${screenshotPath}`);

    // Check for JavaScript errors
    await page.waitForTimeout(1000);
    if (consoleErrors.length > 0) {
      results.warnings.push(`Console errors: ${consoleErrors.join(", ")}`);
      console.log(`   ⚠️  Console errors detected: ${consoleErrors.length}`);
    }

    // Overall result
    if (results.errors.length === 0 && results.dataFound) {
      results.passed = true;
      console.log(`   ✅ Page check passed`);
    } else {
      console.log(`   ❌ Page check failed`);
      if (results.errors.length > 0) {
        console.log(`   Errors: ${results.errors.join(", ")}`);
      }
    }
  } catch (error) {
    results.errors.push(error.message);
    console.log(`   ❌ Error: ${error.message}`);
  } finally {
    await page.close();
  }

  return results;
}

async function main() {
  console.log("🚀 Starting Data Rendering Check...\n");
  console.log(
    "Make sure your dev server is running on http://localhost:3000\n"
  );

  const browser = await chromium.launch({ headless: false }); // Set to true for CI

  const credentials = {
    email: "jericko.razal@greenpasture.ph",
    password: "Clnrd#1009",
  };

  const allResults = [];

  for (const pageConfig of PAGES_TO_CHECK) {
    const result = await checkPage(browser, pageConfig, credentials);
    allResults.push(result);
  }

  await browser.close();

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 SUMMARY");
  console.log("=".repeat(60));

  const passed = allResults.filter((r) => r.passed).length;
  const failed = allResults.filter((r) => !r.passed).length;

  console.log(`\n✅ Passed: ${passed}/${allResults.length}`);
  console.log(`❌ Failed: ${failed}/${allResults.length}`);

  if (failed > 0) {
    console.log("\n❌ Failed Pages:");
    allResults
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`   - ${r.name}`);
        if (r.errors.length > 0) {
          r.errors.forEach((e) => console.log(`     Error: ${e}`));
        }
        if (r.warnings.length > 0) {
          r.warnings.forEach((w) => console.log(`     Warning: ${w}`));
        }
      });
  }

  console.log("\n📸 Screenshots saved in ./screenshots/ directory");
  console.log("\n✨ Check complete!");
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { checkPage, PAGES_TO_CHECK };
