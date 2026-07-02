/**
 * Capture screenshots for docs/guides/FUND_REQUEST_GUIDEBOOK.md
 * Usage: npx playwright test scripts/capture-fund-request-guide-screenshots.spec.ts --project=chromium
 */
import { test, expect, type Page } from "@playwright/test";
import path from "path";

const OUT = path.join(process.cwd(), "docs", "guides", "assets", "fund-request");

const ACCOUNTS = {
  om: {
    email: process.env.TEST_OM_EMAIL || "constantino.milo@addbell.com",
    password: process.env.TEST_OM_PASSWORD || "test123",
    name: "Constantino Milo",
  },
  omFiler: {
    email: process.env.TEST_OM_FILER_EMAIL || "carizza.leonardo@addbell.com",
    password: process.env.TEST_OM_FILER_PASSWORD || "test123",
    name: "Carizza Leonardo",
  },
  po: {
    email: process.env.TEST_PO_EMAIL || "phen.conte@addbell.com",
    password: process.env.TEST_PO_PASSWORD || "test123",
    name: "Phen Conte",
  },
  um: {
    email: process.env.TEST_UM_EMAIL || "doods27us@yahoo.com",
    password: process.env.TEST_UM_PASSWORD || "test123",
    name: "Dado Leonardo",
  },
  employee: {
    id: process.env.TEST_EMPLOYEE_ID || "2025001",
    password: process.env.TEST_EMPLOYEE_PASSWORD || "2025001",
    name: "Jericko Razal",
  },
};

const FUND_IDS = {
  pendingOm: "7a921b9b-8212-4460-b40e-1bca52d6a064",
  poSubcontractor: "a1fd11c7-9845-4dba-ad0a-4edeb73f6d52",
  poProjectFunds: "f7d9ed8e-e4aa-457e-91eb-8d863f3d8288",
  umReview: "45b30aea-55bd-4aa4-9787-bc71e48a7e3f",
};

async function dashboardLogin(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto("/login");
  const emailInput =
    (await page.locator('input[type="email"]').count()) > 0
      ? page.locator('input[type="email"]')
      : page.locator('input[placeholder*="email" i]').first();
  await emailInput.fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.click('button:has-text("Sign In"), button:has-text("Login")');
  await page.waitForURL(
    /\/dashboard|\/fund-request|\/leave-approval|\/overtime-approval|\/employees|\/timesheet/i,
    { timeout: 25000 }
  );
}

async function employeeLogin(page: Page): Promise<void> {
  await page.goto("/login?mode=employee");
  await page.locator('input[placeholder*="Employee ID" i], input[name="employee_id"]').first().fill(ACCOUNTS.employee.id);
  await page.locator('input[type="password"]').fill(ACCOUNTS.employee.password);
  await page.click('button:has-text("Sign In"), button:has-text("Login")');
  await page.waitForURL(/\/employee-portal/i, { timeout: 25000 });
}

test.describe("Fund request guide screenshots", () => {
  test.describe.configure({ mode: "serial" });

  test("01 employee portal fund request list", async ({ page }) => {
    await employeeLogin(page);
    await page.goto("/employee-portal/fund-request");
    await expect(page.getByRole("heading", { name: /Fund Request/i })).toBeVisible({
      timeout: 15000,
    });
    await page.screenshot({
      path: path.join(OUT, "01-employee-fund-request-list.png"),
      fullPage: true,
    });
  });

  test("02 employee new fund request form", async ({ page }) => {
    await employeeLogin(page);
    await page.goto("/employee-portal/fund-request/new");
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: path.join(OUT, "02-employee-new-fund-request.png"),
      fullPage: true,
    });
  });

  test("03 employee subcontractor payment fields", async ({ page }) => {
    await employeeLogin(page);
    await page.goto("/employee-portal/fund-request/new");
    await page.getByRole("combobox").filter({ hasText: /Select purpose|purpose/i }).first().click().catch(() => {});
    const purposeTrigger = page.locator('[role="combobox"]').first();
    await purposeTrigger.click();
    await page.getByRole("option", { name: "Subcontractor Payment" }).click();
    await page.waitForTimeout(800);
    await page.screenshot({
      path: path.join(OUT, "03-employee-subcontractor-payment-form.png"),
      fullPage: true,
    });
  });

  test("04 om inbox pending requests", async ({ page }) => {
    await dashboardLogin(page, ACCOUNTS.om.email, ACCOUNTS.om.password);
    await page.goto("/fund-request?tab=inbox");
    await expect(page.getByRole("heading", { name: /Fund Request/i })).toBeVisible({
      timeout: 15000,
    });
    await page.screenshot({
      path: path.join(OUT, "04-om-inbox.png"),
      fullPage: true,
    });
  });

  test("05 om review approve reject", async ({ page }) => {
    await dashboardLogin(page, ACCOUNTS.om.email, ACCOUNTS.om.password);
    await page.goto(`/fund-request/${FUND_IDS.pendingOm}`);
    await expect(page.getByRole("button", { name: "Approve" })).toBeVisible({
      timeout: 15000,
    });
    await page.screenshot({
      path: path.join(OUT, "05-om-review-approve-reject.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Reject" }).click();
    await page.waitForTimeout(400);
    await page.screenshot({
      path: path.join(OUT, "06-om-reject-reason-required.png"),
      fullPage: true,
    });
  });

  test("07 om filing new request", async ({ page }) => {
    await dashboardLogin(page, ACCOUNTS.omFiler.email, ACCOUNTS.omFiler.password);
    await page.goto("/fund-request/new");
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: path.join(OUT, "07-om-new-fund-request.png"),
      fullPage: true,
    });
  });

  test("08 po inbox", async ({ page }) => {
    await dashboardLogin(page, ACCOUNTS.po.email, ACCOUNTS.po.password);
    await page.goto("/fund-request?tab=inbox");
    await expect(page.getByRole("heading", { name: /Fund Request/i })).toBeVisible({
      timeout: 15000,
    });
    await page.screenshot({
      path: path.join(OUT, "08-po-inbox.png"),
      fullPage: true,
    });
  });

  test("09 po subcontractor payment review", async ({ page }) => {
    await dashboardLogin(page, ACCOUNTS.po.email, ACCOUNTS.po.password);
    await page.goto(`/fund-request/${FUND_IDS.poSubcontractor}`);
    await expect(page.getByText(/Subcontract P\.O\. Amount|Bank Details/i).first()).toBeVisible({
      timeout: 15000,
    });
    await page.screenshot({
      path: path.join(OUT, "09-po-subcontractor-payment-review.png"),
      fullPage: true,
    });
  });

  test("10 po non-subcontractor bank details", async ({ page }) => {
    await dashboardLogin(page, ACCOUNTS.po.email, ACCOUNTS.po.password);
    await page.goto(`/fund-request/${FUND_IDS.poProjectFunds}`);
    await expect(page.getByText(/Bank Details|Account name/i).first()).toBeVisible({
      timeout: 15000,
    });
    await page.screenshot({
      path: path.join(OUT, "10-po-project-funds-bank-details.png"),
      fullPage: true,
    });
  });

  test("11 po filing new request", async ({ page }) => {
    await dashboardLogin(page, ACCOUNTS.po.email, ACCOUNTS.po.password);
    await page.goto("/fund-request/new");
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: path.join(OUT, "11-po-new-fund-request.png"),
      fullPage: true,
    });
  });

  test("12 um final review actions", async ({ page }) => {
    await dashboardLogin(page, ACCOUNTS.um.email, ACCOUNTS.um.password);
    await page.goto(`/fund-request/${FUND_IDS.umReview}`);
    await expect(page.getByRole("button", { name: "Return to Purchasing" })).toBeVisible({
      timeout: 15000,
    });
    await page.screenshot({
      path: path.join(OUT, "12-um-final-review.png"),
      fullPage: true,
    });
  });

  test("13 um return to purchasing reason", async ({ page }) => {
    await dashboardLogin(page, ACCOUNTS.um.email, ACCOUNTS.um.password);
    await page.goto(`/fund-request/${FUND_IDS.umReview}`);
    await page.getByRole("button", { name: "Return to Purchasing" }).click();
    await expect(page.getByText(/Reason for returning to purchasing/i)).toBeVisible({
      timeout: 10000,
    });
    await page.screenshot({
      path: path.join(OUT, "13-um-return-to-purchasing.png"),
      fullPage: true,
    });
  });

  test("14 um reject optional reason", async ({ page }) => {
    await dashboardLogin(page, ACCOUNTS.um.email, ACCOUNTS.um.password);
    await page.goto(`/fund-request/${FUND_IDS.umReview}`);
    await page.getByRole("button", { name: "Reject" }).click();
    await expect(page.getByText(/Rejection reason/i)).toBeVisible({
      timeout: 10000,
    });
    await page.screenshot({
      path: path.join(OUT, "14-um-reject-optional-reason.png"),
      fullPage: true,
    });
  });
});
