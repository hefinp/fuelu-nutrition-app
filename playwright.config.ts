import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  retries: 1,
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: "http://localhost:5000",
    headless: true,
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "unauthenticated",
      testMatch: /01-auth|02-dashboard/,
    },
    {
      name: "authenticated",
      testMatch: /0[3-5]-/,
      use: {
        storageState: "tests/e2e/.auth-state.json",
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    port: 5000,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
