import { test, expect, type Page, type Locator } from "@playwright/test";
import { createTestUser } from "./helpers";

async function visibleInstance(locator: Locator): Promise<Locator> {
  const count = await locator.count();
  for (let i = 0; i < count; i++) {
    if (await locator.nth(i).isVisible()) return locator.nth(i);
  }
  return locator.first();
}

test.describe("Weight tracker", () => {
  test("log weight entry and switch to calories tab", async ({ page }) => {
    await createTestUser(page);

    await page.request.post("/api/calculations", {
      data: {
        weight: "75",
        height: "175",
        age: 30,
        gender: "male",
        activityLevel: "moderate",
        goal: "maintain",
      },
    });

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    const logWeightBtn = await visibleInstance(page.getByTestId("button-log-weight-toggle"));
    await expect(logWeightBtn).toBeVisible({ timeout: 5000 });
    await logWeightBtn.click();
    await page.waitForTimeout(500);

    const weightInput = await visibleInstance(page.getByTestId("input-log-weight"));
    await expect(weightInput).toBeVisible();
    await weightInput.fill("75.5");

    const saveBtn = await visibleInstance(page.getByTestId("button-save-weight"));
    await saveBtn.click();
    await page.waitForTimeout(1500);

    const statEl = await visibleInstance(page.getByTestId("stat-current-weight"));
    await expect(statEl).toContainText("75.5");

    const calTab = await visibleInstance(page.getByTestId("button-tracker-tab-calories"));
    await calTab.click();
    await page.waitForTimeout(500);

    const todayCal = await visibleInstance(page.getByTestId("stat-today-calories"));
    await expect(todayCal).toBeVisible();
  });
});
