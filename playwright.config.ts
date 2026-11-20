import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * Load `.env` for local runs and CI overrides.
 *
 * Values already present in `process.env` win, so CI secrets and explicit
 * overrides (for example `AI_PROVIDER=mock`) are never replaced by the file.
 * The file is read, never printed.
 */
function loadDotEnv(): void {
  const file = resolve(process.cwd(), ".env");

  if (!existsSync(file)) {
    return;
  }

  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);

    if (!match) {
      continue;
    }

    const key = match[1];
    let value = match[2] ?? "";

    if (typeof key !== "string") {
      continue;
    }

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadDotEnv();

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const externalServer = Boolean(process.env.E2E_BASE_URL);

/**
 * E2E always runs with mock AI unless a developer explicitly opts into the real
 * provider. CI must never call a paid LLM.
 */
const useMockAI = process.env.E2E_REAL_AI !== "true";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
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
        command: "corepack pnpm dev --port 3000",
        url: "http://localhost:3000/api/ai/health",
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        env: {
          AUTH_URL: baseURL,
          AUTH_TRUST_HOST: "true",
          APP_BASE_URL: baseURL,
          AI_PROVIDER: useMockAI ? "mock" : (process.env.AI_PROVIDER ?? "mock"),
          ALLOW_MOCK_AI: useMockAI ? "true" : (process.env.ALLOW_MOCK_AI ?? "false"),
        },
      },
});
