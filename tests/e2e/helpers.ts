import { type Page } from "@playwright/test";

let inviteCodeCounter = 0;

export async function createTestUser(page: Page) {
  const suffix = Date.now() + String(inviteCodeCounter++);
  const email = `smoke-${suffix}@test.com`;
  const password = "TestPass123!";
  const name = "Smoke Tester";

  const setupRes = await page.request.post("/api/test/setup-invite", {
    data: { suffix },
  });
  let inviteCode = `E2E${suffix.slice(-8).toUpperCase()}`;
  if (setupRes.ok()) {
    const body = await setupRes.json();
    inviteCode = body.code;
  }

  const regRes = await page.request.post("/api/auth/register", {
    data: { email, name, password, inviteCode },
  });
  if (!regRes.ok()) {
    throw new Error(`Registration failed (${regRes.status()}): ${await regRes.text()}`);
  }

  const meRes = await page.request.get("/api/auth/me");
  if (!meRes.ok()) {
    throw new Error("Auth session not established after registration");
  }

  const prefRes = await page.request.put("/api/user/preferences", {
    data: {
      diet: null,
      allergies: [],
      excludedFoods: [],
      preferredFoods: [],
      micronutrientOptimize: false,
      onboardingComplete: true,
    },
  });
  if (!prefRes.ok()) {
    throw new Error(`Preferences update failed (${prefRes.status()}): ${await prefRes.text()}`);
  }

  return { email, password, name };
}
