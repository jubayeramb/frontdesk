import { defineConfig, devices } from "@playwright/test";

import { E2E_ENV, FAKE_GROQ_PORT } from "./e2e/env";

const port = Number(process.env.PORT ?? 3100);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  globalSetup: "./e2e/global-setup.ts",
  use: { baseURL, trace: "on-first-retry" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command: "pnpm exec tsx e2e/fake-groq.ts",
      url: `http://localhost:${FAKE_GROQ_PORT}`,
      reuseExistingServer: false,
    },
    {
      command: `pnpm build && pnpm start --port ${port}`,
      url: baseURL,
      // A server started by hand would use the developer's own env, not E2E_ENV.
      reuseExistingServer: false,
      timeout: 180_000,
      env: E2E_ENV,
    },
  ],
});
