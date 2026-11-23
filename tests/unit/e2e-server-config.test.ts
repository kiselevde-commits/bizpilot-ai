import { describe, expect, it } from "vitest";
import { resolveE2eServerConfig, type E2eServerEnv } from "../helpers/e2e-server-config";

const TEST_URL = "postgresql://test_user:test_password@localhost:5432/bizpilot_test?schema=public";

function env(overrides: Partial<E2eServerEnv> = {}): E2eServerEnv {
  return { NODE_ENV: "test", TEST_DATABASE_URL: TEST_URL, ...overrides };
}

describe("E2E server configuration", () => {
  it("points the base URL and health URL at the Playwright-owned server", () => {
    const config = resolveE2eServerConfig(env());
    const health = new URL(config.healthURL);

    expect(config.baseURL).toBe("http://localhost:3000");
    expect(health.origin).toBe(config.baseURL);
    expect(health.pathname).toBe("/api/ai/health");
    expect(config.command).toBe("corepack pnpm dev --port 3000");
    expect(config.testDatabaseUrl).toBe(TEST_URL);
  });

  it("rejects a local E2E_BASE_URL so no external server can be selected", () => {
    expect(() => resolveE2eServerConfig(env({ E2E_BASE_URL: "http://localhost:3000" }))).toThrow(
      /E2E_BASE_URL is not supported/,
    );
  });

  it("rejects a remote E2E_BASE_URL", () => {
    expect(() =>
      resolveE2eServerConfig(env({ E2E_BASE_URL: "https://bizpilot.example.com" })),
    ).toThrow(/E2E_BASE_URL is not supported/);
  });

  it("rejects E2E_EXTERNAL_SERVER_ISOLATED even with a valid test database", () => {
    expect(() => resolveE2eServerConfig(env({ E2E_EXTERNAL_SERVER_ISOLATED: "true" }))).toThrow(
      /E2E_EXTERNAL_SERVER_ISOLATED is not supported/,
    );
  });

  it("requires TEST_DATABASE_URL", () => {
    expect(() => resolveE2eServerConfig(env({ TEST_DATABASE_URL: undefined }))).toThrow(
      /TEST_DATABASE_URL is required/,
    );
  });

  it("still refuses a non-test database", () => {
    const regular = "postgresql://test_user:test_password@localhost:5432/bizpilot?schema=public";

    expect(() => resolveE2eServerConfig(env({ TEST_DATABASE_URL: regular }))).toThrow(
      /explicit 'test' marker/,
    );
  });

  it("still refuses a remote database host", () => {
    const remote =
      "postgresql://test_user:test_password@db.example.com:5432/bizpilot_test?schema=public";

    expect(() => resolveE2eServerConfig(env({ TEST_DATABASE_URL: remote }))).toThrow(
      /only local or dedicated test-service hosts/,
    );
  });
});
