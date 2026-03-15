import { test, expect } from "@playwright/test";

test.describe("Food log via diary", () => {
  test("opens drawer, logs a meal via UI, and verifies diary macros and progress bars update", async ({ page }) => {
    await page.goto("/diary");
    await page.waitForLoadState("networkidle");

    const calBarBefore = page.getByTestId("progress-calories-fill");
    await expect(calBarBefore).toBeAttached({ timeout: 5000 });
    const pctBefore = parseInt(await calBarBefore.getAttribute("data-pct") || "0", 10);

    await expect(page.getByTestId("button-diary-log-meal")).toBeVisible();
    await page.getByTestId("button-diary-log-meal").click();

    await expect(page.getByTestId("food-log-drawer")).toBeVisible({ timeout: 3000 });

    await page.getByTestId("button-form-tab-manual").click();

    await page.getByTestId("button-slot-lunch").click();

    await page.getByTestId("input-log-meal-name").fill("E2E Test Grilled Chicken");
    await page.getByTestId("input-log-calories").fill("380");
    await page.getByTestId("input-log-protein").fill("42");
    await page.getByTestId("input-log-carbs").fill("8");
    await page.getByTestId("input-log-fat").fill("18");

    await page.getByTestId("button-log-save").click();

    await expect(page.getByTestId("food-log-drawer")).not.toBeVisible({ timeout: 5000 });

    const slotEl = page.getByTestId("diary-slot-lunch");
    await expect(slotEl).toBeVisible({ timeout: 5000 });
    await expect(slotEl).toContainText("380");

    const macroCalValue = page.getByTestId("macro-calories-value").first();
    await expect(macroCalValue).toBeVisible();
    const calText = await macroCalValue.textContent();
    expect(calText).toMatch(/[1-9]/);

    const calBarAfter = page.getByTestId("progress-calories-fill");
    await expect(calBarAfter).toBeAttached();
    await page.waitForTimeout(500);
    const pctAfter = parseInt(await calBarAfter.getAttribute("data-pct") || "0", 10);
    expect(pctAfter).toBeGreaterThan(pctBefore);

    const protBar = page.getByTestId("progress-protein-fill");
    await expect(protBar).toBeAttached();
    const protPct = parseInt(await protBar.getAttribute("data-pct") || "0", 10);
    expect(protPct).toBeGreaterThan(0);

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const dashboardPage = page.locator("body");
    await expect(dashboardPage).toContainText("380", { timeout: 5000 });
  });

  test("drawer opens and closes correctly", async ({ page }) => {
    await page.goto("/diary");
    await page.waitForLoadState("networkidle");

    await page.getByTestId("button-diary-log-meal").click();
    await expect(page.getByTestId("food-log-drawer")).toBeVisible({ timeout: 3000 });

    await page.getByTestId("button-close-drawer").click();
    await expect(page.getByTestId("food-log-drawer")).not.toBeVisible({ timeout: 3000 });
  });
});
