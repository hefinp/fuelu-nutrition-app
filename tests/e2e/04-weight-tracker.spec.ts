import { test, expect, type Locator } from "@playwright/test";

async function visibleInstance(locator: Locator): Promise<Locator> {
  const count = await locator.count();
  for (let i = 0; i < count; i++) {
    if (await locator.nth(i).isVisible()) return locator.nth(i);
  }
  return locator.first();
}

test.describe("Weight tracker", () => {
  test("log weight, verify stat and chart entry, switch to calories tab", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const logWeightBtn = await visibleInstance(page.getByTestId("button-log-weight-toggle"));
    await expect(logWeightBtn).toBeVisible({ timeout: 10000 });
    await logWeightBtn.click();

    const weightInput = await visibleInstance(page.getByTestId("input-log-weight"));
    await expect(weightInput).toBeVisible();
    await weightInput.fill("82.3");

    const saveBtn = await visibleInstance(page.getByTestId("button-save-weight"));
    await saveBtn.click();

    const statEl = await visibleInstance(page.getByTestId("stat-current-weight"));
    await expect(statEl).toContainText("82.3", { timeout: 5000 });

    const entriesToggle = await visibleInstance(page.getByTestId("toggle-recent-entries"));
    await entriesToggle.click();

    const entryList = page.locator('[data-testid^="weight-entry-"]');
    await expect(entryList.first()).toBeVisible({ timeout: 3000 });

    const calTab = await visibleInstance(page.getByTestId("button-tracker-tab-calories"));
    await calTab.click();

    const todayCal = await visibleInstance(page.getByTestId("stat-today-calories"));
    await expect(todayCal).toBeVisible();

    const weightTab = await visibleInstance(page.getByTestId("button-tracker-tab-weight"));
    await weightTab.click();

    await expect(await visibleInstance(page.getByTestId("stat-current-weight"))).toBeVisible();
  });
});
