import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test("loads and shows sign-in prompt for unauthenticated users", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const signInLink = page.getByTestId("link-sign-in").or(page.getByTestId("link-signin-cta"));
    const onAuthPage = page.url().includes("/auth");

    expect(onAuthPage || (await signInLink.count()) > 0).toBeTruthy();
  });
});
