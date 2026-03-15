import { chromium, type FullConfig } from "@playwright/test";

async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL || "http://localhost:5000";
  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();

  const suffix = Date.now().toString();
  const email = `e2e-shared-${suffix}@test.com`;
  const password = "TestPass123!";
  const name = "E2E Shared User";

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
    throw new Error(`Global setup: registration failed: ${await regRes.text()}`);
  }

  const meRes = await page.request.get("/api/auth/me");
  if (!meRes.ok()) {
    throw new Error("Global setup: auth session not established");
  }

  await page.request.put("/api/user/preferences", {
    data: {
      diet: null,
      allergies: [],
      excludedFoods: [],
      preferredFoods: [],
      micronutrientOptimize: false,
      onboardingComplete: true,
    },
  });

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

  await context.storageState({ path: "tests/e2e/.auth-state.json" });
  await browser.close();

  process.env.E2E_USER_EMAIL = email;
  process.env.E2E_USER_PASSWORD = password;
  process.env.E2E_USER_NAME = name;
}

export default globalSetup;
