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
});
