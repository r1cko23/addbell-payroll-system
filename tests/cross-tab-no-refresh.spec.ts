import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import path from "path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

async function signInWithMagicLink(context: BrowserContext, page: Page) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = process.env.TEST_ADMIN_EMAIL || "jericko.rzl@gmail.com";

  if (!url || !anon || !service) {
    throw new Error("Missing Supabase env in .env.local");
  }

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError || !linkData.properties?.hashed_token) {
    throw new Error(linkError?.message || "Failed to generate magic link");
  }

  const { data: verified, error: verifyError } = await client.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "email",
  });
  if (verifyError || !verified.session) {
    throw new Error(verifyError?.message || "Failed to verify magic link");
  }

  const session = verified.session;
  const projectRef = new URL(url).hostname.split(".")[0];
  const cookieName = `sb-${projectRef}-auth-token`;
  const value = JSON.stringify({
    access_token: session.access_token,
    token_type: session.token_type,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    refresh_token: session.refresh_token,
    user: session.user,
  });

  // auth-helpers chunks cookies over ~3180 chars
  const chunkSize = 3180;
  const cookies =
    value.length <= chunkSize
      ? [
          {
            name: cookieName,
            value,
            domain: "localhost",
            path: "/",
            sameSite: "Lax" as const,
            httpOnly: false,
          },
        ]
      : Array.from({ length: Math.ceil(value.length / chunkSize) }, (_, i) => ({
          name: `${cookieName}.${i}`,
          value: value.slice(i * chunkSize, (i + 1) * chunkSize),
          domain: "localhost",
          path: "/",
          sameSite: "Lax" as const,
          httpOnly: false,
        }));

  await context.addCookies(cookies);
  await page.goto("/fund-request?tab=inbox");
  await expect(page).toHaveURL(/\/fund-request/, { timeout: 20_000 });
}

/**
 * Opening another tab syncs Supabase auth via localStorage/cookies. That must not
 * remount the previous tab (filters, scroll, and in-page DOM state).
 */
test.describe("Cross-tab auth sync", () => {
  test("opening a new tab does not remount the previous page", async ({
    page,
    context,
  }) => {
    await signInWithMagicLink(context, page);

    const heading = page.locator("h1").first();
    await expect(heading).toBeVisible({ timeout: 20_000 });

    // Stamp the live DOM node. A React remount replaces it and drops the attr.
    await heading.evaluate((el) => {
      el.setAttribute("data-cross-tab-persist", "1");
    });

    let fullReloadCount = 0;
    page.on("load", () => {
      fullReloadCount += 1;
    });

    const second = await context.newPage();
    await second.goto("/fund-request?tab=inbox");
    await expect(second.locator("h1").first()).toBeVisible({ timeout: 20_000 });

    // Give the original tab time to receive storage/auth sync events.
    await expect
      .poll(async () => page.locator('h1[data-cross-tab-persist="1"]').count(), {
        timeout: 8_000,
      })
      .toBe(1);

    await expect(page).toHaveURL(/\/fund-request/);
    expect(fullReloadCount).toBe(0);

    await second.close();
  });
});
