import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

/**
 * Writes a `.env`-style file from `process.env` into the OS temp directory so
 * the Playwright `webServer` command can load it through Next.js
 * (`pnpm dev --env-file=...`). Used only when Playwright starts the app itself.
 *
 * The file contains secrets, lives outside the repository, and is removed by
 * the global teardown.
 */
const ENV_KEYS = [
  "DATABASE_URL",
  "SHADOW_DATABASE_URL",
  "AUTH_SECRET",
  "AUTH_URL",
  "AUTH_TRUST_HOST",
  "APP_BASE_URL",
  "SEED_ADMIN_PASSWORD",
  "AI_PROVIDER",
  "ALLOW_MOCK_AI",
  "AI_BASE_URL",
  "AI_API_KEY",
  "AI_MODEL",
  "AI_TIMEOUT_MS",
  "N8N_WEBHOOK_URL",
  "N8N_WEBHOOK_SECRET",
  "N8N_CALLBACK_SECRET",
  "N8N_TIMEOUT_MS",
] as const;

export function envFilePath(): string {
  return resolve(tmpdir(), "bizpilot-e2e.env");
}

export default function globalSetup(): void {
  const lines: string[] = [];

  for (const key of ENV_KEYS) {
    const value = process.env[key];
    if (typeof value === "string" && value !== "") {
      lines.push(`${key}=${JSON.stringify(value)}`);
    }
  }

  writeFileSync(envFilePath(), `${lines.join("\n")}\n`, { mode: 0o600 });
}
