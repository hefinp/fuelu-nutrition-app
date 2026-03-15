import { test, expect } from "@playwright/test";
import { createTestUser } from "./helpers";

test.describe("Diary navigation", () => {
  test("daily and weekly view switching, date navigation", async ({ page }) => {
    await createTestUser(page);

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
});
