import { test, expect } from "@playwright/test";

test.describe("Calculator / Onboarding Wizard", () => {
  test("fresh user completes onboarding wizard and sees nutrition targets", async ({ page }) => {
    const suffix = Date.now().toString();
    const email = `e2e-wizard-${suffix}@test.com`;
    const password = "TestPass123!";
    const name = "E2E Wizard User";

    const setupRes = await page.request.post("/api/test/setup-invite", {
      data: { suffix },
    });
    let inviteCode = `E2E${suffix.slice(-8).toUpperCase()}`;
    if (setupRes.ok()) {
      const body = await setupRes.json();
      inviteCode = body.code;
    }

    await page.goto("/auth");
    await page.waitForLoadState("networkidle");

    const tabRegister = page.getByTestId("tab-register");
    if (await tabRegister.isVisible()) {
      await tabRegister.click();
    }

    await page.getByTestId("input-register-name").fill(name);
    await page.getByTestId("input-register-email").fill(email);
    await page.getByTestId("input-register-password").fill(password);
    await page.getByTestId("input-register-invite-code").fill(inviteCode);
    await page.getByTestId("button-register-submit").click();

    await page.waitForURL("**/dashboard", { timeout: 10000 });
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("onboarding-wizard-overlay")).toBeVisible({ timeout: 10000 });

    await page.getByTestId("wizard-goal-lose").click();
    await page.getByTestId("button-wizard-next").click();

    await page.getByTestId("wizard-input-age").fill("28");
    await page.getByTestId("wizard-sex-female").click();
    await page.getByTestId("wizard-input-height").fill("165");
    await page.getByTestId("wizard-input-weight").fill("68");
    await page.getByTestId("button-wizard-next").click();

    await page.getByTestId("button-wizard-next").click();

    await expect(page.getByTestId("wizard-daily-calories")).toBeVisible({ timeout: 5000 });
    const calText = await page.getByTestId("wizard-daily-calories").textContent();
    expect(calText).toBeTruthy();
    const calNum = parseInt(calText!.replace(/[^0-9]/g, ""), 10);
    expect(calNum).toBeGreaterThan(0);
    expect(calNum).toBeLessThan(10000);

    const protText = await page.getByTestId("wizard-protein").textContent();
    expect(parseInt(protText!.replace(/[^0-9]/g, ""), 10)).toBeGreaterThan(0);

    const carbsText = await page.getByTestId("wizard-carbs").textContent();
    expect(parseInt(carbsText!.replace(/[^0-9]/g, ""), 10)).toBeGreaterThan(0);

    const fatText = await page.getByTestId("wizard-fat").textContent();
    expect(parseInt(fatText!.replace(/[^0-9]/g, ""), 10)).toBeGreaterThan(0);

    await page.getByTestId("button-wizard-save").click();

    await expect(page.getByTestId("onboarding-wizard-overlay")).not.toBeVisible({ timeout: 5000 });

    await page.goto("/diary");
    await page.waitForLoadState("networkidle");

    const macroCalValue = page.getByTestId("macro-calories-value");
    await expect(macroCalValue).toBeVisible({ timeout: 5000 });
    const macroText = await macroCalValue.textContent();
    expect(macroText).toContain("/");
    expect(macroText).not.toContain("/–");
  });
});
