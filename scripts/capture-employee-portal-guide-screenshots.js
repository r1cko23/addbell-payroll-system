const fs = require("fs");
const path = require("path");
const { chromium } = require("@playwright/test");

const BASE_URL = process.env.EMPLOYEE_GUIDE_BASE_URL || "http://localhost:3000";
const EMPLOYEE_ID = process.env.TEST_EMPLOYEE_ID || "2025001";
const EMPLOYEE_PASSWORD = process.env.TEST_EMPLOYEE_PASSWORD || "2025001";
const EMPLOYEE_UUID =
  process.env.TEST_EMPLOYEE_UUID || "00eae364-a755-4846-8d77-b72dfff422f1";
const EMPLOYEE_NAME = process.env.TEST_EMPLOYEE_NAME || "Jericko A. Razal";
const OUTPUT_DIR = path.join(
  process.cwd(),
  "docs",
  "guides",
  "assets",
  "employee-portal"
);

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

async function waitForSettled(page, ms = 1200) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(ms);
}

async function saveScreenshot(page, filename) {
  await page.screenshot({
    path: path.join(OUTPUT_DIR, filename),
    fullPage: false,
  });
}

async function captureLoginAndSeedSession(page) {
  await page.goto(`${BASE_URL}/login?mode=employee`, {
    waitUntil: "domcontentloaded",
  });
  await waitForSettled(page);

  const employeeMode = page.getByRole("button", { name: /employee/i }).first();
  if (await employeeMode.isVisible().catch(() => false)) {
    await employeeMode.click();
    await waitForSettled(page, 600);
  }

  await page.getByPlaceholder("2025-001").fill(EMPLOYEE_ID);
  await page.locator('input[type="password"]').fill(EMPLOYEE_PASSWORD);
  await saveScreenshot(page, "employee-login.png");
  await page.evaluate(
    ({ employeeId, employeeUuid, employeeName }) => {
      localStorage.setItem(
        "employee_session",
        JSON.stringify({
          id: employeeUuid,
          employee_id: employeeId,
          full_name: employeeName,
          loginTime: new Date().toISOString(),
          expiresAt: Date.now() + 8 * 60 * 60 * 1000,
        })
      );
    },
    {
      employeeId: EMPLOYEE_ID,
      employeeUuid: EMPLOYEE_UUID,
      employeeName: EMPLOYEE_NAME,
    }
  );
}

async function captureRoute(page, route, filename, prepare) {
  await page.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded" });
  await waitForSettled(page, 1500);
  if (prepare) {
    await prepare(page);
    await waitForSettled(page, 800);
  }
  await saveScreenshot(page, filename);
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1500, height: 1100 },
    permissions: ["geolocation"],
    geolocation: {
      latitude: 14.5547,
      longitude: 121.0244,
    },
  });
  const page = await context.newPage();

  try {
    await captureLoginAndSeedSession(page);

    await captureRoute(
      page,
      "/employee-portal/bundy",
      "bundy-clock.png",
      async (currentPage) => {
        await currentPage
          .waitForFunction(
            () =>
              !document.body.innerText.includes("Loading attendance data...") &&
              !document.body.innerText.includes("Syncing time..."),
            { timeout: 20000 }
          )
          .catch(() => {});
        await currentPage.waitForTimeout(2500);
      }
    );

    await captureRoute(
      page,
      "/employee-portal/leave-request",
      "leave-request.png",
      async (currentPage) => {
        const lwopRadio = currentPage.getByRole("radio", { name: /lwop/i }).first();
        if (await lwopRadio.isVisible().catch(() => false)) {
          await lwopRadio.click();
        }

        const calendarButtons = currentPage.locator("button").filter({
          hasNot: currentPage.locator('[disabled]'),
        });
        const count = await calendarButtons.count();
        for (let index = 0; index < count; index += 1) {
          const button = calendarButtons.nth(index);
          const text = (await button.textContent())?.trim() || "";
          if (/^\d{1,2}$/.test(text)) {
            await button.click().catch(() => {});
            break;
          }
        }
      }
    );

    await captureRoute(
      page,
      "/employee-portal/overtime",
      "overtime.png",
      async (currentPage) => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        await currentPage.locator("#ot-date").fill(formatDate(tomorrow));
        await currentPage.locator("#start-time").fill("18:00");
        await currentPage.locator("#end-time").fill("21:00");
        const reason = currentPage.locator("textarea").first();
        if (await reason.isVisible().catch(() => false)) {
          await reason.fill("Sample overtime request for employee guide documentation.");
        }
      }
    );

    await captureRoute(
      page,
      "/employee-portal/failure-to-log",
      "failure-to-log.png",
      async (currentPage) => {
        const today = formatDate(new Date());
        await currentPage.locator("select").first().selectOption("both").catch(() => {});
        await currentPage.locator("#missed-date").fill(today).catch(() => {});
        await currentPage.locator("#time-in").fill("08:00").catch(() => {});
        await currentPage.locator("#time-out").fill("17:00").catch(() => {});
        const reason = currentPage.locator("textarea").first();
        if (await reason.isVisible().catch(() => false)) {
          await reason.fill(
            "Sample correction request for missed clock in and clock out."
          );
        }
      }
    );

    await captureRoute(
      page,
      "/employee-portal/info",
      "employee-information.png",
      async (currentPage) => {
        const changePasswordButton = currentPage
          .getByRole("button", { name: /change password/i })
          .first();
        if (await changePasswordButton.isVisible().catch(() => false)) {
          await changePasswordButton.click();
        }
      }
    );

    await captureRoute(page, "/employee-portal/payslips", "payslips.png");
    await captureRoute(
      page,
      "/employee-portal/project-time",
      "project-assignments.png"
    );
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("Failed to capture employee portal screenshots.");
  console.error(error);
  process.exit(1);
});
