import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test("loads and shows sign-in prompt for unauthenticated users", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const signInLink = page.getByTestId("link-sign-in").or(page.getByTestId("link-signin-cta"));
    const onAuthPage = page.url().includes("/auth");

    expect(onAuthPage || (await signInLink.count()) > 0).toBeTruthy();
  });

  test("authenticated dashboard shows nutrition targets and widgets", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: "tests/e2e/.auth-state.json",
      baseURL: "http://localhost:5000",
    });
    const page = await context.newPage();

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const hasWidgets = await page.getByTestId("button-log-weight-toggle").count();
    expect(hasWidgets).toBeGreaterThan(0);

    const foodLogBtn = page.getByTestId("button-add-log-entry");
    expect(await foodLogBtn.count()).toBeGreaterThan(0);

    const diaryLink = page.getByTestId("link-view-diary");
    expect(await diaryLink.count()).toBeGreaterThan(0);

    await context.close();
  });
});
