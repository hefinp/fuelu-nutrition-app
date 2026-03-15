import { test, expect } from "@playwright/test";

test.describe("Auth page", () => {
  test("renders login and register forms with correct fields", async ({ page }) => {
    await page.goto("/auth");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("tab-login")).toBeVisible();
    await expect(page.getByTestId("tab-register")).toBeVisible();

    await expect(page.getByTestId("input-login-email")).toBeVisible();
    await expect(page.getByTestId("input-login-password")).toBeVisible();
    await expect(page.getByTestId("button-login-submit")).toBeVisible();

    await page.getByTestId("tab-register").click();

    await expect(page.getByTestId("input-register-name")).toBeVisible();
    await expect(page.getByTestId("input-register-email")).toBeVisible();
    await expect(page.getByTestId("input-register-password")).toBeVisible();
    await expect(page.getByTestId("input-register-invite-code")).toBeVisible();
    await expect(page.getByTestId("button-register-submit")).toBeVisible();
  });

  test("shows error on invalid login", async ({ page }) => {
    await page.goto("/auth");
    await page.waitForLoadState("networkidle");

    await page.getByTestId("input-login-email").fill("nonexistent@test.com");
    await page.getByTestId("input-login-password").fill("wrongpassword");
    await page.getByTestId("button-login-submit").click();

    await expect(page.getByTestId("error-login")).toBeVisible({ timeout: 5000 });
    expect(page.url()).toContain("/auth");
  });

  test("register with invite code, login, and logout", async ({ page }) => {
    const suffix = Date.now().toString();
    const email = `auth-flow-${suffix}@test.com`;
    const password = "TestPass123!";
    const name = "Auth Flow Tester";

    const setupRes = await page.request.post("/api/test/setup-invite", {
      data: { suffix },
    });
    let inviteCode = `E2E${suffix.slice(-8).toUpperCase()}`;
    if (setupRes.ok()) {
      inviteCode = (await setupRes.json()).code;
    }

    await page.goto("/auth");
    await page.waitForLoadState("networkidle");

    await page.getByTestId("tab-register").click();
    await page.getByTestId("input-register-name").fill(name);
    await page.getByTestId("input-register-email").fill(email);
    await page.getByTestId("input-register-password").fill(password);
    await page.getByTestId("input-register-invite-code").fill(inviteCode);
    await page.getByTestId("button-register-submit").click();

    await page.waitForURL("**/dashboard", { timeout: 10000 });
    expect(page.url()).toContain("/dashboard");

    await page.request.post("/api/auth/logout");

    await page.goto("/auth");
    await page.waitForLoadState("networkidle");

    await page.getByTestId("input-login-email").fill(email);
    await page.getByTestId("input-login-password").fill(password);
    await page.getByTestId("button-login-submit").click();

    await page.waitForURL("**/dashboard", { timeout: 10000 });
    expect(page.url()).toContain("/dashboard");

    await page.request.post("/api/auth/logout");

    const meRes = await page.request.get("/api/auth/me");
    expect(meRes.status()).toBe(401);
  });
});
