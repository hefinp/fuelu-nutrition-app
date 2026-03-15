import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test("loads and shows sign-in prompt for unauthenticated users", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const signInLink = page.getByTestId("link-sign-in").or(page.getByTestId("link-signin-cta"));
    const onAuthPage = page.url().includes("/auth");

    expect(onAuthPage || (await signInLink.count()) > 0).toBeTruthy();
  });

  test("authenticated dashboard shows nutrition targets and food log widget", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: "tests/e2e/.auth-state.json",
      baseURL: "http://localhost:5000",
    });
    const page = await context.newPage();

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const logWeightBtns = page.getByTestId("button-log-weight-toggle");
    expect(await logWeightBtns.count()).toBeGreaterThan(0);

    const foodLogBtns = page.getByTestId("button-add-log-entry");
    expect(await foodLogBtns.count()).toBeGreaterThan(0);

    const diaryLinks = page.getByTestId("link-view-diary");
    expect(await diaryLinks.count()).toBeGreaterThan(0);

    const macroCalories = page.getByTestId("macro-calories");
    expect(await macroCalories.count()).toBeGreaterThan(0);

    const macroCalValue = page.getByTestId("macro-calories-value").first();
    const calText = await macroCalValue.textContent();
    expect(calText).toContain("/");
    expect(calText).not.toContain("/–");

    await context.close();
  });
});
