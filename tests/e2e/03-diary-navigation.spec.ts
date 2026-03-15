import { test, expect } from "@playwright/test";

test.describe("Diary navigation", () => {
  test("daily and weekly view switching, date navigation", async ({ page }) => {
    await page.goto("/diary");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("link-back-dashboard")).toBeVisible();
    await expect(page.getByTestId("button-diary-log-meal")).toBeVisible();
    await expect(page.getByTestId("button-diary-view-daily")).toBeVisible();
    await expect(page.getByTestId("button-diary-view-weekly")).toBeVisible();
    await expect(page.getByTestId("text-diary-date")).toBeVisible();

    const todayText = await page.getByTestId("text-diary-date").textContent();

    await page.getByTestId("button-diary-prev-day").click();
    await expect(page.getByTestId("text-diary-date")).not.toHaveText(todayText!);
    await expect(page.getByTestId("button-diary-go-to-today")).toBeVisible();

    await page.getByTestId("button-diary-go-to-today").click();
    await expect(page.getByTestId("text-diary-date")).toHaveText(todayText!);

    await page.getByTestId("button-diary-view-weekly").click();
    await expect(page.getByTestId("text-diary-week-label")).toBeVisible();
    await expect(page.getByTestId("diary-weekly-log-table")).toBeVisible();

    await page.getByTestId("button-diary-view-daily").click();
    await expect(page.getByTestId("text-diary-date")).toBeVisible();
  });

  test("diary shows non-zero macro targets from calculation", async ({ page }) => {
    await page.goto("/diary");
    await page.waitForLoadState("networkidle");

    const macroCalValue = page.getByTestId("macro-calories-value");
    await expect(macroCalValue).toBeVisible({ timeout: 5000 });

    const calText = await macroCalValue.textContent();
    expect(calText).toContain("/");
    expect(calText).not.toContain("/–");

    const macroProtValue = page.getByTestId("macro-protein-value");
    await expect(macroProtValue).toBeVisible();
    const protText = await macroProtValue.textContent();
    expect(protText).not.toContain("/–");
  });
});
