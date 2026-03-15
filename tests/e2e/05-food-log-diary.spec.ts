import { test, expect } from "@playwright/test";
import { createTestUser } from "./helpers";

test.describe("Food log via diary", () => {
  test("opens food log drawer from diary and verifies form", async ({ page }) => {
    await createTestUser(page);

    await page.goto("/diary");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("button-diary-log-meal")).toBeVisible();
    await page.getByTestId("button-diary-log-meal").click();

    await expect(page.getByTestId("food-log-drawer")).toBeVisible({ timeout: 3000 });
  });

  test("logs a meal via API and verifies diary shows non-zero macros", async ({ page }) => {
    await createTestUser(page);

    const today = new Date().toISOString().slice(0, 10);

    await page.request.post("/api/food-log", {
      data: {
        date: today,
        mealName: "Smoke Test Chicken",
        calories: 350,
        protein: 40,
        carbs: 10,
        fat: 15,
        mealSlot: "lunch",
      },
    });

    await page.goto(`/diary?date=${today}`);
    await page.waitForLoadState("networkidle");

    const slotEl = page.getByTestId("diary-slot-lunch");
    await expect(slotEl).toBeVisible({ timeout: 5000 });
    await expect(slotEl).toContainText("350");
  });
});
