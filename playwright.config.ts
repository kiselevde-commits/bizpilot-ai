import { defineConfig, devices } from "@playwright/test";
import { envFilePath } from "./tests/e2e/global-setup";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const externalServer = Boolean(process.env.E2E_BASE_URL);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  reporter: process.env.CI
    ? [
        ["list"],
        ["html", { open: "never", outputFolder: "playwright-report" }],
        ["junit", { outputFile: "test-results/junit.xml" }],
      ]
    : [["list"], ["html", { open: "never" }]],
  outputDir: "test-results",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    locale: "ru-RU",
    timezoneId: "Europe/Moscow",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: externalServer
    ? undefined
    : {
        command: `corepack pnpm dev --port 3000 --env-file=${envFilePath()}`,
        url: "http://127.0.0.1:3000/api/ai/health",
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        env: {
          AUTH_URL: baseURL,
          AUTH_TRUST_HOST: "true",
          APP_BASE_URL: baseURL,
        },
      },
});
