/**
 * Fail-closed E2E server configuration.
 *
 * E2E creates and mutates CRM records, so it may only talk to the web server
 * that Playwright itself starts with `DATABASE_URL=TEST_DATABASE_URL`. An
 * externally managed server cannot prove which database it is connected to, so
 * `E2E_BASE_URL` and `E2E_EXTERNAL_SERVER_ISOLATED` are rejected outright
 * instead of being trusted as an operator declaration.
 */
import { assertIsolatedTestDatabase } from "./test-database-guard";

export type E2eServerEnv = {
  E2E_BASE_URL?: string;
  E2E_EXTERNAL_SERVER_ISOLATED?: string;
  TEST_DATABASE_URL?: string;
  NODE_ENV?: string;
};

export type E2eServerConfig = {
  baseURL: string;
  healthURL: string;
  command: string;
  testDatabaseUrl: string;
};

const SERVER_PORT = 3000;

// A single source for both the browser base URL and the readiness probe, so
// they can never point at different servers.
const SERVER_ORIGIN = `http://localhost:${SERVER_PORT}`;
const HEALTH_PATH = "/api/ai/health";

function fail(message: string): never {
  throw new Error(`E2E isolation guard: ${message}`);
}

function isSet(value: string | undefined): boolean {
  return (value ?? "").trim() !== "";
}

export function resolveE2eServerConfig(env: E2eServerEnv = process.env): E2eServerConfig {
  if (isSet(env.E2E_BASE_URL)) {
    fail(
      "E2E_BASE_URL is not supported. E2E always starts its own web server with DATABASE_URL=TEST_DATABASE_URL; an external server cannot prove which database it uses.",
    );
  }

  if (isSet(env.E2E_EXTERNAL_SERVER_ISOLATED)) {
    fail(
      "E2E_EXTERNAL_SERVER_ISOLATED is not supported. External E2E servers are forbidden; remove the variable and let Playwright start its own server.",
    );
  }

  const testDatabaseUrl = env.TEST_DATABASE_URL?.trim();

  if (!testDatabaseUrl) {
    fail(
      "TEST_DATABASE_URL is required. Point it at a dedicated, seeded, test-marked database; E2E never falls back to the development .env database.",
    );
  }

  // The web server below is started with DATABASE_URL=TEST_DATABASE_URL, so the
  // pair is checked before any request reaches the app.
  assertIsolatedTestDatabase({
    DATABASE_URL: testDatabaseUrl,
    TEST_DATABASE_URL: testDatabaseUrl,
    NODE_ENV: env.NODE_ENV,
  });

  return {
    baseURL: SERVER_ORIGIN,
    healthURL: `${SERVER_ORIGIN}${HEALTH_PATH}`,
    command: `corepack pnpm dev --port ${SERVER_PORT}`,
    testDatabaseUrl,
  };
}
