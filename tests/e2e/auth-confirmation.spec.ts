import { test, expect, type Page } from "@playwright/test";

// Intercept every Auth request: these tests never register users or send email.
async function mockAuth(page: Page, options: { resendError?: string; unconfirmed?: boolean } = {}) {
  const requests: { path: string; body: Record<string, unknown>; url: string }[] = [];
  await page.route("**/auth/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const body = route.request().postDataJSON() ?? {};
    requests.push({ path: url.pathname, body, url: url.toString() });
    if (url.pathname.endsWith("/signup")) {
      await route.fulfill({ json: { id: "11111111-1111-4111-8111-111111111111", email: body.email, aud: "authenticated", identities: [], created_at: "2026-07-16T00:00:00Z" } });
    } else if (url.pathname.endsWith("/resend")) {
      await route.fulfill(options.resendError
        ? { status: 400, headers: { "x-supabase-api-version": "2024-01-01", "access-control-expose-headers": "x-supabase-api-version" }, json: { code: options.resendError, msg: "Provider rejected request" } }
        : { json: {} });
    } else if (url.pathname.endsWith("/token") && options.unconfirmed) {
      await route.fulfill({ status: 400, headers: { "x-supabase-api-version": "2024-01-01", "access-control-expose-headers": "x-supabase-api-version" }, json: { code: "email_not_confirmed", msg: "Email not confirmed" } });
    } else await route.fulfill({ status: 400, json: { message: "Unexpected mock auth request" } });
  });
  return requests;
}

test("signup success does not falsely promise an existing account was created", async ({ page }) => {
  await mockAuth(page);
  await page.goto("/login?mode=signup");
  await page.getByLabel("Name", { exact: true }).fill("Test pilot");
  await page.getByLabel("Email", { exact: true }).fill("pilot@example.test");
  await page.getByLabel("Password", { exact: true }).fill("MockPassword123");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("If you already registered, sign in or reset your password instead.");
  await expect(page.getByText("Account created.", { exact: false })).toHaveCount(0);
  await page.getByRole("button", { name: "Sign in instead", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Welcome back", exact: true })).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue("pilot@example.test");
});

test("expired-link recovery can resend without a password and uses the confirmation callback", async ({ page }, testInfo) => {
  const requests = await mockAuth(page);
  await page.goto("/login?error=confirmation");
  await page.getByLabel("Email", { exact: true }).fill("pilot@example.test");
  await page.getByRole("button", { name: "Resend confirmation email", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("If this address has an unconfirmed account");
  const resend = requests.filter((request) => request.path.endsWith("/resend"));
  expect(resend).toHaveLength(1);
  expect(resend[0].body).toMatchObject({ type: "signup", email: "pilot@example.test" });
  const destination = new URL(new URL(resend[0].url).searchParams.get("redirect_to")!);
  expect(destination.pathname).toBe("/auth/callback");
  expect(destination.searchParams.get("next")).toBe("/auth/confirmed");
  await expect(page.getByRole("button", { name: /Resend available in/ })).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath("confirmation-recovery.png"), fullPage: true });
});

for (const [code, message] of [["email_address_not_authorized", "email service needs to be configured"], ["over_email_send_rate_limit", "sending limit"]]) {
  test(`resend reports ${code} instead of claiming the email was sent`, async ({ page }) => {
    await mockAuth(page, { resendError: code });
    await page.goto("/login?error=confirmation");
    await page.getByLabel("Email", { exact: true }).fill("pilot@example.test");
    await page.getByRole("button", { name: "Resend confirmation email", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: message })).toBeVisible();
    await expect(page.getByRole("status")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Resend confirmation email", exact: true })).toBeEnabled();
  });
}

test("an unconfirmed sign-in offers a resend without returning to signup", async ({ page }) => {
  await mockAuth(page, { unconfirmed: true });
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("pilot@example.test");
  await page.getByLabel("Password", { exact: true }).fill("MockPassword123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Confirm your email before signing in." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Resend confirmation email", exact: true })).toBeVisible();
});

test("resend validates the email field before contacting the service", async ({ page }) => {
  const requests = await mockAuth(page);
  await page.goto("/login?error=confirmation");
  await page.getByLabel("Email", { exact: true }).fill("invalid-address");
  await page.getByRole("button", { name: "Resend confirmation email", exact: true }).click();
  expect(requests.filter((request) => request.path.endsWith("/resend"))).toHaveLength(0);
});
