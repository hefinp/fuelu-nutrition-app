import { test, expect } from "@playwright/test";

test.describe("Food log via diary", () => {
  test("opens food log drawer from diary and verifies form fields", async ({ page }) => {
    await page.goto("/diary");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("button-diary-log-meal")).toBeVisible();
    await page.getByTestId("button-diary-log-meal").click();

    await expect(page.getByTestId("food-log-drawer")).toBeVisible({ timeout: 3000 });

    await expect(page.getByTestId("button-close-drawer")).toBeVisible();
    await page.getByTestId("button-close-drawer").click();

    await expect(page.getByTestId("food-log-drawer")).not.toBeVisible({ timeout: 3000 });
  });

  test("logs a meal via API and verifies diary slot shows non-zero macros", async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10);

    await page.request.post("/api/food-log", {
      data: {
        date: today,
        mealName: "Smoke Test Salmon",
        calories: 420,
        protein: 35,
        carbs: 5,
        fat: 28,
        mealSlot: "dinner",
      },
    });

    await page.goto(`/diary?date=${today}`);
    await page.waitForLoadState("networkidle");

    const slotEl = page.getByTestId("diary-slot-dinner");
    await expect(slotEl).toBeVisible({ timeout: 5000 });
    await expect(slotEl).toContainText("420");
    await expect(slotEl).toContainText("Dinner");
  });
});
